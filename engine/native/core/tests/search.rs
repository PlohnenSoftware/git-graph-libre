//! The Find dialogue's search, checked against the semantics the `git` CLI backend has.
//!
//! The CLI searches with `--fixed-strings` (literal) plus a separate `--author` pass and a hash
//! lookup. Every test here pins one of those behaviours, because the engine's *other* search
//! (`log::search_history`) is a regex over messages only, and wiring that one would have silently
//! changed what users see.

#[macro_use]
mod common;

use git_graph_core::repository::Repo;
use git_graph_core::search::search_commits;
use git_graph_core::types::SearchOptions;

use common::TestRepo;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

fn options(query: &str) -> SearchOptions {
    SearchOptions {
        query: query.to_string(),
        max_results: 50,
        branches: None,
        authors: None,
        show_tags: true,
        show_remote_branches: true,
        hide_remotes: Vec::new(),
        use_author_date: false,
    }
}

fn subjects(repo: &TestRepo, query: &str) -> Vec<String> {
    let engine = open(repo);
    search_commits(&engine, &options(query))
        .expect("the search failed")
        .into_iter()
        .map(|result| result.message)
        .collect()
}

#[test]
fn matches_message_text_literally_rather_than_as_a_regular_expression() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "release a.c happened");
    repo.commit_file("b.txt", "2", "release abc happened");

    // `--fixed-strings`: the dot is a dot. A regex search would match both.
    assert_eq!(subjects(&repo, "a.c"), vec!["release a.c happened"]);
}

#[test]
fn a_query_that_is_not_valid_regex_searches_instead_of_failing() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "fix parsing of (unbalanced");
    repo.commit_file("b.txt", "2", "unrelated");

    // `(` fails to compile as a regex. The CLI finds the commit; so must this.
    assert_eq!(subjects(&repo, "("), vec!["fix parsing of (unbalanced"]);
}

#[test]
fn matches_regardless_of_case() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "Fix The Thing");

    assert_eq!(subjects(&repo, "fix the thing"), vec!["Fix The Thing"]);
}

#[test]
fn searches_the_whole_message_but_reports_only_the_subject() {
    require_git!();
    let repo = TestRepo::new();
    repo.write("a.txt", "1");
    repo.git(&["add", "-A"]);
    repo.git(&[
        "commit",
        "--quiet",
        "-m",
        "the subject",
        "-m",
        "a body mentioning windmills",
    ]);

    // `--grep` reads the whole message; `%s` prints the subject.
    let found = subjects(&repo, "windmills");
    assert_eq!(found, vec!["the subject"]);
}

#[test]
fn matches_the_author_as_well_as_the_message() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "nothing relevant");
    repo.commit_as("Ada Lovelace", "ada@example.invalid", "also nothing");

    assert_eq!(subjects(&repo, "lovelace"), vec!["also nothing"]);
    // The email counts too, because `--author` matches `Name <email>`.
    assert_eq!(subjects(&repo, "ada@example"), vec!["also nothing"]);
}

#[test]
fn resolves_an_abbreviated_hash() {
    require_git!();
    let mut repo = TestRepo::new();
    let first = repo.commit_file("a.txt", "1", "the one being looked up");
    repo.commit_file("b.txt", "2", "a later commit");

    let engine = open(&repo);
    let results = search_commits(&engine, &options(&first[..8])).expect("the search failed");
    assert_eq!(results.len(), 1, "the hash prefix did not resolve");
    assert_eq!(results[0].hash, first);
}

#[test]
fn a_hash_that_resolves_but_is_not_reachable_is_not_a_result() {
    require_git!();
    let mut repo = TestRepo::new();
    let reachable = repo.commit_file("a.txt", "1", "on the branch");
    // A commit left on no branch at all: `git log <hash>` still finds it, but the CLI drops it
    // because the numbering walk never reaches it.
    repo.git(&["checkout", "--quiet", "-b", "scratch"]);
    let orphan = repo.commit_file("b.txt", "2", "about to be unreferenced");
    repo.git(&["checkout", "--quiet", "-"]);
    repo.git(&["branch", "-D", "scratch"]);

    let engine = open(&repo);
    let results = search_commits(&engine, &options(&orphan[..8])).expect("the search failed");
    assert!(
        results.is_empty(),
        "an unreachable commit was returned as a result"
    );

    let results = search_commits(&engine, &options(&reachable[..8])).expect("the search failed");
    assert_eq!(results.len(), 1);
}

#[test]
fn orders_results_by_how_far_into_the_graph_they_are() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "match oldest");
    repo.commit_file("b.txt", "2", "unrelated");
    repo.commit_file("c.txt", "3", "match newest");

    let engine = open(&repo);
    let results = search_commits(&engine, &options("match")).expect("the search failed");
    let ordered: Vec<&str> = results.iter().map(|r| r.message.as_str()).collect();
    // Newest first, because that is the graph's own order, and `loadCount` counts down it.
    assert_eq!(ordered, vec!["match newest", "match oldest"]);
    assert!(
        results[0].load_count < results[1].load_count,
        "loadCount did not increase with depth: {:?}",
        results.iter().map(|r| r.load_count).collect::<Vec<_>>()
    );
    // Position is counted over every commit walked, not over the matches.
    assert_eq!(results[0].load_count, 1);
    assert_eq!(results[1].load_count, 3);
}

#[test]
fn the_author_filter_hides_commits_from_the_results_and_the_numbering() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Ada", "ada@example.invalid", "match from ada");
    repo.commit_as("Bob", "bob@example.invalid", "match from bob");

    let engine = open(&repo);
    let mut opts = options("match");
    opts.authors = Some(vec!["Ada".to_string()]);
    let results = search_commits(&engine, &opts).expect("the search failed");

    assert_eq!(
        results
            .iter()
            .map(|r| r.message.as_str())
            .collect::<Vec<_>>(),
        vec!["match from ada"]
    );
    // Bob's commit is not merely unmatched, it is not counted: Ada's is position 1, not 2.
    assert_eq!(results[0].load_count, 1);
}

#[test]
fn the_page_size_caps_the_results() {
    require_git!();
    let mut repo = TestRepo::new();
    for i in 0..10 {
        repo.commit_file("a.txt", &i.to_string(), &format!("match {i}"));
    }

    let engine = open(&repo);
    let mut opts = options("match");
    opts.max_results = 3;
    let results = search_commits(&engine, &opts).expect("the search failed");
    assert_eq!(results.len(), 3);
    // The three nearest the top of the graph, not an arbitrary three.
    assert_eq!(
        results.iter().map(|r| r.load_count).collect::<Vec<_>>(),
        vec![1, 2, 3]
    );
}

#[test]
fn an_empty_query_finds_nothing_rather_than_everything() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "something");

    assert!(subjects(&repo, "").is_empty());
    assert!(subjects(&repo, "   ").is_empty());
}

#[test]
fn a_commit_matching_both_message_and_author_appears_once() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Ada", "ada@example.invalid", "a commit by ada about ada");

    let engine = open(&repo);
    let results = search_commits(&engine, &options("ada")).expect("the search failed");
    assert_eq!(results.len(), 1, "the commit was returned twice");
}
