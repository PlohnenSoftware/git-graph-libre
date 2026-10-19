// Ported from microsoft/vscode src/vs/editor/common/diff/linesDiffComputer.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use crate::range_mapping::{DetailedLineRangeMapping, LineRangeMapping};

/// `ILinesDiffComputerOptions`. A `max_computation_time_ms` of 0 means no
/// timeout, as in the `@vscode/diff` package (VS Code passes a huge value).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LinesDiffOptions {
    pub ignore_trim_whitespace: bool,
    pub max_computation_time_ms: u64,
    pub compute_moves: bool,
    pub extend_to_subwords: bool,
}

/// `LinesDiff`: the result of `computeDiff`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LinesDiff {
    pub changes: Vec<DetailedLineRangeMapping>,
    /// Sorted by original line ranges; the original and modified line
    /// ranges are disjoint (but can be touching).
    pub moves: Vec<MovedText>,
    /// Whether the timeout was reached; the diff may then be approximate.
    pub hit_timeout: bool,
}

/// `MovedText`: a block of lines that moved, with its inner diff
/// (empty when the text only moved).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MovedText {
    pub line_range_mapping: LineRangeMapping,
    pub changes: Vec<DetailedLineRangeMapping>,
}

impl MovedText {
    pub fn new(
        line_range_mapping: LineRangeMapping,
        changes: Vec<DetailedLineRangeMapping>,
    ) -> Self {
        Self {
            line_range_mapping,
            changes,
        }
    }
    pub fn flip(&self) -> Self {
        Self::new(
            self.line_range_mapping.flip(),
            self.changes
                .iter()
                .map(DetailedLineRangeMapping::flip)
                .collect(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::MovedText;
    use crate::line_range::LineRange;
    use crate::range_mapping::LineRangeMapping;
    #[test]
    fn flips() {
        let m = MovedText::new(
            LineRangeMapping::new(LineRange::new(1, 3), LineRange::new(5, 7)),
            Vec::new(),
        );
        assert_eq!(m.flip().line_range_mapping.original, LineRange::new(5, 7));
    }
}
