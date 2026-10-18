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

use std::process::Command;

use git_graph_core::repository::Repo;
use git_graph_core::search::search_commits;
use git_graph_core::types::{GitFileStatus, LogOptions, SearchOptions};
use git_graph_core::{blob, details, diff, graph, log, status, ErrorKind};

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

/* ---------- Shallow clones ---------- */

#[test]
fn a_shallow_boundary_commit_has_no_parents_and_opens_its_details() {
    require_git!();
    let mut source = TestRepo::new();
    for n in 1..=4 {
        source.commit_file("a.txt", &format!("{n}\n"), &format!("commit {n}"));
    }
    let clone_dir = tempfile::tempdir().unwrap();
    let url = format!("file://{}", source.path().display()).replace('\\', "/");
    let clone_path = clone_dir.path().join("clone");
    let output = Command::new("git")
        .args(["clone", "--quiet", "--depth", "2", &url])
        .arg(&clone_path)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let git_in_clone = |args: &[&str]| {
        String::from_utf8(
            Command::new("git")
                .args(args)
                .current_dir(&clone_path)
                .output()
                .unwrap()
                .stdout,
        )
        .unwrap()
    };
    let boundary = git_in_clone(&["rev-parse", "HEAD~1"]).trim().to_string();
    // git: `%P` is empty for the boundary commit.
    assert_eq!(
        git_in_clone(&["log", "-1", "--format=%P", &boundary]).trim(),
        ""
    );

    let engine = Repo::discover(&clone_path).unwrap();
    let tips = log::all_tips(&engine, true, true).unwrap();
    let records = log::walk(
        &engine,
        &tips,
        &log::WalkOptions {
            limit: 10,
            ..Default::default()
        },
    )
    .unwrap();
    let record = records
        .iter()
        .find(|record| record.hash == boundary)
        .unwrap();
    assert!(record.parents.is_empty(), "{:?}", record.parents);

    // Its details diff against the empty tree, as `git show` does, instead of failing on the
    // parent that was never fetched.
    let details = details::commit_details(&engine, &boundary).unwrap();
    assert!(details.parents.is_empty());
    assert_eq!(details.file_changes.len(), 1);
    assert_eq!(details.file_changes[0].kind, GitFileStatus::Added);
    let counts = diff::line_counts(&engine, None, &boundary, &["a.txt".to_string()]).unwrap();
    assert_eq!(counts["a.txt"].additions, Some(1));
    assert_eq!(counts["a.txt"].deletions, Some(0));

    // The Find dialogue reports the same parents the graph draws.
    let hits = search_commits(
        &engine,
        &SearchOptions {
            query: "commit 3".to_string(),
            max_results: 10,
            show_tags: true,
            show_remote_branches: true,
            ..Default::default()
        },
    )
    .unwrap();
    let hit = hits.iter().find(|hit| hit.hash == boundary).unwrap();
    assert!(hit.parents.is_empty(), "{:?}", hit.parents);
}

/* ---------- Working-tree status ---------- */

/// How many lines `git status --porcelain` prints — what "Uncommitted Changes (N)" counts.
fn porcelain_lines(repo: &TestRepo) -> usize {
    repo.git(&["status", "--porcelain", "--untracked-files=all"])
        .lines()
        .filter(|line| !line.is_empty())
        .count()
}

#[test]
fn an_intent_to_add_file_is_an_uncommitted_change() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1\n", "one");
    repo.write("new.txt", "new\n");
    repo.git(&["add", "-N", "new.txt"]);

    let engine = open(&repo);
    // git: ` A new.txt`. Missing it, the engine dropped the row entirely.
    assert_eq!(porcelain_lines(&repo), 1);
    assert_eq!(status::count_changes(&engine, true).unwrap(), 1);
}

#[test]
fn a_file_removed_from_the_index_but_kept_on_disk_is_two_changes() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1\n", "one");
    repo.git(&["rm", "--quiet", "--cached", "a.txt"]);

    let engine = open(&repo);
    // git: `D  a.txt` and `?? a.txt`.
    assert_eq!(porcelain_lines(&repo), 2);
    assert_eq!(status::count_changes(&engine, true).unwrap(), 2);
    // Without untracked files only the staged deletion remains.
    assert_eq!(status::count_changes(&engine, false).unwrap(), 1);
}

#[test]
fn a_staged_rename_counts_as_git_status_lists_it() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", &"x\n".repeat(20), "one");
    repo.git(&["mv", "a.txt", "b.txt"]);

    let engine = open(&repo);
    // Renames on (git's default): one `R` line.
    assert_eq!(porcelain_lines(&repo), 1);
    assert_eq!(status::count_changes(&engine, true).unwrap(), 1);

    // `status.renames=false`: `D  a.txt` and `A  b.txt`, two lines.
    repo.git(&["config", "status.renames", "false"]);
    let engine = open(&repo);
    assert_eq!(porcelain_lines(&repo), 2);
    assert_eq!(status::count_changes(&engine, true).unwrap(), 2);

    // The full change list still pairs the rename, as `git diff --find-renames` does.
    let changes = status::uncommitted_changes(&engine).unwrap();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].kind, GitFileStatus::Renamed);
    assert_eq!(changes[0].old_file_path, "a.txt");
}

/* ---------- Replacement objects ---------- */

#[test]
fn replacement_objects_hand_history_reads_to_git() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "one");
    let two = repo.commit_file("a.txt", "2", "two");
    repo.commit_file("a.txt", "3", "three");

    let engine = open(&repo);
    let options = LogOptions {
        max_commits: 10,
        ..Default::default()
    };
    // Without replacements every read is the engine's.
    assert!(graph::load_commits(&engine, &options).is_ok());

    repo.git(&["replace", "--graft", &two]);
    let engine = open(&repo);
    // git now shows `two` as a root; gix would still show its original parent.
    assert_eq!(repo.git(&["log", "--format=%H"]).lines().count(), 2);
    let declined = |kind: ErrorKind| assert_eq!(kind, ErrorKind::Unsupported);
    declined(graph::load_commits(&engine, &options).unwrap_err().kind);
    declined(details::commit_details(&engine, &two).unwrap_err().kind);
    declined(
        diff::diff_revisions(&engine, &two, "HEAD")
            .unwrap_err()
            .kind,
    );
    declined(blob::commit_file(&engine, &two, "a.txt").unwrap_err().kind);
    let search = SearchOptions {
        query: "two".to_string(),
        max_results: 10,
        show_tags: true,
        ..Default::default()
    };
    declined(search_commits(&engine, &search).unwrap_err().kind);

    // `core.useReplaceRefs=false` makes git read the original objects, and gix then applies the
    // replacements (it inverts the setting), so the engine still hands the load to git.
    repo.git(&["config", "core.useReplaceRefs", "false"]);
    assert_eq!(repo.git(&["log", "--format=%H"]).lines().count(), 3);
    let engine = open(&repo);
    declined(graph::load_commits(&engine, &options).unwrap_err().kind);
}

/* ---------- Diff line counts ---------- */

/// The `+N/-M` git itself reports for one path of one commit, from
/// `git diff-tree -r --numstat --find-renames`. `None` is numstat's dash (a binary file).
fn git_numstat_counts(repo: &TestRepo, hash: &str, path: &str) -> (Option<u32>, Option<u32>) {
    let out = repo.git(&[
        "diff-tree",
        "-r",
        "--root",
        "--no-commit-id",
        "--numstat",
        "--find-renames",
        hash,
    ]);
    for line in out.lines() {
        let mut fields = line.split('\t');
        let (Some(added), Some(deleted), Some(found)) =
            (fields.next(), fields.next(), fields.next())
        else {
            continue;
        };
        if found == path {
            let parse = |value: &str| value.parse::<u32>().ok();
            return (parse(added), parse(deleted));
        }
    }
    panic!("`git diff-tree --numstat` has no line for {path} in {hash}:\n{out}");
}

/// The engine's `+N/-M` for one path of one commit, against its first parent.
fn engine_counts(engine: &Repo, hash: &str, path: &str) -> (Option<u32>, Option<u32>) {
    let counts = diff::line_counts(engine, None, hash, &[path.to_string()]).unwrap();
    let settled = counts
        .get(path)
        .copied()
        .expect("the engine settled no counts for the path");
    (settled.additions, settled.deletions)
}

#[test]
fn a_final_line_gaining_its_newline_counts_as_git_counts_it() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\ntwo", "no trailing newline");
    let hash = repo.commit_file("a.txt", "one\ntwo\n", "add the trailing newline");

    // git counts the last line as replaced: it gained its terminator.
    assert_eq!(
        git_numstat_counts(&repo, &hash, "a.txt"),
        (Some(1), Some(1))
    );
    let engine = open(&repo);
    assert_eq!(engine_counts(&engine, &hash, "a.txt"), (Some(1), Some(1)));
}

#[test]
fn a_crlf_to_lf_conversion_counts_every_line_as_git_does() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.git(&["config", "core.autocrlf", "false"]);
    repo.commit_file("a.txt", "one\r\ntwo\r\nthree\r\n", "CRLF");
    let hash = repo.commit_file("a.txt", "one\ntwo\nthree\n", "LF");

    // Every line's terminator changed, so git counts every line.
    assert_eq!(
        git_numstat_counts(&repo, &hash, "a.txt"),
        (Some(3), Some(3))
    );
    let engine = open(&repo);
    assert_eq!(engine_counts(&engine, &hash, "a.txt"), (Some(3), Some(3)));
}

#[test]
fn a_renamed_empty_file_is_one_rename_as_git_reports_it() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("empty.txt", "", "an empty file");
    repo.git(&["mv", "empty.txt", "moved.txt"]);
    let hash = repo.commit("move the empty file");

    // git pairs the two empty blobs into one rename.
    let name_status = repo.git(&[
        "diff-tree",
        "-r",
        "--no-commit-id",
        "--name-status",
        "-M",
        &hash,
    ]);
    assert_eq!(name_status.trim(), "R100\tempty.txt\tmoved.txt");

    let engine = open(&repo);
    let changes = diff::diff_commit(&engine, &hash).unwrap();
    assert_eq!(changes.len(), 1, "{changes:?}");
    assert_eq!(changes[0].kind, GitFileStatus::Renamed);
    assert_eq!(changes[0].old_file_path, "empty.txt");
    assert_eq!(changes[0].new_file_path, "moved.txt");
    assert_eq!(
        engine_counts(&engine, &hash, "moved.txt"),
        (Some(0), Some(0))
    );
}

#[test]
fn a_submodule_counts_as_git_counts_it() {
    require_git!();
    let mut sub_source = TestRepo::new();
    let sub_first = sub_source.commit_file("inside.txt", "one\n", "sub one");
    let sub_second = sub_source.commit_file("inside.txt", "two\n", "sub two");

    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "base\n", "base");
    let sub_path = sub_source.path().display().to_string().replace('\\', "/");
    repo.git(&[
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        "--quiet",
        &sub_path,
        "sub",
    ]);
    repo.git(&["-C", "sub", "checkout", "--quiet", &sub_first]);
    let added = repo.commit("add the submodule");
    repo.git(&["-C", "sub", "checkout", "--quiet", &sub_second]);
    let moved = repo.commit("move the submodule");

    // git's numstat for a gitlink is its one `Subproject commit` line.
    assert_eq!(git_numstat_counts(&repo, &added, "sub"), (Some(1), Some(0)));
    assert_eq!(git_numstat_counts(&repo, &moved, "sub"), (Some(1), Some(1)));

    let engine = open(&repo);
    assert_eq!(engine_counts(&engine, &added, "sub"), (Some(1), Some(0)));
    assert_eq!(engine_counts(&engine, &moved, "sub"), (Some(1), Some(1)));
}
