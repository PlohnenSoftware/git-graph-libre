//! Remote-tracking refs, checked against what git itself reports for the same repository.
//!
//! Every `refs/remotes/*` entry is a remote branch, as the CLI shows it, except the
//! `refs/remotes/<remote>/…/tags/<tag>` refs a tag refspec creates, which are tags (W26J). These
//! tests pin both halves: a `changes` segment is an ordinary name, and a `tags` segment is still
//! a tag.

#[macro_use]
mod common;

use git_graph_core::refs::read_refs;
use git_graph_core::repository::Repo;
use git_graph_core::types::{GitTagRef, RefReadOptions, RefSnapshot};

use common::TestRepo;

fn open(repo: &TestRepo) -> Repo {
    Repo::discover(repo.path()).expect("could not open the fixture repository")
}

fn scan(show_remote_heads: bool, hide: &[&str]) -> RefReadOptions {
    RefReadOptions {
        show_remote_branches: true,
        show_remote_heads,
        hide_remotes: hide.iter().map(|remote| remote.to_string()).collect(),
    }
}

/// `git for-each-ref refs/remotes`: each remote-tracking ref (without its `refs/remotes/` prefix)
/// and the object it names, as git reports them.
fn git_remote_refs(repo: &TestRepo) -> Vec<(String, String)> {
    repo.git(&[
        "for-each-ref",
        "--format=%(refname)%09%(objectname)",
        "refs/remotes",
    ])
    .lines()
    .filter_map(|line| line.split_once('\t'))
    .map(|(refname, object)| {
        (
            refname.trim_start_matches("refs/remotes/").to_string(),
            object.to_string(),
        )
    })
    .collect()
}

/// The remote branches the engine lists, as `(name, hash)` pairs.
fn remote_branches(snapshot: &RefSnapshot) -> Vec<(String, String)> {
    snapshot
        .ref_data
        .remotes
        .iter()
        .map(|remote| (remote.name.clone(), remote.hash.clone()))
        .collect()
}

fn tags_named<'a>(snapshot: &'a RefSnapshot, name: &str) -> Vec<&'a GitTagRef> {
    snapshot
        .ref_data
        .tags
        .iter()
        .filter(|tag| tag.name == name)
        .collect()
}

#[test]
fn changes_and_tags_segments_follow_the_cli_classification() {
    require_git!();
    let mut repo = TestRepo::new();
    let first = repo.commit_file("a.txt", "1", "first");
    let second = repo.commit_file("b.txt", "2", "second");
    repo.add_fake_remote("origin", "main", &second);
    // Literal `changes` segments: ordinary remote branches, with or without a `/` after them.
    repo.update_ref("refs/remotes/origin/changes/foo", &first);
    repo.update_ref("refs/remotes/origin/feature/changes", &second);
    // Literal `tags` segments: still tags, displayed as `<remote>/<tag>`.
    repo.update_ref("refs/remotes/origin/tags/v1", &second);
    repo.update_ref("refs/remotes/origin/release/tags/x", &first);

    let engine = open(&repo);
    let snapshot = read_refs(&engine, &scan(false, &[])).unwrap();
    let remotes = remote_branches(&snapshot);

    // Every ref git lists that is not a tag-segment ref is a remote branch, on the object git
    // names. The engine lists no others.
    let mut expected: Vec<String> = Vec::new();
    for (name, object) in git_remote_refs(&repo) {
        if name.contains("/tags/") {
            continue;
        }
        let entry = remotes
            .iter()
            .find(|(listed, _)| *listed == name)
            .unwrap_or_else(|| panic!("{name} is missing from the remote branches"));
        assert_eq!(entry.1, object, "{name} names a different object");
        expected.push(name);
    }
    let mut listed: Vec<String> = remotes.iter().map(|(name, _)| name.clone()).collect();
    expected.sort();
    listed.sort();
    assert_eq!(
        listed, expected,
        "the engine lists other remote branches than git"
    );

    for name in ["origin/changes/foo", "origin/feature/changes"] {
        assert!(
            snapshot.branches.contains(&format!("remotes/{name}")),
            "{name} is not in the Branches list"
        );
    }

    // The tag-segment refs stay tags, on the commit each one peels to.
    let v1 = tags_named(&snapshot, "origin/v1");
    assert_eq!(v1.len(), 1);
    assert_eq!(v1[0].hash, second);
    assert!(!v1[0].annotated);
    let release = tags_named(&snapshot, "origin/release/x");
    assert_eq!(release.len(), 1);
    assert_eq!(release[0].hash, first);
    assert!(!remotes.iter().any(|(name, _)| name.contains("/tags/")));
}

#[test]
fn an_annotated_remote_tag_mirror_peels_to_its_commit() {
    require_git!();
    let mut repo = TestRepo::new();
    let first = repo.commit_file("a.txt", "1", "first");
    repo.commit_file("b.txt", "2", "second");
    // The object a `+refs/tags/*:refs/remotes/origin/tags/*` refspec would copy. The local tag is
    // removed again so the mirror has no local twin, which would otherwise hide it.
    repo.git(&["tag", "-a", "ann", "-m", "annotated", &first]);
    let tag_object = repo.rev_parse("refs/tags/ann");
    repo.git(&["tag", "-d", "ann"]);
    repo.update_ref("refs/remotes/origin/tags/ann", &tag_object);

    assert_eq!(repo.git(&["cat-file", "-t", &tag_object]).trim(), "tag");
    let commit = repo.rev_parse("refs/remotes/origin/tags/ann^{commit}");
    assert_eq!(commit, first);

    let engine = open(&repo);
    let snapshot = read_refs(&engine, &scan(false, &[])).unwrap();

    // Two records, as for any annotated tag: the tag object, and the peeled commit.
    let records = tags_named(&snapshot, "origin/ann");
    assert_eq!(
        records.len(),
        2,
        "expected the tag object and the peeled commit"
    );
    assert!(records
        .iter()
        .any(|tag| tag.hash == tag_object && !tag.annotated));
    assert!(records
        .iter()
        .any(|tag| tag.hash == commit && tag.annotated));
    assert!(!remote_branches(&snapshot)
        .iter()
        .any(|(name, _)| name == "origin/ann"));
}

#[test]
fn a_symbolic_remote_head_resolves_as_git_resolves_it() {
    require_git!();
    let mut repo = TestRepo::new();
    repo.commit_file("a.txt", "1", "first");
    let second = repo.commit_file("b.txt", "2", "second");
    repo.add_fake_remote("origin", "main", &second);
    repo.git(&[
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
        "refs/remotes/origin/main",
    ]);
    // A dangling symbolic HEAD names nothing and is dropped, as the CLI drops it.
    repo.git(&[
        "symbolic-ref",
        "refs/remotes/dev/HEAD",
        "refs/remotes/dev/absent",
    ]);

    let engine = open(&repo);
    let shown = read_refs(&engine, &scan(true, &[])).unwrap();
    let git_head = repo.rev_parse("refs/remotes/origin/HEAD");
    assert_eq!(git_head, second);
    let entry = remote_branches(&shown)
        .into_iter()
        .find(|(name, _)| name == "origin/HEAD")
        .expect("the symbolic remote HEAD was dropped");
    assert_eq!(entry.1, git_head);
    assert!(!remote_branches(&shown)
        .iter()
        .any(|(name, _)| name == "dev/HEAD"));

    // Without `showRemoteHeads`, the `/HEAD` entries stay out, as before.
    let hidden = read_refs(&engine, &scan(false, &[])).unwrap();
    assert!(!remote_branches(&hidden)
        .iter()
        .any(|(name, _)| name.ends_with("/HEAD")));
}

#[test]
fn a_hidden_remote_shows_no_branch_or_tag_but_its_name_prefix_does_not_match() {
    require_git!();
    let mut repo = TestRepo::new();
    let first = repo.commit_file("a.txt", "1", "first");
    let second = repo.commit_file("b.txt", "2", "second");
    repo.add_fake_remote("origin", "main", &second);
    repo.update_ref("refs/remotes/dev/changes/x", &first);
    repo.update_ref("refs/remotes/dev/tags/t", &first);
    // `devops` begins with the hidden name `dev` but is a different remote.
    repo.update_ref("refs/remotes/devops/changes/y", &first);
    repo.update_ref("refs/remotes/devops/tags/u", &second);

    let engine = open(&repo);

    // Control: with nothing hidden, `dev` is listed.
    let visible = read_refs(&engine, &scan(false, &[])).unwrap();
    assert!(remote_branches(&visible)
        .iter()
        .any(|(name, _)| name == "dev/changes/x"));

    let snapshot = read_refs(&engine, &scan(false, &["dev"])).unwrap();
    let remotes = remote_branches(&snapshot);
    assert!(!remotes.iter().any(|(name, _)| name.starts_with("dev/")));
    assert!(!snapshot
        .ref_data
        .tags
        .iter()
        .any(|tag| tag.name.starts_with("dev/")));
    assert!(remotes.iter().any(|(name, _)| name == "devops/changes/y"));
    assert_eq!(tags_named(&snapshot, "devops/u").len(), 1);
    assert!(remotes.iter().any(|(name, _)| name == "origin/main"));
}

#[test]
fn every_tag_carries_the_full_ref_name_git_lists_it_under() {
    require_git!();
    let mut repo = TestRepo::new();
    let first = repo.commit_file("a.txt", "1", "first");
    let second = repo.commit_file("b.txt", "2", "second");
    repo.add_fake_remote("origin", "main", &second);
    // A local tag that is literally named like a mirrored remote tag, and the mirror itself:
    // both display as `dev/t`, and only the ref name tells them apart.
    repo.git(&["tag", "dev/t", &first]);
    repo.update_ref("refs/remotes/dev/tags/t", &second);
    // A remote name with a `/` and a `tags` segment inside the branch path.
    repo.update_ref("refs/remotes/team/fork/tags/x", &first);
    repo.git(&["tag", "-a", "ann", "-m", "annotated", &second]);

    let engine = open(&repo);
    let snapshot = read_refs(&engine, &scan(false, &[])).unwrap();

    let mut listed: Vec<(String, String)> = snapshot
        .ref_data
        .tags
        .iter()
        .map(|tag| (tag.name.clone(), tag.ref_name.clone()))
        .collect();
    listed.sort();
    listed.dedup();
    let expected = vec![
        ("ann".to_string(), "refs/tags/ann".to_string()),
        ("dev/t".to_string(), "refs/remotes/dev/tags/t".to_string()),
        ("dev/t".to_string(), "refs/tags/dev/t".to_string()),
        (
            "team/fork/x".to_string(),
            "refs/remotes/team/fork/tags/x".to_string(),
        ),
    ];
    assert_eq!(listed, expected);

    // Every ref name is one git itself lists, and an annotated tag's two records agree.
    let git_names: Vec<String> = repo
        .git(&[
            "for-each-ref",
            "--format=%(refname)",
            "refs/tags",
            "refs/remotes",
        ])
        .lines()
        .map(str::to_string)
        .collect();
    for tag in &snapshot.ref_data.tags {
        assert!(
            git_names.contains(&tag.ref_name),
            "{} is not a ref git lists",
            tag.ref_name
        );
    }
    let ann = tags_named(&snapshot, "ann");
    assert_eq!(ann.len(), 2);
    assert!(ann.iter().all(|tag| tag.ref_name == "refs/tags/ann"));
}
