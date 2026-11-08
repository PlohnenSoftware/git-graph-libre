//! The commit walk's traversal, compared with what `git log` reports for the same repository:
//! first-parent path filtering, topological order, and author-date page membership.

#[macro_use]
mod common;

use git_graph_core::log::{self, WalkOptions};
use git_graph_core::repository::Repo;
use git_graph_core::types::CommitOrdering;

use common::TestRepo;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

fn hashes(repo: &TestRepo, options: &WalkOptions) -> Vec<String> {
    let engine = open(repo);
    let tips = log::all_tips(&engine, true, true).expect("could not resolve the tips");
    log::walk(&engine, &tips, options)
        .expect("the walk failed")
        .into_iter()
        .map(|record| record.hash)
        .collect()
}

#[test]
fn first_parent_path_filter_judges_a_merge_against_its_first_parent() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("f.txt", "0", "base");
    repo.git(&["checkout", "--quiet", "-b", "side"]);
    repo.commit_file("f.txt", "2", "side edits f");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("other.txt", "x", "main edits other");
    repo.git(&["merge", "--quiet", "--no-ff", "-m", "merge", "side"]);

    // The merge carries the side's version of `f.txt` in: it equals its second parent but differs
    // from its first, which is the only parent a first-parent walk compares against.
    let expected = repo.log_hashes(&["--first-parent", "--all", "--", "f.txt"]);
    assert_eq!(expected.len(), 3, "merge, side and base: {expected:?}");
    let options = WalkOptions {
        limit: 100,
        first_parent_only: true,
        filter_paths: vec!["f.txt".to_string()],
        ..Default::default()
    };
    assert_eq!(hashes(&repo, &options), expected);
}
