// Ported from microsoft/vscode src/vs/editor/common/diff/rangeMapping.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8 (the mapping types;
// conversion helpers arrive with the slices that use them).
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

use crate::line_range::LineRange;
use crate::range::Range;

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

#[cfg(test)]
mod tests {
    use super::{DetailedLineRangeMapping, LineRangeMapping, RangeMapping};
    use crate::line_range::LineRange;
    use crate::range::Range;
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
}
