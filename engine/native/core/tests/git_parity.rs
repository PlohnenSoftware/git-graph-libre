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
use git_graph_core::{blob, details, diff, graph, log, status};

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

/// `git`'s one-letter status for a change, as `--name-status` prints it.
fn status_letter(kind: GitFileStatus) -> &'static str {
    match kind {
        GitFileStatus::Added => "A",
        GitFileStatus::Modified => "M",
        GitFileStatus::Deleted => "D",
        GitFileStatus::Renamed => "R",
        GitFileStatus::TypeChanged => "T",
        GitFileStatus::Untracked => "U",
    }
}

/// `<letter>\t<path>` lines for the engine's file changes, to set beside `--name-status`.
fn name_status_lines(changes: &[git_graph_core::types::GitFileChange]) -> Vec<String> {
    changes
        .iter()
        .map(|change| format!("{}\t{}", status_letter(change.kind), change.new_file_path))
        .collect()
}

/// Every read the engine serves for the fixture, set beside what git shows for it.
fn assert_reads_match_git_under_replacements(repo: &TestRepo, two: &str, expected_commits: usize) {
    let engine = open(repo);
    let options = LogOptions {
        max_commits: 10,
        ..Default::default()
    };

    // The history walk follows the replaced parents, as `git log` does.
    let git_hashes = repo.log_hashes(&[]);
    assert_eq!(git_hashes.len(), expected_commits);
    let engine_hashes: Vec<String> = graph::load_commits(&engine, &options)
        .unwrap()
        .commits
        .into_iter()
        .map(|commit| commit.hash)
        .collect();
    assert_eq!(engine_hashes, git_hashes);

    // Commit details list the replaced commit's files against the replacement's parents.
    let expected_files: Vec<String> = repo
        .git(&[
            "diff-tree",
            "-r",
            "--root",
            "--no-commit-id",
            "--name-status",
            "--find-renames",
            two,
        ])
        .lines()
        .map(str::to_string)
        .collect();
    let details = details::commit_details(&engine, two).unwrap();
    assert_eq!(name_status_lines(&details.file_changes), expected_files);

    // A comparison reads the replaced commit's tree.
    let expected_range: Vec<String> = repo
        .git(&["diff", "--name-status", "--find-renames", two, "HEAD"])
        .lines()
        .map(str::to_string)
        .collect();
    let range = diff::diff_revisions(&engine, two, "HEAD").unwrap();
    assert_eq!(name_status_lines(&range), expected_range);

    // The file at a revision comes from the tree git reads.
    let expected_text = repo.git(&["show", &format!("{two}:a.txt")]);
    let file = blob::commit_file(&engine, two, "a.txt").unwrap();
    assert_eq!(file.contents.as_deref(), Some(expected_text.as_str()));

    // Search walks the same history: "one" is found only while the first commit is reachable.
    let search = SearchOptions {
        query: "one".to_string(),
        max_results: 10,
        show_tags: true,
        ..Default::default()
    };
    let hits: Vec<String> = search_commits(&engine, &search)
        .unwrap()
        .into_iter()
        .map(|hit| hit.hash)
        .collect();
    assert_eq!(hits, repo.log_hashes(&["-i", "--grep=one"]));
}

#[test]
fn the_engine_matches_git_under_replacement_objects() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "one");
    let two = repo.commit_file("a.txt", "2", "two");
    repo.commit_file("a.txt", "3", "three");

    // Without replacements: three commits.
    assert_reads_match_git_under_replacements(&repo, &two, 3);

    // `git replace --graft` makes `two` a root: git shows two commits.
    repo.git(&["replace", "--graft", &two]);
    assert_reads_match_git_under_replacements(&repo, &two, 2);

    // `core.useReplaceRefs=false` makes git read the original objects again: three commits.
    repo.git(&["config", "core.useReplaceRefs", "false"]);
    assert_reads_match_git_under_replacements(&repo, &two, 3);
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

/* ---------- Type changes ---------- */

/// One file row: status letter, path and `+N/-M`, `None` being numstat's dash.
type Row = (String, String, Option<u32>, Option<u32>);

/// Write a blob through plumbing, so no symlink or submodule needs to exist on disk.
fn write_blob(repo: &TestRepo, contents: &str) -> String {
    repo.git_stdin(&["hash-object", "-w", "--stdin"], contents)
        .trim()
        .to_string()
}

/// A commit for a gitlink to name; it never needs to be checked out.
fn write_gitlink_commit(repo: &TestRepo, message: &str) -> String {
    let tree = repo.git_stdin(&["mktree"], "").trim().to_string();
    repo.git(&["commit-tree", &tree, "-m", message])
        .trim()
        .to_string()
}

/// Stage `(mode, id, path)` entries and commit the index as it stands.
fn commit_entries(repo: &TestRepo, entries: &[(&str, &str, &str)], message: &str) -> String {
    for (mode, id, path) in entries {
        let entry = format!("{mode},{id},{path}");
        repo.git(&["update-index", "--add", "--cacheinfo", &entry]);
    }
    repo.git(&["commit", "--quiet", "-m", message]);
    repo.head()
}

/// What `git diff --name-status` and `--numstat` report for `from..to`.
fn git_rows(repo: &TestRepo, from: &str, to: &str) -> Vec<Row> {
    let numstat = repo.git(&["diff", "--numstat", "--find-renames", from, to]);
    let counts: std::collections::HashMap<&str, (Option<u32>, Option<u32>)> = numstat
        .lines()
        .filter_map(|line| {
            let mut fields = line.splitn(3, '\t');
            let (added, deleted) = (fields.next()?, fields.next()?);
            Some((fields.next()?, (added.parse().ok(), deleted.parse().ok())))
        })
        .collect();
    repo.git(&["diff", "--name-status", "--find-renames", from, to])
        .lines()
        .map(|line| {
            let (status, path) = line.split_once('\t').expect("a name-status line");
            let (added, deleted) = counts[path];
            (status.to_string(), path.to_string(), added, deleted)
        })
        .collect()
}

/// The engine's rows for the same diff; `from` is `None` for a commit against its first parent.
fn engine_rows(engine: &Repo, from: Option<&str>, to: &str) -> Vec<Row> {
    let changes = match from {
        Some(from) => diff::diff_revisions(engine, from, to),
        None => diff::diff_commit(engine, to),
    }
    .unwrap();
    let paths: Vec<String> = changes.iter().map(|c| c.new_file_path.clone()).collect();
    let counts = diff::line_counts(engine, from, to, &paths).unwrap();
    let mut rows: Vec<Row> = changes
        .iter()
        .map(|change| {
            let letter = serde_json::to_value(change.kind).unwrap();
            let settled = counts[&change.new_file_path];
            (
                letter.as_str().unwrap().to_string(),
                change.new_file_path.clone(),
                settled.additions,
                settled.deletions,
            )
        })
        .collect();
    rows.sort_by(|a, b| a.1.cmp(&b.1));
    rows
}

fn row(status: &str, path: &str, added: Option<u32>, deleted: Option<u32>) -> Row {
    (status.to_string(), path.to_string(), added, deleted)
}

#[test]
fn type_changes_list_and_count_as_git_does() {
    require_git!();
    let repo = TestRepo::new();
    let three = write_blob(&repo, "one\ntwo\nthree\n");
    let edited = write_blob(&repo, "one\ntwo\nthree\nfour\n");
    let target = write_blob(&repo, "target/path");
    let retarget = write_blob(&repo, "other/target");
    let binary = write_blob(&repo, "a\0b\n");
    let sub = write_gitlink_commit(&repo, "sub one");
    let sub2 = write_gitlink_commit(&repo, "sub two");
    let sub3 = write_gitlink_commit(&repo, "sub three");
    let (file, link, gitlink, exec) = ("100644", "120000", "160000", "100755");

    let before = commit_entries(
        &repo,
        &[
            (file, &three, "file-to-link"),
            (file, &three, "file-to-gitlink"),
            (link, &target, "link-to-file"),
            (link, &target, "link-to-gitlink"),
            (gitlink, &sub, "gitlink-to-file"),
            (gitlink, &sub, "gitlink-to-link"),
            (file, &target, "same-bytes"),
            (file, &binary, "binary-to-link"),
            (file, &binary, "binary-to-gitlink"),
            (file, &three, "executable"),
            (gitlink, &sub, "gitlink-update"),
        ],
        "before",
    );
    let changed = commit_entries(
        &repo,
        &[
            (link, &target, "file-to-link"),
            (gitlink, &sub, "file-to-gitlink"),
            (file, &three, "link-to-file"),
            (gitlink, &sub2, "link-to-gitlink"),
            (file, &three, "gitlink-to-file"),
            (link, &retarget, "gitlink-to-link"),
            (link, &target, "same-bytes"),
            (link, &target, "binary-to-link"),
            (gitlink, &sub, "binary-to-gitlink"),
            (exec, &three, "executable"),
            (gitlink, &sub2, "gitlink-update"),
        ],
        "change every type",
    );
    // Then ordinary modifications on top: T followed by M, and D05's gitlink add and delete.
    repo.git(&["rm", "--cached", "--quiet", "gitlink-update"]);
    let after = commit_entries(
        &repo,
        &[
            (link, &retarget, "file-to-link"),
            (file, &edited, "gitlink-to-file"),
            (gitlink, &sub3, "link-to-gitlink"),
            (gitlink, &sub3, "gitlink-added"),
        ],
        "modify on top",
    );

    // git's own answers, pinned: a gitlink diffs as its one `Subproject commit` line, a symlink as
    // its target, identical bytes count nothing, and a binary side counts as binary.
    let expected = vec![
        row("T", "binary-to-gitlink", None, None),
        row("T", "binary-to-link", None, None),
        row("M", "executable", Some(0), Some(0)),
        row("T", "file-to-gitlink", Some(1), Some(3)),
        row("T", "file-to-link", Some(1), Some(3)),
        row("T", "gitlink-to-file", Some(3), Some(1)),
        row("T", "gitlink-to-link", Some(1), Some(1)),
        row("M", "gitlink-update", Some(1), Some(1)),
        row("T", "link-to-file", Some(3), Some(1)),
        row("T", "link-to-gitlink", Some(1), Some(1)),
        row("T", "same-bytes", Some(0), Some(0)),
    ];
    assert_eq!(git_rows(&repo, &before, &changed), expected);
    assert_eq!(
        git_rows(&repo, &changed, &after),
        vec![
            row("M", "file-to-link", Some(1), Some(1)),
            row("A", "gitlink-added", Some(1), Some(0)),
            row("M", "gitlink-to-file", Some(1), Some(0)),
            row("D", "gitlink-update", Some(0), Some(1)),
            row("M", "link-to-gitlink", Some(1), Some(1)),
        ]
    );

    let engine = open(&repo);
    for (from, to) in [
        (&before, &changed),
        (&changed, &after),
        (&before, &after),
        (&after, &before),
    ] {
        assert_eq!(
            engine_rows(&engine, Some(from), to),
            git_rows(&repo, from, to),
            "comparison {from}..{to}"
        );
    }
    assert_eq!(engine_rows(&engine, None, &changed), expected);
    assert_eq!(
        engine_rows(&engine, None, &after),
        git_rows(&repo, &changed, &after)
    );
}
