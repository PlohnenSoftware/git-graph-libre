// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/diffAlgorithm.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8. The `ITimeout` trait and
// `InfiniteTimeout` live here; `DateTimeout` is `clock::Timeout`.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

use crate::clock::{Clock, Timeout};
use crate::offset_range::OffsetRange;

/// `IDiffAlgorithm`: a synchronous diff algorithm. Callers without a time
/// limit pass `&mut InfiniteTimeout` (the TypeScript default argument).
pub trait IDiffAlgorithm {
    fn compute(
        &self,
        sequence1: &dyn ISequence,
        sequence2: &dyn ISequence,
        timeout: &mut dyn ITimeout,
    ) -> DiffAlgorithmResult;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffAlgorithmResult {
    pub diffs: Vec<SequenceDiff>,
    /// Whether the time out was reached; the diffs are then an approximation.
    pub hit_timeout: bool,
}

impl DiffAlgorithmResult {
    pub fn trivial(seq1: &dyn ISequence, seq2: &dyn ISequence) -> Self {
        Self::whole(seq1, seq2, false)
    }
    pub fn trivial_timed_out(seq1: &dyn ISequence, seq2: &dyn ISequence) -> Self {
        Self::whole(seq1, seq2, true)
    }
    fn whole(seq1: &dyn ISequence, seq2: &dyn ISequence, hit_timeout: bool) -> Self {
        let diff = SequenceDiff::new(
            OffsetRange::of_length(seq1.length()),
            OffsetRange::of_length(seq2.length()),
        );
        Self {
            diffs: vec![diff],
            hit_timeout,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SequenceDiff {
    pub seq1_range: OffsetRange,
    pub seq2_range: OffsetRange,
}

impl SequenceDiff {
    pub fn new(seq1_range: OffsetRange, seq2_range: OffsetRange) -> Self {
        Self {
            seq1_range,
            seq2_range,
        }
    }
    /// The gaps between the diffs (and before the first and after the last),
    /// as `forEachAdjacent` visits them.
    pub fn invert(sequence_diffs: &[Self], doc1_length: u32) -> Vec<Self> {
        let mut result = Vec::with_capacity(sequence_diffs.len() + 1);
        for i in 0..=sequence_diffs.len() {
            let a = i.checked_sub(1).map(|j| sequence_diffs[j]);
            let b = sequence_diffs.get(i);
            let end = b.map_or_else(
                || {
                    let skew = a.map_or(0, |a| {
                        i64::from(a.seq2_range.end_exclusive)
                            - i64::from(a.seq1_range.end_exclusive)
                    });
                    OffsetPair::new(doc1_length, (skew + i64::from(doc1_length)) as u32)
                },
                |b| b.get_starts(),
            );
            result.push(Self::from_offset_pairs(
                a.map_or(OffsetPair::ZERO, |a| a.get_end_exclusives()),
                end,
            ));
        }
        result
    }
    pub fn from_offset_pairs(start: OffsetPair, end_exclusive: OffsetPair) -> Self {
        Self::new(
            OffsetRange::new(start.offset1, end_exclusive.offset1),
            OffsetRange::new(start.offset2, end_exclusive.offset2),
        )
    }
    /// Panics (`BugIndicatingError`) when the diffs are not sorted.
    pub fn assert_sorted(sequence_diffs: &[Self]) {
        for pair in sequence_diffs.windows(2) {
            let (last, cur) = (pair[0], pair[1]);
            assert!(
                last.seq1_range.end_exclusive <= cur.seq1_range.start
                    && last.seq2_range.end_exclusive <= cur.seq2_range.start,
                "Sequence diffs must be sorted"
            );
        }
    }
    pub fn swap(self) -> Self {
        Self::new(self.seq2_range, self.seq1_range)
    }
    pub fn join(self, other: Self) -> Self {
        Self::new(
            self.seq1_range.join(other.seq1_range),
            self.seq2_range.join(other.seq2_range),
        )
    }
    pub fn delta(self, offset: i64) -> Self {
        Self::new(self.seq1_range.delta(offset), self.seq2_range.delta(offset))
    }
    pub fn delta_start(self, offset: i64) -> Self {
        Self::new(
            self.seq1_range.delta_start(offset),
            self.seq2_range.delta_start(offset),
        )
    }
    pub fn delta_end(self, offset: i64) -> Self {
        Self::new(
            self.seq1_range.delta_end(offset),
            self.seq2_range.delta_end(offset),
        )
    }
    pub fn intersects_or_touches(self, other: Self) -> bool {
        self.seq1_range.intersects_or_touches(other.seq1_range)
            || self.seq2_range.intersects_or_touches(other.seq2_range)
    }
    pub fn intersect(self, other: Self) -> Option<Self> {
        let i1 = self.seq1_range.intersect(other.seq1_range)?;
        let i2 = self.seq2_range.intersect(other.seq2_range)?;
        Some(Self::new(i1, i2))
    }
    pub fn get_starts(self) -> OffsetPair {
        OffsetPair::new(self.seq1_range.start, self.seq2_range.start)
    }
    pub fn get_end_exclusives(self) -> OffsetPair {
        OffsetPair::new(self.seq1_range.end_exclusive, self.seq2_range.end_exclusive)
    }
}

impl fmt::Display for SequenceDiff {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} <-> {}", self.seq1_range, self.seq2_range)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OffsetPair {
    pub offset1: u32,
    pub offset2: u32,
}

impl OffsetPair {
    pub const ZERO: Self = Self::new(0, 0);
    /// `OffsetPair.max` (`Number.MAX_SAFE_INTEGER` there; offsets here are `u32`).
    pub const MAX: Self = Self::new(u32::MAX, u32::MAX);

    pub const fn new(offset1: u32, offset2: u32) -> Self {
        Self { offset1, offset2 }
    }
    pub fn delta(self, offset: i64) -> Self {
        Self::new(
            (i64::from(self.offset1) + offset) as u32,
            (i64::from(self.offset2) + offset) as u32,
        )
    }
}

impl fmt::Display for OffsetPair {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} <-> {}", self.offset1, self.offset2)
    }
}

/// `ISequence`. Elements are the numbers the algorithms compare (UTF-16 code
/// units, or the identity of a trimmed line).
pub trait ISequence {
    fn get_element(&self, offset: u32) -> u32;
    fn length(&self) -> u32;
    /// The higher the score, the better that offset can be used to split the
    /// sequence; never negative. `None` stands for TypeScript's absent
    /// optional method: the sequence has no boundary scores.
    fn get_boundary_score(&self, _length: u32) -> Option<f64> {
        None
    }
    /// Line sequences compare trimmed lines in `get_element`; this compares the
    /// original lines, which keeps shifts from landing on less matching lines.
    fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool;
}

/// `ITimeout`. `&mut self` because a timeout latches once it has expired.
pub trait ITimeout {
    fn is_valid(&mut self) -> bool;
}

pub struct InfiniteTimeout;

impl ITimeout for InfiniteTimeout {
    fn is_valid(&mut self) -> bool {
        true
    }
}

impl<C: Clock> ITimeout for Timeout<'_, C> {
    fn is_valid(&mut self) -> bool {
        Timeout::is_valid(self)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        DiffAlgorithmResult, ISequence, ITimeout, InfiniteTimeout, OffsetPair, SequenceDiff,
    };
    use crate::clock::{Clock, Timeout};
    use crate::offset_range::OffsetRange;
    use std::cell::Cell;

    struct Seq(u32);
    impl ISequence for Seq {
        fn get_element(&self, offset: u32) -> u32 {
            offset
        }
        fn length(&self) -> u32 {
            self.0
        }
        fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool {
            offset1 == offset2
        }
    }
    struct Fake(Cell<u64>);
    impl Clock for Fake {
        fn now_ms(&self) -> u64 {
            self.0.get()
        }
    }
    fn diff(a: (u32, u32), b: (u32, u32)) -> SequenceDiff {
        SequenceDiff::new(OffsetRange::new(a.0, a.1), OffsetRange::new(b.0, b.1))
    }

    #[test]
    fn trivial_results() {
        let (a, b) = (Seq(3), Seq(0));
        let r = DiffAlgorithmResult::trivial(&a, &b);
        assert_eq!(
            (r.diffs, r.hit_timeout),
            (vec![diff((0, 3), (0, 0))], false)
        );
        assert!(DiffAlgorithmResult::trivial_timed_out(&a, &b).hit_timeout);
        assert!(a.get_boundary_score(1).is_none());
    }

    // Expected values come from running VS Code's `SequenceDiff.invert`.
    #[test]
    fn invert_fills_the_gaps() {
        let inverted = SequenceDiff::invert(&[diff((1, 3), (2, 7))], 10);
        let texts: Vec<_> = inverted.iter().map(ToString::to_string).collect();
        assert_eq!(texts, ["[0, 1) <-> [0, 2)", "[3, 10) <-> [7, 14)"]);
        assert_eq!(SequenceDiff::invert(&[], 4), [diff((0, 4), (0, 4))]);
    }

    #[test]
    fn sequence_diff_arithmetic() {
        let (a, b) = (diff((1, 3), (2, 4)), diff((3, 5), (9, 9)));
        assert_eq!(a.swap(), diff((2, 4), (1, 3)));
        assert_eq!(a.join(b), diff((1, 5), (2, 9)));
        assert_eq!(a.delta(2), diff((3, 5), (4, 6)));
        assert_eq!(a.delta_start(1), diff((2, 3), (3, 4)));
        assert_eq!(a.delta_end(1), diff((1, 4), (2, 5)));
        assert!(a.intersects_or_touches(b));
        assert_eq!(a.intersect(b), None);
        assert_eq!(
            a.intersect(diff((2, 8), (3, 9))),
            Some(diff((2, 3), (3, 4)))
        );
        assert_eq!(a.to_string(), "[1, 3) <-> [2, 4)");
        assert_eq!(a.get_starts(), OffsetPair::new(1, 2));
        assert_eq!(a.get_end_exclusives().delta(1).to_string(), "4 <-> 5");
    }

    #[test]
    fn assert_sorted_accepts_sorted_and_rejects_overlap() {
        SequenceDiff::assert_sorted(&[diff((0, 1), (0, 1)), diff((1, 2), (1, 2))]);
        let overlapping = [diff((0, 2), (0, 1)), diff((1, 3), (1, 2))];
        let caught = std::panic::catch_unwind(|| SequenceDiff::assert_sorted(&overlapping));
        assert!(caught.is_err());
    }

    #[test]
    fn timeouts() {
        assert!(InfiniteTimeout.is_valid());
        let clock = Fake(Cell::new(0));
        let mut timeout = Timeout::new(&clock, 5);
        assert!(ITimeout::is_valid(&mut timeout));
        clock.0.set(5);
        assert!(!ITimeout::is_valid(&mut timeout));
    }
}
