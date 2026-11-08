//! A failed ref scan reaches the caller instead of being served as an empty repository, while the
//! benign cases (an unborn HEAD, no stash) still load.

#[macro_use]
mod common;

use std::process::Command;

use git_graph_core::error::ErrorKind;
use git_graph_core::graph;
use git_graph_core::repository::Repo;
use git_graph_core::types::{LogOptions, RefReadOptions};

use common::TestRepo;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

/// The options a default view load sends.
fn view_options() -> LogOptions {
    LogOptions {
        max_commits: 100,
        show_tags: true,
        show_remote_branches: true,
        ..Default::default()
    }
}

/// Whether `git` itself exits with a failure for these arguments in the repository.
fn git_fails(repo: &TestRepo, args: &[&str]) -> bool {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo.path())
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("HOME", repo.path())
        .output()
        .expect("could not run git");
    !output.status.success()
}

/// A repository whose branch has been packed, followed by a `packed-refs` file that git cannot
/// parse, so reading the refs fails outright.
fn corrupt_packed_refs() -> TestRepo {
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    repo.git(&["pack-refs", "--all"]);
    repo.write(".git/packed-refs", "garbage line\n");
    repo
}

#[test]
fn corrupt_packed_refs_fail_repo_info_as_git_does() {
    require_git!();
    let repo = corrupt_packed_refs();
    assert!(
        git_fails(&repo, &["for-each-ref"]),
        "git itself must fail on this repository"
    );
    let engine = open(&repo);

    let error = graph::repo_info(&engine, &RefReadOptions::default(), true)
        .err()
        .expect("repo_info must report the ref failure, not an empty repository");
    assert_eq!(error.kind, ErrorKind::Git);
}

#[test]
fn corrupt_packed_refs_fail_load_commits_as_git_does() {
    require_git!();
    let repo = corrupt_packed_refs();
    assert!(
        git_fails(&repo, &["log", "--all"]),
        "git itself must fail on this repository"
    );
    let engine = open(&repo);

    let error = graph::load_commits(&engine, &view_options())
        .err()
        .expect("load_commits must report the ref failure, not an empty graph");
    assert_eq!(error.kind, ErrorKind::Git);
}

#[test]
fn an_unborn_head_still_loads_as_an_empty_graph() {
    require_git!();
    let repo = TestRepo::new();
    let engine = open(&repo);

    let info = graph::repo_info(&engine, &RefReadOptions::default(), true)
        .expect("an unborn HEAD is not a ref failure");
    assert_eq!(info.head.as_deref(), Some("main"));
    assert_eq!(info.branches, vec!["main"]);
    assert!(info.stashes.is_empty());

    let data =
        graph::load_commits(&engine, &view_options()).expect("an unborn HEAD is not a ref failure");
    assert!(data.commits.is_empty());
    assert_eq!(data.head, None);
}

#[test]
fn an_ordinary_repository_without_stashes_loads() {
    require_git!();
    let mut repo = TestRepo::new();
    let first = repo.commit_file("a.txt", "1", "first");
    repo.git(&["tag", "v1.0"]);
    let engine = open(&repo);

    let info = graph::repo_info(&engine, &RefReadOptions::default(), true)
        .expect("an ordinary repository must load");
    assert_eq!(info.head.as_deref(), Some("main"));
    assert_eq!(info.branches, vec!["main"]);
    assert_eq!(info.tags, vec!["v1.0"]);
    assert!(info.stashes.is_empty());
    assert_eq!(info.error, None);

    let data =
        graph::load_commits(&engine, &view_options()).expect("an ordinary repository must load");
    let hashes: Vec<&str> = data.commits.iter().map(|c| c.hash.as_str()).collect();
    assert_eq!(hashes, vec![first.as_str()]);
    assert_eq!(data.head.as_deref(), Some(first.as_str()));
    assert_eq!(data.error, None);
}
