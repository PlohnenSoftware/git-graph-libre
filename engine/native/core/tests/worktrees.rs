//! `list_worktrees` against `git worktree list --porcelain -z` on repositories built with the
//! `git` command line: the engine must give the same list, or decline so the CLI answers.
//!
//! Every worktree is created in a temporary directory of its own, with awkward names (a space,
//! non-ASCII characters, mixed case), and nothing here touches a real repository.

#[macro_use]
mod common;

use std::fs;
use std::path::Path;

use git_graph_core::error::ErrorKind;
use git_graph_core::worktrees::{list_worktrees, Worktree};
use git_graph_core::Repo;

use common::TestRepo;

/// What `git worktree list --porcelain -z` says, parsed into the engine's own shape.
fn cli_list(repo: &TestRepo, from: &Path) -> Vec<Worktree> {
    let output = std::process::Command::new("git")
        .args(["worktree", "list", "--porcelain", "-z"])
        .current_dir(from)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("HOME", repo.path())
        .output()
        .expect("could not run git");
    assert!(output.status.success(), "git worktree list failed");
    let text = String::from_utf8(output.stdout).expect("git printed non-UTF-8");
    let mut list = Vec::new();
    let mut current: Option<Worktree> = None;
    for field in text.split('\0') {
        if field.is_empty() {
            list.extend(current.take());
            continue;
        }
        let (key, value) = field.split_once(' ').unwrap_or((field, ""));
        if key == "worktree" {
            current = Some(Worktree {
                path: value.to_string(),
                head: None,
                branch: None,
                detached: false,
                bare: false,
                is_main: list.is_empty(),
                locked: None,
            });
            continue;
        }
        let entry = current.as_mut().expect("a field before its worktree line");
        match key {
            "HEAD" => entry.head = Some(value.to_string()),
            "branch" => entry.branch = value.strip_prefix("refs/heads/").map(str::to_string),
            "detached" => entry.detached = true,
            "bare" => entry.bare = true,
            "locked" => entry.locked = Some(value.to_string()),
            "prunable" => panic!("the parity fixtures must not be prunable: {field}"),
            other => panic!("an unexpected porcelain field: {other}"),
        }
    }
    list
}

fn engine_list(from: &Path) -> Result<Vec<Worktree>, git_graph_core::Error> {
    list_worktrees(&Repo::discover(from).expect("could not open the repository"))
}

fn assert_same(repo: &TestRepo, from: &Path) {
    assert_eq!(
        engine_list(from).expect("the engine declined"),
        cli_list(repo, from),
        "listing from {}",
        from.display()
    );
}

fn add(repo: &TestRepo, parent: &Path, name: &str, args: &[&str]) -> String {
    let path = parent.join(name).display().to_string();
    let mut full = vec!["worktree", "add", "--quiet"];
    full.extend_from_slice(args);
    full.insert(3, &path);
    repo.git(&full);
    path
}

fn declined(result: Result<Vec<Worktree>, git_graph_core::Error>) -> String {
    let error = result.expect_err("the engine should have declined");
    assert_eq!(error.kind, ErrorKind::Unsupported, "{error}");
    error.message
}

#[test]
fn a_repository_with_no_linked_worktree_lists_only_itself() {
    require_git!();
    let mut repo = TestRepo::new();
    // Unborn: Git prints the null id.
    assert_same(&repo, repo.path());
    repo.commit_file("a.txt", "one\n", "first");
    assert_same(&repo, repo.path());
    repo.git(&["checkout", "--quiet", "--detach"]);
    assert_same(&repo, repo.path());
    let list = engine_list(repo.path()).unwrap();
    assert_eq!(list.len(), 1);
    assert!(list[0].is_main && list[0].detached && list[0].branch.is_none());
}

#[test]
fn linked_worktrees_match_git_in_content_and_order() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    let names = [
        "wt-feat",
        "w b \u{fc}",
        "Zed",
        "alpha",
        "\u{c4}",
        "\u{e9}",
        "z-1",
        "z 1",
    ];
    for (i, name) in names.iter().enumerate() {
        if i % 2 == 0 {
            add(&repo, parent.path(), name, &["-b", &format!("b{i}")]);
        } else {
            add(&repo, parent.path(), name, &["--detach"]);
        }
    }
    assert_same(&repo, repo.path());
    let list = engine_list(repo.path()).unwrap();
    assert_eq!(list.len(), names.len() + 1);
    assert!(list[0].is_main);
    assert!(list[1..].iter().all(|w| !w.is_main && !w.bare));

    // The same list from inside a linked worktree and from a subdirectory of the main one.
    for name in names {
        assert_same(&repo, &parent.path().join(name));
    }
    fs::create_dir(repo.path().join("sub")).unwrap();
    assert_same(&repo, &repo.path().join("sub"));
}

#[test]
fn lock_reasons_read_as_git_prints_them() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    for name in ["plain", "empty", "spaced", "multi", "none"] {
        add(&repo, parent.path(), name, &["--detach"]);
    }
    // Git itself locks one with a reason, for the first line of the check below.
    let plain = parent.path().join("plain").display().to_string();
    repo.git(&[
        "worktree",
        "lock",
        "--reason",
        "on a drive that sleeps",
        &plain,
    ]);
    let admin = repo.path().join(".git/worktrees");
    // The odder files are written as a hand-edited or older Git would leave them.
    for (name, contents) in [
        ("plain", "on a drive that sleeps\n"),
        ("empty", ""),
        ("spaced", "  \t lead and trail \t \n"),
        ("multi", "two  \nlines  \n\n"),
    ] {
        fs::write(admin.join(name).join("locked"), contents).unwrap();
    }
    assert_same(&repo, repo.path());
    let list = engine_list(repo.path()).unwrap();
    let reason = |name: &str| {
        list.iter()
            .find(|w| w.path.ends_with(&format!("/{name}")))
            .unwrap()
            .locked
            .clone()
    };
    assert_eq!(reason("plain").as_deref(), Some("on a drive that sleeps"));
    assert_eq!(reason("empty").as_deref(), Some(""));
    assert_eq!(reason("spaced").as_deref(), Some("lead and trail"));
    assert_eq!(reason("multi").as_deref(), Some("two  \nlines"));
    assert_eq!(reason("none"), None);
}

#[test]
fn a_locked_worktree_whose_folder_is_gone_is_not_prunable_and_matches_git() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    let path = add(&repo, parent.path(), "away", &["--detach"]);
    repo.git(&["worktree", "lock", "--reason", "removable drive", &path]);
    fs::remove_dir_all(&path).unwrap();
    assert_same(&repo, repo.path());
}

#[test]
fn an_unborn_branch_in_a_linked_worktree_has_the_null_id() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    let path = add(&repo, parent.path(), "fresh", &["--detach"]);
    repo.git(&["-C", &path, "symbolic-ref", "HEAD", "refs/heads/not-yet"]);
    assert_same(&repo, repo.path());
    let list = engine_list(repo.path()).unwrap();
    assert_eq!(list[1].head.as_deref(), Some("0".repeat(40).as_str()));
    assert_eq!(list[1].branch.as_deref(), Some("not-yet"));
}

#[test]
fn a_bare_main_repository_lists_first_with_no_head() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    let bare = parent.path().join("origin.git");
    repo.git(&[
        "clone",
        "--quiet",
        "--bare",
        ".",
        &bare.display().to_string(),
    ]);
    let linked = parent.path().join("linked");
    repo.git(&[
        "-C",
        &bare.display().to_string(),
        "worktree",
        "add",
        "--quiet",
        "-b",
        "feat",
        &linked.display().to_string(),
        "main",
    ]);
    assert_same(&repo, &bare);
    assert_same(&repo, &linked);
    let list = engine_list(&bare).unwrap();
    assert!(list[0].bare && list[0].is_main && list[0].head.is_none());
    assert_eq!(list[1].branch.as_deref(), Some("feat"));
}

#[test]
fn core_ignorecase_sorts_the_way_git_does() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    for name in ["Zed", "alpha", "Beta", "gamma"] {
        add(&repo, parent.path(), name, &["--detach"]);
    }
    repo.git(&["config", "core.ignorecase", "true"]);
    assert_same(&repo, repo.path());
    repo.git(&["config", "core.ignorecase", "false"]);
    assert_same(&repo, repo.path());
}

#[cfg(unix)]
#[test]
fn a_repository_reached_through_a_symlink_lists_its_real_path() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    add(&repo, parent.path(), "wt", &["--detach"]);
    let link = parent.path().join("link");
    std::os::unix::fs::symlink(repo.path(), &link).unwrap();
    assert_eq!(
        engine_list(&link).unwrap(),
        cli_list(&repo, &link),
        "listing through the symlink"
    );
}

#[test]
fn a_prunable_worktree_declines() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    let path = add(&repo, parent.path(), "gone", &["--detach"]);
    add(&repo, parent.path(), "kept", &["--detach"]);
    fs::remove_dir_all(&path).unwrap();
    assert!(declined(engine_list(repo.path())).contains("prunable"));
}

#[test]
fn an_admin_entry_without_a_gitdir_file_declines() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    add(&repo, parent.path(), "orphan", &["--detach"]);
    fs::remove_file(repo.path().join(".git/worktrees/orphan/gitdir")).unwrap();
    assert!(declined(engine_list(repo.path())).contains("no gitdir file"));
}

#[test]
fn a_stray_file_in_the_admin_directory_declines() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    add(&repo, parent.path(), "wt", &["--detach"]);
    fs::write(repo.path().join(".git/worktrees/README"), "hello").unwrap();
    assert!(declined(engine_list(repo.path())).contains("not a directory"));
}

#[test]
fn a_relative_gitdir_declines() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    add(&repo, parent.path(), "wt", &["--detach"]);
    fs::write(
        repo.path().join(".git/worktrees/wt/gitdir"),
        "../../../wt/.git\n",
    )
    .unwrap();
    assert!(declined(engine_list(repo.path())).contains("not absolute"));
}

#[test]
fn a_head_outside_refs_heads_declines() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let parent = tempfile::tempdir().unwrap();
    let path = add(&repo, parent.path(), "odd", &["--detach"]);
    repo.git(&["-C", &path, "symbolic-ref", "HEAD", "refs/odd/place"]);
    assert!(declined(engine_list(repo.path())).contains("outside refs/heads/"));
}

#[test]
fn a_git_directory_not_named_dot_git_declines() {
    require_git!();
    let parent = tempfile::tempdir().unwrap();
    let repo = TestRepo::new();
    let separate = parent.path().join("elsewhere");
    let work = parent.path().join("work");
    fs::create_dir(&work).unwrap();
    repo.git(&[
        "init",
        "--quiet",
        "--separate-git-dir",
        &separate.display().to_string(),
        &work.display().to_string(),
    ]);
    assert!(declined(engine_list(&work)).contains("not named .git"));
}
