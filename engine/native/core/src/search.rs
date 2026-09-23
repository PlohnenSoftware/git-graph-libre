//! The Find dialogue's commit search, reproducing what the `git` CLI backend does.
//!
//! This is deliberately *not* the engine's original `log::search_history`, which matched a regular
//! expression against commit messages across every ref. This project's search is a different
//! question, and wiring the regex one would have changed what users see, so it was removed instead:
//!
//! | | this search | `log::search_history` (removed) |
//! | --- | --- | --- |
//! | message match | literal substring, case-insensitive | regular expression |
//! | author match | yes, literal substring | no |
//! | hash match | yes, abbreviated hashes resolve | no |
//! | refs searched | the ones the view is showing | every ref, always |
//! | author filter | honoured | ignored |
//! | ordering | position in the graph's own walk | commit date, newest first |
//!
//! The CLI reaches the answer with four `git log` invocations run together — a literal
//! `--fixed-strings --grep`, an `--author`, a hash lookup, and one unbounded walk that numbers
//! every commit. That numbering is the `loadCount` each result carries: "how far into the graph
//! you would have to load to reach this commit". Everything here is one walk instead of four
//! processes, producing the same three match sets and the same numbering.

use std::collections::HashMap;

use crate::error::{Result, ResultExt};
use crate::log;
use crate::refs::read_refs;
use crate::repository::Repo;
use crate::types::{GitSearchResult, RefReadOptions, SearchOptions};

/// A query that could be an abbreviated object id. Mirrors the CLI's `/^[0-9a-f]{4,40}$/i`, which
/// is what decides whether the hash lookup runs at all.
fn is_hash_like(query: &str) -> bool {
    let length = query.len();
    (4..=40).contains(&length) && query.chars().all(|c| c.is_ascii_hexdigit())
}

/// The tips the search walks, which are the refs the *view is showing* rather than everything.
///
/// The CLI builds these as `--branches`, plus `--tags` and `--remotes` when those are shown, with
/// hidden remotes excluded. Two absences are deliberate and both are the CLI's: `HEAD` is not a
/// tip, so a detached HEAD's own commits are not searched, and neither is the stash.
fn search_tips(repo: &Repo, options: &SearchOptions) -> Result<Vec<gix::ObjectId>> {
    // An explicit selection (branches and/or tags chosen in the dropdowns) replaces the lot, which
    // is what the CLI's `refArgs` does when it has any selected refs.
    if let Some(branches) = &options.branches {
        return log::resolve_tips(repo, branches);
    }

    let ref_options = RefReadOptions {
        show_remote_branches: options.show_remote_branches,
        // `--remotes` lists non-symbolic remote refs; a symbolic `origin/HEAD` aliases a branch
        // that is already a tip in its own right, so including it would only duplicate work.
        show_remote_heads: false,
        hide_remotes: options.hide_remotes.clone(),
    };
    let snapshot = read_refs(repo, &ref_options)?;

    let mut revisions: Vec<String> = Vec::new();
    revisions.extend(snapshot.ref_data.heads.iter().map(|head| head.hash.clone()));
    if options.show_tags {
        revisions.extend(snapshot.ref_data.tags.iter().map(|tag| tag.hash.clone()));
    }
    if options.show_remote_branches {
        revisions.extend(
            snapshot
                .ref_data
                .remotes
                .iter()
                .map(|remote| remote.hash.clone()),
        );
    }
    log::resolve_tips(repo, &revisions)
}

/// Does this commit's author line contain the query?
///
/// ### Deviation
///
/// git's `--author` matches the whole `author Name <email> <timestamp> <tz>` header, so a query of
/// bare digits can match a commit's timestamp there and not here. Matching the rendered timestamp
/// would mean reproducing git's date formatting exactly, which is a larger risk than the case it
/// covers: this matches `Name <email>`, which is every realistic author query.
fn author_contains(author: &gix::actor::SignatureRef<'_>, needle_lower: &str) -> bool {
    let haystack = format!("{} <{}>", author.name, author.email).to_lowercase();
    haystack.contains(needle_lower)
}

/// One commit rendered into the result shape, at the position the walk gave it.
fn to_result(
    commit: &gix::Commit<'_>,
    load_count: u32,
    use_author_date: bool,
) -> Result<GitSearchResult> {
    let author = commit
        .author()
        .git_ctx("Could not decode the commit author")?;
    let date = if use_author_date {
        author.time().map(|time| time.seconds).unwrap_or(0)
    } else {
        commit
            .committer()
            .git_ctx("Could not decode the commit committer")?
            .time()
            .map(|time| time.seconds)
            .unwrap_or(0)
    };
    Ok(GitSearchResult {
        hash: commit.id().detach().to_string(),
        parents: commit
            .parent_ids()
            .map(|id| id.detach().to_string())
            .collect(),
        author: author.name.to_string(),
        email: author.email.to_string(),
        date,
        // The subject alone, which is what `%s` prints and what the dialogue lists. The match above
        // ran against the whole message, exactly as `--grep` does.
        message: commit
            .message()
            .git_ctx("Could not decode the commit message")?
            .summary()
            .to_string(),
        load_count,
    })
}

/// Search the commits the view is showing, as the `git` CLI backend searches them.
pub fn search_commits(repo: &Repo, options: &SearchOptions) -> Result<Vec<GitSearchResult>> {
    let query = options.query.trim();
    if query.is_empty() || options.max_results == 0 {
        return Ok(Vec::new());
    }
    let needle = query.to_lowercase();
    let limit = options.max_results as usize;

    let tips = search_tips(repo, options)?;
    if tips.is_empty() {
        return Ok(Vec::new());
    }

    let git = repo.borrow();
    let walk = git
        .rev_walk(tips.iter().copied())
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .git_ctx("Could not walk the commit graph")?;

    // The three match sets the CLI produces with three separate `git log` runs. Each is capped at
    // `max_results` on its own, because each of the CLI's runs carries its own `--max-count`; the
    // merge below then re-slices the union.
    let mut message_hits: Vec<GitSearchResult> = Vec::new();
    let mut author_hits: Vec<GitSearchResult> = Vec::new();
    let mut positions: HashMap<String, u32> = HashMap::new();
    let mut position = 0u32;

    for info in walk {
        let info = match info {
            // A missing object truncates the search rather than failing it, as it truncates the
            // graph walk.
            Err(_) => break,
            Ok(info) => info,
        };
        let commit = match git.find_commit(info.id) {
            Ok(commit) => commit,
            Err(_) => continue,
        };

        // The author filter applies to the numbering walk as well as to the matches, because the
        // CLI passes `--author` to its positions run too. A commit it hides is not merely
        // unmatched, it has no position at all, and an otherwise-matching commit without a
        // position is dropped by the merge.
        if let Some(authors) = &options.authors {
            if !log::commit_matches_author(&commit, authors)? {
                continue;
            }
        }

        let hash = commit.id().detach().to_string();
        position += 1;
        positions.entry(hash).or_insert(position);
        let load_count = position;

        let full_message_matches = message_hits.len() < limit
            && commit
                .message_raw()
                .git_ctx("Could not decode the commit message")?
                .to_string()
                .to_lowercase()
                .contains(&needle);
        if full_message_matches {
            message_hits.push(to_result(&commit, load_count, options.use_author_date)?);
        }

        if author_hits.len() < limit {
            let author = commit
                .author()
                .git_ctx("Could not decode the commit author")?;
            if author_contains(&author, &needle) {
                author_hits.push(to_result(&commit, load_count, options.use_author_date)?);
            }
        }
    }

    // The hash lookup, which the CLI runs without any ref or author constraint and then discards
    // if the commit turns out to have no position — so an unreachable or filtered-out commit is
    // not a result even when its hash is typed in full.
    let mut results: Vec<GitSearchResult> = Vec::new();
    if is_hash_like(query) {
        if let Some(found) = git
            .rev_parse_single(format!("{query}^{{commit}}").as_str())
            .ok()
            .and_then(|id| git.find_commit(id).ok())
        {
            let hash = found.id().detach().to_string();
            if let Some(&load_count) = positions.get(&hash) {
                results.push(to_result(&found, load_count, options.use_author_date)?);
            }
        }
    }

    // Merge in the CLI's order — hash, then message, then author — keeping the first record of any
    // commit, then order the union by position and cut it to the page.
    results.extend(message_hits);
    results.extend(author_hits);
    let mut seen: Vec<String> = Vec::with_capacity(results.len());
    results.retain(|result| {
        if seen.contains(&result.hash) {
            return false;
        }
        seen.push(result.hash.clone());
        true
    });
    results.sort_by_key(|result| result.load_count);
    results.truncate(limit);
    Ok(results)
}
