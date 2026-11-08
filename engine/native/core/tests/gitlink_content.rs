//! A gitlink (submodule entry, mode 160000) read at a revision or from the index.
//!
//! The answer is the diff-display line `Subproject commit <hash>\n`, as text. It is what a diff
//! shows for a submodule, not what `git show <rev>:<path>` prints. The submodule commit is never
//! looked up: these fixtures point the gitlink at a commit that is NOT in the superproject.

#[macro_use]
mod common;

use git_graph_core::blob;
use git_graph_core::error::ErrorKind;
use git_graph_core::repository::Repo;

use common::TestRepo;

const SUBMODULE_COMMIT: &str = "1234567890abcdef1234567890abcdef12345678";

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

fn stage_gitlink(repo: &TestRepo, path: &str, hash: &str) {
    repo.git(&[
        "update-index",
        "--add",
        "--cacheinfo",
        &format!("160000,{hash},{path}"),
    ]);
}

/// Commit what is staged. `TestRepo::commit` runs `git add -A`, which would drop a gitlink whose
/// directory does not exist in the working tree.
fn commit_staged(repo: &TestRepo, message: &str) -> String {
    repo.git(&["commit", "--quiet", "-m", message]);
    repo.head()
}

fn expected(hash: &str) -> String {
    format!("Subproject commit {hash}\n")
}

#[test]
fn a_revision_gitlink_reads_as_the_subproject_line() {
    require_git!();
    let repo = TestRepo::new();
    repo.write("a.txt", "1");
    repo.git(&["add", "a.txt"]);
    stage_gitlink(&repo, "libs/sub", SUBMODULE_COMMIT);
    let hash = commit_staged(&repo, "add a gitlink");
    let engine = open(&repo);

    let file = blob::commit_file(&engine, &hash, "libs/sub").unwrap();
    assert_eq!(file.contents, Some(expected(SUBMODULE_COMMIT)));
    assert!(!file.binary);
}

#[test]
fn a_staged_gitlink_reads_as_the_subproject_line() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    stage_gitlink(&repo, "sub", SUBMODULE_COMMIT);
    let engine = open(&repo);

    let file = blob::index_file(&engine, "sub").unwrap();
    assert_eq!(file.contents, Some(expected(SUBMODULE_COMMIT)));
    assert!(!file.binary);
}

#[test]
fn a_moved_gitlink_shows_each_pointed_at_commit() {
    require_git!();
    let repo = TestRepo::new();
    let other = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    stage_gitlink(&repo, "sub", SUBMODULE_COMMIT);
    let first = commit_staged(&repo, "point at one");
    stage_gitlink(&repo, "sub", other);
    let second = commit_staged(&repo, "point at two");
    let engine = open(&repo);

    let before = blob::commit_file(&engine, &first, "sub").unwrap();
    let after = blob::commit_file(&engine, &second, "sub").unwrap();
    assert_eq!(before.contents, Some(expected(SUBMODULE_COMMIT)));
    assert_eq!(after.contents, Some(expected(other)));
}

#[test]
fn a_gitlink_is_not_bounded_by_a_blob_size_limit() {
    require_git!();
    let repo = TestRepo::new();
    stage_gitlink(&repo, "sub", SUBMODULE_COMMIT);
    let hash = commit_staged(&repo, "add a gitlink");
    let engine = open(&repo);

    // The synthetic line is longer than a limit of 1, and there is no blob to measure.
    let file = blob::commit_file_limited(&engine, &hash, "sub", 1).unwrap();
    assert_eq!(file.contents, Some(expected(SUBMODULE_COMMIT)));
    let staged = blob::index_file_limited(&engine, "sub", 1).unwrap();
    assert_eq!(staged.contents, Some(expected(SUBMODULE_COMMIT)));
}

#[test]
fn ordinary_blob_binary_and_missing_reads_are_unchanged() {
    require_git!();
    let repo = TestRepo::new();
    repo.write("text.txt", "hello\n");
    repo.write("bin.dat", "a\0b");
    repo.git(&["add", "text.txt", "bin.dat"]);
    stage_gitlink(&repo, "sub", SUBMODULE_COMMIT);
    let hash = commit_staged(&repo, "mixed");
    let engine = open(&repo);

    let text = blob::commit_file(&engine, &hash, "text.txt").unwrap();
    assert_eq!(text.contents, Some("hello\n".to_string()));
    assert!(!text.binary);

    let binary = blob::commit_file(&engine, &hash, "bin.dat").unwrap();
    assert_eq!(binary.contents, None);
    assert!(binary.binary);

    let missing = blob::commit_file(&engine, &hash, "nope").unwrap_err();
    assert_eq!(missing.kind, ErrorKind::NotFound);
    // A directory is still not a file, even when a gitlink sits beside it.
    let dir = blob::commit_file(&engine, &hash, "text.txt/x").unwrap_err();
    assert_eq!(dir.kind, ErrorKind::NotFound);

    let staged_text = blob::index_file(&engine, "text.txt").unwrap();
    assert_eq!(staged_text.contents, Some("hello\n".to_string()));
    let staged_binary = blob::index_file(&engine, "bin.dat").unwrap();
    assert!(staged_binary.binary);
    let staged_missing = blob::index_file(&engine, "nope").unwrap_err();
    assert_eq!(staged_missing.kind, ErrorKind::NotFound);
}
