//! `read_reflog` against the CLI query's own commands (`git log -g`, two
//! passes for index and entry time) on repositories built with the `git`
//! command line: the engine must give the same page, or decline so the CLI
//! answers. Fixtures live in temporary directories only.

#[macro_use]
mod common;

use std::fs;
use std::path::Path;

use git_graph_core::error::ErrorKind;
use git_graph_core::reflog::{read_reflog, ReflogPage, ReflogState};
use git_graph_core::Repo;

use common::TestRepo;

fn engine(
    from: &Path,
    ref_name: &str,
    limit: usize,
    offset: usize,
) -> git_graph_core::Result<ReflogPage> {
    read_reflog(
        &Repo::discover(from).expect("could not open the repository"),
        ref_name,
        limit,
        offset,
    )
}

fn declined(result: git_graph_core::Result<ReflogPage>) -> String {
    let error = result.expect_err("the engine should have declined");
    assert_eq!(error.kind, ErrorKind::Unsupported, "{error}");
    error.message
}

/// One shown entry as the CLI oracle reports it.
#[derive(Debug, PartialEq, Eq)]
struct CliEntry {
    hash: String,
    index: usize,
    time: i64,
    name: String,
    email: String,
    message: String,
}

fn git_out(home: &Path, cwd: &Path, args: &[&str]) -> String {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("HOME", home)
        .output()
        .expect("could not run git");
    assert!(
        output.status.success(),
        "`git {}` failed: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).expect("git printed non-UTF-8")
}

/// The ref's full name as the CLI query resolves it (`HEAD` stays `HEAD`).
fn cli_full_ref(home: &Path, cwd: &Path, ref_name: &str) -> String {
    if ref_name == "HEAD" {
        return "HEAD".to_string();
    }
    let out = git_out(
        home,
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            "--symbolic-full-name",
            "--end-of-options",
            ref_name,
        ],
    );
    let full = out.trim().to_string();
    assert!(!full.is_empty(), "the oracle cannot resolve {ref_name}");
    full
}

fn selector_number(selector: &str) -> usize {
    let start = selector.rfind("@{").expect("a selector");
    selector[start + 2..selector.len() - 1]
        .parse()
        .expect("a numeric selector")
}

/// The CLI query's page: the two `git log -g -z` passes, paired by position,
/// plus its `hasMore`. The oracle for every served case below.
fn cli_page(
    home: &Path,
    cwd: &Path,
    ref_name: &str,
    limit: usize,
    offset: usize,
) -> (Vec<CliEntry>, bool, String) {
    let full = cli_full_ref(home, cwd, ref_name);
    let run = |format: &str, date: Option<&str>| -> Vec<Vec<String>> {
        let mut args: Vec<String> = vec![
            "log".into(),
            "-g".into(),
            "-z".into(),
            "--no-show-signature".into(),
        ];
        if let Some(date) = date {
            args.push(format!("--date={date}"));
        }
        args.push(format!("--format={format}"));
        args.push(format!("--max-count={}", limit + 1));
        args.push(format!("--skip={offset}"));
        args.push("--end-of-options".into());
        args.push(full.clone());
        args.push("--".into());
        let refs: Vec<&str> = args.iter().map(String::as_str).collect();
        let out = git_out(home, cwd, &refs);
        let mut records: Vec<Vec<String>> = out
            .split('\0')
            .map(|record| record.split('\u{1f}').map(str::to_string).collect())
            .collect();
        if records
            .last()
            .is_some_and(|r| r.len() == 1 && r[0].is_empty())
        {
            records.pop();
        }
        records
    };
    let entries = run("%H%x1f%gd%x1f%gn%x1f%ge%x1f%gs", None);
    let times = run("%H%x1f%gd", Some("unix"));
    assert_eq!(entries.len(), times.len(), "the oracle passes disagree");
    let has_more = entries.len() > limit;
    let page: Vec<CliEntry> = entries
        .into_iter()
        .zip(times)
        .take(limit)
        .map(|(fields, time_fields)| {
            assert_eq!(fields[0], time_fields[0], "the oracle passes disagree");
            CliEntry {
                hash: fields[0].clone(),
                index: selector_number(&fields[1]),
                time: selector_number(&time_fields[1]) as i64,
                name: fields[2].clone(),
                email: fields[3].clone(),
                message: fields[4..].join("\u{1f}"),
            }
        })
        .collect();
    (page, has_more, full)
}

/// The engine page must equal the CLI page, entry for entry.
fn assert_same(home: &Path, cwd: &Path, ref_name: &str, limit: usize, offset: usize) -> ReflogPage {
    let page = engine(cwd, ref_name, limit, offset).expect("the engine declined");
    let (cli, has_more, full) = cli_page(home, cwd, ref_name, limit, offset);
    assert_eq!(page.ref_name, full, "ref for {ref_name}");
    assert_eq!(page.has_more, has_more, "hasMore for {ref_name}");
    assert_eq!(page.state, ReflogState::Entries, "state for {ref_name}");
    let mine: Vec<CliEntry> = page
        .entries
        .iter()
        .map(|e| CliEntry {
            hash: e.hash.clone(),
            index: e.index,
            time: e.time,
            name: e.name.clone(),
            email: e.email.clone(),
            message: e.message.clone(),
        })
        .collect();
    assert_eq!(
        mine, cli,
        "entries for {ref_name} (limit {limit}, offset {offset})"
    );
    page
}

#[test]
fn a_plain_history_with_amend_checkout_reset_and_merges_matches_the_cli() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.commit_file("b.txt", "two\n", "second");
    repo.git(&["commit", "--quiet", "--amend", "-m", "second, amended"]);
    repo.git(&["checkout", "--quiet", "-b", "topic"]);
    repo.commit_file("t.txt", "topic\n", "topic work");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("c.txt", "three\n", "third");
    repo.git(&["merge", "--quiet", "--no-ff", "topic", "-m", "merge topic"]);
    repo.git(&["checkout", "--quiet", "-b", "fast"]);
    repo.commit_file("f.txt", "fast\n", "fast work");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.git(&["merge", "--quiet", "--ff-only", "fast"]);
    repo.git(&["reset", "--quiet", "--soft", "HEAD~1"]);
    repo.commit("fast work, again");

    let home = repo.path();
    assert_same(home, home, "HEAD", 200, 0);
    assert_same(home, home, "main", 200, 0);
    assert_same(home, home, "refs/heads/main", 200, 0);
    assert_same(home, home, "topic", 200, 0);
    let page = assert_same(home, home, "HEAD", 200, 0);
    let messages: Vec<&str> = page.entries.iter().map(|e| e.message.as_str()).collect();
    assert!(
        messages.iter().any(|m| m.starts_with("commit (amend):")),
        "{messages:?}"
    );
    assert!(
        messages.iter().any(|m| m.starts_with("checkout:")),
        "{messages:?}"
    );
    assert!(
        messages.iter().any(|m| m.starts_with("reset:")),
        "{messages:?}"
    );
    assert!(
        messages.iter().any(|m| m.starts_with("merge ")),
        "{messages:?}"
    );
}

#[test]
fn a_rebase_replay_matches_the_cli() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.git(&["checkout", "--quiet", "-b", "topic"]);
    repo.commit_file("t.txt", "topic\n", "topic work");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("b.txt", "two\n", "main moves");
    repo.git(&["rebase", "--quiet", "main", "topic"]);

    let home = repo.path();
    let page = assert_same(home, home, "HEAD", 200, 0);
    assert_same(home, home, "topic", 200, 0);
    let messages: Vec<&str> = page.entries.iter().map(|e| e.message.as_str()).collect();
    assert!(
        messages.iter().any(|m| m.starts_with("rebase (pick):")),
        "{messages:?}"
    );
    assert!(
        messages.iter().any(|m| m.starts_with("rebase (finish):")),
        "{messages:?}"
    );
}

#[test]
fn the_selector_gap_of_a_branch_rename_matches_the_cli() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.git(&["checkout", "--quiet", "-b", "feat"]);
    repo.commit_file("b.txt", "two\n", "second");
    repo.git(&["branch", "-m", "feat", "feat2"]);
    repo.commit_file("c.txt", "three\n", "third");

    let home = repo.path();
    let page = assert_same(home, home, "HEAD", 200, 0);
    let indexes: Vec<usize> = page.entries.iter().map(|e| e.index).collect();
    // The rename's null-target entry keeps its number, so the shown indexes gap.
    assert_eq!(indexes, [0, 1, 3, 4, 5]);
    // A window starting past the gap keeps Git's numbers.
    assert_same(home, home, "HEAD", 2, 2);
}

#[test]
fn paging_crosses_a_boundary_without_a_gap_or_a_repeat() {
    require_git!();
    let mut repo = TestRepo::new();
    for name in ["a", "b", "c", "d", "e", "f"] {
        repo.commit_file(&format!("{name}.txt"), "x\n", name);
    }
    let home = repo.path();
    let all = assert_same(home, home, "HEAD", 100, 0);
    assert_eq!(all.entries.len(), 6);
    assert!(!all.has_more);
    let first = assert_same(home, home, "HEAD", 4, 0);
    let second = assert_same(home, home, "HEAD", 4, 4);
    assert!(first.has_more && !second.has_more);
    let joined: Vec<&str> = first
        .entries
        .iter()
        .chain(&second.entries)
        .map(|e| e.hash.as_str())
        .collect();
    let every: Vec<&str> = all.entries.iter().map(|e| e.hash.as_str()).collect();
    assert_eq!(joined, every);
    let past_end = engine(home, "HEAD", 4, 6).expect("the engine declined");
    assert!(past_end.entries.is_empty());
    assert_eq!(past_end.state, ReflogState::Entries);
    assert!(!past_end.has_more);
}

#[test]
fn the_entry_time_is_the_entrys_own_time() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.commit_file("b.txt", "two\n", "second");
    // The fixture clock starts at 1_600_000_000; check the older commit out
    // under a much later committer date, which stamps the reflog entry.
    repo.git_in(
        repo.path(),
        &["checkout", "--quiet", "-b", "later", "HEAD~1"],
        &[("GIT_COMMITTER_DATE", "1700000000 +0000")],
    );
    let home = repo.path();
    let page = assert_same(home, home, "HEAD", 200, 0);
    assert_eq!(page.entries[0].time, 1_700_000_000);
    assert!(page.entries[0].message.starts_with("checkout:"));
    // The checked-out commit itself is far older than the entry.
    let commit_time: i64 = repo
        .git(&["log", "-1", "--format=%ct", "HEAD"])
        .trim()
        .parse()
        .unwrap();
    assert!(commit_time < 1_700_000_000);
}

#[test]
fn a_detached_head_and_the_stash_ref_match_the_cli() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.commit_file("b.txt", "two\n", "second");
    repo.git(&["checkout", "--quiet", "--detach", "HEAD~1"]);
    repo.commit_file("d.txt", "detached\n", "detached work");
    repo.write("dirty.txt", "dirty\n");
    repo.git(&[
        "stash",
        "push",
        "--quiet",
        "--include-untracked",
        "-m",
        "keep",
    ]);

    let home = repo.path();
    assert_same(home, home, "HEAD", 200, 0);
    assert_same(home, home, "refs/stash", 200, 0);
    assert_same(home, home, "stash", 200, 0);
}

#[test]
fn a_linked_worktrees_head_log_is_its_own_and_branch_logs_are_shared() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    let linked = repo.add_worktree("linked wt", "feat");
    repo.git_in(
        &linked,
        &["commit", "--quiet", "--allow-empty", "-m", "linked work"],
        &[],
    );
    repo.commit_file("b.txt", "two\n", "main work");

    let home = repo.path();
    // Each worktree's HEAD log, read from that worktree, as the CLI does.
    assert_same(home, home, "HEAD", 200, 0);
    let linked_page = assert_same(home, &linked, "HEAD", 200, 0);
    assert!(
        linked_page
            .entries
            .iter()
            .any(|e| e.message.contains("linked work")),
        "{linked_page:?}"
    );
    // The branch log is the same file from either worktree.
    assert_same(home, home, "feat", 200, 0);
    assert_same(home, &linked, "feat", 200, 0);
    assert_same(home, &linked, "main", 200, 0);
}

#[test]
fn none_empty_and_unborn_are_told_apart() {
    require_git!();
    // Unborn: no commit yet. HEAD keeps no reflog; the branch names nothing.
    let unborn = TestRepo::new();
    let page = engine(unborn.path(), "HEAD", 200, 0).expect("the engine declined");
    assert_eq!(page.state, ReflogState::None);
    assert_eq!(page.ref_name, "HEAD");
    assert!(page.entries.is_empty() && !page.has_more);
    assert!(declined(engine(unborn.path(), "main", 200, 0)).contains("resolves to no reference"));

    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.git(&["tag", "v1"]);
    // A tag keeps no reflog, by short and by full name.
    for ref_name in ["v1", "refs/tags/v1"] {
        let page = engine(repo.path(), ref_name, 200, 0).expect("the engine declined");
        assert_eq!(page.state, ReflogState::None, "{ref_name}");
        assert_eq!(page.ref_name, "refs/tags/v1");
    }
    // Expired: the files stay, holding nothing. The branch reads empty; the
    // HEAD read declines because Git's branch fallback is open there.
    repo.git(&["reflog", "expire", "--expire=all", "--all"]);
    let page = engine(repo.path(), "main", 200, 0).expect("the engine declined");
    assert_eq!(page.state, ReflogState::Empty);
    assert!(declined(engine(repo.path(), "HEAD", 200, 0)).contains("empty HEAD reflog"));
}

#[test]
fn no_reflog_at_all_reads_none_for_a_branch_and_declines_for_head() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.git(&["config", "core.logAllRefUpdates", "false"]);
    repo.commit_file("a.txt", "one\n", "first");
    let page = engine(repo.path(), "main", 200, 0).expect("the engine declined");
    assert_eq!(page.state, ReflogState::None);
    assert!(declined(engine(repo.path(), "HEAD", 200, 0)).contains("no HEAD reflog file"));
}

#[test]
fn a_bare_repository_reads_none_for_a_branch_and_declines_for_head() {
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
    let page = engine(&bare, "main", 200, 0).expect("the engine declined");
    assert_eq!(page.state, ReflogState::None);
    assert_eq!(page.ref_name, "refs/heads/main");
    assert!(declined(engine(&bare, "HEAD", 200, 0)).contains("no HEAD reflog file"));
}

#[test]
fn unknown_hash_expression_and_dash_refs_decline() {
    require_git!();
    let mut repo = TestRepo::new();
    let hash = repo.commit_file("a.txt", "one\n", "first");
    for ref_name in [
        "no-such-branch",
        hash.as_str(),
        "HEAD~1",
        "main@{1}",
        "-x",
        "",
    ] {
        declined(engine(repo.path(), ref_name, 200, 0));
    }
}

#[test]
fn malformed_missing_and_non_commit_entries_decline() {
    require_git!();
    // A garbage line: Git skips it without counting it; the engine declines.
    let mut garbage = TestRepo::new();
    garbage.commit_file("a.txt", "one\n", "first");
    let head_log = garbage.path().join(".git/logs/HEAD");
    let mut contents = fs::read_to_string(&head_log).unwrap();
    contents.push_str("this is not a reflog line\n");
    fs::write(&head_log, contents).unwrap();
    assert!(declined(engine(garbage.path(), "HEAD", 200, 0)).contains("does not parse"));

    // A well-formed line pointing at an object that does not exist.
    let mut missing = TestRepo::new();
    let head = missing.commit_file("a.txt", "one\n", "first");
    let head_log = missing.path().join(".git/logs/HEAD");
    let mut contents = fs::read_to_string(&head_log).unwrap();
    contents.push_str(&format!(
        "{head} {} Test User <test@example.com> 1700000000 +0000\tfake: missing\n",
        "d".repeat(40)
    ));
    fs::write(&head_log, contents).unwrap();
    assert!(declined(engine(missing.path(), "HEAD", 200, 0)).contains("missing object"));

    // A well-formed line pointing at a tree.
    let mut tree = TestRepo::new();
    let head = tree.commit_file("a.txt", "one\n", "first");
    let tree_id = tree.git(&["rev-parse", "HEAD^{tree}"]).trim().to_string();
    let head_log = tree.path().join(".git/logs/HEAD");
    let mut contents = fs::read_to_string(&head_log).unwrap();
    contents.push_str(&format!(
        "{head} {tree_id} Test User <test@example.com> 1700000000 +0000\tfake: tree\n"
    ));
    fs::write(&head_log, contents).unwrap();
    assert!(declined(engine(tree.path(), "HEAD", 200, 0)).contains("non-commit"));
}

#[test]
fn a_missing_head_log_declines_instead_of_reading_the_branch_log() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.git(&["checkout", "--quiet", "-b", "side"]);
    repo.git(&["checkout", "--quiet", "main"]);
    // Git now reads the branch's log under HEAD selectors; the engine must
    // not guess that, so the CLI answers.
    fs::remove_file(repo.path().join(".git/logs/HEAD")).unwrap();
    assert!(declined(engine(repo.path(), "HEAD", 200, 0)).contains("no HEAD reflog file"));
    // The branch log itself still serves.
    assert_same(repo.path(), repo.path(), "main", 200, 0);
}

#[test]
fn a_symbolic_ref_declines_so_git_resolves_it() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "one\n", "first");
    repo.git(&["symbolic-ref", "refs/heads/alias", "refs/heads/main"]);
    assert!(declined(engine(repo.path(), "alias", 200, 0)).contains("symbolic ref"));
    assert!(declined(engine(repo.path(), "refs/heads/alias", 200, 0)).contains("symbolic ref"));
}
