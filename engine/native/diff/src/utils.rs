// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/utils.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8. `isSpace` and
// `LineRangeFragment` are here; `Array2D` is private to 22c's module.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use std::collections::HashMap;

use crate::line_range::LineRange;
use crate::text::TextModel;

const SPACE: u32 = 32;
const TAB: u32 = 9;

/// `isSpace`: a space or a tab, nothing else (a UTF-16 code unit, as a number).
pub fn is_space(char_code: u32) -> bool {
    char_code == SPACE || char_code == TAB
}

/// `LineRangeFragment`: a histogram of the UTF-16 units in a range of lines
/// (every line counts its `\n`). VS Code numbers characters through a static
/// map; similarity sums over every character, so the numbering never shows
/// and a per-fragment map gives the same value. `source` is the index of the
/// `DetailedLineRangeMapping` in the caller's list (VS Code keeps the object).
pub struct LineRangeFragment {
    pub range: LineRange,
    pub source: usize,
    total_count: u32,
    histogram: HashMap<u16, u32>,
}

impl LineRangeFragment {
    pub fn new(range: LineRange, lines: &TextModel, source: usize) -> Self {
        let mut histogram = HashMap::new();
        let mut total_count = 0;
        for line_number in range.start_line_number..range.end_line_number_exclusive {
            for &unit in lines
                .utf16_line(line_number)
                .iter()
                .chain(&[u16::from(b'\n')])
            {
                total_count += 1;
                *histogram.entry(unit).or_insert(0) += 1;
            }
        }
        Self {
            range,
            source,
            total_count,
            histogram,
        }
    }

    pub fn compute_similarity(&self, other: &Self) -> f64 {
        let count = |h: &HashMap<u16, u32>, k: &u16| h.get(k).copied().unwrap_or(0);
        let mut sum_differences = 0;
        for (k, &a) in &self.histogram {
            sum_differences += a.abs_diff(count(&other.histogram, k));
        }
        for (k, &b) in &other.histogram {
            if !self.histogram.contains_key(k) {
                sum_differences += b;
            }
        }
        1.0 - f64::from(sum_differences) / f64::from(self.total_count + other.total_count)
    }
}

#[cfg(test)]
mod tests {
    use super::{is_space, LineRangeFragment};
    use crate::line_range::LineRange;
    use crate::text::TextModel;

    #[test]
    fn fragment_similarity_counts_units_and_newlines() {
        let a = TextModel::from_lines(vec!["ab".into(), "c".into(), "\u{1F600}".into()]);
        let b = TextModel::from_lines(vec!["ba".into(), "c".into(), "x".into()]);
        let whole = LineRange::new(1, 4);
        let (fa, fb) = (
            LineRangeFragment::new(whole, &a, 0),
            LineRangeFragment::new(whole, &b, 1),
        );
        assert_eq!(fa.compute_similarity(&fa), 1.0);
        // totals 8 and 7; they differ by the two surrogate units and `x`
        assert_eq!(fa.compute_similarity(&fb), 1.0 - 3.0 / 15.0);
        assert_eq!(fa.source + fb.source, 1);
    }

    #[test]
    fn only_space_and_tab() {
        assert!(is_space(0x20) && is_space(0x09));
        for other in [0x0A, 0x0D, 0xA0, 0x3000, 0x2003, 0x41] {
            assert!(!is_space(other), "{other:#x}");
        }
    }
}
