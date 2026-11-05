//! The repository's worktrees, as `git worktree list` reports them, read in process.
//!
//! The list is the main worktree followed by every linked one, sorted by path. Everything is read
//! from files Git itself writes: the common directory, each `worktrees/<id>/` admin directory
//! (`gitdir`, `locked`) and each worktree's `HEAD`. A sibling's `HEAD` is read through the
//! reference store as `worktrees/<id>/HEAD`; no sibling repository is ever opened, because an
//! opened sibling would inherit this handle's trust options.
//!
//! Git is the authority, so this module answers only what it can phrase exactly as Git does. Any
//! entry it cannot (no `gitdir` file, a prunable worktree, a relative or odd `gitdir`, a `HEAD`
//! outside `refs/heads/`, a non-UTF-8 name) makes the whole call `Unsupported`, and the caller
//! lists with the CLI instead. This module only reads: worktree writes stay on the CLI.

use std::cmp::Ordering;
use std::fs;
use std::path::Path;

use crate::error::{Error, Result};
use crate::repository::Repo;

/// One worktree, with the fields `git worktree list --porcelain -z` prints.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    /// Absolute path, as Git prints it.
    pub path: String,
    /// The commit at HEAD (the null id for an unborn branch); `None` for a bare main repository.
    pub head: Option<String>,
    /// The branch name with `refs/heads/` removed; `None` when detached or bare.
    pub branch: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub is_main: bool,
    /// The lock reason as Git prints it (empty when there is none); `None` when not locked.
    pub locked: Option<String>,
}

const BRANCH_PREFIX: &str = "refs/heads/";

/// Why this module cannot answer exactly as Git would.
fn decline(why: impl std::fmt::Display) -> Error {
    Error::unsupported(format!("worktree list: {why}"))
}

/// List the worktrees of the repository `repo` belongs to, main first.
pub fn list_worktrees(repo: &Repo) -> Result<Vec<Worktree>> {
    let git = repo.borrow();
    let common = git.current_dir().join(git.common_dir());
    let common = fs::canonicalize(&common).map_err(|e| decline(format!("common dir: {e}")))?;

    let ignore_case = git
        .config_snapshot()
        .boolean("core.ignorecase")
        .unwrap_or(false);
    let main = main_entry(&git, &common)?;

    let mut linked = linked_entries(&git, &common)?;
    linked.sort_by(|a, b| compare_paths(&a.path, &b.path, ignore_case));

    let mut all = Vec::with_capacity(linked.len() + 1);
    all.push(main);
    all.extend(linked);
    Ok(all)
}

fn main_entry(git: &gix::Repository, common: &Path) -> Result<Worktree> {
    let bare = match git.kind() {
        gix::repository::Kind::Common => git.workdir().is_none(),
        gix::repository::Kind::LinkedWorkTree => {
            git.config_snapshot().boolean("core.bare").unwrap_or(false)
        }
        gix::repository::Kind::Submodule => return Err(decline("a submodule has no list")),
    };

    // Git prints the common dir's real path, minus the `.git` of a non-bare repository. A git
    // directory with another name (`--separate-git-dir`) is printed whole by Git, an oddity this
    // module does not copy.
    let path = if bare {
        common.to_path_buf()
    } else if common.file_name().is_some_and(|name| name == ".git") {
        common.parent().map(Path::to_path_buf).unwrap_or_default()
    } else {
        return Err(decline("the git directory is not named .git"));
    };
    let path = path_to_string(&path)?;

    if bare {
        return Ok(Worktree {
            path,
            head: None,
            branch: None,
            detached: false,
            bare: true,
            is_main: true,
            locked: None,
        });
    }
    let head_name = match git.kind() {
        gix::repository::Kind::LinkedWorkTree => "main-worktree/HEAD",
        _ => "HEAD",
    };
    let head = read_head(git, head_name)?;
    Ok(Worktree {
        path,
        head: Some(head.id),
        branch: head.branch,
        detached: head.detached,
        bare: false,
        is_main: true,
        locked: None,
    })
}

fn linked_entries(git: &gix::Repository, common: &Path) -> Result<Vec<Worktree>> {
    let admin_root = common.join("worktrees");
    let entries = match fs::read_dir(&admin_root) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(decline(format!("worktrees dir: {e}"))),
    };
    let mut list = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| decline(format!("worktrees dir: {e}")))?;
        list.push(linked_entry(git, &entry.path())?);
    }
    Ok(list)
}

fn linked_entry(git: &gix::Repository, admin: &Path) -> Result<Worktree> {
    let id = admin
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| decline("a worktree id is not UTF-8"))?;
    if !admin.is_dir() {
        return Err(decline(format!("worktrees/{id} is not a directory")));
    }
    let gitdir = match fs::read(admin.join("gitdir")) {
        Ok(bytes) => bytes,
        // Git skips such an entry in one place and reports it prunable in another.
        Err(_) => return Err(decline(format!("worktrees/{id} has no gitdir file"))),
    };
    let dot_git = std::str::from_utf8(&gitdir)
        .map_err(|_| decline(format!("worktrees/{id}/gitdir is not UTF-8")))?
        .trim_end_matches(is_git_space);
    if !Path::new(dot_git).is_absolute() {
        return Err(decline(format!("worktrees/{id}/gitdir is not absolute")));
    }
    let path = dot_git
        .strip_suffix("/.git")
        .ok_or_else(|| decline(format!("worktrees/{id}/gitdir does not end in /.git")))?;

    let locked = lock_reason(admin, id)?;
    // Not locked, and its `.git` is gone: Git calls it prunable, with a reason text that has
    // several wordings, so the CLI answers.
    if locked.is_none() && fs::metadata(dot_git).is_err() {
        return Err(decline(format!("worktrees/{id} is prunable")));
    }

    let head = read_head(git, &format!("worktrees/{id}/HEAD"))?;
    Ok(Worktree {
        path: path.to_string(),
        head: Some(head.id),
        branch: head.branch,
        detached: head.detached,
        bare: false,
        is_main: false,
        locked,
    })
}

/// The reason in `worktrees/<id>/locked`, trimmed as Git trims it; `None` when there is no lock.
fn lock_reason(admin: &Path, id: &str) -> Result<Option<String>> {
    let file = admin.join("locked");
    if file.symlink_metadata().is_err() {
        return Ok(None);
    }
    let bytes = fs::read(&file).map_err(|e| decline(format!("worktrees/{id}/locked: {e}")))?;
    let text = std::str::from_utf8(&bytes)
        .map_err(|_| decline(format!("worktrees/{id}/locked is not UTF-8")))?;
    Ok(Some(text.trim_matches(is_git_space).to_string()))
}

/// Git's `isspace`: space, tab, newline and carriage return, nothing else.
fn is_git_space(c: char) -> bool {
    matches!(c, ' ' | '\t' | '\n' | '\r')
}

struct Head {
    id: String,
    branch: Option<String>,
    detached: bool,
}

/// One worktree's HEAD, read through the reference store without opening that worktree.
fn read_head(git: &gix::Repository, name: &str) -> Result<Head> {
    let reference = git
        .find_reference(name)
        .map_err(|e| decline(format!("{name}: {e}")))?;
    match reference.target() {
        gix::refs::TargetRef::Object(id) => Ok(Head {
            id: id.to_string(),
            branch: None,
            detached: true,
        }),
        gix::refs::TargetRef::Symbolic(full) => {
            let full = full.as_bstr().to_string();
            let branch = full
                .strip_prefix(BRANCH_PREFIX)
                .ok_or_else(|| decline(format!("{name} points outside refs/heads/")))?
                .to_string();
            let target = git
                .try_find_reference(full.as_str())
                .map_err(|e| decline(format!("{full}: {e}")))?;
            // An unborn branch has no commit, and Git prints the null id for it.
            let id = match target {
                None => git.object_hash().null().to_string(),
                Some(target) => target
                    .target()
                    .try_id()
                    .ok_or_else(|| decline(format!("{full} is a symbolic ref")))?
                    .to_string(),
            };
            Ok(Head {
                id,
                branch: Some(branch),
                detached: false,
            })
        }
    }
}

fn path_to_string(path: &Path) -> Result<String> {
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| decline("a path is not UTF-8"))
}

/// Git's `fspathcmp`: byte order, or `strcasecmp` order when `core.ignorecase` is on.
fn compare_paths(a: &str, b: &str, ignore_case: bool) -> Ordering {
    if ignore_case {
        a.bytes()
            .map(|c| c.to_ascii_lowercase())
            .cmp(b.bytes().map(|c| c.to_ascii_lowercase()))
    } else {
        a.as_bytes().cmp(b.as_bytes())
    }
}
