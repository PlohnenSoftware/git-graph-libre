//! Bounded reads of working-tree files.
//!
//! Every single-file read the engine serves (a blob at a revision, a staged blob, a file on disk)
//! shares one ceiling, [`MAX_READ_BYTES`], so one multi-gigabyte file never materializes whole in
//! the extension host. The ceiling matches the 64 MiB `maxBuffer` of the CLI route in the GGL Diff
//! tab. A blob is checked from its object header before any data is decoded (see `blob.rs`); a
//! file on disk is bounded by the read itself, because its size can change between a metadata
//! call and the read.

use std::io::Read;
use std::path::{Component, Path, PathBuf};

use crate::error::{Error, ErrorKind, Result};
use crate::repository::Repo;
use crate::types::CommitFile;

/// The size a single file read refuses to exceed: 64 MiB, the CLI route's `maxBuffer`.
pub const MAX_READ_BYTES: u64 = 64 * 1024 * 1024;

/// The error for content above `limit` bytes. `what` names the thing that was too large.
pub(crate) fn too_large(what: &str, limit: u64) -> Error {
    Error::too_large(format!(
        "{what} is above the {limit} byte limit of a single file read"
    ))
}

/// Read `reader` to its end, refusing more than `limit` bytes.
///
/// At most `limit + 1` bytes are ever pulled from the reader, so a source that grows while it is
/// being read is still bounded, and a source of exactly `limit` bytes is accepted.
pub fn read_bounded_from(reader: impl Read, limit: u64) -> Result<Vec<u8>> {
    let mut data = Vec::new();
    reader
        .take(limit.saturating_add(1))
        .read_to_end(&mut data)?;
    if data.len() as u64 > limit {
        return Err(too_large("the file", limit));
    }
    Ok(data)
}

/// Read the file at `path`, refusing more than `limit` bytes.
///
/// The metadata check only avoids opening a file that is already too large; the bound that
/// holds is the one on the read itself.
pub fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>> {
    let file = std::fs::File::open(path)?;
    if file.metadata()?.len() > limit {
        return Err(too_large("the file", limit));
    }
    read_bounded_from(file, limit)
}

/// The on-disk path of a repository-relative `file_path`.
///
/// This is a lexical check only: it refuses absolute paths, drive prefixes and `..` components,
/// which `Path::join` would otherwise follow out of the root. It does NOT prevent a symlink
/// inside the working tree from pointing outside it; reading through such a link is not blocked.
fn working_tree_path(root: &Path, file_path: &str) -> Result<PathBuf> {
    let relative = Path::new(file_path);
    let lexically_inside = relative
        .components()
        .all(|component| matches!(component, Component::Normal(_) | Component::CurDir));
    if file_path.is_empty() || !lexically_inside {
        return Err(Error::invalid_argument(format!(
            "'{file_path}' is not a path inside the working tree"
        )));
    }
    Ok(root.join(relative))
}

/// Read one file from the working tree under the same text/binary contract as
/// `blob::commit_file`, bounded by [`MAX_READ_BYTES`].
pub fn working_tree_file(repo: &Repo, file_path: &str) -> Result<CommitFile> {
    working_tree_file_limited(repo, file_path, MAX_READ_BYTES)
}

/// [`working_tree_file`] with an explicit limit, so tests can use a tiny one.
pub fn working_tree_file_limited(repo: &Repo, file_path: &str, limit: u64) -> Result<CommitFile> {
    let path = working_tree_path(repo.root(), file_path)?;
    match read_bounded(&path, limit) {
        Ok(data) => Ok(crate::blob::text_or_binary(data)),
        Err(error) if error.kind == ErrorKind::Io => Err(Error::new(
            ErrorKind::Io,
            format!("{file_path}: {}", error.message),
        )),
        Err(error) => Err(error),
    }
}
