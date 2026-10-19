// Runs VS Code's 58 diffing fixtures (vendored in tests/fixtures/vscode-diff,
// MIT, Copyright (c) Microsoft Corporation; see that folder's README) through
// the Rust port and compares the result with `advanced.expected.diff.json`
// exactly, moves included. The runner mirrors VS Code's
// src/vs/editor/test/node/diffing/fixtures.test.ts at commit
// 28a562309973a386b2bdefae78127788a4742fe8: line endings normalized to `\n`,
// `ignoreTrimWhitespace` for folders named `*trimws*`, `computeMoves: true`,
// `maxComputationTimeMs: Number.MAX_SAFE_INTEGER`; and, for the others,
// its `assertDiffCorrectness` (the inner changes turn the original into the
// modified text).
// This test is part of Git Graph Libre, AGPL-3.0-or-later.
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use git_graph_diff::fixture::format_lines_diff;
use git_graph_diff::{compute_diff, LinesDiff, LinesDiffOptions, SystemClock, TextModel};

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../tests/fixtures/vscode-diff")
}

/// The JSON the fixtures use (no numbers or booleans), compared as data: the
/// expected files list their keys in more than one order.
#[derive(Debug, PartialEq)]
enum Json {
    Null,
    Str(String),
    Array(Vec<Json>),
    Object(BTreeMap<String, Json>),
}

struct JsonParser<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
}

impl JsonParser<'_> {
    fn skip_whitespace(&mut self) {
        while self.chars.next_if(|c| c.is_whitespace()).is_some() {}
    }

    fn expect(&mut self, wanted: char) {
        self.skip_whitespace();
        assert_eq!(self.chars.next(), Some(wanted));
    }

    fn value(&mut self) -> Json {
        self.skip_whitespace();
        match self.chars.peek() {
            Some('{') => self.object(),
            Some('[') => self.array(),
            Some('"') => Json::Str(self.string()),
            Some('n') => {
                assert!((0..4).all(|_| self.chars.next().is_some()));
                Json::Null
            }
            other => panic!("unexpected JSON start {other:?}"),
        }
    }

    fn string(&mut self) -> String {
        self.expect('"');
        let mut out = String::new();
        loop {
            match self.chars.next().expect("unterminated string") {
                '"' => return out,
                '\\' => out.push(self.escape()),
                c => out.push(c),
            }
        }
    }

    fn escape(&mut self) -> char {
        match self.chars.next().expect("unterminated escape") {
            'n' => '\n',
            't' => '\t',
            'r' => '\r',
            'b' => '\u{8}',
            'f' => '\u{c}',
            'u' => {
                let hex: String = (0..4).filter_map(|_| self.chars.next()).collect();
                // Lone surrogates cannot be a `char`; the comparison does not need them.
                char::from_u32(u32::from_str_radix(&hex, 16).unwrap()).unwrap_or('\u{fffd}')
            }
            c => c,
        }
    }

    fn array(&mut self) -> Json {
        self.expect('[');
        let mut items = Vec::new();
        self.skip_whitespace();
        if self.chars.next_if_eq(&']').is_some() {
            return Json::Array(items);
        }
        loop {
            items.push(self.value());
            self.skip_whitespace();
            if self.chars.next() == Some(']') {
                return Json::Array(items);
            }
        }
    }

    fn object(&mut self) -> Json {
        self.expect('{');
        let mut fields = BTreeMap::new();
        self.skip_whitespace();
        if self.chars.next_if_eq(&'}').is_some() {
            return Json::Object(fields);
        }
        loop {
            let key = self.string();
            self.expect(':');
            fields.insert(key, self.value());
            self.skip_whitespace();
            if self.chars.next() == Some('}') {
                return Json::Object(fields);
            }
        }
    }
}

fn parse_json(json: &str) -> Json {
    JsonParser {
        chars: json.chars().peekable(),
    }
    .value()
}

/// The `diffs` and `moves` members of a parsed fixture result: what the
/// printer prints (`original` and `modified` hold the file contents).
fn result_members(json: &str) -> Json {
    let Json::Object(mut fields) = parse_json(json) else {
        panic!("a fixture result is an object");
    };
    fields.retain(|key, _| key == "diffs" || key == "moves");
    Json::Object(fields)
}

/// `readFixtureFile`: UTF-8 text with `\r\n` and `\r` turned into `\n`.
fn read_normalized(dir: &Path, prefix: &str) -> String {
    let mut files: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .filter(|name| name.starts_with(prefix))
        .collect();
    files.sort();
    let text = fs::read_to_string(dir.join(&files[0])).unwrap();
    text.replace("\r\n", "\n").replace('\r', "\n")
}

/// The UTF-16 offset of a 1-based (line, column) in the text joined with `\n`.
fn offset(model: &TextModel, line_number: u32, column: u32) -> usize {
    let before: usize = (1..line_number)
        .map(|n| model.utf16_line(n).len() + 1)
        .sum();
    before + column as usize - 1
}

fn joined(model: &TextModel) -> Vec<u16> {
    (1..=model.line_count())
        .map(|n| model.utf16_line(n).to_vec())
        .collect::<Vec<_>>()
        .join(&10)
}

/// `assertDiffCorrectness`: applying every inner change to the original text
/// gives the modified text.
fn assert_diff_correct(diff: &LinesDiff, original: &TextModel, modified: &TextModel, name: &str) {
    let (original_text, modified_text) = (joined(original), joined(modified));
    let mut result: Vec<u16> = Vec::new();
    let mut cursor = 0;
    for inner in diff
        .changes
        .iter()
        .flat_map(|c| c.inner_changes.iter().flatten())
    {
        let (o, m) = (inner.original_range, inner.modified_range);
        let start = offset(original, o.start_line_number, o.start_column);
        let end = offset(original, o.end_line_number, o.end_column);
        result.extend_from_slice(&original_text[cursor..start]);
        let (m_start, m_end) = (
            offset(modified, m.start_line_number, m.start_column),
            offset(modified, m.end_line_number, m.end_column),
        );
        result.extend_from_slice(&modified_text[m_start..m_end]);
        cursor = end;
    }
    result.extend_from_slice(&original_text[cursor..]);
    assert!(
        result == modified_text,
        "{name}: applying the diff does not give the modified text"
    );
}

#[test]
fn all_58_fixtures_match_exactly_moves_included() {
    let mut names: Vec<String> = fs::read_dir(fixtures_dir())
        .unwrap()
        .map(|entry| entry.unwrap())
        .filter(|entry| entry.file_type().unwrap().is_dir())
        .map(|entry| entry.file_name().into_string().unwrap())
        .collect();
    names.sort();
    assert_eq!(names.len(), 58);

    let (mut with_moves, mut with_move_changes) = (0, 0);
    for name in &names {
        let dir = fixtures_dir().join(name);
        let original = TextModel::from_text(&read_normalized(&dir, "1."));
        let modified = TextModel::from_text(&read_normalized(&dir, "2."));
        let ignore_trim_whitespace = name.contains("trimws");
        let options = LinesDiffOptions {
            ignore_trim_whitespace,
            max_computation_time_ms: MAX_SAFE_INTEGER,
            compute_moves: true,
            extend_to_subwords: false,
        };
        let diff = compute_diff(&original, &modified, options, &SystemClock::new())
            .unwrap_or_else(|e| panic!("{name}: {e}"));
        if !ignore_trim_whitespace {
            assert_diff_correct(&diff, &original, &modified, name);
        }
        let expected = fs::read_to_string(dir.join("advanced.expected.diff.json")).unwrap();
        let actual = format_lines_diff(&diff, &original, &modified);
        assert_eq!(
            result_members(&actual),
            result_members(&expected),
            "fixture {name}"
        );
        with_moves += usize::from(!diff.moves.is_empty());
        with_move_changes += diff.moves.iter().filter(|m| !m.changes.is_empty()).count();
    }
    // The fixtures do exercise moves, and moves whose text also changed.
    assert!(
        with_moves > 0 && with_move_changes > 0,
        "{with_moves} {with_move_changes}"
    );
}
