//! Commit text in other encodings, checked against what `git log` prints.
//!
//! Git converts a commit's author, committer and message to UTF-8 from the commit's `encoding`
//! header. The commits here are written as raw objects so that their bytes and header are exactly
//! what a user's `i18n.commitEncoding` would have produced, and each read the engine serves is
//! compared with Git's UTF-8 output. A read the engine cannot answer as Git does must decline with
//! `Unsupported`, never return text that differs.

#[macro_use]
mod common;

use std::collections::HashMap;
use std::io::Write;
use std::ops::RangeInclusive;
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
        String::from_utf8_lossy(&self.pipe_bytes(args, input))
            .trim()
            .to_string()
    }

    /// Feed `input` to `git <args>` in the repository and return its standard output, as bytes.
    fn pipe_bytes(&self, args: &[&str], input: &[u8]) -> Vec<u8> {
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
        // Write the input from another thread: git may fill its stdout while it is still reading
        // a long input, and a write made here, before anything is read, would never return.
        let mut stdin = child.stdin.take().expect("stdin was not piped");
        let input = input.to_vec();
        let writer = std::thread::spawn(move || stdin.write_all(&input));
        let output = child.wait_with_output().expect("could not wait for git");
        writer
            .join()
            .expect("the writer thread panicked")
            .expect("could not write to git");
        assert!(
            output.status.success(),
            "`git {}` failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
        output.stdout
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

// ---- Byte sweeps: one commit per probe, compared with Git's output ------------------------------

/// The bytes one probe commit carries in its author name, its subject and its body.
type Probe = Vec<u8>;

/// What `git log` prints for one probe commit, as raw bytes.
struct Printed {
    author: Vec<u8>,
    subject: Vec<u8>,
    /// `%B` without its final newline, the same reading as `commit_bodies`.
    body: Vec<u8>,
}

/// What the engine serves for one probe commit, as raw bytes.
#[derive(Debug, PartialEq)]
struct Served {
    author: Vec<u8>,
    subject: Vec<u8>,
    body: Vec<u8>,
}

impl Raw {
    /// Write one root commit per probe, all in one `git hash-object` process. Each commit's
    /// author name, subject and body are the probe, and its header says `encoding <label>`.
    fn write_probes(&self, encoding: &str, probes: &[Probe]) -> Vec<String> {
        let tree = self.pipe(&["hash-object", "-t", "tree", "-w", "--stdin"], b"");
        let dir = self.repo.path().join("probe-objects");
        std::fs::create_dir_all(&dir).expect("could not create the probe directory");
        let mut paths = String::new();
        for (index, probe) in probes.iter().enumerate() {
            let mut object = format!("tree {tree}\nauthor ").into_bytes();
            object.extend_from_slice(probe);
            object.extend_from_slice(b" <a@example.com> 1600000000 +0000\n");
            object.extend_from_slice(b"committer Ann <a@example.com> 1600000000 +0000\n");
            object.extend_from_slice(format!("encoding {encoding}\n\n").as_bytes());
            object.extend_from_slice(probe);
            object.extend_from_slice(b"\n\n");
            object.extend_from_slice(probe);
            object.push(b'\n');
            let path = dir.join(index.to_string());
            std::fs::write(&path, &object).expect("could not write a probe object");
            paths.push_str(path.to_str().expect("the path is not UTF-8"));
            paths.push('\n');
        }
        self.pipe(
            &[
                "hash-object",
                "-t",
                "commit",
                "-w",
                "--literally",
                "--stdin-paths",
            ],
            paths.as_bytes(),
        )
        .lines()
        .map(str::to_string)
        .collect()
    }

    /// What `git log` prints for each of the commits, in UTF-8, read in one process.
    fn printed(&self, hashes: &[String]) -> HashMap<String, Printed> {
        let input = hashes.join("\n");
        let out = self.pipe_bytes(
            &[
                "log",
                "--no-walk=unsorted",
                "--stdin",
                "--format=%H%x1f%an%x1f%s%x1f%B%x1e",
            ],
            input.as_bytes(),
        );
        let mut printed = HashMap::new();
        for record in out.split(|&byte| byte == 0x1e) {
            let fields: Vec<&[u8]> = record.splitn(4, |&byte| byte == 0x1f).collect();
            if fields.len() != 4 {
                continue;
            }
            let hash = String::from_utf8_lossy(fields[0]).trim().to_string();
            printed.insert(
                hash,
                Printed {
                    author: fields[1].to_vec(),
                    subject: fields[2].to_vec(),
                    body: strip_final_newline(fields[3]).to_vec(),
                },
            );
        }
        printed
    }
}

fn strip_final_newline(bytes: &[u8]) -> &[u8] {
    bytes.strip_suffix(b"\n").unwrap_or(bytes)
}

/// What the engine serves for one commit. A decline comes back as the error.
fn served(repo: &Repo, hash: &str) -> Result<Served> {
    let summary = commit_summaries(repo, &[hash.to_string()])?;
    let bodies = commit_bodies(repo, &[hash.to_string()])?;
    let id = repo.resolve_commit(hash)?;
    let options = WalkOptions {
        limit: 1,
        ..WalkOptions::default()
    };
    let records = log::walk(repo, &[id], &options)?;
    Ok(Served {
        author: summary[hash].author.as_bytes().to_vec(),
        subject: records[0].message.as_bytes().to_vec(),
        body: bodies[hash].as_bytes().to_vec(),
    })
}

/// The outcome of one sweep: how many probes the engine served, how many it declined, and the
/// first probes it served differently from Git.
#[derive(Debug)]
struct Sweep {
    served: usize,
    declined: usize,
    differing: usize,
    examples: Vec<String>,
}

fn sweep(encoding: &str, probes: &[Probe]) -> Sweep {
    let raw = Raw::new();
    let hashes = raw.write_probes(encoding, probes);
    let printed = raw.printed(&hashes);
    let repo = raw.open();
    let mut outcome = Sweep {
        served: 0,
        declined: 0,
        differing: 0,
        examples: Vec::new(),
    };
    for (probe, hash) in probes.iter().zip(&hashes) {
        match served(&repo, hash) {
            Ok(got) => {
                outcome.served += 1;
                let want = &printed[hash];
                let expected = Served {
                    author: want.author.clone(),
                    subject: want.subject.clone(),
                    body: want.body.clone(),
                };
                if got != expected {
                    outcome.differing += 1;
                    if outcome.examples.len() < 3 {
                        outcome.examples.push(format!(
                            "probe {probe:02x?}: engine {got:?}, git {expected:?}"
                        ));
                    }
                }
            }
            Err(error) => {
                assert_eq!(error.kind, ErrorKind::Unsupported, "{error}");
                outcome.declined += 1;
            }
        }
    }
    outcome
}

/// Every single byte from 0x80 up, one per commit.
fn high_bytes() -> Vec<Probe> {
    (0x80..=0xFF_u8).map(|byte| vec![byte]).collect()
}

/// Two-byte probes: every lead of `leads` with every trail of `trails`.
fn pairs(leads: RangeInclusive<u8>, trails: &[RangeInclusive<u8>]) -> Vec<Probe> {
    leads
        .flat_map(|lead| {
            trails
                .iter()
                .flat_map(|trail| trail.clone())
                .map(move |trail| vec![lead, trail])
        })
        .collect()
}

/// Every probe of `probes`, one in `step`, so that a label that declines still gets a broad
/// sample without a commit per pair.
fn every(probes: Vec<Probe>, step: usize) -> Vec<Probe> {
    probes.into_iter().step_by(step).collect()
}

/// Verdicts, pinned. Accepted: the engine served probes and every one matched Git. Declined:
/// the engine served nothing, every read of such a commit is `Unsupported`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Verdict {
    Accepted,
    Declined,
}

fn check(label: &str, verdict: Verdict, probes: &[Probe]) {
    let outcome = sweep(label, probes);
    match verdict {
        Verdict::Accepted => assert!(
            outcome.served > 0 && outcome.differing == 0,
            "{label} must be accepted: {outcome:?}"
        ),
        Verdict::Declined => assert_eq!(
            outcome.served, 0,
            "{label} must decline every read: {outcome:?}"
        ),
    }
}

#[test]
fn single_byte_labels_match_git_on_every_high_byte() {
    require_git!();
    use Verdict::{Accepted, Declined};
    let table = [
        // The Latin-1 path, byte for byte.
        ("latin1", Accepted),
        ("iso-8859-1", Accepted),
        ("iso8859-1", Accepted),
        ("iso_8859-1", Accepted),
        ("iso-ir-100", Accepted),
        ("cp819", Accepted),
        ("l1", Accepted),
        // ISO-8859 and the other single-byte tables that `encoding_rs` decodes as they are.
        ("iso-8859-2", Accepted),
        ("latin2", Accepted),
        ("iso8859-2", Accepted),
        ("iso_8859-2", Accepted),
        ("csisolatin2", Accepted),
        ("iso-ir-101", Accepted),
        ("iso-8859-3", Accepted),
        ("latin3", Accepted),
        ("iso-ir-109", Accepted),
        ("iso-8859-4", Accepted),
        ("latin4", Accepted),
        ("iso-ir-110", Accepted),
        ("iso-8859-5", Accepted),
        ("cyrillic", Accepted),
        ("iso-ir-144", Accepted),
        ("iso-8859-6", Accepted),
        ("arabic", Accepted),
        ("iso-ir-127", Accepted),
        ("iso-8859-7", Accepted),
        ("greek", Accepted),
        ("iso-ir-126", Accepted),
        ("iso-8859-8", Accepted),
        ("hebrew", Accepted),
        ("iso-ir-138", Accepted),
        ("iso-8859-10", Accepted),
        ("latin6", Accepted),
        ("iso-8859-13", Accepted),
        ("iso-8859-14", Accepted),
        ("iso-8859-15", Accepted),
        ("iso-8859-16", Accepted),
        ("ibm866", Accepted),
        ("cp866", Accepted),
        ("csibm866", Accepted),
        ("koi8-r", Accepted),
        ("cskoi8r", Accepted),
        ("windows-1256", Accepted),
        ("cp1256", Accepted),
        // Declined: the ISO-8859 label the web standard folds into a Windows table, Thai,
        // Turkish and the Hebrew visual variant, and the Windows tables that differ from iconv.
        ("iso-8859-9", Declined),
        ("iso-8859-11", Declined),
        ("tis-620", Declined),
        ("iso-8859-8-i", Declined),
        ("windows-874", Declined),
        ("windows-1250", Declined),
        ("windows-1251", Declined),
        ("windows-1252", Declined),
        ("windows-1253", Declined),
        ("windows-1254", Declined),
        ("windows-1255", Declined),
        ("windows-1257", Declined),
        ("windows-1258", Declined),
        ("cp1250", Declined),
        ("cp1251", Declined),
        ("cp1252", Declined),
        // Declined: KOI8-U; the `koi8` alias, whose iconv table is not KOI8-R's (it rejects
        // some bytes KOI8-R maps); Mac Roman, which iconv maps differently; and Mac Cyrillic,
        // which iconv does not know.
        ("koi8-u", Declined),
        ("koi8", Declined),
        ("macintosh", Declined),
        ("mac", Declined),
        ("x-mac-cyrillic", Declined),
        // Declined: ASCII labels, which the web standard reads as Windows-1252.
        ("ascii", Declined),
        ("us-ascii", Declined),
    ];
    for (label, verdict) in table {
        check(label, verdict, &high_bytes());
    }
}

#[test]
fn multi_byte_and_other_labels_decline() {
    require_git!();
    let mut probes = high_bytes();
    probes.extend(pairs(0x81..=0xFE, &[0x40..=0x7E, 0x80..=0xFE]));
    let sample = every(probes, 11);
    // The disagreements the sweeps found, named so that they are always among the probes.
    let named: Vec<Probe> = vec![
        vec![0x80],
        vec![0xA1, 0x40],
        vec![0xA2, 0xE3],
        vec![0x81, 0x30, 0x81, 0x30],
        vec![0xA3, 0xA0],
        vec![0x87, 0x40],
        vec![0x88, 0x62],
        vec![0x81, 0x41],
        vec![0xA1, 0xC1],
        vec![0x8F, 0xA2, 0xAF],
        vec![0x81, 0x60],
    ];
    let mut all = sample;
    all.extend(named);
    for label in [
        // GBK, GB18030 and their aliases; Big5 and its HKSCS and alias labels; EUC-KR and UHC.
        "gbk",
        "gb2312",
        "x-gbk",
        "gb18030",
        "big5",
        "big5-hkscs",
        "cn-big5",
        "euc-kr",
        "ks_c_5601-1987",
        "windows-949",
        // EUC-JP, Shift_JIS and their aliases.
        "euc-jp",
        "x-euc-jp",
        "shift_jis",
        "sjis",
        "windows-31j",
        "x-sjis",
        // Not ASCII supersets, and labels `encoding_rs` does not know.
        "iso-2022-jp",
        "utf-16le",
        "utf-16be",
        "replacement",
        "klingon",
    ] {
        check(label, Verdict::Declined, &all);
    }
}

#[test]
fn real_text_in_verified_labels_matches_git() {
    require_git!();
    // Each sample is the text iconv encodes to the label, with a multi-line body.
    let samples: [(&str, &[u8], &[u8]); 4] = [
        // Αθήνα, υπογραφή
        (
            "ISO-8859-7",
            b"\xc1\xe8\xde\xed\xe1",
            b"\xf5\xf0\xef\xe3\xf1\xe1\xf6\xde\n\nsecond line\n",
        ),
        // مرحبا
        (
            "windows-1256",
            b"\xe3\xd1\xcd\xc8\xc7",
            b"\xe3\xd1\xcd\xc8\xc7\n",
        ),
        // Привет
        (
            "IBM866",
            b"\x8f\xe0\xa8\xa2\xa5\xe2",
            b"\x8f\xe0\xa8\xa2\xa5\xe2\n",
        ),
        // Zoë, Łódź
        ("ISO-8859-2", b"Zo\xeb", b"\xa3\xf3d\xbc\n\nbody\n"),
    ];
    for (label, author, message) in samples {
        let mut raw = Raw::new();
        let hash = raw.commit(&Spec::new(Some(label), author, message));
        let expected = raw.git_fields(&hash);
        let got = served(&raw.open(), &hash).expect("the engine must serve a verified label");
        assert_eq!(got.author, expected[0].as_bytes(), "{label} author");
        assert_eq!(got.subject, expected[3].as_bytes(), "{label} subject");
        assert_eq!(
            got.body,
            strip_final_newline(expected[5].as_bytes()),
            "{label} body"
        );
    }
}
