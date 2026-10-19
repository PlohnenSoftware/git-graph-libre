// Ported from microsoft/vscode src/vs/editor/common/core/ranges/lineRange.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

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

#[cfg(test)]
mod tests {
    use super::LineRange;
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
    }
}
