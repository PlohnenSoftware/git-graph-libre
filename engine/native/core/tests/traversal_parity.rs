//! The commit walk's traversal, compared with what `git log` reports for the same repository:
//! first-parent path filtering, topological order, and author-date page membership.

#[macro_use]
mod common;

use git_graph_core::log::{self, WalkOptions};
use git_graph_core::repository::Repo;
use git_graph_core::types::CommitOrdering;

use common::TestRepo;
use std::collections::HashMap;

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

// ---------------------------------------------------------------------------------------------
// Generated histories, built with one `git fast-import` spawn.
// ---------------------------------------------------------------------------------------------

/// A small deterministic generator (xorshift): the fixtures must be the same on every run.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }
}

/// How the commit dates of a generated history relate to each other.
#[derive(Clone, Copy, Debug)]
enum Clocks {
    /// Every commit is a minute after the previous one, author date equal to committer date.
    Ticking,
    /// Commits come in blocks that share one date, so the walks' tie-breaks decide the order.
    Equal,
    /// Author and committer dates are independent and a child may be older than its parent.
    Skewed,
}

/// One commit of a generated history: its parents (earlier indexes) and its two dates.
struct Spec {
    parents: Vec<usize>,
    author: i64,
    committer: i64,
    author_name: &'static str,
}

const BASE: i64 = 1_600_000_000;
const AUTHORS: [&str; 3] = ["Alice", "Bob", "Bobby"];

/// A random DAG of `count` commits: most commits extend a recent one, some start a side line,
/// some merge two earlier commits. Index 0 is the only root.
fn generate(seed: u64, count: usize, clocks: Clocks) -> Vec<Spec> {
    let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);
    let mut specs: Vec<Spec> = Vec::with_capacity(count);
    for index in 0..count {
        let parents = if index == 0 {
            Vec::new()
        } else {
            let recent = index - 1 - rng.below(index.min(4));
            match rng.below(6) {
                0 if index > 1 => {
                    let other = rng.below(index);
                    if other == recent {
                        vec![recent]
                    } else {
                        vec![recent, other]
                    }
                }
                1 => vec![rng.below(index)],
                _ => vec![recent],
            }
        };
        let (author, committer) = match clocks {
            Clocks::Ticking => (BASE + index as i64 * 60, BASE + index as i64 * 60),
            Clocks::Equal => {
                let block = BASE + (index / 5) as i64 * 60;
                (block, block)
            }
            Clocks::Skewed => (
                BASE + index as i64 * 60 + rng.below(3000) as i64 - 1500,
                BASE + index as i64 * 60 + rng.below(3000) as i64 - 1500,
            ),
        };
        specs.push(Spec {
            parents,
            author,
            committer,
            author_name: AUTHORS[rng.below(AUTHORS.len())],
        });
    }
    specs
}

/// Import `specs` into `repo` and give every commit nothing descends from a branch of its own.
/// Returns the hash of each commit, by index.
fn import(repo: &TestRepo, specs: &[Spec]) -> Vec<String> {
    let mut stream = String::new();
    for (index, spec) in specs.iter().enumerate() {
        let message = format!("c{index}");
        stream.push_str(&format!(
            "commit refs/heads/import\nmark :{mark}\nauthor {name} <{name}@example.com> {author} +0000\ncommitter Test User <test@example.com> {committer} +0000\ndata {len}\n{message}\n",
            mark = index + 1,
            name = spec.author_name,
            author = spec.author,
            committer = spec.committer,
            len = message.len(),
        ));
        if let Some(first) = spec.parents.first() {
            stream.push_str(&format!("from :{}\n", first + 1));
        }
        for other in spec.parents.iter().skip(1) {
            stream.push_str(&format!("merge :{}\n", other + 1));
        }
        stream.push('\n');
    }
    repo.git_stdin(
        &["fast-import", "--quiet", "--export-marks=.git/marks.txt"],
        &stream,
    );
    let marks = std::fs::read_to_string(repo.path().join(".git/marks.txt"))
        .expect("fast-import wrote no marks");
    let by_mark: HashMap<usize, String> = marks
        .lines()
        .filter_map(|line| {
            let (mark, hash) = line.split_once(' ')?;
            Some((mark.trim_start_matches(':').parse().ok()?, hash.to_string()))
        })
        .collect();
    let hashes: Vec<String> = (0..specs.len())
        .map(|i| by_mark[&(i + 1)].clone())
        .collect();

    let mut has_child = vec![false; specs.len()];
    for spec in specs {
        for parent in &spec.parents {
            has_child[*parent] = true;
        }
    }
    repo.git(&["update-ref", "-d", "refs/heads/import"]);
    for (index, hash) in hashes.iter().enumerate() {
        if !has_child[index] {
            repo.git(&["update-ref", &format!("refs/heads/tip{index}"), hash]);
        }
    }
    repo.git(&[
        "symbolic-ref",
        "HEAD",
        &format!("refs/heads/tip{}", hashes.len() - 1),
    ]);
    hashes
}

fn engine_hashes(repo: &TestRepo, tips: &[String], options: &WalkOptions) -> Vec<String> {
    let engine = open(repo);
    let ids: Vec<gix::ObjectId> = tips
        .iter()
        .map(|tip| gix::ObjectId::from_hex(tip.as_bytes()).expect("a hash"))
        .collect();
    log::walk(&engine, &ids, options)
        .expect("the walk failed")
        .into_iter()
        .map(|record| record.hash)
        .collect()
}

fn leaves(specs: &[Spec], hashes: &[String]) -> Vec<String> {
    let mut has_child = vec![false; specs.len()];
    for spec in specs {
        for parent in &spec.parents {
            has_child[*parent] = true;
        }
    }
    (0..specs.len())
        .filter(|index| !has_child[*index])
        .map(|index| hashes[index].clone())
        .collect()
}

/// One comparison of the engine's page with git's, over a generated history.
struct Case {
    ordering: CommitOrdering,
    flag: &'static str,
    /// Use only some of the leaves as tips, as a branch filter does.
    subset: bool,
    limit: usize,
    author: Option<&'static str>,
}

/// Count, over `seeds` histories of `count` commits, how many pages differ from git's.
fn disagreements(case: &Case, clocks: Clocks, count: usize, seeds: u64) -> (usize, Option<String>) {
    let mut bad = 0;
    let mut first = None;
    for seed in 1..=seeds {
        let repo = TestRepo::new();
        let specs = generate(seed, count, clocks);
        let hashes = import(&repo, &specs);
        let mut tips = leaves(&specs, &hashes);
        if case.subset {
            let mut rng = Rng(seed | 1);
            let kept: Vec<String> = tips.iter().filter(|_| rng.below(2) == 0).cloned().collect();
            tips = if kept.is_empty() {
                tips[..1].to_vec()
            } else {
                kept
            };
        }
        let limit = case.limit.to_string();
        let author = case.author.map(|name| format!("--author={name} <"));
        let mut args = vec![case.flag, "-n", limit.as_str()];
        if let Some(author) = &author {
            args.push(author.as_str());
        }
        args.extend(tips.iter().map(String::as_str));
        let expected = repo.log_hashes(&args);
        let options = WalkOptions {
            limit: case.limit,
            ordering: case.ordering,
            authors: case.author.map(|name| vec![name.to_string()]),
            ..Default::default()
        };
        let got = engine_hashes(&repo, &tips, &options);
        if got != expected {
            bad += 1;
            if first.is_none() {
                first = Some(format!(
                    "seed {seed}: git {} rows, engine {} rows",
                    expected.len(),
                    got.len()
                ));
            }
        }
    }
    (bad, first)
}

/// Every combination of clock, branch filter and author filter, over a small and a large history
/// (the large one is longer than the walk's window floor of 256 commits).
fn assert_parity(ordering: CommitOrdering, flag: &'static str, authors: &[Option<&'static str>]) {
    for clocks in [Clocks::Ticking, Clocks::Equal, Clocks::Skewed] {
        for (count, limit, seeds) in [(40, 1000, 6), (40, 12, 6), (320, 25, 2)] {
            for subset in [false, true] {
                for author in authors {
                    let case = Case {
                        ordering,
                        flag,
                        subset,
                        limit,
                        author: *author,
                    };
                    let (bad, first) = disagreements(&case, clocks, count, seeds);
                    assert_eq!(
                        bad,
                        0,
                        "{flag} {clocks:?} n={count} limit={limit} subset={subset} \
                         author={author:?}: {bad}/{seeds} pages differ ({})",
                        first.unwrap_or_default()
                    );
                }
            }
        }
    }
}

#[test]
fn topological_order_matches_git_on_generated_histories() {
    require_git!();
    assert_parity(
        CommitOrdering::Topo,
        "--topo-order",
        &[None, Some("Alice"), Some("Bob")],
    );
}

#[test]
fn date_order_matches_git_on_generated_histories() {
    require_git!();
    // Author filters are left out: a filtered date-order walk reads commits in commit-time order
    // only as far as its page needs and does not re-rank them (see `uses_ranked_walk`).
    assert_parity(CommitOrdering::Date, "--date-order", &[None]);
}

#[test]
fn topological_order_starts_from_the_newest_tip_and_keeps_a_line_together() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("src/base.txt", "0", "base");
    repo.git(&["checkout", "--quiet", "-b", "side"]);
    repo.commit_file("src/side1.txt", "1", "side 1");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("src/main1.txt", "1", "main 1");
    repo.git(&["checkout", "--quiet", "side"]);
    repo.commit_file("src/side2.txt", "2", "side 2");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("src/main2.txt", "2", "main 2");

    // git reverses its initially ready commits so the newest tip comes out first, then follows
    // the line it is on: main 2, main 1, side 2, side 1, base.
    let expected = repo.log_hashes(&["--topo-order", "--all"]);
    let options = WalkOptions {
        limit: 100,
        ordering: CommitOrdering::Topo,
        ..Default::default()
    };
    assert_eq!(hashes(&repo, &options), expected);
}

#[test]
fn topological_order_matches_git_across_merges_and_a_second_tip() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("base.txt", "0", "base");
    for round in 1..=3 {
        let topic = format!("topic{round}");
        repo.git(&["checkout", "--quiet", "-b", &topic]);
        repo.commit_file(&format!("{topic}a.txt"), "a", &format!("topic {round} a"));
        repo.git(&["checkout", "--quiet", "main"]);
        repo.commit_file(&format!("main{round}.txt"), "m", &format!("main {round}"));
        repo.git(&["checkout", "--quiet", &topic]);
        repo.commit_file(&format!("{topic}b.txt"), "b", &format!("topic {round} b"));
        repo.git(&["checkout", "--quiet", "main"]);
        repo.git(&[
            "merge",
            "--quiet",
            "--no-ff",
            "-m",
            &format!("merge {round}"),
            &topic,
        ]);
    }
    repo.git(&["checkout", "--quiet", "-b", "loose", "HEAD~1"]);
    repo.commit_file("loose.txt", "l", "loose");
    repo.git(&["checkout", "--quiet", "main"]);

    let options = WalkOptions {
        limit: 100,
        ordering: CommitOrdering::Topo,
        ..Default::default()
    };
    assert_eq!(
        hashes(&repo, &options),
        repo.log_hashes(&["--topo-order", "--all"])
    );
}

#[test]
fn topological_order_matches_git_across_a_criss_cross_merge() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("base.txt", "0", "base");
    repo.git(&["checkout", "--quiet", "-b", "left"]);
    repo.commit_file("left.txt", "1", "left 1");
    repo.git(&["checkout", "--quiet", "-b", "right", "main"]);
    repo.commit_file("right.txt", "1", "right 1");
    // Each side merges the other's first commit, then both carry on: two merge bases.
    repo.git(&["checkout", "--quiet", "left"]);
    repo.git(&[
        "merge",
        "--quiet",
        "--no-ff",
        "-m",
        "left takes right",
        "right",
    ]);
    repo.git(&["checkout", "--quiet", "right"]);
    repo.git(&[
        "merge",
        "--quiet",
        "--no-ff",
        "-m",
        "right takes left",
        "left~1",
    ]);
    repo.commit_file("right.txt", "2", "right 2");
    repo.git(&["checkout", "--quiet", "left"]);
    repo.commit_file("left.txt", "2", "left 2");
    repo.git(&[
        "merge",
        "--quiet",
        "--no-ff",
        "-m",
        "left takes right again",
        "right",
    ]);

    for (ordering, flag) in [
        (CommitOrdering::Topo, "--topo-order"),
        (CommitOrdering::Date, "--date-order"),
    ] {
        let options = WalkOptions {
            limit: 100,
            ordering,
            ..Default::default()
        };
        assert_eq!(
            hashes(&repo, &options),
            repo.log_hashes(&[flag, "--all"]),
            "{flag}"
        );
    }
}

#[test]
fn topological_order_surfaces_old_tips_that_a_date_window_would_cut() {
    require_git!();
    let repo = TestRepo::new();
    // Root R, a chain of 300 commits C0..C299 dated well after everything else, and three tips:
    // X on top of the chain (newest), Z on the chain's last commit (oldest) and O beside the
    // chain, off the root. git starts at X, finds C299 still waiting for Z, takes O and then Z
    // (newest tip first), and only then runs down the chain: X, O, Z, C299, ... A traversal that
    // visits commits by date reaches the whole chain before O and Z, and a window cut there
    // never sees them.
    let mut specs = vec![Spec {
        parents: Vec::new(),
        author: 50,
        committer: 50,
        author_name: "Alice",
    }];
    for index in 0..300 {
        let date = 10_000 + index as i64 * 60;
        specs.push(Spec {
            parents: vec![index],
            author: date,
            committer: date,
            author_name: "Alice",
        });
    }
    for (parent, date) in [(300, 20_000), (300, 100), (0, 200)] {
        specs.push(Spec {
            parents: vec![parent],
            author: date,
            committer: date,
            author_name: "Alice",
        });
    }
    let hashes_by_index = import(&repo, &specs);
    let tips = leaves(&specs, &hashes_by_index);
    assert_eq!(tips.len(), 3);

    let options = WalkOptions {
        limit: 20,
        ordering: CommitOrdering::Topo,
        ..Default::default()
    };
    let expected = repo.log_hashes(&["--topo-order", "--all", "-n", "20"]);
    assert_eq!(engine_hashes(&repo, &tips, &options), expected);
    // The page really does start with the three tips before the chain.
    assert_eq!(
        expected[..3],
        [301, 303, 302].map(|i| hashes_by_index[i].clone())
    );
}

#[test]
fn topological_order_matches_git_in_a_shallow_clone() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("base.txt", "0", "base");
    for round in 1..=4 {
        let topic = format!("topic{round}");
        repo.git(&["checkout", "--quiet", "-b", &topic]);
        repo.commit_file(&format!("{topic}.txt"), "a", &format!("topic {round}"));
        repo.git(&["checkout", "--quiet", "main"]);
        repo.commit_file(&format!("main{round}.txt"), "m", &format!("main {round}"));
        repo.git(&[
            "merge",
            "--quiet",
            "--no-ff",
            "-m",
            &format!("merge {round}"),
            &topic,
        ]);
    }
    let parent = tempfile::tempdir().expect("a temporary directory");
    let clone = parent.path().join("shallow");
    repo.git(&[
        "clone",
        "--quiet",
        "--depth=3",
        "--no-local",
        &format!("file://{}", repo.path().display()),
        clone.to_str().expect("a UTF-8 path"),
    ]);

    let engine = Repo::discover(&clone).expect("could not open the shallow clone");
    let tips = log::all_tips(&engine, true, true).expect("could not resolve the tips");
    for (ordering, flag) in [
        (CommitOrdering::Topo, "--topo-order"),
        (CommitOrdering::Date, "--date-order"),
    ] {
        let options = WalkOptions {
            limit: 100,
            ordering,
            ..Default::default()
        };
        let got: Vec<String> = log::walk(&engine, &tips, &options)
            .expect("the walk failed")
            .into_iter()
            .map(|record| record.hash)
            .collect();
        let expected: Vec<String> = repo
            .git_in(&clone, &["log", "--format=%H", flag, "--all"], &[])
            .lines()
            .map(str::to_string)
            .collect();
        assert_eq!(got, expected, "{flag}");
    }
}

#[test]
fn a_path_filtered_topological_page_matches_git() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("src/base.txt", "0", "base");
    repo.git(&["checkout", "--quiet", "-b", "side"]);
    repo.commit_file("src/side1.txt", "1", "side 1");
    repo.commit_file("docs/side.txt", "1", "side docs");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("src/main1.txt", "1", "main 1");
    repo.git(&["checkout", "--quiet", "side"]);
    repo.commit_file("src/side2.txt", "2", "side 2");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("src/main2.txt", "2", "main 2");

    let options = WalkOptions {
        limit: 100,
        ordering: CommitOrdering::Topo,
        filter_paths: vec!["src".to_string()],
        ..Default::default()
    };
    assert_eq!(
        hashes(&repo, &options),
        repo.log_hashes(&[
            "--topo-order",
            "--full-history",
            "--simplify-merges",
            "--all",
            "--",
            "src",
        ])
    );
}

#[test]
fn author_date_order_matches_git_on_generated_histories() {
    require_git!();
    assert_parity(
        CommitOrdering::AuthorDate,
        "--author-date-order",
        &[None, Some("Alice"), Some("Bob")],
    );
}

/// 300 commits ticking a minute apart on one line, plus one out-of-band commit off the oldest:
/// authored a day after the base (the newest author date of the repository, authored by `Bob`),
/// committed a minute after it (among the oldest committer dates).
fn out_of_band_history() -> Vec<Spec> {
    let mut specs: Vec<Spec> = (0..300)
        .map(|index| {
            let date = BASE + index as i64 * 60;
            Spec {
                parents: if index == 0 {
                    Vec::new()
                } else {
                    vec![index - 1]
                },
                author: date,
                committer: date,
                author_name: "Alice",
            }
        })
        .collect();
    specs.push(Spec {
        parents: vec![0],
        author: BASE + 86_400,
        committer: BASE + 60,
        author_name: "Bob",
    });
    specs
}

#[test]
fn the_author_date_page_holds_the_commits_git_puts_on_it() {
    require_git!();
    let repo = TestRepo::new();
    let specs = out_of_band_history();
    let imported = import(&repo, &specs);
    let tips = leaves(&specs, &imported);
    assert_eq!(tips.len(), 2);

    // git's own page: the out-of-band commit first (newest author date), then the newest-authored
    // commits of the main line. A committer-date window of 256 commits cannot contain it.
    let expected = repo.log_hashes(&["--author-date-order", "--all", "-n", "10"]);
    assert_eq!(expected[0], imported[300]);

    let options = WalkOptions {
        limit: 10,
        ordering: CommitOrdering::AuthorDate,
        ..Default::default()
    };
    assert_eq!(engine_hashes(&repo, &tips, &options), expected);

    // The control: under date order the same commit stays off the page.
    let expected_date = repo.log_hashes(&["--date-order", "--all", "-n", "10"]);
    let options = WalkOptions {
        limit: 10,
        ordering: CommitOrdering::Date,
        ..Default::default()
    };
    let got = engine_hashes(&repo, &tips, &options);
    assert_eq!(got, expected_date);
    assert!(!got.contains(&imported[300]));
}

#[test]
fn filtered_author_date_pages_hold_the_commits_git_puts_on_them() {
    require_git!();
    let repo = TestRepo::new();
    let specs = out_of_band_history();
    let imported = import(&repo, &specs);
    let tips = leaves(&specs, &imported);

    // An author filter: Bob wrote only the out-of-band commit, Alice the 300 others.
    for (name, limit) in [("Bob", 5), ("Alice", 10)] {
        let pattern = format!("--author={name} <");
        let expected = repo.log_hashes(&[
            "--author-date-order",
            "--all",
            "-n",
            &limit.to_string(),
            &pattern,
        ]);
        let options = WalkOptions {
            limit,
            ordering: CommitOrdering::AuthorDate,
            authors: Some(vec![name.to_string()]),
            ..Default::default()
        };
        assert_eq!(engine_hashes(&repo, &tips, &options), expected, "{name}");
    }

    // A branch filter: only the main line, whose newest-authored commits lead; and only the
    // out-of-band branch.
    for tip in &tips {
        let expected = repo.log_hashes(&["--author-date-order", "-n", "10", tip]);
        let options = WalkOptions {
            limit: 10,
            ordering: CommitOrdering::AuthorDate,
            ..Default::default()
        };
        assert_eq!(
            engine_hashes(&repo, std::slice::from_ref(tip), &options),
            expected
        );
    }
}

#[test]
fn a_path_filtered_author_date_page_matches_git() {
    require_git!();
    let repo = TestRepo::new();
    // The files are written commit by commit with distinct author and committer dates.
    let write_commit = |path: &str, message: &str, author: i64, committer: i64| {
        repo.write(path, message);
        repo.git(&["add", "-A"]);
        let author = format!("{author} +0000");
        let committer = format!("{committer} +0000");
        repo.git_in(
            repo.path(),
            &["commit", "--quiet", "-m", message],
            &[
                ("GIT_AUTHOR_DATE", author.as_str()),
                ("GIT_COMMITTER_DATE", committer.as_str()),
            ],
        );
    };
    write_commit("src/base.txt", "base", BASE, BASE);
    repo.git(&["checkout", "--quiet", "-b", "side"]);
    write_commit("src/side1.txt", "side 1", BASE + 5_000, BASE + 100);
    write_commit("docs/side.txt", "side docs", BASE + 5_100, BASE + 200);
    repo.git(&["checkout", "--quiet", "main"]);
    write_commit("src/main1.txt", "main 1", BASE + 300, BASE + 300);
    repo.git(&["merge", "--quiet", "--no-ff", "-m", "merge", "side"]);
    write_commit("src/main2.txt", "main 2", BASE + 400, BASE + 400);

    let options = WalkOptions {
        limit: 100,
        ordering: CommitOrdering::AuthorDate,
        filter_paths: vec!["src".to_string()],
        ..Default::default()
    };
    assert_eq!(
        hashes(&repo, &options),
        repo.log_hashes(&[
            "--author-date-order",
            "--full-history",
            "--simplify-merges",
            "--all",
            "--",
            "src",
        ])
    );
}

#[test]
fn author_date_pages_agree_across_a_page_boundary() {
    require_git!();
    let repo = TestRepo::new();
    let specs = generate(7, 60, Clocks::Skewed);
    let imported = import(&repo, &specs);
    let tips = leaves(&specs, &imported);

    // The view asks for one commit more than a page to learn whether "Load More" is needed: the
    // page must be the prefix of the longer one, and both must be git's.
    for ordering_flag in [
        (CommitOrdering::AuthorDate, "--author-date-order"),
        (CommitOrdering::Topo, "--topo-order"),
        (CommitOrdering::Date, "--date-order"),
    ] {
        let (ordering, flag) = ordering_flag;
        let page = |limit: usize| {
            engine_hashes(
                &repo,
                &tips,
                &WalkOptions {
                    limit,
                    ordering,
                    ..Default::default()
                },
            )
        };
        let git_page = |limit: usize| {
            let count = limit.to_string();
            let mut args = vec![flag, "-n", count.as_str()];
            args.extend(tips.iter().map(String::as_str));
            repo.log_hashes(&args)
        };
        for limit in [10, 11, 25, 26] {
            assert_eq!(page(limit), git_page(limit), "{flag} limit {limit}");
        }
        assert_eq!(
            page(11)[..10],
            page(10)[..],
            "{flag}: the longer page extends the shorter"
        );
    }
}
