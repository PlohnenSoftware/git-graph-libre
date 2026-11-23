//! The Statistics view's two reads: commits-per-author and the commit-activity heatmap.
//!
//! Both walk every commit reachable from `--all`'s real ref coverage (branches, tags,
//! remote-tracking, HEAD, the stash - `refs/stash` is a plain ref under `refs/`, so real
//! `git --all` walks it too, even though `log::all_tips` alone does not enumerate it - and the
//! HEADs of the other worktrees, see `log::every_tip`), excluding
//! merge commits, mirroring `git shortlog -sne --all --no-merges` and
//! `git log --all --format=%aI --no-merges` respectively - the CLI backend this engine path is
//! ported from, and which cross-backend tests assert stays in agreement with it.
//!
//! `shortlog` canonicalizes authors through the mailmap, so `author_stats` does too
//! ([`Mailmap`]): the working tree's `.mailmap` (or `HEAD:.mailmap` in a bare repository with
//! no `mailmap.blob` configured), then the blob named by `mailmap.blob`, then the file named
//! by `mailmap.file`, with later sources overriding earlier ones - the order and precedence
//! `git shortlog` applies, checked against it in `tests/stats.rs`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use gix::bstr::ByteSlice;

use crate::error::{Error, ErrorKind, Result, ResultExt};
use crate::file_read::{read_bounded, too_large, MAX_READ_BYTES};
use crate::log::every_tip;
use crate::repository::Repo;
use crate::text::{self, CommitText};
use crate::types::{GitActivityCell, GitAuthorStat};

/// Commit counts per author, across all refs, merge commits excluded, authors canonicalized
/// through the mailmap - what `git shortlog -sne --all --no-merges` aggregates into.
pub fn author_stats(repo: &Repo) -> Result<Vec<GitAuthorStat>> {
    let tips = every_tip(repo)?;
    let git = repo.borrow();
    text::ensure_utf8_output(&git)?;
    let mailmap = Mailmap::load(&git)?;

    let mut raw_counts: HashMap<(String, String), usize> = HashMap::new();
    for info in git
        .rev_walk(tips.iter().copied())
        .all()
        .git_ctx("Could not walk the commit graph")?
    {
        let info = match info {
            Ok(info) => info,
            Err(_) => break,
        };
        let Ok(commit) = git.find_commit(info.id) else {
            continue;
        };
        // --no-merges: a commit with more than one parent is excluded.
        if commit.parent_ids().count() > 1 {
            continue;
        }
        let Ok(author) = commit.author() else {
            continue;
        };
        // A commit this read cannot show as Git does fails the whole read, never one name.
        let text = CommitText::of(&commit)?;
        *raw_counts
            .entry((
                text.decode(author.name)?.into_owned(),
                text.decode(author.email)?.into_owned(),
            ))
            .or_insert(0) += 1;
    }

    // The mailmap is applied to the decoded identities Git prints (the repository prints
    // UTF-8, or `ensure_utf8_output` declined above), once per distinct author.
    let mut counts: HashMap<(String, String), usize> = HashMap::new();
    for ((name, email), commits) in raw_counts {
        *counts.entry(mailmap.apply(name, email)?).or_insert(0) += commits;
    }

    let mut stats: Vec<GitAuthorStat> = counts
        .into_iter()
        .map(|((name, email), commits)| GitAuthorStat {
            name,
            email,
            commits,
        })
        .collect();
    stats.sort_by(|a, b| b.commits.cmp(&a.commits).then_with(|| a.name.cmp(&b.name)));
    Ok(stats)
}

/* ---------- The mailmap, as `git shortlog` reads it ---------- */

/// One mailmap entry with owned fields: the canonical name and/or email that replace an
/// author matched by email, and by name too when `old_name` is set.
struct MailmapEntry {
    new_name: Option<Vec<u8>>,
    new_email: Option<Vec<u8>>,
    old_name: Option<Vec<u8>>,
    old_email: Vec<u8>,
}

/// The repository's mailmap entries, merged from every source in Git's order.
///
/// gix parses the sources and merges colliding entries (`gix::mailmap::Snapshot`), but its
/// resolve step also rewrites a matched email's letter case to the mailmap's spelling even
/// when the entry only renames the author. Git keeps the commit's email verbatim there, so
/// `BOB@example.com` and `bob@example.com` stay two shortlog rows under a name-only entry.
/// The lookup below therefore works from the snapshot's entries and replaces only the
/// fields an entry actually provides.
struct Mailmap(Vec<MailmapEntry>);

impl Mailmap {
    /// Load every mailmap source, in the order Git overrides them: the default `.mailmap`,
    /// then `mailmap.blob`, then `mailmap.file`.
    ///
    /// A source Git would skip with a warning - a missing file, an unresolvable blob spec, a
    /// symlinked working-tree `.mailmap` (Git opens it without following symlinks and reports
    /// an error), a malformed line - is skipped here too, so the counts still agree with
    /// shortlog's. What fails the read instead is a source above the engine's read ceiling
    /// ([`MAX_READ_BYTES`], answered as too large) and a *matched* entry whose canonical name
    /// or email is not UTF-8 ([`Mailmap::apply`]): the engine declines rather than guess at
    /// bytes shortlog would print raw.
    fn load(git: &gix::Repository) -> Result<Mailmap> {
        let config = git.config_snapshot();
        let blob_spec = config.string("mailmap.blob").map(|value| value.to_owned());
        let mut snapshot = gix::mailmap::Snapshot::default();

        match git.workdir() {
            Some(root) => {
                if let Some(data) = read_worktree_mailmap(root)? {
                    snapshot.merge(gix::mailmap::parse_ignore_errors(&data));
                }
            }
            // Bare: Git falls back to the committed `.mailmap` unless a blob is configured.
            None if blob_spec.is_none() => {
                if let Some(id) = head_mailmap_blob(git) {
                    if let Some(data) = read_mailmap_blob(git, id)? {
                        snapshot.merge(gix::mailmap::parse_ignore_errors(&data));
                    }
                }
            }
            None => {}
        }

        if let Some(spec) = &blob_spec {
            if let Ok(id) = git.rev_parse_single(spec.as_bstr()) {
                if let Some(data) = read_mailmap_blob(git, id.detach())? {
                    snapshot.merge(gix::mailmap::parse_ignore_errors(&data));
                }
            }
        }

        if let Some(path) = config.trusted_path("mailmap.file").ok().flatten() {
            let path = if path.is_relative() {
                mailmap_file_base(git).join(path)
            } else {
                path
            };
            if let Some(data) = read_mailmap_file(&path, true)? {
                snapshot.merge(gix::mailmap::parse_ignore_errors(&data));
            }
        }

        Ok(Mailmap(
            snapshot
                .entries()
                .into_iter()
                .map(|entry| MailmapEntry {
                    new_name: entry.new_name().map(|name| name.to_vec()),
                    new_email: entry.new_email().map(|email| email.to_vec()),
                    old_name: entry.old_name().map(|name| name.to_vec()),
                    old_email: entry.old_email().to_vec(),
                })
                .collect(),
        ))
    }

    /// The canonical identity for one decoded author: the name-and-email entry when one
    /// matches, else the email-only entry, else the author unchanged. Email and name
    /// comparisons ignore ASCII case, as Git's do; fields the entry does not provide keep
    /// the commit's spelling, letter case included.
    fn apply(&self, name: String, email: String) -> Result<(String, String)> {
        let mut by_email: Option<&MailmapEntry> = None;
        let mut by_name: Option<&MailmapEntry> = None;
        for entry in &self.0 {
            if !entry.old_email.eq_ignore_ascii_case(email.as_bytes()) {
                continue;
            }
            match &entry.old_name {
                None => by_email = Some(entry),
                Some(old_name) if old_name.eq_ignore_ascii_case(name.as_bytes()) => {
                    by_name = Some(entry)
                }
                Some(_) => {}
            }
        }
        let Some(entry) = by_name.or(by_email) else {
            return Ok((name, email));
        };
        let name = match &entry.new_name {
            Some(new_name) => mailmap_text(new_name, "name")?,
            None => name,
        };
        let email = match &entry.new_email {
            Some(new_email) => mailmap_text(new_email, "email")?,
            None => email,
        };
        Ok((name, email))
    }
}

/// A canonical name or email from a matched entry, which must be UTF-8: anything else is
/// bytes shortlog would print raw in a non-UTF-8 encoding, and this read only serves
/// repositories that print UTF-8.
fn mailmap_text(bytes: &[u8], what: &str) -> Result<String> {
    std::str::from_utf8(bytes)
        .map(str::to_owned)
        .map_err(|_| {
            Error::unsupported(format!(
                "The mailmap maps an author to a {what} that is not UTF-8"
            ))
        })
}

/// The working tree's `.mailmap`, read without following symlinks: Git refuses a symlinked
/// `.mailmap` and continues without it, so a symlink is skipped, not followed.
fn read_worktree_mailmap(root: &Path) -> Result<Option<Vec<u8>>> {
    read_mailmap_file(&root.join(".mailmap"), false)
}

/// Read one mailmap file under the read ceiling. A file that cannot be read is skipped, as
/// Git skips it with a warning; only a file above the ceiling fails the read.
fn read_mailmap_file(path: &Path, follow_symlinks: bool) -> Result<Option<Vec<u8>>> {
    if !follow_symlinks {
        if let Ok(metadata) = std::fs::symlink_metadata(path) {
            if metadata.file_type().is_symlink() {
                return Ok(None);
            }
        }
    }
    match read_bounded(path, MAX_READ_BYTES) {
        Ok(data) => Ok(Some(data)),
        Err(error) if error.kind == ErrorKind::TooLarge => Err(error),
        Err(_) => Ok(None),
    }
}

/// The `.mailmap` blob of the commit HEAD points at, for a bare repository.
fn head_mailmap_blob(git: &gix::Repository) -> Option<gix::ObjectId> {
    let mut head = git.head().ok()?;
    let commit = head.peel_to_commit().ok()?;
    let tree = commit.tree().ok()?;
    tree.find_entry(".mailmap").map(|entry| entry.object_id())
}

/// One blob's bytes under the read ceiling, or `None` when the object is missing or is not
/// a blob - the cases Git reports and then continues without.
fn read_mailmap_blob(git: &gix::Repository, id: gix::ObjectId) -> Result<Option<Vec<u8>>> {
    let Ok(header) = git.find_header(id) else {
        return Ok(None);
    };
    if header.kind() != gix::object::Kind::Blob {
        return Ok(None);
    }
    let size = header.size();
    if size > MAX_READ_BYTES {
        return Err(too_large(
            &format!("the mailmap blob is {size} bytes and"),
            MAX_READ_BYTES,
        ));
    }
    match git.find_object(id) {
        Ok(object) => Ok(Some(object.data.to_vec())),
        Err(_) => Ok(None),
    }
}

/// The directory a relative `mailmap.file` resolves against: Git runs at the working
/// tree's top level (a `shortlog` from a subdirectory still reads the top level's file),
/// or, for a bare repository, its git directory.
fn mailmap_file_base(git: &gix::Repository) -> PathBuf {
    let base = match git.workdir() {
        Some(root) => root.to_path_buf(),
        None => git.git_dir().to_path_buf(),
    };
    if base.is_relative() {
        git.current_dir().join(base)
    } else {
        base
    }
}

/// Commit activity binned by each commit's AUTHOR-LOCAL weekday/hour, across all refs, merge
/// commits excluded - what `git log --all --format=%aI --no-merges` is binned into.
///
/// Deliberately computed from the author date's local civil components (`seconds + offset`,
/// decomposed as if that sum were itself a UTC instant) rather than the true UTC instant alone -
/// the same rule the ported TypeScript/CLI implementation applies to `%aI`'s printed digits, so a
/// commit made at 11pm in the author's timezone bins as "night" regardless of what time it was
/// for whoever happens to be viewing the graph.
pub fn activity_heatmap(repo: &Repo) -> Result<Vec<GitActivityCell>> {
    let tips = every_tip(repo)?;
    let git = repo.borrow();

    let mut counts: HashMap<(u8, u8), usize> = HashMap::new();
    for info in git
        .rev_walk(tips.iter().copied())
        .all()
        .git_ctx("Could not walk the commit graph")?
    {
        let info = match info {
            Ok(info) => info,
            Err(_) => break,
        };
        let Ok(commit) = git.find_commit(info.id) else {
            continue;
        };
        if commit.parent_ids().count() > 1 {
            continue;
        }
        let Ok(author) = commit.author() else {
            continue;
        };
        let Ok(time) = author.time() else {
            continue;
        };

        let local_seconds = time.seconds + i64::from(time.offset);
        let days_since_epoch = local_seconds.div_euclid(86400);
        let hour = (local_seconds.rem_euclid(86400) / 3600) as u8;
        // 1970-01-01 (epoch day 0) was a Thursday (weekday 4 in the 0=Sunday scheme); +4 aligns
        // day 0 to weekday 4, and rem_euclid keeps the result in 0..7 for commits before 1970 too.
        let weekday = ((days_since_epoch + 4).rem_euclid(7)) as u8;

        *counts.entry((weekday, hour)).or_insert(0) += 1;
    }

    Ok(counts
        .into_iter()
        .map(|((weekday, hour), count)| GitActivityCell {
            weekday,
            hour,
            count,
        })
        .collect())
}
