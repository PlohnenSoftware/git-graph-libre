// Ported from microsoft/vscode src/vs/editor/common/core/ranges/offsetRange.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

/// A range of offsets (0-based), `[start, end_exclusive)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct OffsetRange {
    pub start: u32,
    pub end_exclusive: u32,
}

impl OffsetRange {
    pub fn new(start: u32, end_exclusive: u32) -> Self {
        assert!(
            start <= end_exclusive,
            "Invalid range: [{start}, {end_exclusive})"
        );
        Self {
            start,
            end_exclusive,
        }
    }
    pub fn of_length(length: u32) -> Self {
        Self::new(0, length)
    }
    pub fn of_start_and_length(start: u32, length: u32) -> Self {
        Self::new(start, start + length)
    }
    pub fn empty_at(offset: u32) -> Self {
        Self::new(offset, offset)
    }
    pub fn is_empty(self) -> bool {
        self.start == self.end_exclusive
    }
    pub fn length(self) -> u32 {
        self.end_exclusive - self.start
    }
    pub fn delta(self, offset: i64) -> Self {
        Self::new(
            (i64::from(self.start) + offset) as u32,
            (i64::from(self.end_exclusive) + offset) as u32,
        )
    }
    pub fn contains(self, offset: u32) -> bool {
        self.start <= offset && offset < self.end_exclusive
    }
    /// The smallest range containing both ranges.
    pub fn join(self, other: Self) -> Self {
        Self::new(
            self.start.min(other.start),
            self.end_exclusive.max(other.end_exclusive),
        )
    }
    /// Empty when the ranges only touch; `None` when they do not even touch.
    pub fn intersect(self, other: Self) -> Option<Self> {
        let (s, e) = (
            self.start.max(other.start),
            self.end_exclusive.min(other.end_exclusive),
        );
        (s <= e).then(|| Self::new(s, e))
    }
}

impl fmt::Display for OffsetRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}, {})", self.start, self.end_exclusive)
    }
}

#[cfg(test)]
mod tests {
    use super::OffsetRange;
    #[test]
    fn basics() {
        let r = OffsetRange::of_start_and_length(3, 4);
        assert_eq!((r.length(), r.to_string().as_str()), (4, "[3, 7)"));
        assert!(r.contains(3) && !r.contains(7));
        assert_eq!(r.join(OffsetRange::new(9, 10)), OffsetRange::new(3, 10));
        assert_eq!(
            r.intersect(OffsetRange::new(7, 9)),
            Some(OffsetRange::empty_at(7))
        );
        assert_eq!(r.intersect(OffsetRange::new(8, 9)), None);
        assert_eq!(r.delta(-3), OffsetRange::of_length(4));
    }
    #[test]
    #[should_panic(expected = "Invalid range")]
    fn reversed_panics() {
        let _ = OffsetRange::new(5, 4);
    }
}
