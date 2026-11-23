//! The Statistics view's two reads, checked against what they're meant to reproduce:
//! `git shortlog -sne --all --no-merges` and `git log --all --format=%aI --no-merges` binned by
//! author-local weekday/hour.

#[macro_use]
mod common;

use std::collections::BTreeMap;
use std::path::Path;

use git_graph_core::repository::Repo;
use git_graph_core::stats;

use common::TestRepo;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

type Counts = BTreeMap<(String, String), usize>;

/// The counts `git shortlog -sne --all --no-merges` reports in `dir`, as a map.
fn shortlog_counts(repo: &TestRepo, dir: &Path) -> Counts {
    let output = repo.git_in(dir, &["shortlog", "-sne", "--all", "--no-merges"], &[]);
    let mut counts = Counts::new();
    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let (count, identity) = line
            .split_once('\t')
            .unwrap_or_else(|| panic!("unparsable shortlog line: {line:?}"));
        let count: usize = count
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("unparsable shortlog count: {line:?}"));
        let identity = identity.strip_suffix('>').unwrap_or(identity);
        let (name, email) = identity
            .rsplit_once(" <")
            .unwrap_or_else(|| panic!("unparsable shortlog identity: {line:?}"));
        *counts
            .entry((name.to_string(), email.to_string()))
            .or_insert(0) += count;
    }
    counts
}

/// The engine's counts for the repository at `dir`, as a map. Opens a fresh handle, so a
/// configuration change since the last call is seen.
fn engine_counts(dir: &Path) -> Counts {
    let engine = Repo::discover(dir).expect("could not open the fixture repository");
    let stats = stats::author_stats(&engine).expect("author_stats failed");
    let counts: Counts = stats
        .iter()
        .map(|row| ((row.name.clone(), row.email.clone()), row.commits))
        .collect();
    assert_eq!(
        counts.len(),
        stats.len(),
        "author_stats must not emit duplicate authors"
    );
    counts
}

/// The one assertion every mailmap case makes: same repository, same counts.
fn assert_shortlog_parity(repo: &TestRepo) {
    assert_shortlog_parity_in(repo, repo.path());
}

fn assert_shortlog_parity_in(repo: &TestRepo, dir: &Path) {
    assert_eq!(engine_counts(dir), shortlog_counts(repo, dir));
}

#[test]
fn counts_commits_per_author_like_git_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first"); // fixture default author
    repo.git(&[
        "commit",
        "--quiet",
        "--allow-empty",
        "--author=Bob <bob@example.com>",
        "-m",
        "by bob",
    ]);
    repo.git(&[
        "commit",
        "--quiet",
        "--allow-empty",
        "--author=Bob <bob@example.com>",
        "-m",
        "by bob again",
    ]);

    let engine = open(&repo);
    let stats = stats::author_stats(&engine).expect("author_stats failed");

    let bob = stats
        .iter()
        .find(|s| s.email == "bob@example.com")
        .expect("bob's commits must be counted");
    assert_eq!(bob.name, "Bob");
    assert_eq!(bob.commits, 2);

    // Sorted by commit count descending: bob (2 commits) before the fixture's single commit.
    assert_eq!(stats[0].email, "bob@example.com");
}

#[test]
fn excludes_merge_commits_from_the_author_count() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "base");
    repo.git(&["checkout", "--quiet", "-b", "feature"]);
    repo.commit_file("feature.txt", "f", "feature work");
    repo.git(&["checkout", "--quiet", "main"]);
    repo.commit_file("main.txt", "m", "main work");
    repo.git(&[
        "merge",
        "--quiet",
        "--no-ff",
        "-m",
        "merge feature",
        "feature",
    ]);

    let engine = open(&repo);
    let stats = stats::author_stats(&engine).expect("author_stats failed");
    // 4 real commits (base, feature work, main work) + the merge commit itself, which must be
    // excluded: --no-merges means the total across all authors is 3, not 4.
    let total: usize = stats.iter().map(|s| s.commits).sum();
    assert_eq!(total, 3, "the merge commit itself must not be counted");
}

#[test]
fn walks_refs_stash_matching_real_all_ref_coverage() {
    require_git!();
    // A stash creates a 2-parent "On <branch>: ..." commit (refs/stash's own target - a merge of
    // the base and an "index on ..." commit holding the staged state), plus that "index on ..."
    // commit itself, reachable only by walking refs/stash's parents (it has no ref of its own).
    // Verified directly against `git log --all --no-merges` before writing this test: the
    // "On <branch>: ..." tip is itself EXCLUDED by --no-merges (it has 2 parents), while the
    // "index on ..." commit survives (1 parent) - so of the two commits `refs/stash` newly makes
    // reachable, exactly one is counted. This pins that `stats::author_stats` walks refs/stash at
    // all (log::all_tips alone does not enumerate it - only stats::author_stats's extra merge-in
    // does), not that stashing conceptually "adds one commit".
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "base");
    repo.write("a.txt", "changed");
    repo.git(&["stash", "push", "--quiet", "-m", "the stash"]);

    let engine = open(&repo);
    let stats = stats::author_stats(&engine).expect("author_stats failed");
    let total: usize = stats.iter().map(|s| s.commits).sum();
    assert_eq!(
        total, 2,
        "base + the stash's non-merge \"index on ...\" commit"
    );
}

#[test]
fn bins_activity_by_the_committed_weekday_and_hour_digits_not_the_true_utc_instant() {
    require_git!();
    let repo = TestRepo::new();
    // 2024-01-01 was a Monday (weekday 1). The literal hour digit is 23, even though the +05:00
    // offset means the true UTC instant is already the next calendar day (2024-01-01T18:30Z -
    // still Monday, but 18:00, not 23:00). The printed digits, not the UTC instant, must win.
    repo.git(&[
        "commit",
        "--quiet",
        "--allow-empty",
        "--date=2024-01-01T23:30:00+05:00",
        "-m",
        "late commit",
    ]);

    let engine = open(&repo);
    let cells = stats::activity_heatmap(&engine).expect("activity_heatmap failed");

    let cell = cells
        .iter()
        .find(|c| c.weekday == 1 && c.hour == 23)
        .unwrap_or_else(|| panic!("expected a Monday/23:00 cell, got: {cells:?}"));
    assert_eq!(cell.count, 1);
}

#[test]
fn aggregates_two_commits_in_the_same_cell() {
    require_git!();
    let repo = TestRepo::new();
    for _ in 0..2 {
        repo.git(&[
            "commit",
            "--quiet",
            "--allow-empty",
            "--date=2024-01-01T10:00:00+00:00", // a Monday
            "-m",
            "same slot",
        ]);
    }

    let engine = open(&repo);
    let cells = stats::activity_heatmap(&engine).expect("activity_heatmap failed");
    let monday_ten = cells
        .iter()
        .find(|c| c.weekday == 1 && c.hour == 10)
        .expect("expected a Monday/10:00 cell");
    assert_eq!(monday_ten.count, 2);
}

#[test]
fn never_emits_a_zero_count_cell() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    repo.commit_file("b.txt", "2", "second");

    let engine = open(&repo);
    let cells = stats::activity_heatmap(&engine).expect("activity_heatmap failed");
    assert!(cells.iter().all(|c| c.count > 0));
}

/* ---------- Mailmap parity with `git shortlog` (F3-05) ---------- */

#[test]
fn matches_shortlog_without_a_mailmap() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.commit_as("Robert", "bob@example.com", "also bob, another name");
    assert_shortlog_parity(&repo);
}

#[test]
fn merges_two_identities_of_one_person_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "one");
    repo.commit_as("Robert", "old@example.com", "two");
    repo.commit_as("Bob", "bob@example.com", "three");
    repo.write(
        ".mailmap",
        "Robert Smith <bob@example.com> <old@example.com>\nRobert Smith <bob@example.com>\n",
    );
    assert_shortlog_parity(&repo);
    let counts = engine_counts(repo.path());
    assert_eq!(
        counts[&("Robert Smith".into(), "bob@example.com".into())],
        3,
        "both identities must land on the canonical author"
    );
}

#[test]
fn name_only_and_email_only_mappings_match_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "name only");
    repo.commit_as("Alice", "alice@old.example.com", "email only");
    repo.write(
        ".mailmap",
        "Robert Smith <bob@example.com>\n<alice@example.com> <alice@old.example.com>\n",
    );
    assert_shortlog_parity(&repo);
}

#[test]
fn name_and_email_keyed_mapping_leaves_other_names_alone() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("bob", "bob@example.com", "lowercase name");
    repo.commit_as("Alice", "bob@example.com", "same email, another name");
    repo.write(
        ".mailmap",
        "Proper <proper@example.com> Bob <bob@example.com>\n",
    );
    assert_shortlog_parity(&repo);
}

#[test]
fn name_only_mapping_keeps_the_commit_email_case_like_shortlog() {
    require_git!();
    // Git matches the email ignoring case but prints the commit's own spelling when the
    // entry only renames, so the two spellings stay two rows. gix's own resolve would
    // normalize the case and merge them.
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "lower");
    repo.commit_as("Bob", "BOB@EXAMPLE.COM", "upper");
    repo.write(".mailmap", "Robert Smith <bob@example.com>\n");
    assert_shortlog_parity(&repo);
}

#[test]
fn uncommitted_mailmap_applies_and_a_deleted_one_stops_applying() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write(".mailmap", "Robert <bob@example.com>\n");
    repo.commit("add the mailmap");
    assert_shortlog_parity(&repo);
    // Git reads the working tree's file, not the committed one.
    repo.remove(".mailmap");
    assert_shortlog_parity(&repo);
}

#[test]
fn malformed_mailmap_lines_are_ignored_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write(
        ".mailmap",
        "# a comment\nnot a mapping\nRobert <bob@example.com>\n<broken\n",
    );
    assert_shortlog_parity(&repo);
}

#[test]
fn later_duplicate_and_partial_entries_match_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write(
        ".mailmap",
        "First <first@example.com> <bob@example.com>\nSecond <bob@example.com>\n",
    );
    assert_shortlog_parity(&repo);
    // Only the canonical name is restated by the augmenting file; whether the canonical
    // email from the first entry survives is shortlog's call, and the engine must agree.
    repo.write("extra.map", "Third <bob@example.com>\n");
    let extra = repo.path().join("extra.map");
    repo.git(&["config", "mailmap.file", extra.to_str().unwrap()]);
    assert_shortlog_parity(&repo);
}

#[test]
fn mailmap_is_not_applied_transitively() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Ann", "ann@example.com", "by ann");
    repo.write(
        ".mailmap",
        "Bee <bee@example.com> <ann@example.com>\nCee <cee@example.com> <bee@example.com>\n",
    );
    assert_shortlog_parity(&repo);
}

#[test]
fn mailmap_file_and_blob_precedence_matches_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write(".mailmap", "FromDefault <bob@example.com>\n");
    assert_shortlog_parity(&repo);

    let blob = repo
        .git_stdin(&["hash-object", "-w", "--stdin"], "FromBlob <bob@example.com>\n")
        .trim()
        .to_string();
    repo.git(&["config", "mailmap.blob", &blob]);
    assert_shortlog_parity(&repo);

    repo.write("extra.map", "FromFile <bob@example.com>\n");
    let extra = repo.path().join("extra.map");
    repo.git(&["config", "mailmap.file", extra.to_str().unwrap()]);
    assert_shortlog_parity(&repo);
}

#[test]
fn mailmap_blob_accepts_a_revision_path_spec_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write("m.map", "BlobSpec <bob@example.com>\n");
    repo.commit("add the blob mailmap");
    repo.git(&["config", "mailmap.blob", "HEAD:m.map"]);
    assert_shortlog_parity(&repo);
}

#[test]
fn relative_mailmap_file_resolves_from_the_worktree_top() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write("extra.map", "RelFile <bob@example.com>\n");
    repo.git(&["config", "mailmap.file", "extra.map"]);
    assert_shortlog_parity(&repo);
}

#[test]
fn missing_mailmap_file_and_bad_blob_are_skipped_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write(".mailmap", "Robert <bob@example.com>\n");
    let missing = repo.path().join("nope.map");
    repo.git(&["config", "mailmap.file", missing.to_str().unwrap()]);
    repo.git(&[
        "config",
        "mailmap.blob",
        "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    ]);
    assert_shortlog_parity(&repo);
}

#[test]
fn bare_repository_reads_the_committed_mailmap_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write(".mailmap", "Robert <bob@example.com>\n");
    repo.commit("add the mailmap");
    let bare = repo.path().join("bare.git");
    repo.git(&["clone", "--quiet", "--bare", ".", bare.to_str().unwrap()]);
    assert_shortlog_parity_in(&repo, &bare);
}

#[test]
fn linked_worktree_reads_its_own_mailmap_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    let worktree = repo.add_worktree("linked", "linked-branch");
    std::fs::write(worktree.join(".mailmap"), "Robert <bob@example.com>\n")
        .expect("could not write the worktree mailmap");
    assert_shortlog_parity_in(&repo, &worktree);
    // The main worktree has no mailmap and must stay unmapped.
    assert_shortlog_parity(&repo);
}

#[cfg(unix)]
#[test]
fn symlinked_worktree_mailmap_is_skipped_like_shortlog() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    repo.write("real.map", "Robert <bob@example.com>\n");
    std::os::unix::fs::symlink(repo.path().join("real.map"), repo.path().join(".mailmap"))
        .expect("could not symlink the mailmap");
    assert_shortlog_parity(&repo);
}

#[test]
fn non_utf8_canonical_name_declines_instead_of_guessing() {
    require_git!();
    // Shortlog would print the raw byte; this read serves UTF-8 repositories only, so a
    // matched canonical name that is not UTF-8 declines the whole read.
    let mut repo = TestRepo::new();
    repo.commit_as("Bob", "bob@example.com", "by bob");
    std::fs::write(repo.path().join(".mailmap"), b"Ren\xe9 <bob@example.com>\n")
        .expect("could not write the mailmap");
    let engine = open(&repo);
    let error = stats::author_stats(&engine).expect_err("the read must decline");
    assert_eq!(error.kind, git_graph_core::error::ErrorKind::Unsupported);
}
