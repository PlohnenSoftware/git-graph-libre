//! Where gix and git read the same repository differently, checked against git itself.
//!
//! Each test pins one place the engine disagreed with the `git` command line: the objects a tag
//! can name, shallow boundaries, working-tree states gix classifies differently, rename and line
//! count rules, replacement objects, and commit text. The expected answer always comes from
//! running git on the same fixture.
//!
//! Adapted from the MIT-licensed `native/core/tests/git_parity.rs` of
//! neophack/vscode-git-graph-rs (commit `ff4aafe`, 2026-09-23), alongside the fixes it pins; see
//! `engine/NOTICE.md`.

#[macro_use]
mod common;

use git_graph_core::log;
use git_graph_core::repository::Repo;

use common::TestRepo;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

/* ---------- The objects a tag can name ---------- */

#[test]
fn a_tag_of_a_blob_or_a_tree_does_not_cut_history_reads_short() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "one");
    let blob = repo.rev_parse("HEAD:a.txt");
    let tree = repo.rev_parse("HEAD^{tree}");
    repo.git(&["tag", "blobtag", &blob]);
    repo.git(&["tag", "-a", "treetag", "-m", "a tree", &tree]);
    repo.git(&["tag", "lighttree", &tree]);
    // A second author whose only commit is reachable from a remote-tracking ref, which the tips
    // list after the tags: a walk ended by the blob never reached it.
    repo.git(&["checkout", "--quiet", "-b", "side"]);
    let side = repo.commit_as("Bob", "bob@example.com", "side work");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.update_ref("refs/remotes/origin/side", &side);
    repo.git(&["branch", "--quiet", "-D", "side"]);

    let engine = open(&repo);
    // `git log --all` passes over the tags that name no commit.
    let mut expected: Vec<String> = repo
        .git(&["log", "--all", "--format=%an"])
        .lines()
        .map(str::to_string)
        .collect();
    expected.sort();
    expected.dedup();
    let mut authors: Vec<String> = log::authors(&engine)
        .unwrap()
        .into_iter()
        .map(|author| author.name)
        .collect();
    authors.sort();
    assert_eq!(authors, expected);
    assert_eq!(authors, vec!["Bob", "Test User"]);

    let tips = log::all_tips(&engine, true, true).unwrap();
    let id = |hex: &str| gix::ObjectId::from_hex(hex.as_bytes()).unwrap();
    assert!(!tips.contains(&id(&blob)));
    assert!(!tips.contains(&id(&tree)));
}
