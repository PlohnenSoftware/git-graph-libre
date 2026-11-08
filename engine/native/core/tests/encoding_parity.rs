//! Commit text in other encodings, checked against what `git log` prints.
//!
//! Git converts a commit's author, committer and message to UTF-8 from the commit's `encoding`
//! header. The commits here are written as raw objects so that their bytes and header are exactly
//! what a user's `i18n.commitEncoding` would have produced, and each read the engine serves is
//! compared with Git's UTF-8 output. A read the engine cannot answer as Git does must decline with
//! `Unsupported`, never return text that differs.

#[macro_use]
mod common;

use std::io::Write;
use std::process::{Command, Stdio};

use git_graph_core::details::{commit_bodies, commit_details_base, commit_summaries};
use git_graph_core::error::{ErrorKind, Result};
use git_graph_core::log::{self, WalkOptions};
use git_graph_core::repository::Repo;
use git_graph_core::search::search_commits;
use git_graph_core::stash::read_stashes;
use git_graph_core::stats::author_stats;
use git_graph_core::types::{CommitRecord, SearchOptions};
use git_graph_core::{Engine, GraphOptions};

use common::TestRepo;

/// A repository whose commits are written byte for byte.
struct Raw {
    repo: TestRepo,
    clock: i64,
    tip: Option<String>,
}

struct Spec<'a> {
    encoding: Option<&'a str>,
    author: &'a [u8],
    email: &'a [u8],
    message: &'a [u8],
}

impl<'a> Spec<'a> {
    fn new(encoding: Option<&'a str>, author: &'a [u8], message: &'a [u8]) -> Spec<'a> {
        Spec {
            encoding,
            author,
            email: b"a@example.com",
            message,
        }
    }
}

impl Raw {
    fn new() -> Raw {
        Raw {
            repo: TestRepo::new(),
            clock: 1_600_000_000,
            tip: None,
        }
    }

    /// Feed `input` to `git <args>` in the repository and return its standard output.
    fn pipe(&self, args: &[&str], input: &[u8]) -> String {
        let mut child = Command::new("git")
            .args(args)
            .current_dir(self.repo.path())
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("HOME", self.repo.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("could not run git");
        child
            .stdin
            .take()
            .expect("stdin was not piped")
            .write_all(input)
            .expect("could not write to git");
        let output = child.wait_with_output().expect("could not wait for git");
        assert!(
            output.status.success(),
            "`git {}` failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    /// Write a commit with these exact bytes on top of the current tip and move `main` to it.
    fn commit(&mut self, spec: &Spec<'_>) -> String {
        let tree = self.pipe(&["hash-object", "-t", "tree", "-w", "--stdin"], b"");
        self.clock += 60;
        let mut object: Vec<u8> = format!("tree {tree}\n").into_bytes();
        if let Some(tip) = &self.tip {
            object.extend_from_slice(format!("parent {tip}\n").as_bytes());
        }
        let mut identity = spec.author.to_vec();
        identity.extend_from_slice(b" <");
        identity.extend_from_slice(spec.email);
        identity.extend_from_slice(format!("> {} +0000\n", self.clock).as_bytes());
        object.extend_from_slice(b"author ");
        object.extend_from_slice(&identity);
        object.extend_from_slice(b"committer ");
        object.extend_from_slice(&identity);
        if let Some(encoding) = spec.encoding {
            object.extend_from_slice(format!("encoding {encoding}\n").as_bytes());
        }
        object.push(b'\n');
        object.extend_from_slice(spec.message);
        let hash = self.pipe(
            &[
                "hash-object",
                "-t",
                "commit",
                "-w",
                "--stdin",
                "--literally",
            ],
            &object,
        );
        self.repo.update_ref("refs/heads/main", &hash);
        self.tip = Some(hash.clone());
        hash
    }

    fn open(&self) -> Repo {
        Repo::discover(self.repo.path()).expect("could not open the fixture repository")
    }

    fn walk(&self) -> Result<Vec<CommitRecord>> {
        let repo = self.open();
        let tips = log::all_tips(&repo, true, true)?;
        let options = WalkOptions {
            limit: 100,
            ..WalkOptions::default()
        };
        log::walk(&repo, &tips, &options)
    }

    /// `git log` for one commit: author, email, committer, subject and body, in UTF-8.
    fn git_fields(&self, hash: &str) -> Vec<String> {
        let out = self.repo.git(&[
            "log",
            "-1",
            "--format=%an%x00%ae%x00%cn%x00%s%x00%b%x00%B",
            hash,
        ]);
        out.trim_end().split('\0').map(str::to_string).collect()
    }
}

fn latin1(text: &str) -> Vec<u8> {
    text.chars()
        .map(|c| u8::try_from(u32::from(c)).unwrap())
        .collect()
}

fn expect_unsupported<T: std::fmt::Debug>(result: Result<T>) {
    let error = result.expect_err("the engine must decline");
    assert_eq!(error.kind, ErrorKind::Unsupported, "{error}");
}

fn search_options(query: &str) -> SearchOptions {
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

#[test]
fn iso_8859_1_text_is_what_git_prints() {
    require_git!();
    let mut raw = Raw::new();
    let message = latin1("café crème\n\nBöse Überraschung\nzweite Zeile \u{80}\u{a0}\u{ff}\n");
    let hash = raw.commit(&Spec::new(
        Some("ISO-8859-1"),
        &latin1("José Ñandú"),
        &message,
    ));

    let expected = raw.git_fields(&hash);
    assert_eq!(expected[0], "José Ñandú");
    assert_eq!(expected[3], "café crème");

    let records = raw.walk().expect("the walk failed");
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].author, expected[0]);
    assert_eq!(records[0].email, "a@example.com");
    assert_eq!(records[0].message, expected[3]);

    let repo = raw.open();
    let details = commit_details_base(&repo, &hash).expect("details failed");
    assert_eq!(details.author, expected[0]);
    assert_eq!(details.committer, expected[2]);
    assert_eq!(details.body.trim_end(), expected[5].trim_end());

    let bodies = commit_bodies(&repo, std::slice::from_ref(&hash)).expect("bodies failed");
    assert_eq!(bodies[&hash].trim_end(), expected[5].trim_end());

    let summaries = commit_summaries(&repo, std::slice::from_ref(&hash)).expect("summaries failed");
    assert_eq!(summaries[&hash].author, expected[0]);
    assert_eq!(summaries[&hash].message, expected[5].trim());

    let authors = log::authors(&repo).expect("authors failed");
    assert_eq!(authors.len(), 1);
    assert_eq!(authors[0].name, expected[0]);

    let stats = author_stats(&repo).expect("statistics failed");
    assert_eq!(stats.len(), 1);
    assert_eq!(stats[0].name, expected[0]);
    assert_eq!(stats[0].commits, 1);

    let engine = Engine::open(raw.repo.path()).expect("could not open the engine");
    let graph = engine
        .graph(&GraphOptions::default())
        .expect("the graph failed");
    assert_eq!(graph.commits[0].author, expected[0]);
    assert_eq!(graph.commits[0].message, expected[3]);
}

#[test]
fn search_matches_the_decoded_text() {
    require_git!();
    let mut raw = Raw::new();
    let hash = raw.commit(&Spec::new(
        Some("ISO-8859-1"),
        &latin1("José"),
        &latin1("café\n"),
    ));
    let repo = raw.open();

    // Git finds the same commit by the UTF-8 spelling of the text it stores in Latin-1.
    for (query, git_args) in [
        ("café", vec!["--grep=café"]),
        ("josé", vec!["--author=José"]),
    ] {
        let mut args = vec!["log", "--format=%H", "--fixed-strings"];
        args.extend(git_args);
        assert_eq!(
            raw.repo.git(&args).trim(),
            hash,
            "git does not find {query}"
        );

        let results = search_commits(&repo, &search_options(query)).expect("search failed");
        assert_eq!(results.len(), 1, "the engine does not find {query}");
        assert_eq!(results[0].hash, hash);
        assert_eq!(results[0].message, "café");
        assert_eq!(results[0].author, "José");
    }

    // The filter by author name matches the decoded name too.
    let options = WalkOptions {
        limit: 10,
        authors: Some(vec!["José".to_string()]),
        ..WalkOptions::default()
    };
    let tips = log::all_tips(&repo, true, true).expect("tips failed");
    let filtered = log::walk(&repo, &tips, &options).expect("the filtered walk failed");
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].author, "José");
}

#[test]
fn other_encodings_that_git_and_the_engine_read_alike() {
    require_git!();
    let mut raw = Raw::new();
    // KOI8-R: Привет, and ISO-8859-2: Zoë / Łódź, both written as iconv encodes them.
    let koi8 = raw.commit(&Spec::new(
        Some("KOI8-R"),
        b"\xf0\xd2\xc9\xd7\xc5\xd4",
        b"\xcb\xcf\xcd\xcd\xc9\xd4\n",
    ));
    let latin2 = raw.commit(&Spec::new(
        Some("ISO-8859-2"),
        b"Zo\xeb",
        b"\xa3\xf3d\xbc\n",
    ));

    let records = raw.walk().expect("the walk failed");
    for hash in [&koi8, &latin2] {
        let expected = raw.git_fields(hash);
        let record = records
            .iter()
            .find(|record| &record.hash == hash)
            .expect("the commit is in the walk");
        assert_eq!(record.author, expected[0]);
        assert_eq!(record.message, expected[3]);
    }
    assert_eq!(raw.git_fields(&koi8)[0], "Привет");
    assert_eq!(raw.git_fields(&latin2)[3], "Łódź");
}

#[test]
fn shift_jis_and_windows_1252_decline_although_encoding_rs_decodes_them() {
    require_git!();
    // Shift_JIS reads 0x8160 as U+FF5E where Git's converter prints U+301C, and
    // windows-1252 reads 0x81 where Git's converter prints the raw byte. The verdicts and the
    // evidence are pinned with the byte sweeps.
    for (label, author, message) in [
        (
            "Shift_JIS",
            &b"\x8d\xec\x8e\xd2"[..],
            &b"\x93\xfa\x96\x7b\x8c\xea\n"[..],
        ),
        ("windows-1252", &b"Zo\xeb"[..], &b"price \x80 5\n"[..]),
    ] {
        let mut raw = Raw::new();
        let hash = raw.commit(&Spec::new(Some(label), author, message));
        let repo = raw.open();
        expect_unsupported(raw.walk());
        expect_unsupported(commit_details_base(&repo, &hash));
        expect_unsupported(commit_bodies(&repo, std::slice::from_ref(&hash)));
    }
}

#[test]
fn leading_blank_lines_and_a_multi_line_first_paragraph() {
    require_git!();
    let mut raw = Raw::new();
    let leading = raw.commit(&Spec::new(
        None,
        b"Ann",
        b"\n\n  \nSubject after blanks\n\nbody\n",
    ));
    let folded = raw.commit(&Spec::new(
        None,
        b"Ann",
        b"first line  \nsecond\tline\n   third\n\nbody paragraph\n",
    ));
    let crlf = raw.commit(&Spec::new(
        None,
        b"Ann",
        b"crlf subject\r\nsecond\r\n\r\nbody\r\n",
    ));
    let empty = raw.commit(&Spec::new(None, b"Ann", b"\n\n"));

    let records = raw.walk().expect("the walk failed");
    for hash in [&leading, &folded, &crlf, &empty] {
        let expected = raw.git_fields(hash);
        let record = records.iter().find(|r| &r.hash == hash).unwrap();
        assert_eq!(record.message, expected[3], "subject of {hash}");
    }
    assert_eq!(raw.git_fields(&leading)[3], "Subject after blanks");
    assert_eq!(
        raw.git_fields(&folded)[3],
        "first line second\tline    third"
    );

    // The same subject reaches search results.
    let repo = raw.open();
    let results = search_commits(&repo, &search_options("after blanks")).expect("search failed");
    assert_eq!(results[0].message, "Subject after blanks");
}

#[test]
fn utf8_commits_are_unchanged() {
    require_git!();
    let mut raw = Raw::new();
    let plain = raw.commit(&Spec::new(
        None,
        "Zoë Müller".as_bytes(),
        "naïve café\n\nbody ✓\n".as_bytes(),
    ));
    let labeled = raw.commit(&Spec::new(
        Some("UTF-8"),
        "Zoë".as_bytes(),
        "label utf-8 ✓\n".as_bytes(),
    ));
    let lower = raw.commit(&Spec::new(
        Some("utf8"),
        b"Zed",
        "spelled utf8 é\n".as_bytes(),
    ));
    // Bytes that are not UTF-8 in a commit that claims nothing: git prints them as they are, the
    // CLI's decoder turns them into U+FFFD, and so does the engine.
    let broken = raw.commit(&Spec::new(None, b"Bo\xe9", b"caf\xe9\n"));

    let records = raw.walk().expect("the walk failed");
    for hash in [&plain, &labeled, &lower] {
        let expected = raw.git_fields(hash);
        let record = records.iter().find(|r| &r.hash == hash).unwrap();
        assert_eq!(record.author, expected[0]);
        assert_eq!(record.message, expected[3]);
    }
    let broken_record = records.iter().find(|r| r.hash == broken).unwrap();
    assert_eq!(broken_record.author, "Bo\u{fffd}");
    assert_eq!(broken_record.message, "caf\u{fffd}");
}

#[test]
fn an_unsupported_encoding_declines_every_read() {
    require_git!();
    for (label, message) in [
        // A label nothing knows.
        ("klingon", &b"text\n"[..]),
        // The web standard reads ISO-8859-9 as Windows-1254; Git's converter does not.
        ("ISO-8859-9", &b"text\n"[..]),
        // Not an ASCII superset.
        ("UTF-16LE", &b"text\n"[..]),
    ] {
        let mut raw = Raw::new();
        let hash = raw.commit(&Spec::new(Some(label), b"Ann", message));
        let repo = raw.open();

        expect_unsupported(raw.walk());
        expect_unsupported(commit_details_base(&repo, &hash));
        expect_unsupported(commit_bodies(&repo, std::slice::from_ref(&hash)));
        expect_unsupported(commit_summaries(&repo, std::slice::from_ref(&hash)));
        expect_unsupported(log::authors(&repo));
        expect_unsupported(author_stats(&repo));
        expect_unsupported(search_commits(&repo, &search_options("text")));
        let engine = Engine::open(raw.repo.path()).expect("could not open the engine");
        expect_unsupported(engine.graph(&GraphOptions::default()));
    }
}

#[test]
fn bytes_invalid_in_the_declared_encoding_decline_the_reads_that_show_them() {
    require_git!();
    let mut raw = Raw::new();
    // Git prints text it cannot convert unconverted, so there is nothing to compare with. 0xA5 is
    // unassigned in ISO-8859-3, which the engine verifies.
    let hash = raw.commit(&Spec::new(Some("ISO-8859-3"), b"Ann", b"\xa5 text\n"));
    let repo = raw.open();

    expect_unsupported(raw.walk());
    expect_unsupported(commit_details_base(&repo, &hash));
    expect_unsupported(commit_bodies(&repo, std::slice::from_ref(&hash)));
    expect_unsupported(commit_summaries(&repo, std::slice::from_ref(&hash)));
    expect_unsupported(search_commits(&repo, &search_options("text")));
    // The names alone are ASCII and read the same in every encoding accepted here.
    assert_eq!(log::authors(&repo).expect("authors failed")[0].name, "Ann");
    assert_eq!(
        author_stats(&repo).expect("statistics failed")[0].name,
        "Ann"
    );
}

#[test]
fn an_undecodable_commit_below_decodable_ones_still_declines() {
    require_git!();
    let mut raw = Raw::new();
    raw.commit(&Spec::new(Some("klingon"), b"Ann", b"old\n"));
    raw.commit(&Spec::new(None, b"Ann", b"new\n"));
    // The newest commit is fine, but the page is not served with the older one unreadable.
    expect_unsupported(raw.walk());
    expect_unsupported(author_stats(&raw.open()));
}

#[test]
fn a_stash_in_another_encoding_reads_as_git_prints_it() {
    require_git!();
    let mut raw = Raw::new();
    let base = raw.commit(&Spec::new(None, b"Ann", b"base\n"));
    let tree = raw.pipe(&["hash-object", "-t", "tree", "-w", "--stdin"], b"");
    let mut object: Vec<u8> = format!("tree {tree}\nparent {base}\nparent {base}\n").into_bytes();
    object.extend_from_slice(b"author Ren\xe9 <r@example.com> 1600001000 +0000\n");
    object.extend_from_slice(b"committer Ren\xe9 <r@example.com> 1600001000 +0000\n");
    object.extend_from_slice(b"encoding ISO-8859-1\n\nOn main: caf\xe9 stash\n");
    let stash = raw.pipe(
        &[
            "hash-object",
            "-t",
            "commit",
            "-w",
            "--stdin",
            "--literally",
        ],
        &object,
    );
    raw.repo.git(&["stash", "store", "-m", "stored", &stash]);

    let expected = raw.git_fields(&stash);
    assert_eq!(expected[0], "René");
    let stashes = read_stashes(&raw.open()).expect("the stash read failed");
    assert_eq!(stashes.len(), 1);
    assert_eq!(stashes[0].author, expected[0]);
    assert_eq!(stashes[0].message, expected[3]);
    assert_eq!(stashes[0].message, "On main: café stash");
}

#[test]
fn a_repository_that_prints_another_encoding_declines() {
    require_git!();
    let mut raw = Raw::new();
    raw.commit(&Spec::new(None, b"Ann", b"plain ascii\n"));
    assert!(raw.walk().is_ok());

    // With `i18n.logOutputEncoding` (or, absent that, `i18n.commitEncoding`) set to something
    // else, the CLI's output is not UTF-8, so the engine's would differ from it.
    raw.repo
        .git(&["config", "i18n.logOutputEncoding", "ISO-8859-1"]);
    let repo = raw.open();
    expect_unsupported(raw.walk());
    expect_unsupported(author_stats(&repo));
    expect_unsupported(read_stashes(&repo));
    expect_unsupported(search_commits(&repo, &search_options("plain")));
    expect_unsupported(commit_details_base(&repo, &raw.repo.head()));

    // Naming UTF-8 explicitly is the default again.
    raw.repo.git(&["config", "i18n.logOutputEncoding", "utf-8"]);
    assert!(raw.walk().is_ok());

    // `i18n.commitEncoding` alone also moves Git's output encoding...
    raw.repo
        .git(&["config", "--unset", "i18n.logOutputEncoding"]);
    raw.repo
        .git(&["config", "i18n.commitEncoding", "ISO-8859-1"]);
    expect_unsupported(raw.walk());

    // ...unless the log output encoding says UTF-8 for itself.
    raw.repo.git(&["config", "i18n.logOutputEncoding", "UTF-8"]);
    assert!(raw.walk().is_ok());
}

/// A real `git commit` with the usual setting, for the end-to-end shape of the bug report.
#[cfg(unix)]
#[test]
fn a_commit_made_with_commit_encoding_reads_as_git_prints_it() {
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;

    require_git!();
    let raw = Raw::new();
    let message = latin1("café\n");
    std::fs::write(raw.repo.path().join("message.txt"), &message).expect("could not write");
    let output = Command::new("git")
        .args([
            "-c",
            "i18n.commitEncoding=ISO-8859-1",
            "commit",
            "--quiet",
            "--allow-empty",
            "-F",
            "message.txt",
        ])
        .current_dir(raw.repo.path())
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("HOME", raw.repo.path())
        .env("GIT_AUTHOR_NAME", OsStr::from_bytes(&latin1("Zoë")))
        .output()
        .expect("could not run git commit");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let head = raw.repo.head();
    let expected = raw.git_fields(&head);
    assert_eq!(expected[0], "Zoë");
    assert_eq!(expected[3], "café");

    let records = raw.walk().expect("the walk failed");
    assert_eq!(records[0].author, "Zoë");
    assert_eq!(records[0].message, "café");
}
