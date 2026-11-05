//! Every read the extension wires to the engine, run on a linked worktree and checked against what
//! `git` itself reports from inside that worktree (W40).
//!
//! The fixture has two linked worktrees of one repository: `wt é one` on its own branch with a
//! local commit, a stash, a dirty index, a ref of its own under `refs/worktree/` and a
//! `config.worktree` value; and `wt two`, detached on a commit no branch holds, so the only way to
//! reach that commit is through that worktree's HEAD. Both folder names are awkward on purpose.

#[macro_use]
mod common;

use std::collections::BTreeMap;
use std::path::PathBuf;

use git_graph_core::error::ErrorKind;
use git_graph_core::log::{self, WalkOptions};
use git_graph_core::repository::{Repo, RepoManager};
use git_graph_core::search::search_commits;
use git_graph_core::types::{CommitOrdering, RefReadOptions, SearchOptions};
use git_graph_core::{blob, config, details, diff, refs, stash, stats, status};

use common::TestRepo;

struct Fixture {
    repo: TestRepo,
    one: PathBuf,
    two: PathBuf,
    main_head: String,
    one_head: String,
    two_head: String,
}

const AUTHOR_ENV: &[(&str, &str)] = &[
    ("GIT_AUTHOR_DATE", "1700000000 +0200"),
    ("GIT_COMMITTER_DATE", "1700000000 +0200"),
];

fn fixture() -> Fixture {
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "base\n", "base");
    let main_head = repo.commit_file("b.txt", "second\n", "second");
    repo.git(&["tag", "v1"]);
    repo.add_fake_remote("origin", "main", &main_head);
    repo.git(&["config", "extensions.worktreeConfig", "true"]);

    let one = repo.add_worktree("wt é one", "feature");
    repo.git_in(
        &one,
        &["config", "--worktree", "user.name", "Worktree User"],
        &[],
    );
    repo.git_in(&one, &["update-ref", "refs/worktree/mine", "HEAD"], &[]);
    std::fs::write(one.join("one.txt"), "one\n").unwrap();
    repo.git_in(&one, &["add", "one.txt"], &[]);
    let mut env = AUTHOR_ENV.to_vec();
    env.push(("GIT_AUTHOR_NAME", "Alice"));
    env.push(("GIT_AUTHOR_EMAIL", "alice@example.com"));
    repo.git_in(&one, &["commit", "--quiet", "-m", "local commit"], &env);
    let one_head = repo
        .git_in(&one, &["rev-parse", "HEAD"], &[])
        .trim()
        .to_string();
    // A stash made in the worktree, then a dirty index and work tree on top of it.
    std::fs::write(one.join("a.txt"), "stashed\n").unwrap();
    repo.git_in(&one, &["stash", "push", "--quiet", "-m", "wip"], &[]);
    std::fs::write(one.join("a.txt"), "staged\n").unwrap();
    repo.git_in(&one, &["add", "a.txt"], &[]);
    std::fs::write(one.join("b.txt"), "unstaged\n").unwrap();
    std::fs::write(one.join("untracked.txt"), "new\n").unwrap();

    let two = repo.add_worktree("wt two", "other");
    repo.git_in(&two, &["checkout", "--quiet", "--detach"], &[]);
    std::fs::write(two.join("two.txt"), "two\n").unwrap();
    repo.git_in(&two, &["add", "two.txt"], &[]);
    let mut env = AUTHOR_ENV.to_vec();
    env.push(("GIT_AUTHOR_NAME", "Carol"));
    env.push(("GIT_AUTHOR_EMAIL", "carol@example.com"));
    env[0] = ("GIT_AUTHOR_DATE", "1700003600 -0500");
    env[1] = ("GIT_COMMITTER_DATE", "1700003600 -0500");
    repo.git_in(&two, &["commit", "--quiet", "-m", "detached commit"], &env);
    let two_head = repo
        .git_in(&two, &["rev-parse", "HEAD"], &[])
        .trim()
        .to_string();
    // The branch `other` stays on the base; only the detached HEAD holds the new commit.
    Fixture {
        repo,
        one,
        two,
        main_head,
        one_head,
        two_head,
    }
}

fn open(path: &std::path::Path) -> Repo {
    Repo::discover(path).expect("could not open the linked worktree")
}

fn lines(text: &str) -> Vec<String> {
    text.lines().map(str::to_string).collect()
}

#[test]
fn opens_a_linked_worktree_at_its_own_root() {
    require_git!();
    let f = fixture();
    let engine = open(&f.one);
    let top = f
        .repo
        .git_in(&f.one, &["rev-parse", "--show-toplevel"], &[]);
    assert_eq!(
        std::fs::canonicalize(engine.root()).unwrap(),
        std::fs::canonicalize(top.trim()).unwrap()
    );
    assert!(!engine.is_bare());
}

#[test]
fn refs_and_repo_info_match_git_on_a_linked_worktree() {
    require_git!();
    let f = fixture();
    let engine = open(&f.one);
    let snapshot = refs::read_refs(&engine, &RefReadOptions::default()).unwrap();

    assert_eq!(snapshot.ref_data.head.as_deref(), Some(f.one_head.as_str()));
    assert_eq!(snapshot.branch_head.as_deref(), Some("feature"));
    let mut branches = lines(
        &f.repo
            .git_in(&f.one, &["branch", "--format=%(refname:short)"], &[]),
    );
    branches.sort();
    let mut seen = snapshot.branches.clone();
    seen.sort();
    assert_eq!(seen, branches);
    assert_eq!(snapshot.tag_names, ["v1"]);
    // `refs/worktree/*` is never shown, as the CLI's own ref scans never show it.
    assert!(snapshot
        .ref_data
        .heads
        .iter()
        .all(|head| head.name != "mine"));
}

#[test]
fn the_commit_walk_matches_git_log_from_a_linked_worktree() {
    require_git!();
    let f = fixture();
    let engine = open(&f.one);
    let tips = log::all_tips(&engine, true, true).unwrap();
    let walked: Vec<String> = log::walk(
        &engine,
        &tips,
        &WalkOptions {
            limit: 100,
            ordering: CommitOrdering::Date,
            ..Default::default()
        },
    )
    .unwrap()
    .into_iter()
    .map(|record| record.hash)
    .collect();
    let expected = lines(&f.repo.git_in(
        &f.one,
        &[
            "log",
            "--format=%H",
            "--date-order",
            "HEAD",
            "--branches",
            "--tags",
            "--remotes",
        ],
        &[],
    ));
    assert_eq!(walked, expected);
}

#[test]
fn details_and_comparisons_match_git_on_a_linked_worktree() {
    require_git!();
    let f = fixture();
    let engine = open(&f.one);

    let detail = details::commit_details(&engine, &f.one_head).unwrap();
    assert_eq!(detail.author, "Alice");
    assert_eq!(detail.author_email, "alice@example.com");
    assert_eq!(detail.author_date, 1_700_000_000);
    let names: Vec<String> = detail
        .file_changes
        .iter()
        .map(|c| c.new_file_path.clone())
        .collect();
    assert_eq!(
        names,
        lines(&f.repo.git_in(
            &f.one,
            &["show", "--format=", "--name-only", &f.one_head],
            &[],
        ))
    );

    let compared = diff::diff_revisions(&engine, &f.main_head, &f.one_head).unwrap();
    let expected = lines(&f.repo.git_in(
        &f.one,
        &["diff", "--name-only", &f.main_head, &f.one_head],
        &[],
    ));
    let got: Vec<String> = compared.iter().map(|c| c.new_file_path.clone()).collect();
    assert_eq!(got, expected);
}

#[test]
fn the_uncommitted_row_and_staged_file_match_git_on_a_linked_worktree() {
    require_git!();
    let f = fixture();
    let engine = open(&f.one);

    let porcelain = lines(&f.repo.git_in(&f.one, &["status", "--porcelain"], &[]));
    assert_eq!(
        status::count_changes(&engine, true).unwrap(),
        porcelain.len()
    );

    let mut expected = lines(&f.repo.git_in(&f.one, &["diff", "--name-only", "HEAD"], &[]));
    expected.sort();
    let mut got: Vec<String> = details::uncommitted_details(&engine)
        .unwrap()
        .file_changes
        .iter()
        .map(|c| c.new_file_path.clone())
        .collect();
    got.sort();
    // `git diff HEAD` leaves untracked files out; the row lists them too.
    let mut tracked: Vec<String> = got
        .iter()
        .filter(|path| path.as_str() != "untracked.txt")
        .cloned()
        .collect();
    tracked.sort();
    assert_eq!(tracked, expected);

    let files = status::status_files(&engine, true).unwrap();
    assert_eq!(files.untracked, ["untracked.txt"]);

    // The staged file is the one in this worktree's own index, not the shared one.
    let staged = blob::index_file(&engine, "a.txt").unwrap();
    assert_eq!(staged.contents.as_deref(), Some("staged\n"));
}

#[test]
fn stashes_search_and_configuration_match_git_on_a_linked_worktree() {
    require_git!();
    let f = fixture();
    let engine = open(&f.one);

    let stashes = stash::read_stashes(&engine).unwrap();
    let expected = lines(
        &f.repo
            .git_in(&f.one, &["stash", "list", "--format=%H"], &[]),
    );
    assert_eq!(
        stashes.iter().map(|s| s.hash.clone()).collect::<Vec<_>>(),
        expected
    );
    assert_eq!(stashes.len(), 1);

    let hits = search_commits(
        &engine,
        &SearchOptions {
            query: "local".to_string(),
            max_results: 50,
            branches: None,
            authors: None,
            show_tags: true,
            show_remote_branches: true,
            hide_remotes: Vec::new(),
            use_author_date: false,
        },
    )
    .unwrap();
    let expected = lines(&f.repo.git_in(
        &f.one,
        &[
            "log",
            "--format=%H",
            "--fixed-strings",
            "--grep=local",
            "HEAD",
            "--branches",
            "--tags",
            "--remotes",
        ],
        &[],
    ));
    assert_eq!(
        hits.iter().map(|h| h.hash.clone()).collect::<Vec<_>>(),
        expected
    );

    // `config.worktree` wins over the shared local file, as it does for `git config`.
    let snapshot = config::read_config(&engine).unwrap();
    let cli_name = f.repo.git_in(&f.one, &["config", "user.name"], &[]);
    assert_eq!(snapshot.user_name.as_deref(), Some(cli_name.trim()));
    assert_eq!(snapshot.user_name.as_deref(), Some("Worktree User"));
}

fn cli_authors(f: &Fixture, dir: &std::path::Path) -> Vec<String> {
    let mut names = lines(&f.repo.git_in(dir, &["log", "--format=%an", "--all"], &[]));
    names.sort();
    names.dedup();
    names
}

#[test]
fn authors_include_every_worktrees_head_like_git_log_all() {
    require_git!();
    let f = fixture();
    for dir in [&f.one, &f.two, f.repo.path()] {
        let engine = open(dir);
        let mut names: Vec<String> = log::authors(&engine)
            .unwrap()
            .into_iter()
            .map(|author| author.name)
            .collect();
        names.sort();
        assert_eq!(names, cli_authors(&f, dir), "from {}", dir.display());
        assert!(
            names.contains(&"Carol".to_string()),
            "from {}",
            dir.display()
        );
    }
}

#[test]
fn author_stats_and_the_heatmap_include_every_worktrees_head() {
    require_git!();
    let f = fixture();
    for dir in [&f.one, &f.two, f.repo.path()] {
        let engine = open(dir);
        let shortlog = f
            .repo
            .git_in(dir, &["shortlog", "-sne", "--all", "--no-merges"], &[]);
        let mut expected: BTreeMap<String, usize> = BTreeMap::new();
        for line in shortlog.lines() {
            let (count, rest) = line.trim().split_once('\t').unwrap();
            expected.insert(rest.to_string(), count.trim().parse().unwrap());
        }
        let got: BTreeMap<String, usize> = stats::author_stats(&engine)
            .unwrap()
            .into_iter()
            .map(|s| (format!("{} <{}>", s.name, s.email), s.commits))
            .collect();
        assert_eq!(got, expected, "from {}", dir.display());

        let total: usize = stats::activity_heatmap(&engine)
            .unwrap()
            .iter()
            .map(|cell| cell.count)
            .sum();
        let dates = f
            .repo
            .git_in(dir, &["log", "--all", "--format=%aI", "--no-merges"], &[]);
        assert_eq!(total, dates.lines().count(), "from {}", dir.display());
    }
    assert!(f.two_head.len() == 40);
}

#[test]
fn a_removed_worktree_declines_instead_of_answering_from_the_shared_refs() {
    require_git!();
    let f = fixture();
    let manager = RepoManager::new();
    let handle = manager
        .get(&f.two)
        .expect("the worktree opens while it exists");
    assert!(handle.root().ends_with("wt two"));

    f.repo
        .git(&["worktree", "remove", "--force", f.two.to_str().unwrap()]);
    let error = manager
        .get(&f.two)
        .err()
        .expect("a removed worktree must not be served from a stale handle");
    assert_eq!(error.kind, ErrorKind::NotARepository);
    assert_eq!(manager.open_count(), 0, "the stale handle is evicted");
}

#[test]
fn a_moved_worktree_declines_at_its_old_path() {
    require_git!();
    let f = fixture();
    let manager = RepoManager::new();
    manager.get(&f.one).unwrap();
    let moved = f.repo.path().join(".worktrees").join("moved one");
    f.repo.git(&[
        "worktree",
        "move",
        f.one.to_str().unwrap(),
        moved.to_str().unwrap(),
    ]);
    assert_eq!(
        manager.get(&f.one).err().map(|e| e.kind),
        Some(ErrorKind::NotARepository)
    );
    assert!(manager.get(&moved).is_ok());
}
