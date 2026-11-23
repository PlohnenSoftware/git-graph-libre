//! One ref's reflog, read in process the way `git log -g` reports it.
//!
//! The entries come from the reference store's forward log iterator, oldest
//! first. Git numbers them from the newest end of the whole file
//! (`<ref>@{N}`), and its log walk leaves some counted entries out: an entry
//! whose new value is the null id (a ref deletion recorded inside the `HEAD`
//! log by a branch rename, say) keeps its number but is never shown. The
//! index of every shown entry is therefore its position counted from the end
//! of the full file, gaps included, while paging counts only shown entries.
//!
//! Git is the authority, so this module answers only what it can phrase
//! exactly as the CLI query does. Anything else is `Unsupported` and the
//! caller reads with the CLI instead: a line gix cannot parse (Git silently
//! skips those, with its own idea of what counts), an entry pointing at a
//! missing or non-commit object (Git counts it but does not show it, and a
//! tag object even suppresses the whole listing), a symbolic ref other than
//! `HEAD` (Git resolves it before choosing a log), replace refs, non-UTF-8
//! identity or message text, and a missing or empty `HEAD` log. That last
//! one is Git's own fallback: with no `logs/HEAD` entries, `git log -g HEAD`
//! on a branch reads the branch's reflog instead, under `HEAD@{N}` selectors.
//! This module only reads: reflog writes stay on the CLI.

use std::collections::HashSet;

use crate::error::{Error, Result};
use crate::repository::Repo;

/// One shown reflog entry, in the fields the CLI query carries.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    /// The commit the ref pointed at after the move.
    pub hash: String,
    /// The `N` of `<ref>@{N}`, over the whole file, counted entries included.
    pub index: usize,
    /// When the entry was written, in Unix seconds. Not the commit's date.
    pub time: i64,
    /// Who made the entry (the committer identity Git used at the time).
    pub name: String,
    pub email: String,
    /// The message exactly as Git wrote it.
    pub message: String,
}

/// What a reflog holds, as the CLI query tells the three cases apart.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ReflogState {
    /// The reflog has shown entries (this page may still lie past its end).
    Entries,
    /// A reflog file exists but no entry is shown.
    Empty,
    /// The ref keeps no reflog.
    None,
}

/// One page of a reflog, newest first.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogPage {
    pub entries: Vec<ReflogEntry>,
    pub state: ReflogState,
    /// True when older shown entries exist beyond this page.
    pub has_more: bool,
    /// The ref's full name, such as `refs/heads/main`, or `HEAD`.
    #[serde(rename = "ref")]
    pub ref_name: String,
}

/// Why this module cannot answer exactly as Git would.
fn decline(why: impl std::fmt::Display) -> Error {
    Error::unsupported(format!("reflog: {why}"))
}

/// A counted entry: every line gix could parse, shown or not.
struct Counted {
    new_oid: gix::ObjectId,
    time: i64,
    name: Vec<u8>,
    email: Vec<u8>,
    message: Vec<u8>,
}

/// Read one page of `requested`'s reflog: `limit` shown entries after
/// skipping `offset` shown ones, newest first.
pub fn read_reflog(
    repo: &Repo,
    requested: &str,
    limit: usize,
    offset: usize,
) -> Result<ReflogPage> {
    if requested.is_empty() || requested.starts_with('-') {
        return Err(decline("not a ref name the engine resolves"));
    }
    let git = repo.borrow();
    if has_replace_refs(&git)? {
        return Err(decline("the repository has replace refs"));
    }
    let (full, reference) = resolve(&git, requested)?;
    if full == "HEAD" {
        if let Some(page) = unborn_head_page(&git)? {
            return Ok(page);
        }
    }
    let counted = match read_counted(&reference)? {
        Some(counted) => counted,
        // No reflog file. For `HEAD` Git may fall back to the branch log, so
        // only a plain ref's `none` is the engine's to answer.
        None if full == "HEAD" => return Err(decline("no HEAD reflog file")),
        None => {
            return Ok(ReflogPage {
                entries: Vec::new(),
                state: ReflogState::None,
                has_more: false,
                ref_name: full,
            })
        }
    };
    if counted.is_empty() {
        // An empty `HEAD` file leaves Git's branch fallback open, as above.
        if full == "HEAD" {
            return Err(decline("an empty HEAD reflog file"));
        }
        return Ok(ReflogPage {
            entries: Vec::new(),
            state: ReflogState::Empty,
            has_more: false,
            ref_name: full,
        });
    }
    let visible = visible_entries(&git, &counted)?;
    if visible.is_empty() {
        if full == "HEAD" {
            return Err(decline("no shown HEAD reflog entries"));
        }
        return Ok(ReflogPage {
            entries: Vec::new(),
            state: ReflogState::Empty,
            has_more: false,
            ref_name: full,
        });
    }
    let total = visible.len();
    let start = offset.min(total);
    let end = offset.saturating_add(limit).min(total).max(start);
    let mut entries = Vec::with_capacity(end - start);
    for (entry, index) in &visible[start..end] {
        entries.push(ReflogEntry {
            hash: entry.new_oid.to_string(),
            index: *index,
            time: entry.time,
            name: text(&entry.name)?,
            email: text(&entry.email)?,
            message: text(&entry.message)?,
        });
    }
    Ok(ReflogPage {
        entries,
        state: ReflogState::Entries,
        has_more: end < total,
        ref_name: full,
    })
}

/// The CLI's unborn-`HEAD` answer, when `HEAD` resolves to no commit because
/// the branch it names does not exist yet. Declines on any other shape.
fn unborn_head_page(git: &gix::Repository) -> Result<Option<ReflogPage>> {
    match git.head_id() {
        Ok(id) => {
            let id = id.detach();
            match git.find_object(id) {
                Ok(object) if object.kind == gix::object::Kind::Commit => Ok(None),
                _ => Err(decline("HEAD does not resolve to a stored commit")),
            }
        }
        Err(_) => {
            let head = git
                .find_reference("HEAD")
                .map_err(|e| decline(format!("HEAD: {e}")))?;
            let gix::refs::TargetRef::Symbolic(target) = head.target() else {
                return Err(decline("a detached HEAD resolves to no commit"));
            };
            let target = target.as_bstr().to_string();
            match git.try_find_reference(target.as_str()) {
                Ok(None) => Ok(Some(ReflogPage {
                    entries: Vec::new(),
                    state: ReflogState::None,
                    has_more: false,
                    ref_name: "HEAD".to_string(),
                })),
                Ok(Some(_)) => Err(decline("HEAD resolves to no commit")),
                Err(e) => Err(decline(format!("{target}: {e}"))),
            }
        }
    }
}

/// Resolve the requested name the way `rev-parse --symbolic-full-name` does
/// for the names this read serves. `HEAD` stays `HEAD`; anything symbolic,
/// unknown, or outside `refs/` declines so the CLI resolves it.
fn resolve<'a>(git: &'a gix::Repository, requested: &str) -> Result<(String, gix::Reference<'a>)> {
    if requested == "HEAD" {
        let reference = git
            .find_reference("HEAD")
            .map_err(|e| decline(format!("HEAD: {e}")))?;
        return Ok(("HEAD".to_string(), reference));
    }
    for candidate in candidates(requested) {
        let found = git
            .try_find_reference(candidate.as_str())
            .map_err(|e| decline(format!("{candidate}: {e}")))?;
        let Some(reference) = found else { continue };
        if matches!(reference.target(), gix::refs::TargetRef::Symbolic(_)) {
            return Err(decline(format!("{candidate} is a symbolic ref")));
        }
        return Ok((candidate, reference));
    }
    Err(decline(format!(
        "\"{requested}\" resolves to no reference here"
    )))
}

/// Git's ref lookup order for a short name, as full names only.
fn candidates(requested: &str) -> Vec<String> {
    let mut list: Vec<String> = Vec::new();
    if requested.starts_with("refs/") {
        list.push(requested.to_string());
    }
    for full in [
        format!("refs/{requested}"),
        format!("refs/tags/{requested}"),
        format!("refs/heads/{requested}"),
        format!("refs/remotes/{requested}"),
        format!("refs/remotes/{requested}/HEAD"),
    ] {
        if !list.contains(&full) {
            list.push(full);
        }
    }
    list
}

/// Every parsed line of the ref's reflog file, oldest first, or `None` when
/// there is no file. One line gix cannot parse declines the whole read.
fn read_counted(reference: &gix::Reference<'_>) -> Result<Option<Vec<Counted>>> {
    let mut platform = reference.log_iter();
    let Some(lines) = platform
        .all()
        .map_err(|e| decline(format!("could not read the reflog file: {e}")))?
    else {
        return Ok(None);
    };
    let mut counted = Vec::new();
    for line in lines {
        let line = line.map_err(|e| decline(format!("a reflog line does not parse: {e}")))?;
        let time = line
            .signature
            .time()
            .map_err(|e| decline(format!("a reflog time does not parse: {e}")))?;
        counted.push(Counted {
            new_oid: line.new_oid(),
            time: time.seconds,
            name: line.signature.name.to_vec(),
            email: line.signature.email.to_vec(),
            message: line.message.to_vec(),
        });
    }
    Ok(Some(counted))
}

/// The entries `git log -g` shows, newest first, each with its selector
/// index over the whole file. A missing or non-commit target declines.
fn visible_entries<'a>(
    git: &gix::Repository,
    counted: &'a [Counted],
) -> Result<Vec<(&'a Counted, usize)>> {
    let total = counted.len();
    let mut checked: HashSet<gix::ObjectId> = HashSet::new();
    let mut visible: Vec<(&Counted, usize)> = Vec::new();
    for (position, entry) in counted.iter().enumerate() {
        if entry.new_oid.is_null() {
            continue;
        }
        if checked.insert(entry.new_oid) {
            match git.find_object(entry.new_oid) {
                Ok(object) if object.kind == gix::object::Kind::Commit => {}
                Ok(_) => {
                    return Err(decline("a reflog entry points at a non-commit object"));
                }
                Err(_) => {
                    return Err(decline("a reflog entry points at a missing object"));
                }
            }
        }
        visible.push((entry, total - 1 - position));
    }
    visible.reverse();
    Ok(visible)
}

fn has_replace_refs(git: &gix::Repository) -> Result<bool> {
    let platform = git
        .references()
        .map_err(|e| decline(format!("could not read references: {e}")))?;
    let mut iter = platform
        .prefixed("refs/replace/")
        .map_err(|e| decline(format!("could not read replace refs: {e}")))?;
    match iter.next() {
        None => Ok(false),
        Some(Ok(_)) => Ok(true),
        Some(Err(e)) => Err(decline(format!("could not read replace refs: {e}"))),
    }
}

/// Identity and message text exactly as written. Non-UTF-8 declines rather
/// than guessing at the replacement the CLI's decoding would produce.
fn text(bytes: &[u8]) -> Result<String> {
    std::str::from_utf8(bytes)
        .map(str::to_string)
        .map_err(|_| decline("reflog text is not UTF-8"))
}
