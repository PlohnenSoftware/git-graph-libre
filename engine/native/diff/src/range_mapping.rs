// Ported from microsoft/vscode src/vs/editor/common/diff/rangeMapping.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8 (the mapping types and
// the conversion helpers the diff computer uses; the legacy-diff helpers
// `lineRangeMappingFromChange`, `inverse`, `clip` and the text-edit
// conversions are not needed).
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

use crate::line_range::LineRange;
use crate::position::Position;
use crate::range::Range;
use crate::text::TextModel;

/// Maps a line range in the original text to one in the modified text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LineRangeMapping {
    pub original: LineRange,
    pub modified: LineRange,
}

impl LineRangeMapping {
    pub fn new(original: LineRange, modified: LineRange) -> Self {
        Self { original, modified }
    }
    pub fn flip(&self) -> Self {
        Self::new(self.modified, self.original)
    }
}

impl fmt::Display for LineRangeMapping {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{{{}->{}}}", self.original, self.modified)
    }
}

/// Maps a character range in the original text to one in the modified text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RangeMapping {
    pub original_range: Range,
    pub modified_range: Range,
}

impl RangeMapping {
    pub fn new(original_range: Range, modified_range: Range) -> Self {
        Self {
            original_range,
            modified_range,
        }
    }
    pub fn flip(&self) -> Self {
        Self::new(self.modified_range, self.original_range)
    }
}

/// A line-range mapping with its character-level refinement
/// (`inner_changes` is `None` when VS Code leaves it undefined).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DetailedLineRangeMapping {
    pub original: LineRange,
    pub modified: LineRange,
    pub inner_changes: Option<Vec<RangeMapping>>,
}

impl DetailedLineRangeMapping {
    pub fn new(
        original: LineRange,
        modified: LineRange,
        inner_changes: Option<Vec<RangeMapping>>,
    ) -> Self {
        Self {
            original,
            modified,
            inner_changes,
        }
    }
    pub fn flip(&self) -> Self {
        Self::new(
            self.modified,
            self.original,
            self.inner_changes
                .as_ref()
                .map(|c| c.iter().map(RangeMapping::flip).collect()),
        )
    }
}

impl LineRangeMapping {
    /// `LineRangeMapping.toRangeMapping2` (`rangeMapping.ts` L132-L171): the
    /// character range of a line diff, without addressing lines that do not
    /// exist. Panics where VS Code throws a `BugIndicatingError` (one range
    /// empty, the other touching the last line, both starting at line 1).
    pub fn to_range_mapping2(&self, original: &TextModel, modified: &TextModel) -> RangeMapping {
        let (o, m) = (self.original, self.modified);
        if is_valid_line_number(o.end_line_number_exclusive, original)
            && is_valid_line_number(m.end_line_number_exclusive, modified)
        {
            return RangeMapping::new(
                Range::new(o.start_line_number, 1, o.end_line_number_exclusive, 1),
                Range::new(m.start_line_number, 1, m.end_line_number_exclusive, 1),
            );
        }
        if !o.is_empty() && !m.is_empty() {
            return RangeMapping::new(
                Range::from_positions(
                    Position::new(o.start_line_number, 1),
                    end_of_line(i64::from(o.end_line_number_exclusive) - 1, original),
                ),
                Range::from_positions(
                    Position::new(m.start_line_number, 1),
                    end_of_line(i64::from(m.end_line_number_exclusive) - 1, modified),
                ),
            );
        }
        if o.start_line_number > 1 && m.start_line_number > 1 {
            let at = |line: u32, end: u32, text: &TextModel| {
                Range::from_positions(
                    end_of_line(i64::from(line) - 1, text),
                    end_of_line(i64::from(end) - 1, text),
                )
            };
            return RangeMapping::new(
                at(o.start_line_number, o.end_line_number_exclusive, original),
                at(m.start_line_number, m.end_line_number_exclusive, modified),
            );
        }
        // One range is empty, one touches the last line and one starts at line 1.
        panic!("BugIndicatingError: not a valid diff");
    }
}

/// `normalizePosition(new Position(line, Number.MAX_SAFE_INTEGER), content)`
/// (`rangeMapping.ts` L174-L186): the end of that line, clamped into the text.
fn end_of_line(line_number: i64, content: &TextModel) -> Position {
    if line_number < 1 {
        return Position::new(1, 1);
    }
    let line_count = content.line_count();
    if line_number > i64::from(line_count) {
        return Position::new(line_count, content.utf16_line(line_count).len() as u32 + 1);
    }
    let line_number = line_number as u32;
    Position::new(
        line_number,
        content.utf16_line(line_number).len() as u32 + 1,
    )
}

/// `isValidLineNumber` (`rangeMapping.ts` L188-L190).
fn is_valid_line_number(line_number: u32, lines: &TextModel) -> bool {
    line_number >= 1 && line_number <= lines.line_count()
}

/// `getLineRangeMapping` (`rangeMapping.ts` L361-L396): the line ranges
/// covering one character-level mapping, leaving out a first or last line
/// the mapping only touches at its edge.
pub fn get_line_range_mapping(
    range_mapping: &RangeMapping,
    original_lines: &TextModel,
    modified_lines: &TextModel,
) -> DetailedLineRangeMapping {
    let (o, m) = (range_mapping.original_range, range_mapping.modified_range);
    let mut line_start_delta = 0i64;
    let mut line_end_delta = 0i64;

    // original: ]xxx \n <- this line is not modified
    // modified: ]xx  \n
    // We can only do this if the range is not empty yet.
    if m.end_column == 1
        && o.end_column == 1
        && o.start_line_number <= o.end_line_number
        && m.start_line_number <= m.end_line_number
    {
        line_end_delta = -1;
    }

    // original: xxx[ \n <- this line is not modified
    // modified: xxx[ \n
    // We can only do this if the range is not empty yet.
    if m.start_column as usize > modified_lines.utf16_line(m.start_line_number).len()
        && o.start_column as usize > original_lines.utf16_line(o.start_line_number).len()
        && i64::from(o.start_line_number) <= i64::from(o.end_line_number) + line_end_delta
        && i64::from(m.start_line_number) <= i64::from(m.end_line_number) + line_end_delta
    {
        line_start_delta = 1;
    }

    let line_range = |start: u32, end: u32| {
        LineRange::new(
            (i64::from(start) + line_start_delta) as u32,
            (i64::from(end) + 1 + line_end_delta) as u32,
        )
    };
    DetailedLineRangeMapping::new(
        line_range(o.start_line_number, o.end_line_number),
        line_range(m.start_line_number, m.end_line_number),
        Some(vec![range_mapping.clone()]),
    )
}

#[cfg(test)]
mod tests {
    use super::{get_line_range_mapping, DetailedLineRangeMapping, LineRangeMapping, RangeMapping};
    use crate::line_range::LineRange;
    use crate::range::Range;
    use crate::text::TextModel;
    #[test]
    fn flips() {
        let m = LineRangeMapping::new(LineRange::new(1, 3), LineRange::new(2, 5));
        assert_eq!(m.to_string(), "{[1,3)->[2,5)}");
        assert_eq!(m.flip().original, LineRange::new(2, 5));
        let d = DetailedLineRangeMapping::new(
            LineRange::new(1, 2),
            LineRange::new(1, 2),
            Some(vec![RangeMapping::new(
                Range::new(1, 1, 1, 3),
                Range::new(1, 1, 1, 4),
            )]),
        );
        assert_eq!(
            d.flip().inner_changes.unwrap()[0].original_range,
            Range::new(1, 1, 1, 4)
        );
    }

    fn text(lines: &[&str]) -> TextModel {
        TextModel::from_lines(lines.iter().map(|l| (*l).to_string()).collect())
    }

    // The two `lineRangeMapping` tests of VS Code's `defaultLinesDiffComputer.test.ts`.
    #[test]
    fn line_range_mapping_simple() {
        let mapping = get_line_range_mapping(
            &RangeMapping::new(Range::new(2, 1, 3, 1), Range::new(2, 1, 2, 1)),
            &text(&["const abc = \"helloworld\".split(\"\");", "", ""]),
            &text(&["const asciiLower = \"helloworld\".split(\"\");", ""]),
        );
        assert_eq!(
            LineRangeMapping::new(mapping.original, mapping.modified).to_string(),
            "{[2,3)->[2,2)}"
        );
    }

    #[test]
    fn line_range_mapping_empty_lines() {
        let mapping = get_line_range_mapping(
            &RangeMapping::new(Range::new(2, 1, 2, 1), Range::new(2, 1, 4, 1)),
            &text(&["", ""]),
            &text(&["", "", "", ""]),
        );
        assert_eq!(
            LineRangeMapping::new(mapping.original, mapping.modified).to_string(),
            "{[2,2)->[2,4)}"
        );
    }

    #[test]
    fn character_range_of_a_line_diff() {
        let (a, b) = (text(&["x", "y", "z"]), text(&["x", "z"]));
        let at = |o: (u32, u32), m: (u32, u32)| {
            LineRangeMapping::new(LineRange::new(o.0, o.1), LineRange::new(m.0, m.1))
                .to_range_mapping2(&a, &b)
        };
        // Both end lines exist: whole lines, column 1.
        assert_eq!(at((2, 3), (2, 2)).original_range, Range::new(2, 1, 3, 1));
        // Deleting the last line: from the end of line 2 to the end of line 3.
        let last = at((3, 4), (3, 3));
        assert_eq!(last.original_range, Range::new(2, 2, 3, 2));
        // A pure insertion after line 1 anchors at the end of line 1.
        let ins = at((2, 2), (2, 3));
        assert_eq!(ins.original_range, Range::new(1, 2, 1, 2));
    }

    #[test]
    #[should_panic(expected = "BugIndicatingError")]
    fn invalid_diff_panics() {
        let a = text(&["x"]);
        let _ = LineRangeMapping::new(LineRange::new(1, 1), LineRange::new(1, 5))
            .to_range_mapping2(&a, &a);
    }
}
