//! Commit text as `git log` prints it.
//!
//! gix hands out a commit's author, committer and message as the raw bytes of the object. Git
//! does two things to them before printing that the engine has to repeat, or the two backends
//! show different text for the same commit:
//!
//! - **Re-encoding.** A commit made with `i18n.commitEncoding` set records an `encoding` header
//!   and stores its text in that encoding. Git converts it to the log output encoding, which is
//!   UTF-8 unless `i18n.logOutputEncoding` (or, failing that, `i18n.commitEncoding`) says
//!   otherwise. Reading the raw bytes as UTF-8 turns `café` in ISO-8859-1 into `caf�`.
//! - **The subject.** `%s` skips the blank lines a message may start with and joins the first
//!   paragraph's lines with single spaces. gix's `summary()` does not skip leading blank lines.
//!
//! ## Declining
//!
//! The engine never shows text it is not sure Git would show the same way. These decline with
//! [`ErrorKind::Unsupported`](crate::ErrorKind::Unsupported), so the caller reads through the
//! `git` CLI instead:
//!
//! - a repository whose effective log output encoding is not UTF-8 ([`ensure_utf8_output`]);
//! - an `encoding` header naming a label outside [`VERIFIED_LABELS`]: a label this decoder does
//!   not know, or one whose decoding Git's converter (iconv) may not reproduce, because iconv does
//!   not know the label or decodes some bytes differently. `encoding_parity.rs` checks each
//!   verified label against Git byte for byte;
//! - bytes that are not valid in the declared encoding, because Git then prints the bytes
//!   unconverted and a decoder would have to guess.

use std::borrow::Cow;

use encoding_rs::Encoding;
use gix::bstr::ByteSlice;

use crate::error::{Error, Result};

/// Decline unless Git would print commits in UTF-8 in this repository.
///
/// Git converts commit text to `i18n.logOutputEncoding`, which defaults to `i18n.commitEncoding`
/// and then to UTF-8. When that is anything but UTF-8 the CLI's output is not UTF-8 text at all,
/// so the engine must not answer: its (UTF-8) answer would differ from the CLI's.
pub fn ensure_utf8_output(git: &gix::Repository) -> Result<()> {
    let config = git.config_snapshot();
    let configured = config
        .string("i18n.logOutputEncoding")
        .or_else(|| config.string("i18n.commitEncoding"));
    if let Some(label) = configured {
        let label: &[u8] = label.as_ref();
        if !is_utf8_label(label) {
            return Err(Error::unsupported(format!(
                "The repository prints commits in {}, not UTF-8",
                label.to_str_lossy()
            )));
        }
    }
    Ok(())
}

/// Git's own test for UTF-8: `utf-8` or `utf8`, in any case.
fn is_utf8_label(label: &[u8]) -> bool {
    let label = label.trim();
    label.eq_ignore_ascii_case(b"utf-8") || label.eq_ignore_ascii_case(b"utf8")
}

/// How the bytes of one commit are to be read.
#[derive(Clone, Copy)]
enum Stored {
    /// UTF-8, the default; invalid bytes show as U+FFFD, as they do through the CLI.
    Utf8,
    /// ISO-8859-1 proper, where every byte is the code point of the same value. `encoding_rs`
    /// follows the web standard and would read `0x80..=0x9F` as Windows-1252 letters instead.
    Latin1,
    Other(&'static Encoding),
}

/// The encoding a commit's text is stored in, read from its `encoding` header.
#[derive(Clone, Copy)]
pub struct CommitText(Stored);

impl CommitText {
    /// Read the commit's `encoding` header.
    ///
    /// Declines with `Unsupported` for a label the engine cannot decode as Git does.
    pub fn of(commit: &gix::Commit<'_>) -> Result<CommitText> {
        match encoding_header(&commit.data) {
            None => Ok(CommitText(Stored::Utf8)),
            Some(label) => stored_as(label).map(CommitText),
        }
    }

    /// Text of this commit (an identity, a message) as Git prints it.
    pub fn decode<'a>(&self, bytes: &'a [u8]) -> Result<Cow<'a, str>> {
        match self.0 {
            Stored::Utf8 => Ok(String::from_utf8_lossy(bytes)),
            Stored::Latin1 => Ok(match std::str::from_utf8(bytes) {
                Ok(text) if bytes.is_ascii() => Cow::Borrowed(text),
                _ => Cow::Owned(bytes.iter().map(|&byte| char::from(byte)).collect()),
            }),
            Stored::Other(_) if bytes.is_ascii() => {
                // Every encoding accepted here is an ASCII superset, so ASCII is unchanged.
                Ok(String::from_utf8_lossy(bytes))
            }
            Stored::Other(encoding) => encoding
                .decode_without_bom_handling_and_without_replacement(bytes)
                .ok_or_else(|| {
                    Error::unsupported(format!(
                        "Commit text is not valid {}; the engine leaves it to Git",
                        encoding.name()
                    ))
                }),
        }
    }

    /// The commit's whole message, decoded and otherwise as stored.
    pub fn message<'a>(&self, commit: &'a gix::Commit<'_>) -> Result<Cow<'a, str>> {
        self.decode(commit.message_raw_sloppy())
    }

    /// The commit's subject as `git log --format=%s` prints it.
    pub fn subject(&self, commit: &gix::Commit<'_>) -> Result<String> {
        let subject = subject(commit.message_raw_sloppy());
        Ok(self.decode(&subject)?.into_owned())
    }
}

/// The value of the first `encoding` header, if the commit has one. Headers end at the first
/// blank line, and a line that starts with a space continues the header above it.
fn encoding_header(data: &[u8]) -> Option<&[u8]> {
    for line in data.split(|&byte| byte == b'\n') {
        if line.is_empty() {
            return None;
        }
        if let Some(value) = line.strip_prefix(b"encoding ") {
            return Some(value);
        }
    }
    None
}

/// The labels, in lowercase, whose decoding `encoding_parity.rs` has checked against Git's
/// converter: every byte from 0x80 to 0xFF in an author name, a subject and a body, one commit
/// per byte, with no difference from what Git prints (bytes the decoder rejects decline on their
/// own). Any other label declines, even one `encoding_rs` knows: a label Git's iconv does not
/// know prints raw bytes, and the web standard's Windows-code-page and Mac-Roman tables disagree
/// with iconv on bytes that iconv maps elsewhere or leaves unassigned. The byte-level results
/// are recorded in `encoding_parity.rs`.
const VERIFIED_LABELS: &[&str] = &[
    "ibm866",
    "cp866",
    "csibm866",
    "iso-8859-2",
    "iso8859-2",
    "iso_8859-2",
    "csisolatin2",
    "latin2",
    "iso-ir-101",
    "iso-8859-3",
    "latin3",
    "iso-ir-109",
    "iso-8859-4",
    "latin4",
    "iso-ir-110",
    "iso-8859-5",
    "cyrillic",
    "iso-ir-144",
    "iso-8859-6",
    "arabic",
    "iso-ir-127",
    "iso-8859-7",
    "greek",
    "iso-ir-126",
    "iso-8859-8",
    "hebrew",
    "iso-ir-138",
    "iso-8859-10",
    "latin6",
    "iso-8859-13",
    "iso-8859-14",
    "iso-8859-15",
    "iso-8859-16",
    "koi8-r",
    "cskoi8r",
    "windows-1256",
    "cp1256",
];

/// Resolve a header's label, or decline.
fn stored_as(label: &[u8]) -> Result<Stored> {
    let label = label.trim();
    if is_utf8_label(label) {
        return Ok(Stored::Utf8);
    }
    let unsupported = |why: &str| {
        Error::unsupported(format!(
            "The commit's encoding {:?} {why}",
            label.to_str_lossy()
        ))
    };
    let Ok(name) = std::str::from_utf8(label) else {
        return Err(unsupported("is not a name the engine knows"));
    };
    let lower = name.to_ascii_lowercase();
    if matches!(
        lower.as_str(),
        "iso-8859-1" | "iso8859-1" | "iso_8859-1" | "latin1" | "l1" | "iso-ir-100" | "cp819"
    ) {
        return Ok(Stored::Latin1);
    }
    if !VERIFIED_LABELS.contains(&lower.as_str()) {
        return Err(unsupported("is not one the engine has checked against Git"));
    }
    let Some(encoding) = Encoding::for_label(label) else {
        return Err(unsupported("is not one the engine can decode"));
    };
    Ok(Stored::Other(encoding))
}

/// A commit's subject as `git log --format=%s` prints it, still in the commit's own encoding:
/// the first paragraph after any leading blank lines, each line stripped of trailing whitespace,
/// joined with single spaces.
pub fn subject(message: &[u8]) -> Vec<u8> {
    // Git's whitespace: space, tab, line feed and carriage return.
    let blank = |byte: u8| matches!(byte, b' ' | b'\t' | b'\n' | b'\r');
    let mut out = Vec::new();
    let mut started = false;
    for line in message.lines() {
        let line = line.trim_end_with(|c| c.is_ascii() && blank(c as u8));
        if line.is_empty() {
            if started {
                break;
            }
            continue;
        }
        if started {
            out.push(b' ');
        }
        out.extend_from_slice(line);
        started = true;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subject_skips_leading_blank_lines_and_folds_the_first_paragraph() {
        assert_eq!(
            subject(b"\n\n  leading blanks  \n\nbody"),
            b"  leading blanks"
        );
        assert_eq!(
            subject(b"first line\nsecond line\n\nbody"),
            b"first line second line"
        );
        assert_eq!(subject(b"crlf subject\r\n\r\nbody\r\n"), b"crlf subject");
        assert_eq!(subject(b"tabs\tand   spaces   \n"), b"tabs\tand   spaces");
        assert_eq!(subject(b" \t \nafter blanks"), b"after blanks");
        assert_eq!(subject(b""), b"");
    }

    #[test]
    fn the_header_is_found_only_among_the_headers() {
        let commit = b"tree 1\nauthor a\nencoding ISO-8859-1\n\nencoding utf-8\n";
        assert_eq!(encoding_header(commit), Some(&b"ISO-8859-1"[..]));
        assert_eq!(encoding_header(b"tree 1\n\nencoding x\n"), None);
        assert_eq!(encoding_header(b"tree 1\ngpgsig a\n encoding x\n\n"), None);
    }

    fn decode(label: &str, bytes: &[u8]) -> Result<String> {
        let text = CommitText(stored_as(label.as_bytes())?);
        text.decode(bytes).map(Cow::into_owned)
    }

    #[test]
    fn latin1_reads_every_byte_as_its_own_code_point() {
        assert_eq!(decode("ISO-8859-1", b"caf\xe9").unwrap(), "café");
        assert_eq!(decode("latin1", b"\x80\x9f").unwrap(), "\u{80}\u{9f}");
    }

    #[test]
    fn verified_labels_decode_or_decline() {
        assert_eq!(
            decode("KOI8-R", b"\xf0\xd2\xc9\xd7\xc5\xd4").unwrap(),
            "Привет"
        );
        assert_eq!(decode("iso-8859-2", b"\xb1").unwrap(), "ą");
        // `encoding_rs` decodes these, but Git's converter does not match it, so they decline
        // whatever the bytes.
        assert!(decode("Shift_JIS", b"\x93\xfa\x96\x7b").is_err());
        assert!(decode("windows-1252", b"\x80").is_err());
        assert!(decode("EUC-JP", b"\xff\xff").is_err());
        assert!(decode("klingon", b"x").is_err());
        assert!(decode("UTF-16LE", b"x").is_err());
        assert!(decode("iso-8859-9", b"x").is_err());
        assert!(decode("us-ascii", b"x").is_err());
    }

    #[test]
    fn every_verified_label_is_one_encoding_rs_knows() {
        for label in VERIFIED_LABELS {
            assert!(
                Encoding::for_label(label.as_bytes()).is_some(),
                "{label} is not a label encoding_rs knows"
            );
        }
    }

    #[test]
    fn utf8_labels_pass_through() {
        assert_eq!(decode("utf8", "café".as_bytes()).unwrap(), "café");
        assert_eq!(decode("UTF-8", b"a").unwrap(), "a");
    }
}
