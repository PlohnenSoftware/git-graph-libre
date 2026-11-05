//! A repository Git refuses as owned by someone else is refused by the engine, with its own error
//! kind, instead of being opened with reduced trust (W41).
//!
//! A real ownership mismatch cannot be built without root or another user's files, so the trust
//! level is asserted through `Repo::discover_assuming_reduced_trust`, which replaces only the ownership
//! derivation at discovery. Everything after it is the code a real mismatch runs through: gix's
//! `safe.directory` check, the refusal, and the error mapping. The configuration comes from a
//! temporary file named by `GIT_CONFIG_GLOBAL`; the real `~/.gitconfig` is never read or written.

#[macro_use]
mod common;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use git_graph_core::error::ErrorKind;
use git_graph_core::repository::Repo;

use common::TestRepo;

static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Point the global configuration at `contents` for as long as the guard lives.
struct GlobalConfig<'a> {
    _lock: MutexGuard<'a, ()>,
}

impl GlobalConfig<'_> {
    fn set(dir: &Path, contents: &str) -> GlobalConfig<'static> {
        let lock = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let file = dir.join("untrusted-test-gitconfig");
        std::fs::write(&file, contents).unwrap();
        std::env::set_var("GIT_CONFIG_GLOBAL", &file);
        std::env::set_var("GIT_CONFIG_NOSYSTEM", "1");
        GlobalConfig { _lock: lock }
    }
}

impl Drop for GlobalConfig<'_> {
    fn drop(&mut self) {
        std::env::remove_var("GIT_CONFIG_GLOBAL");
        std::env::remove_var("GIT_CONFIG_NOSYSTEM");
    }
}

fn reduced(path: &Path) -> Result<Repo, git_graph_core::Error> {
    Repo::discover_assuming_reduced_trust(path)
}

fn refused(path: &Path) {
    let error = reduced(path)
        .err()
        .expect("the untrusted open must be refused");
    assert_eq!(error.kind, ErrorKind::Untrusted, "{}", error.message);
}

fn fixture() -> TestRepo {
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "base\n", "base");
    repo
}

#[test]
fn an_owned_repository_opens_with_full_trust() {
    require_git!();
    let repo = fixture();
    let _config = GlobalConfig::set(repo.path(), "");
    assert!(Repo::discover(repo.path()).is_ok());
    assert!(Repo::open(repo.path()).is_ok());
}

#[test]
fn an_untrusted_repository_is_refused_not_opened_with_reduced_trust() {
    require_git!();
    let repo = fixture();
    let _config = GlobalConfig::set(repo.path(), "");
    refused(repo.path());
    // From a subdirectory, discovery searches upwards and still refuses the repository it finds.
    std::fs::create_dir(repo.path().join("sub dir")).unwrap();
    refused(&repo.path().join("sub dir"));
}

#[test]
fn a_safe_directory_entry_lets_the_untrusted_repository_open() {
    require_git!();
    let repo = fixture();
    let canonical = repo.path().canonicalize().unwrap();
    let entry = canonical.display().to_string().replace('\\', "/");
    let _config = GlobalConfig::set(repo.path(), &format!("[safe]\n\tdirectory = {entry}\n"));
    assert!(
        reduced(repo.path()).is_ok(),
        "Git trusts it, so the engine does"
    );
}

#[test]
fn a_wildcard_safe_directory_lets_it_open_and_an_unrelated_entry_does_not() {
    require_git!();
    let repo = fixture();
    {
        let _config = GlobalConfig::set(repo.path(), "[safe]\n\tdirectory = *\n");
        assert!(reduced(repo.path()).is_ok());
    }
    let _config = GlobalConfig::set(repo.path(), "[safe]\n\tdirectory = /somewhere/else\n");
    refused(repo.path());
}

#[test]
fn an_untrusted_linked_worktree_is_refused() {
    require_git!();
    let repo = fixture();
    let worktree = repo.add_worktree("wt é one", "feature");
    let _config = GlobalConfig::set(repo.path(), "");
    refused(&worktree);
    assert!(Repo::discover(&worktree).is_ok(), "owned, so trusted");
}

#[test]
fn an_untrusted_submodule_is_refused() {
    require_git!();
    let mut source = TestRepo::new();
    source.commit_file("inside.txt", "one\n", "sub one");
    let repo = fixture();
    let url = source.path().display().to_string().replace('\\', "/");
    repo.git(&[
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        "--quiet",
        &url,
        "sub",
    ]);
    let _config = GlobalConfig::set(repo.path(), "");
    refused(&repo.path().join("sub"));
    assert!(
        Repo::discover(repo.path().join("sub")).is_ok(),
        "owned, so trusted"
    );
}

#[test]
fn a_missing_repository_is_not_a_trust_refusal() {
    require_git!();
    let dir = tempfile::tempdir().unwrap();
    let _config = GlobalConfig::set(dir.path(), "");
    let error = Repo::discover(dir.path().join("nothing here"))
        .err()
        .unwrap();
    assert_eq!(error.kind, ErrorKind::NotARepository);
    let error = Repo::open(dir.path()).err().unwrap();
    assert_eq!(error.kind, ErrorKind::NotARepository);
}
