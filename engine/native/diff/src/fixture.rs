// Prints a `LinesDiff` in VS Code's fixture format — the `diffs` (and
// `moves`, when present) of `advanced.expected.diff.json`: line ranges as
// `[2,3)`, character ranges as `[2,1 -> 2,5]`, with ` EOL` when a character
// range ends past its line's last UTF-16 code unit. Format from the fixture
// runner in microsoft/vscode src/vs/editor/test/node/diffing at commit
// 28a562309973a386b2bdefae78127788a4742fe8 (see also D21's oracle suite).
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use crate::line_range::LineRange;
use crate::lines_diff::LinesDiff;
use crate::range::Range;
use crate::range_mapping::DetailedLineRangeMapping;
use crate::text::TextModel;

fn line_range(range: LineRange) -> String {
    format!(
        "[{},{})",
        range.start_line_number, range.end_line_number_exclusive
    )
}

fn char_range(range: Range, model: &TextModel) -> String {
    let eol = range.end_column == model.utf16_line(range.end_line_number).len() as u32 + 1;
    format!(
        "[{},{} -> {},{}{}]",
        range.start_line_number,
        range.start_column,
        range.end_line_number,
        range.end_column,
        if eol { " EOL" } else { "" }
    )
}

fn detailed(
    change: &DetailedLineRangeMapping,
    original: &TextModel,
    modified: &TextModel,
) -> String {
    let inner = match &change.inner_changes {
        None => "null".to_string(),
        Some(changes) => {
            let items: Vec<String> = changes
                .iter()
                .map(|c| {
                    format!(
                        "{{\"originalRange\": \"{}\", \"modifiedRange\": \"{}\"}}",
                        char_range(c.original_range, original),
                        char_range(c.modified_range, modified)
                    )
                })
                .collect();
            format!("[{}]", items.join(", "))
        }
    };
    format!(
        "{{\"originalRange\": \"{}\", \"modifiedRange\": \"{}\", \"innerChanges\": {}}}",
        line_range(change.original),
        line_range(change.modified),
        inner
    )
}

/// The canonical JSON for a diff result: `{"diffs": [...]}` plus
/// `, "moves": [...]` when there are moves, as in the expected files.
pub fn format_lines_diff(diff: &LinesDiff, original: &TextModel, modified: &TextModel) -> String {
    let diffs: Vec<String> = diff
        .changes
        .iter()
        .map(|c| detailed(c, original, modified))
        .collect();
    let mut out = format!("{{\"diffs\": [{}]", diffs.join(", "));
    if !diff.moves.is_empty() {
        let moves: Vec<String> = diff
            .moves
            .iter()
            .map(|m| {
                let changes: Vec<String> = m
                    .changes
                    .iter()
                    .map(|c| detailed(c, original, modified))
                    .collect();
                format!(
                    "{{\"originalRange\": \"{}\", \"modifiedRange\": \"{}\", \"changes\": [{}]}}",
                    line_range(m.line_range_mapping.original),
                    line_range(m.line_range_mapping.modified),
                    changes.join(", ")
                )
            })
            .collect();
        out.push_str(&format!(", \"moves\": [{}]", moves.join(", ")));
    }
    out.push('}');
    out
}

#[cfg(test)]
mod tests {
    use super::format_lines_diff;
    use crate::line_range::LineRange;
    use crate::lines_diff::LinesDiff;
    use crate::range::Range;
    use crate::range_mapping::{DetailedLineRangeMapping, RangeMapping};
    use crate::text::TextModel;
    #[test]
    fn prints_the_fixture_format() {
        let diff = LinesDiff {
            changes: vec![DetailedLineRangeMapping::new(
                LineRange::new(2, 3),
                LineRange::new(2, 3),
                Some(vec![RangeMapping::new(
                    Range::new(2, 1, 2, 5),
                    Range::new(2, 1, 2, 3),
                )]),
            )],
            moves: Vec::new(),
            hit_timeout: false,
        };
        // "abcd" has 4 UTF-16 units, so end column 5 is EOL; "ab" makes 3 EOL too.
        let printed = format_lines_diff(
            &diff,
            &TextModel::from_text("x\nabcd"),
            &TextModel::from_text("x\nab"),
        );
        assert_eq!(
            printed,
            "{\"diffs\": [{\"originalRange\": \"[2,3)\", \"modifiedRange\": \"[2,3)\", \
             \"innerChanges\": [{\"originalRange\": \"[2,1 -> 2,5 EOL]\", \"modifiedRange\": \"[2,1 -> 2,3 EOL]\"}]}]}"
        );
    }
}
