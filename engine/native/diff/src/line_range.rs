// Ported from microsoft/vscode src/vs/editor/common/core/ranges/lineRange.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

use crate::arrays_find::{
    find_first_idx_monotonous_or_arr_len, find_last_idx_monotonous, find_last_monotonous,
};
use crate::offset_range::OffsetRange;

/// A range of lines (1-based), `[start_line_number, end_line_number_exclusive)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct LineRange {
    pub start_line_number: u32,
    pub end_line_number_exclusive: u32,
}

impl LineRange {
    pub fn new(start_line_number: u32, end_line_number_exclusive: u32) -> Self {
        assert!(
            start_line_number <= end_line_number_exclusive,
            "startLineNumber {start_line_number} cannot be after endLineNumberExclusive {end_line_number_exclusive}"
        );
        Self {
            start_line_number,
            end_line_number_exclusive,
        }
    }
    pub fn of_length(start_line_number: u32, length: u32) -> Self {
        Self::new(start_line_number, start_line_number + length)
    }
    pub fn is_empty(self) -> bool {
        self.start_line_number == self.end_line_number_exclusive
    }
    pub fn length(self) -> u32 {
        self.end_line_number_exclusive - self.start_line_number
    }
    pub fn contains(self, line_number: u32) -> bool {
        self.start_line_number <= line_number && line_number < self.end_line_number_exclusive
    }
    pub fn delta(self, offset: i64) -> Self {
        Self::new(
            (i64::from(self.start_line_number) + offset) as u32,
            (i64::from(self.end_line_number_exclusive) + offset) as u32,
        )
    }
    pub fn join(self, other: Self) -> Self {
        Self::new(
            self.start_line_number.min(other.start_line_number),
            self.end_line_number_exclusive
                .max(other.end_line_number_exclusive),
        )
    }
    /// Empty when the ranges only touch; `None` when they do not even touch.
    pub fn intersect(self, other: Self) -> Option<Self> {
        let (s, e) = (
            self.start_line_number.max(other.start_line_number),
            self.end_line_number_exclusive
                .min(other.end_line_number_exclusive),
        );
        (s <= e).then(|| Self::new(s, e))
    }
    pub fn intersects_or_touches(self, other: Self) -> bool {
        self.start_line_number <= other.end_line_number_exclusive
            && other.start_line_number <= self.end_line_number_exclusive
    }
    /// `toOffsetRange`: the same lines as 0-based offsets.
    pub fn to_offset_range(self) -> OffsetRange {
        OffsetRange::new(
            self.start_line_number - 1,
            self.end_line_number_exclusive - 1,
        )
    }
}

impl fmt::Display for LineRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{},{})",
            self.start_line_number, self.end_line_number_exclusive
        )
    }
}

/// `LineRangeSet`, with the methods `computeMovedLines` uses: line ranges
/// sorted by start, none touching or intersecting.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LineRangeSet {
    normalized_ranges: Vec<LineRange>,
}

impl LineRangeSet {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn ranges(&self) -> &[LineRange] {
        &self.normalized_ranges
    }
    /// The index range of the elements that touch `range` (start, end exclusive).
    fn touching(&self, range: LineRange) -> (usize, usize) {
        let r = &self.normalized_ranges;
        let start = find_first_idx_monotonous_or_arr_len(r, |r| {
            r.end_line_number_exclusive >= range.start_line_number
        });
        let end = find_last_idx_monotonous(
            r,
            |r| r.start_line_number <= range.end_line_number_exclusive,
            0,
        ) + 1;
        (start, end as usize)
    }
    pub fn add_range(&mut self, range: LineRange) {
        if range.length() == 0 {
            return;
        }
        let (start, end) = self.touching(range);
        let r = &mut self.normalized_ranges;
        if start == end {
            r.insert(start, range);
        } else {
            let joined = r[start].join(r[end - 1]).join(range);
            r.splice(start..end, [joined]);
        }
    }
    pub fn contains(&self, line_number: u32) -> bool {
        find_last_monotonous(&self.normalized_ranges, |r| {
            r.start_line_number <= line_number
        })
        .is_some_and(|r| r.end_line_number_exclusive > line_number)
    }
    /// Subtracts all ranges in this set from `range` and returns the result.
    pub fn subtract_from(&self, range: LineRange) -> Self {
        let (start, end) = self.touching(range);
        if start == end {
            return Self {
                normalized_ranges: vec![range],
            };
        }
        let mut result = Vec::new();
        let mut start_line_number = range.start_line_number;
        for r in &self.normalized_ranges[start..end] {
            if r.start_line_number > start_line_number {
                result.push(LineRange::new(start_line_number, r.start_line_number));
            }
            start_line_number = r.end_line_number_exclusive;
        }
        if start_line_number < range.end_line_number_exclusive {
            result.push(LineRange::new(
                start_line_number,
                range.end_line_number_exclusive,
            ));
        }
        Self {
            normalized_ranges: result,
        }
    }
    pub fn get_intersection(&self, other: &Self) -> Self {
        let mut result = Vec::new();
        let (mut i1, mut i2) = (0, 0);
        while i1 < self.normalized_ranges.len() && i2 < other.normalized_ranges.len() {
            let (r1, r2) = (self.normalized_ranges[i1], other.normalized_ranges[i2]);
            if let Some(i) = r1.intersect(r2).filter(|i| !i.is_empty()) {
                result.push(i);
            }
            if r1.end_line_number_exclusive < r2.end_line_number_exclusive {
                i1 += 1;
            } else {
                i2 += 1;
            }
        }
        Self {
            normalized_ranges: result,
        }
    }
    pub fn get_with_delta(&self, value: i64) -> Self {
        Self {
            normalized_ranges: self
                .normalized_ranges
                .iter()
                .map(|r| r.delta(value))
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{LineRange, LineRangeSet};
    #[test]
    fn basics() {
        let r = LineRange::of_length(2, 3);
        assert_eq!((r.length(), r.to_string().as_str()), (3, "[2,5)"));
        assert!(r.contains(4) && !r.contains(5));
        assert_eq!(r.join(LineRange::new(9, 10)), LineRange::new(2, 10));
        assert_eq!(
            r.intersect(LineRange::new(5, 8)),
            Some(LineRange::new(5, 5))
        );
        assert_eq!(r.intersect(LineRange::new(6, 8)), None);
        assert!(r.intersects_or_touches(LineRange::new(5, 8)));
        assert_eq!(
            r.to_offset_range(),
            crate::offset_range::OffsetRange::new(1, 4)
        );
    }

    #[test]
    fn line_range_set_adds_subtracts_and_intersects() {
        let mut set = LineRangeSet::new();
        for (s, e) in [(10, 12), (2, 4), (4, 6), (20, 25), (11, 21)] {
            set.add_range(LineRange::new(s, e));
        }
        set.add_range(LineRange::new(7, 7)); // empty: ignored
        assert_eq!(set.ranges(), [LineRange::new(2, 6), LineRange::new(10, 25)]);
        assert!(set.contains(2) && set.contains(24) && !set.contains(6) && !set.contains(1));
        let rest = set.subtract_from(LineRange::new(1, 30));
        assert_eq!(
            rest.ranges(),
            [
                LineRange::new(1, 2),
                LineRange::new(6, 10),
                LineRange::new(25, 30)
            ]
        );
        assert_eq!(
            set.subtract_from(LineRange::new(7, 9)).ranges(),
            [LineRange::new(7, 9)]
        );
        let shifted = rest.get_with_delta(-1);
        assert_eq!(shifted.ranges()[1], LineRange::new(5, 9));
        let both = set.get_intersection(&rest);
        assert!(both.ranges().is_empty());
        let mut window = LineRangeSet::new();
        window.add_range(LineRange::new(8, 12));
        let touching = set.get_intersection(&window);
        assert_eq!(touching.ranges(), [LineRange::new(10, 12)]);
    }
}
