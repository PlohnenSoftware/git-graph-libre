//! Size-bounded single-file reads: a blob at a revision, a staged blob and a working-tree file.
//!
//! Each reader takes its limit as a parameter, so the boundary is tested with a tiny limit; the
//! public paths use `MAX_READ_BYTES` (64 MiB).

#[macro_use]
mod common;

use git_graph_core::error::ErrorKind;
use git_graph_core::file_read::{read_bounded_from, working_tree_file_limited, MAX_READ_BYTES};
use git_graph_core::repository::Repo;
use git_graph_core::{blob, Engine};

use common::TestRepo;

const LIMIT: u64 = 16;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

fn text_of(len: u64) -> String {
    "x".repeat(len as usize)
}

#[test]
fn the_ceiling_is_64_mib() {
    assert_eq!(MAX_READ_BYTES, 64 * 1024 * 1024);
}

#[test]
fn a_revision_blob_is_bounded_by_its_header() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.write("at.txt", &text_of(LIMIT));
    repo.write("over.txt", &text_of(LIMIT + 1));
    let hash = repo.commit("add files");
    let engine = open(&repo);

    let at = blob::commit_file_limited(&engine, &hash, "at.txt", LIMIT).unwrap();
    assert_eq!(at.contents, Some(text_of(LIMIT)));

    let over = blob::commit_file_limited(&engine, &hash, "over.txt", LIMIT).unwrap_err();
    assert_eq!(over.kind, ErrorKind::TooLarge, "{over}");
}

#[test]
fn a_missing_path_is_still_not_found_not_too_large() {
    require_git!();
    let mut repo = TestRepo::new();
    let hash = repo.commit_file("a.txt", "1", "first");
    let engine = open(&repo);

    let error = blob::commit_file_limited(&engine, &hash, "nope.txt", LIMIT).unwrap_err();
    assert_eq!(error.kind, ErrorKind::NotFound);
}

#[test]
fn a_staged_blob_is_bounded_by_its_header() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    repo.write("at.txt", &text_of(LIMIT));
    repo.write("over.txt", &text_of(LIMIT + 1));
    repo.git(&["add", "at.txt", "over.txt"]);
    let engine = open(&repo);

    let at = blob::index_file_limited(&engine, "at.txt", LIMIT).unwrap();
    assert_eq!(at.contents, Some(text_of(LIMIT)));

    let over = blob::index_file_limited(&engine, "over.txt", LIMIT).unwrap_err();
    assert_eq!(over.kind, ErrorKind::TooLarge, "{over}");
}

#[test]
fn a_working_tree_file_is_bounded() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    repo.write("at.txt", &text_of(LIMIT));
    repo.write("over.txt", &text_of(LIMIT + 1));
    let engine = open(&repo);

    let at = working_tree_file_limited(&engine, "at.txt", LIMIT).unwrap();
    assert_eq!(at.contents, Some(text_of(LIMIT)));

    let over = working_tree_file_limited(&engine, "over.txt", LIMIT).unwrap_err();
    assert_eq!(over.kind, ErrorKind::TooLarge, "{over}");

    let missing = working_tree_file_limited(&engine, "gone.txt", LIMIT).unwrap_err();
    assert_eq!(missing.kind, ErrorKind::Io, "{missing}");
}

#[test]
fn a_reader_that_outgrows_its_metadata_is_still_bounded() {
    // A stream longer than the limit, as a file that grew after `metadata()` looks to the read.
    let endless = std::io::repeat(b'x');
    let error = read_bounded_from(endless, LIMIT).unwrap_err();
    assert_eq!(error.kind, ErrorKind::TooLarge);

    let exact = read_bounded_from(std::io::Read::take(std::io::repeat(b'x'), LIMIT), LIMIT);
    assert_eq!(exact.unwrap().len() as u64, LIMIT);

    let one_over = read_bounded_from(std::io::Read::take(std::io::repeat(b'x'), LIMIT + 1), LIMIT);
    assert_eq!(one_over.unwrap_err().kind, ErrorKind::TooLarge);
}

#[test]
fn the_facade_reads_the_working_tree_strictly() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    repo.write("ok.txt", "hello\n");
    std::fs::write(repo.path().join("latin1.txt"), [b'c', b'a', b'f', 0xE9]).unwrap();
    let engine = Engine::open(repo.path()).unwrap();

    let ok = engine
        .file(git_graph_core::api::WORKING_TREE, "ok.txt")
        .unwrap();
    assert_eq!(ok.contents.as_deref(), Some("hello\n"));

    // Not valid UTF-8: binary with no contents, never a lossy decode.
    let latin1 = engine
        .file(git_graph_core::api::WORKING_TREE, "latin1.txt")
        .unwrap();
    assert!(latin1.binary);
    assert_eq!(latin1.contents, None);

    for bad in ["../outside.txt", "/etc/hostname", "sub/../../x", ""] {
        let error = engine
            .file(git_graph_core::api::WORKING_TREE, bad)
            .unwrap_err();
        assert_eq!(error.kind, ErrorKind::InvalidArgument, "{bad}: {error}");
    }
}
