// Compares the Rust `compute_diff` with the oracle corpus produced by running
// VS Code's own `DefaultLinesDiffComputer.computeDiff`
// (tests/oracle/gen-default-lines-diff-computer.mjs, microsoft/vscode at commit
// 28a562309973a386b2bdefae78127788a4742fe8, MIT, Copyright (c) Microsoft
// Corporation): code-like and whitespace-only edits, moves, long lines, unicode,
// repeated lines, and texts either side of the 1700-line switch to Myers, with
// every combination of `ignoreTrimWhitespace`, `computeMoves` and
// `extendToSubwords` the generator draws. Cases on which VS Code throws must
// come back as an error.
// This test is part of Git Graph Libre, AGPL-3.0-or-later.
use git_graph_diff::{
    compute_diff, DetailedLineRangeMapping, LineRange, LinesDiffOptions, MovedText, Range,
    SystemClock, TextModel,
};

/// `decodeURIComponent` for the generator's `encodeURIComponent`.
fn decode(encoded: &str) -> String {
    let bytes = encoded.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            out.push(u8::from_str_radix(&encoded[i + 1..i + 3], 16).unwrap());
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).unwrap()
}

fn model(field: &str) -> TextModel {
    TextModel::from_lines(field.split('|').map(decode).collect())
}

fn line_range(r: LineRange) -> String {
    format!("{},{}", r.start_line_number, r.end_line_number_exclusive)
}

fn char_range(r: Range) -> String {
    format!(
        "{},{},{},{}",
        r.start_line_number, r.start_column, r.end_line_number, r.end_column
    )
}

fn change(c: &DetailedLineRangeMapping) -> String {
    let inner = match &c.inner_changes {
        None => "!".to_string(),
        Some(inner) => inner
            .iter()
            .map(|i| {
                format!(
                    "[{}>{}]",
                    char_range(i.original_range),
                    char_range(i.modified_range)
                )
            })
            .collect(),
    };
    format!(
        "c{},{}{inner}",
        line_range(c.original),
        line_range(c.modified)
    )
}

fn mv(m: &MovedText) -> String {
    let changes: String = m.changes.iter().map(change).collect();
    format!(
        "m{},{}({changes})",
        line_range(m.line_range_mapping.original),
        line_range(m.line_range_mapping.modified)
    )
}

#[test]
fn matches_vscode_on_the_oracle_corpus() {
    let (mut cases, mut with_moves, mut throws) = (0, 0, 0);
    for (number, line) in include_str!("data/default-lines-diff-computer-oracle.txt")
        .lines()
        .filter(|l| !l.starts_with('#'))
        .enumerate()
    {
        let fields: Vec<&str> = line.split(';').collect();
        let flags: Vec<bool> = fields[2].split(',').map(|f| f == "1").collect();
        let options = LinesDiffOptions {
            ignore_trim_whitespace: flags[0],
            max_computation_time_ms: 0,
            compute_moves: flags[1],
            extend_to_subwords: flags[2],
        };
        let result = compute_diff(
            &model(fields[0]),
            &model(fields[1]),
            options,
            &SystemClock::new(),
        );
        cases += 1;
        if fields[3] == "THROW" {
            assert!(
                result.is_err(),
                "case {number}: VS Code throws, the port returned a diff"
            );
            throws += 1;
            continue;
        }
        let diff = result.unwrap_or_else(|e| panic!("case {number}: {e}"));
        let changes: Vec<String> = diff.changes.iter().map(change).collect();
        let moves: Vec<String> = diff.moves.iter().map(mv).collect();
        let actual = format!(
            "{} | {} | {}",
            changes.join(" "),
            moves.join(" "),
            u8::from(diff.hit_timeout)
        );
        assert_eq!(actual, fields[3], "case {number}");
        with_moves += usize::from(!diff.moves.is_empty());
    }
    assert!(
        cases > 400 && with_moves > 20 && throws > 0,
        "{cases} {with_moves} {throws}"
    );
}
