//! Tree diffing: the file lists behind the Commit Details and Commit Comparison views.
//!
//! The original extension ran two `git diff` processes per commit — one for `--name-status` and
//! one for `--numstat` — and merged their output by path. Here the file *statuses* come from a
//! single tree walk, which is cheap; the per-file line counts are the expensive part (each one
//! reads and inflates two blobs) and are therefore answered separately, for a subset of paths,
//! by [`line_counts`] — so a commit touching ten thousand files renders its file list immediately
//! and fills the `+N/-M` counts in as they are computed.

use std::collections::{BTreeMap, HashSet};

use bstr::ByteSlice;

use crate::error::{Error, Result, ResultExt};
use crate::repository::Repo;
use crate::types::{GitFileChange, GitFileStatus, GitLineCounts, GitStatusFiles, UNCOMMITTED};

/// The similarity below which two files are no longer considered a rename. Matches git's default
/// (`-M50%`), so the rename detection the view shows agrees with the command line.
const RENAME_SIMILARITY: f32 = 0.5;

/// Diff two revisions.
///
/// `to` may be [`UNCOMMITTED`] or empty, which compares `from` against the working tree, as
/// `git diff <from>` does.
pub fn diff_revisions(repo: &Repo, from: &str, to: &str) -> Result<Vec<GitFileChange>> {
    // Either revision may be replaced, and with it the tree being compared.
    repo.decline_replace_refs()?;
    if to.is_empty() || to == UNCOMMITTED {
        return diff_against_worktree(repo, from);
    }
    let from_id = repo.resolve_commit(from)?;
    let to_id = repo.resolve_commit(to)?;
    diff_commits(repo, Some(from_id), to_id)
}

/// Where a file has been renamed to between a commit and the working tree, or `None` when it has
/// not been renamed (or no longer exists).
///
/// This backs the code-review view's file tracking: when the reviewed file was renamed since the
/// revision under review, the review follows it to its new path rather than losing it.
///
/// A rename is recognised by the paths alone, rather than by the change's status: a file that was
/// renamed *and then modified in the working tree* is layered into a modification record by the
/// worktree overlay, but it still carries the pre-rename path on its old side — which is exactly
/// the rename this question asks about.
pub fn new_path_of_renamed_file(
    repo: &Repo,
    commit_hash: &str,
    old_file_path: &str,
) -> Result<Option<String>> {
    let changes = diff_revisions(repo, commit_hash, "")?;
    Ok(changes.into_iter().find_map(|change| {
        (change.old_file_path == old_file_path && change.new_file_path != old_file_path)
            .then_some(change.new_file_path)
    }))
}

/// The file changes a commit introduced, compared against its first parent.
///
/// A root commit is compared against the empty tree, which is how the commit that created a
/// repository shows its files as added rather than showing nothing at all. So is a shallow clone's
/// boundary commit, whose parent was never fetched — exactly as `git show` treats it.
pub fn diff_commit(repo: &Repo, hash: &str) -> Result<Vec<GitFileChange>> {
    let id = repo.resolve_commit(hash)?;
    let git = repo.borrow();
    let commit = git.find_commit(id).git_ctx("Could not read the commit")?;
    let parent = crate::repository::Shallow::of(&git)
        .parents(&commit)
        .first()
        .copied();
    diff_commits(repo, parent, id)
}

/// Diff the trees of two commits, `from` being `None` for the empty tree.
pub fn diff_commits(
    repo: &Repo,
    from: Option<gix::ObjectId>,
    to: gix::ObjectId,
) -> Result<Vec<GitFileChange>> {
    let git = repo.borrow();
    let to_tree = git
        .find_commit(to)
        .git_ctx("Could not read the commit")?
        .tree()
        .git_ctx("Could not read the commit tree")?;
    let from_tree = match from {
        Some(from) => git
            .find_commit(from)
            .git_ctx("Could not read the parent commit")?
            .tree()
            .git_ctx("Could not read the parent tree")?,
        None => git.empty_tree(),
    };

    collect_changes(&from_tree, &to_tree)
}

/// Compare a revision against the working tree, as `git diff <revision>` does.
///
/// The tracked changes come from a tree diff, and the untracked and deleted files are layered on
/// top from the working-tree scan — the same two sources the original extension combined, because
/// neither alone describes an uncommitted state completely.
///
/// ### Deviation
///
/// No line counts are reported for a comparison against the working tree: files modified but not
/// staged could only be counted by hashing the worktree file, and a count that is exact for part
/// of the list and missing for the rest reads worse than none at all.
fn diff_against_worktree(repo: &Repo, from: &str) -> Result<Vec<GitFileChange>> {
    let from_id = repo.resolve_commit(from)?;
    let head = repo.resolve_commit("HEAD").ok();

    // Everything committed between the revision and HEAD is a plain tree diff, with exact counts.
    let mut changes = match head {
        Some(head) if head != from_id => diff_commits(repo, Some(from_id), head)?,
        _ => Vec::new(),
    };

    // Everything uncommitted on top of HEAD is only visible to the working-tree scan.
    for change in crate::status::uncommitted_changes(repo)? {
        match changes
            .iter_mut()
            .find(|existing| existing.new_file_path == change.new_file_path)
        {
            // The file already differs from the revision; the worktree state decides how it reads
            // now, and the counts no longer describe the whole difference.
            Some(existing) => {
                existing.kind = change.kind;
                existing.additions = None;
                existing.deletions = None;
            }
            None => changes.push(change),
        }
    }

    Ok(changes)
}

/// Layer the untracked and deleted files of the working tree onto a diff.
///
/// A file deleted in the working tree but still in the index shows as deleted rather than
/// unchanged, and untracked files are appended — neither is visible to a tree-to-tree diff.
pub fn apply_worktree_status(changes: &mut Vec<GitFileChange>, status: &GitStatusFiles) {
    for path in &status.deleted {
        match changes
            .iter_mut()
            .find(|change| &change.new_file_path == path)
        {
            Some(change) => change.kind = GitFileStatus::Deleted,
            None => changes.push(GitFileChange {
                old_file_path: path.clone(),
                new_file_path: path.clone(),
                kind: GitFileStatus::Deleted,
                additions: None,
                deletions: None,
            }),
        }
    }
    for path in &status.untracked {
        changes.push(GitFileChange {
            old_file_path: path.clone(),
            new_file_path: path.clone(),
            kind: GitFileStatus::Untracked,
            additions: None,
            deletions: None,
        });
    }
}

/// Run one tree diff and turn every change into the record the view renders — statuses only.
///
/// No blob is read here, which is what lets a many-file commit appear instantly. The line counts
/// that the view shows next to modified and renamed files arrive later, through [`line_counts`].
fn collect_changes(
    from_tree: &gix::Tree<'_>,
    to_tree: &gix::Tree<'_>,
) -> Result<Vec<GitFileChange>> {
    let mut changes = from_tree.changes().git_ctx("Could not diff the trees")?;
    changes.options(|options| {
        options.track_rewrites(Some(gix::diff::Rewrites {
            copies: None,
            percentage: Some(RENAME_SIMILARITY),
            track_empty: true,
            ..Default::default()
        }));
    });

    let mut collected: Vec<GitFileChange> = Vec::new();
    let outcome = changes.for_each_to_obtain_tree(to_tree, |change| {
        if let Some(record) = classify(&change) {
            collected.push(record);
        }
        Ok(std::ops::ControlFlow::Continue(()))
    });
    outcome.map_err(|e| Error::git(format!("Could not diff the trees: {e}")))?;

    Ok(collected)
}

/// The `+N/-M` line counts of the given paths between two revisions, keyed by the path.
///
/// `from` is `None` to diff `to` against its first parent — the Commit Details view of a plain
/// commit — or a revision, for the Commit Comparison view and a stash's base. Binary files map to
/// an entry whose counts are `None`, exactly as `git diff --numstat` prints a dash for them.
///
/// The tree is walked again here (walking is cheap; it is the blob reads that cost), and only the
/// requested paths are counted, so the caller can settle a viewport's worth of rows in a few
/// milliseconds no matter how large the commit is.
pub fn line_counts(
    repo: &Repo,
    from: Option<&str>,
    to: &str,
    paths: &[String],
) -> Result<BTreeMap<String, GitLineCounts>> {
    if paths.is_empty() {
        return Ok(BTreeMap::new());
    }

    let wanted: HashSet<&str> = paths.iter().map(String::as_str).collect();
    let to_id = repo.resolve_commit(to)?;
    let git = repo.borrow();
    let to_tree = git
        .find_commit(to_id)
        .git_ctx("Could not read the commit")?
        .tree()
        .git_ctx("Could not read the commit tree")?;

    let from_tree = match from {
        Some(rev) => {
            let from_id = repo.resolve_commit(rev)?;
            git.find_commit(from_id)
                .git_ctx("Could not read the parent commit")?
                .tree()
                .git_ctx("Could not read the parent tree")?
        }
        // `None` is the commit's first parent — or the empty tree for a root commit (or a shallow
        // boundary commit), so that its files report as added rather than as unaccounted for.
        None => match crate::repository::Shallow::of(&git)
            .parents(
                &git.find_commit(to_id)
                    .git_ctx("Could not read the commit")?,
            )
            .first()
            .copied()
        {
            Some(parent) => git
                .find_commit(parent)
                .git_ctx("Could not read the parent commit")?
                .tree()
                .git_ctx("Could not read the parent tree")?,
            None => git.empty_tree(),
        },
    };

    let mut changes = from_tree.changes().git_ctx("Could not diff the trees")?;
    changes.options(|options| {
        options.track_rewrites(Some(gix::diff::Rewrites {
            copies: None,
            percentage: Some(RENAME_SIMILARITY),
            track_empty: true,
            ..Default::default()
        }));
    });

    // The resource cache holds the blob data the line counting reads, and is reused across every
    // file of the diff rather than being rebuilt per file.
    let mut cache = git
        .diff_resource_cache_for_tree_diff()
        .git_ctx("Could not prepare the diff")?;

    let mut counted: BTreeMap<String, GitLineCounts> = BTreeMap::new();
    let outcome = changes.for_each_to_obtain_tree(&to_tree, |change| {
        // `classify` holds the definition of a path the view lists as a file — in particular it
        // drops the directory-level tree rewrites, which must never settle a folder path here
        // even if one is asked for.
        if classify(&change).is_none() {
            return Ok(std::ops::ControlFlow::Continue(()));
        }
        if !wanted.contains(change.location().to_str_lossy().as_ref()) {
            return Ok(std::ops::ControlFlow::Continue(()));
        }
        let lines = if let Some(lines) = gitlink_counts(&change) {
            Some(lines)
        } else if let Some(type_change) = gitlink_type_change(&change) {
            count_against_gitlink(&mut cache, &git.objects, change.location(), type_change)
        } else {
            change.diff(&mut cache).ok().and_then(count_lines)
        };
        let counts = GitLineCounts {
            additions: lines.map(|(additions, _)| additions),
            deletions: lines.map(|(_, deletions)| deletions),
        };
        counted.insert(change.location().to_string(), counts);
        Ok(std::ops::ControlFlow::Continue(()))
    });
    outcome.map_err(|e| Error::git(format!("Could not diff the trees: {e}")))?;

    Ok(counted)
}

/// Count added and removed lines the way `git diff --numstat` does, keeping line endings.
///
/// Temporary shim: gix's `Platform::line_counts()` diffs lines with their LF/CRLF stripped, so a
/// final line gaining its newline and a CRLF-to-LF conversion both count as no change. Diffing
/// the `intern_source()` tokens instead keeps the terminators and matches git. Remove this once
/// gix ships numstat-compatible counts (D30b) and switch back to `line_counts()`.
fn count_lines(platform: gix::object::blob::diff::Platform<'_>) -> Option<(u32, u32)> {
    use gix::diff::blob::platform::prepare_diff::Operation;

    platform
        .resource_cache
        .options
        .skip_internal_diff_if_external_is_configured = false;
    let prep = platform.resource_cache.prepare_diff().ok()?;
    match prep.operation {
        Operation::InternalDiff { algorithm } => {
            let input = gix::diff::blob::InternedInput::new(
                prep.old.intern_source(),
                prep.new.intern_source(),
            );
            let diff = gix::diff::blob::Diff::compute(algorithm, &input);
            Some((diff.count_additions(), diff.count_removals()))
        }
        Operation::SourceOrDestinationIsBinary | Operation::ExternalCommand { .. } => None,
    }
}

/// The counts git reports for a gitlink (submodule), whose diff is its one `Subproject commit`
/// line: `(1, 0)` when added, `(0, 1)` when deleted and `(1, 1)` when moved to another commit.
/// `None` for a change no side of which is a gitlink, and for a type change between a gitlink and
/// a file or symlink, which [`count_against_gitlink`] counts against the other side's content.
fn gitlink_counts(change: &gix::object::tree::diff::Change<'_, '_, '_>) -> Option<(u32, u32)> {
    use gix::object::tree::diff::Change;

    match change {
        Change::Addition { entry_mode, .. } if entry_mode.is_commit() => Some((1, 0)),
        Change::Deletion { entry_mode, .. } if entry_mode.is_commit() => Some((0, 1)),
        Change::Modification {
            entry_mode,
            previous_entry_mode,
            ..
        } if entry_mode.is_commit() && previous_entry_mode.is_commit() => Some((1, 1)),
        Change::Rewrite {
            entry_mode,
            source_entry_mode,
            source_id,
            id,
            ..
        } if entry_mode.is_commit() || source_entry_mode.is_commit() => {
            // A rename that keeps the same submodule commit changes no `Subproject commit` line.
            Some(if source_id.detach() == id.detach() {
                (0, 0)
            } else {
                (1, 1)
            })
        }
        _ => None,
    }
}

/// A type change between a gitlink and a file or symlink: the gitlink's commit, and the blob on
/// the other side with its kind and its side of the diff.
struct GitlinkTypeChange {
    commit: gix::ObjectId,
    blob: gix::ObjectId,
    blob_kind: gix::object::tree::EntryKind,
    blob_side: gix::diff::blob::ResourceKind,
}

/// The [`GitlinkTypeChange`] a change is, or `None` for any other change.
fn gitlink_type_change(
    change: &gix::object::tree::diff::Change<'_, '_, '_>,
) -> Option<GitlinkTypeChange> {
    use gix::diff::blob::ResourceKind;
    use gix::object::tree::diff::Change;

    let Change::Modification {
        previous_entry_mode,
        previous_id,
        entry_mode,
        id,
        ..
    } = change
    else {
        return None;
    };
    match (previous_entry_mode.is_commit(), entry_mode.is_commit()) {
        (false, true) => Some(GitlinkTypeChange {
            commit: id.detach(),
            blob: previous_id.detach(),
            blob_kind: previous_entry_mode.kind(),
            blob_side: ResourceKind::OldOrSource,
        }),
        (true, false) => Some(GitlinkTypeChange {
            commit: previous_id.detach(),
            blob: id.detach(),
            blob_kind: entry_mode.kind(),
            blob_side: ResourceKind::NewOrDestination,
        }),
        _ => None,
    }
}

/// Count a gitlink type change the way `git diff --numstat` does: the gitlink's one
/// `Subproject commit <hash>` line against the other side's real content, so a three-line file
/// becoming a submodule counts `(1, 3)`. `None` when the other side is binary, as git prints
/// dashes for it.
fn count_against_gitlink(
    cache: &mut gix::diff::blob::Platform,
    objects: &impl gix::objs::FindObjectOrHeader,
    path: &bstr::BStr,
    change: GitlinkTypeChange,
) -> Option<(u32, u32)> {
    use gix::diff::blob::platform::resource::Data;
    use gix::diff::blob::{sources::byte_lines, Diff, InternedInput, ResourceKind};

    // gix's resource cache refuses a gitlink, so only the blob side goes through it, which still
    // applies the attributes and the binary check a two-sided diff would.
    cache
        .set_resource(
            change.blob,
            change.blob_kind,
            path,
            change.blob_side,
            objects,
        )
        .ok()?;
    let algorithm = cache.options.algorithm.unwrap_or_default();
    let Data::Buffer { buf, .. } = cache.resource(change.blob_side)?.data else {
        return None;
    };
    let subproject = format!("Subproject commit {}\n", change.commit);
    let (old, new) = match change.blob_side {
        ResourceKind::OldOrSource => (buf, subproject.as_bytes()),
        ResourceKind::NewOrDestination => (subproject.as_bytes(), buf),
    };
    let diff = Diff::compute(
        algorithm,
        &InternedInput::new(byte_lines(old), byte_lines(new)),
    );
    Some((diff.count_additions(), diff.count_removals()))
}

/// Turn one tree change into a file change record, or `None` for changes the view does not list.
fn classify(change: &gix::object::tree::diff::Change<'_, '_, '_>) -> Option<GitFileChange> {
    use gix::object::tree::diff::Change;

    let record = match change {
        Change::Addition {
            location,
            entry_mode,
            ..
        } => {
            // A directory becoming present is not a file change; only its entries are.
            if entry_mode.is_tree() {
                return None;
            }
            let path = location.to_string();
            GitFileChange {
                old_file_path: path.clone(),
                new_file_path: path,
                kind: GitFileStatus::Added,
                additions: None,
                deletions: None,
            }
        }
        Change::Deletion {
            location,
            entry_mode,
            ..
        } => {
            if entry_mode.is_tree() {
                return None;
            }
            let path = location.to_string();
            GitFileChange {
                old_file_path: path.clone(),
                new_file_path: path,
                kind: GitFileStatus::Deleted,
                additions: None,
                deletions: None,
            }
        }
        Change::Modification {
            location,
            entry_mode,
            previous_entry_mode,
            ..
        } => {
            if entry_mode.is_tree() {
                return None;
            }
            // A type change (regular file ↔ symlink ↔ gitlink) is what git spells `T`, as the CLI
            // lists it under `--diff-filter=AMDRT`. The executable bit alone stays a modification;
            // a file becoming a directory never gets here, the tree diff reports it as a deletion
            // and additions.
            let type_changed = entry_mode.is_link() != previous_entry_mode.is_link()
                || entry_mode.is_commit() != previous_entry_mode.is_commit();
            let path = location.to_string();
            GitFileChange {
                old_file_path: path.clone(),
                new_file_path: path,
                kind: if type_changed {
                    GitFileStatus::TypeChanged
                } else {
                    GitFileStatus::Modified
                },
                additions: None,
                deletions: None,
            }
        }
        Change::Rewrite {
            source_location,
            location,
            entry_mode,
            source_entry_mode,
            copy,
            ..
        } => {
            // A directory becoming renamed is not a file change; only its entries are. The rewrite
            // tracker pairs a deleted tree with a similar added one as a rewrite of the directory
            // itself, and a directory path in the list would collide with the entries under it
            // when the view builds its file tree.
            if entry_mode.is_tree() || source_entry_mode.is_tree() {
                return None;
            }
            // A copy is reported by git as an addition unless `-C` was asked for, and the view
            // has no separate presentation for one.
            GitFileChange {
                old_file_path: source_location.to_string(),
                new_file_path: location.to_string(),
                kind: if *copy {
                    GitFileStatus::Added
                } else {
                    GitFileStatus::Renamed
                },
                additions: None,
                deletions: None,
            }
        }
    };
    Some(record)
}
