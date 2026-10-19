//! Single-file reads: the content of a file at one revision or in the index.
//!
//! The Commit Details view lets the user open one file of a commit. The original extension
//! spawned `git show <hash>:<path>` for each click; here the answer comes from the tree walk the
//! engine already uses. The unified-diff export that used to live here was replaced by the
//! Phase 17 diff port (`git-graph-diff`).

use crate::error::{Error, Result, ResultExt};
use crate::repository::Repo;
use crate::types::CommitFile;

/// How far into a blob git looks before deciding it is binary: a NUL byte within the first 8000
/// bytes marks the blob binary, everything else is diffed as text.
const BINARY_SNIFF_LEN: usize = 8000;

/* ---------- File content at a revision ---------- */

/// Read one file of a commit's tree.
///
/// A file that is not valid UTF-8 cannot be handed to the webview as a string, so it is reported
/// as binary with `contents: None` — the view shows its "cannot display binary" presentation,
/// exactly as it does for the `git` backend's binary output.
pub fn commit_file(repo: &Repo, hash: &str, file_path: &str) -> Result<CommitFile> {
    // A replaced commit reads its file from the replacement's tree in git.
    repo.decline_replace_refs()?;
    let id = repo.resolve_commit(hash)?;
    let git = repo.borrow();
    let tree = git
        .find_commit(id)
        .git_ctx("Could not read the commit")?
        .tree()
        .git_ctx("Could not read the commit tree")?;

    let data = blob_at(&git, &tree, file_path)?
        .ok_or_else(|| Error::not_found(format!("'{file_path}' is not in commit {hash}")))?;

    // git's own notion of binary comes first: a NUL byte is valid UTF-8 but still not text a
    // user wants to read, so the sniff decides before the UTF-8 check does.
    if is_binary(&data) {
        return Ok(CommitFile {
            contents: None,
            binary: true,
        });
    }
    match String::from_utf8(data) {
        Ok(contents) => Ok(CommitFile {
            contents: Some(contents),
            binary: false,
        }),
        Err(_) => Ok(CommitFile {
            contents: None,
            binary: true,
        }),
    }
}

/* ---------- File content in the index ---------- */

/// Read one file's staged copy — what the index holds, between "Modified" and "Staged".
///
/// The same text/binary contract as [`commit_file`]: a blob that is binary or not valid UTF-8
/// comes back with `contents: None`.
pub fn index_file(repo: &Repo, file_path: &str) -> Result<CommitFile> {
    let git = repo.borrow();
    let index = git.index().git_ctx("Could not read the index")?;
    let entry = index
        .entry_by_path(file_path.as_bytes().into())
        .ok_or_else(|| Error::not_found(format!("'{file_path}' is not in the index")))?;

    let data = git
        .find_blob(entry.id)
        .git_ctx("Could not read the blob")?
        .data
        .to_vec();

    if is_binary(&data) {
        return Ok(CommitFile {
            contents: None,
            binary: true,
        });
    }
    match String::from_utf8(data) {
        Ok(contents) => Ok(CommitFile {
            contents: Some(contents),
            binary: false,
        }),
        Err(_) => Ok(CommitFile {
            contents: None,
            binary: true,
        }),
    }
}

/// Look a path up in a tree and return its blob data, or `None` when the tree has no such file.
///
/// A path that resolves to a subtree (a directory) is not a file and reads as absent, which is
/// also how `git show <rev>:<dir>` fails.
fn blob_at(git: &gix::Repository, tree: &gix::Tree<'_>, path: &str) -> Result<Option<Vec<u8>>> {
    let entry = tree
        .lookup_entry(path.split('/'))
        .git_ctx("Could not look up the path in the tree")?;
    match entry {
        Some(entry) if entry.mode().is_blob() => {
            let data = git
                .find_blob(entry.id())
                .git_ctx("Could not read the blob")?
                .data
                .to_vec();
            Ok(Some(data))
        }
        _ => Ok(None),
    }
}

/// git's binary heuristic: a NUL byte early in the blob marks it binary.
fn is_binary(data: &[u8]) -> bool {
    data[..data.len().min(BINARY_SNIFF_LEN)].contains(&0)
}
