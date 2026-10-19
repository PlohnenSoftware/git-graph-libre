// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/myersDiffAlgorithm.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// Exactness: the TypeScript keeps x, y and the V values as JavaScript numbers
// and reads `Int32Array` slots past their allocation, which yields `undefined`
// and so NaN. Diagonals that no earlier pass could set (outside the grid) are
// read that way. The port keeps those values as `f64`, with JavaScript's
// NaN-propagating `Math.max`/`Math.min`, so every such read behaves as it does
// in VS Code; the oracle corpus in `tests/data` contains them.
use crate::diff_algorithm::{
    DiffAlgorithmResult, IDiffAlgorithm, ISequence, ITimeout, SequenceDiff,
};
use crate::offset_range::OffsetRange;

/// An O(ND) diff algorithm that has a quadratic space worst-case complexity.
pub struct MyersDiffAlgorithm;

impl IDiffAlgorithm for MyersDiffAlgorithm {
    /// `MyersDiffAlgorithm.compute` (`myersDiffAlgorithm.ts` L13-L103 at
    /// `28a5623`). Split into helpers to stay under Sonar's complexity limit
    /// (decision X12); in call order they replace:
    ///
    /// 1. `MyersSearch::new` for L36-L40, the `V` and `paths` setup (its
    ///    snake walk is `MyersSearch::x_after_snake`, L23-L29);
    /// 2. `MyersSearch::find_final_diagonal` for L31 and L42-L52 plus
    ///    L74-L75, the `loop: while (true)` over `d` with the timeout check
    ///    and the diagonal bounds, whose `for (k ...)` body is
    /// 3. `MyersSearch::extend_diagonal` for L53-L72;
    /// 4. `backtrack_diffs` for L77-L102, the walk back along the path that
    ///    builds the `SequenceDiff` list.
    ///
    /// Left here: L13-L17 (the trivial early return), L20-L21 (`seqX`,
    /// `seqY`) and the hand-off between the helpers.
    fn compute(
        &self,
        seq1: &dyn ISequence,
        seq2: &dyn ISequence,
        timeout: &mut dyn ITimeout,
    ) -> DiffAlgorithmResult {
        // These are common special cases; the early return is a big speed-up.
        if seq1.length() == 0 || seq2.length() == 0 {
            return DiffAlgorithmResult::trivial(seq1, seq2);
        }
        let (seq_x, seq_y) = (seq1, seq2); // x axis, y axis
        let mut search = MyersSearch::new(seq_x, seq_y);
        match search.find_final_diagonal(timeout) {
            Some(final_k) => {
                backtrack_diffs(seq_x, seq_y, &search.arena, search.paths.get(final_k))
            }
            None => DiffAlgorithmResult::trivial_timed_out(seq_x, seq_y),
        }
    }
}

/// The state of the search over `d` (`V`, `paths` and the sequences) that the
/// TypeScript keeps in `compute`'s locals and closure.
struct MyersSearch<'a> {
    seq_x: &'a dyn ISequence,
    seq_y: &'a dyn ISequence,
    len_x: i64,
    len_y: i64,
    fx: f64,
    fy: f64,
    // V[k]: X value of longest d-line that ends in diagonal k.
    // d-line: path from (0,0) to (x,y) that uses exactly d non-diagonals.
    // diagonal k: set of points (x,y) with x-y = k.
    v: FastInt32Array,
    paths: FastArrayNegativeIndices,
    arena: Vec<SnakePath>,
}

impl<'a> MyersSearch<'a> {
    /// Replaces L36-L40 of `MyersDiffAlgorithm.compute` (`myersDiffAlgorithm.ts`
    /// at `28a5623`): `new FastInt32Array()`, `V.set(0, getXAfterSnake(0, 0))`,
    /// and the `paths` array with its first `SnakePath`.
    fn new(seq_x: &'a dyn ISequence, seq_y: &'a dyn ISequence) -> Self {
        let (len_x, len_y) = (i64::from(seq_x.length()), i64::from(seq_y.length()));
        let mut search = Self {
            seq_x,
            seq_y,
            len_x,
            len_y,
            fx: len_x as f64,
            fy: len_y as f64,
            v: FastInt32Array::new(),
            paths: FastArrayNegativeIndices::new(),
            arena: Vec::new(),
        };
        let first = search.x_after_snake(0.0, 0.0);
        search.v.set(0, first);
        let first = search.v.get(0);
        let path = (first != 0.0).then(|| push_path(&mut search.arena, None, 0.0, 0.0, first));
        search.paths.set(0, path);
        search
    }

    /// Replaces the nested function `getXAfterSnake` of
    /// `MyersDiffAlgorithm.compute` (`myersDiffAlgorithm.ts` L23-L29 at
    /// `28a5623`): the `while` loop that extends a diagonal snake.
    fn x_after_snake(&self, mut x: f64, mut y: f64) -> f64 {
        // A negative y reads `undefined` in the TypeScript: never equal.
        while x < self.fx && y < self.fy && x >= 0.0 && y >= 0.0 {
            if self.seq_x.get_element(x as u32) != self.seq_y.get_element(y as u32) {
                break;
            }
            x += 1.0;
            y += 1.0;
        }
        x
    }

    /// Replaces the outer search of `MyersDiffAlgorithm.compute`
    /// (`myersDiffAlgorithm.ts` at `28a5623`): L31 (`let d = 0`), the
    /// `loop: while (true)` header and the `d++` and timeout check
    /// (L42-L48), the bounds (L49-L51) and the `for (k ...)` header (L52),
    /// with its `break loop` (L71-L73) turned into a return. The loop body is
    /// `Self::extend_diagonal`. Gives the final `k` (the TypeScript's `k`
    /// after the loop), or `None` when the timeout expired (L46-L48).
    fn find_final_diagonal(&mut self, timeout: &mut dyn ITimeout) -> Option<i64> {
        let mut d: i64 = 0;
        loop {
            d += 1;
            if !timeout.is_valid() {
                return None;
            }
            // The paper has `for (k = -d; k <= d; k += 2)`, but diagonals that
            // cannot influence the result can be ignored.
            let lower_bound = -d.min(self.len_y + d % 2);
            let upper_bound = d.min(self.len_x + d % 2);
            for k in (lower_bound..=upper_bound).step_by(2) {
                if self.extend_diagonal(k, lower_bound, upper_bound) {
                    return Some(k);
                }
            }
        }
    }

    /// Replaces the body of the `for (k ...)` loop of
    /// `MyersDiffAlgorithm.compute` (`myersDiffAlgorithm.ts` L53-L72 at
    /// `28a5623`, minus the `step` counters, which nothing reads): the X
    /// values of the (d-1)-lines, the new snake and its path, and the
    /// `continue` for an irrelevant diagonal. Gives whether diagonal `k`
    /// reaches the end of both sequences (the `break loop` test, L71).
    fn extend_diagonal(&mut self, k: i64, lower_bound: i64, upper_bound: i64) -> bool {
        // The X values of (d-1)-lines give the X value of the longest d-lines.
        // Top: a vertical non-diagonal (add a symbol in seqX).
        let top = if k == upper_bound {
            -1.0
        } else {
            self.v.get(k + 1)
        };
        // Left: a horizontal non-diagonal (delete a symbol in seqX).
        let left = if k == lower_bound {
            -1.0
        } else {
            self.v.get(k - 1) + 1.0
        };
        let x = js_min(js_max(top, left), self.fx);
        let y = x - k as f64;
        if x > self.fx || y > self.fy {
            // This diagonal is irrelevant for the result.
            return false;
        }
        let new_max_x = self.x_after_snake(x, y);
        self.v.set(k, new_max_x);
        let last_path = if x == top {
            self.paths.get(k + 1)
        } else {
            self.paths.get(k - 1)
        };
        let path = if new_max_x == x {
            last_path
        } else {
            Some(push_path(&mut self.arena, last_path, x, y, new_max_x - x))
        };
        self.paths.set(k, path);
        self.v.get(k) == self.fx && self.v.get(k) - k as f64 == self.fy
    }
}

/// Replaces the back-walk of `MyersDiffAlgorithm.compute`
/// (`myersDiffAlgorithm.ts` L77-L102 at `28a5623`): starting from the final
/// path, it turns the gaps between snakes into `SequenceDiff`s (L77-L99),
/// reverses them (L101) and wraps them in the result (L102).
fn backtrack_diffs(
    seq_x: &dyn ISequence,
    seq_y: &dyn ISequence,
    arena: &[SnakePath],
    mut path: Option<usize>,
) -> DiffAlgorithmResult {
    let mut result = Vec::new();
    let (mut last_aligning_pos_s1, mut last_aligning_pos_s2) = (seq_x.length(), seq_y.length());
    loop {
        let (end_x, end_y) = path.map_or((0, 0), |p| {
            let p = &arena[p];
            (to_offset(p.x + p.length), to_offset(p.y + p.length))
        });
        if end_x != last_aligning_pos_s1 || end_y != last_aligning_pos_s2 {
            result.push(SequenceDiff::new(
                OffsetRange::new(end_x, last_aligning_pos_s1),
                OffsetRange::new(end_y, last_aligning_pos_s2),
            ));
        }
        let Some(p) = path.map(|p| &arena[p]) else {
            break;
        };
        last_aligning_pos_s1 = to_offset(p.x);
        last_aligning_pos_s2 = to_offset(p.y);
        path = p.prev;
    }
    result.reverse();
    DiffAlgorithmResult {
        diffs: result,
        hit_timeout: false,
    }
}

/// One link of a path; `prev` indexes the arena (a long chain must not drop recursively).
struct SnakePath {
    prev: Option<usize>,
    x: f64,
    y: f64,
    length: f64,
}

fn push_path(
    arena: &mut Vec<SnakePath>,
    prev: Option<usize>,
    x: f64,
    y: f64,
    length: f64,
) -> usize {
    arena.push(SnakePath { prev, x, y, length });
    arena.len() - 1
}

/// A path that reaches the result is always a finite, non-negative offset.
fn to_offset(value: f64) -> u32 {
    debug_assert!(value.is_finite() && value >= 0.0, "NaN reached a path");
    value as u32
}

/// `Math.max`: NaN when either side is NaN (`f64::max` would ignore it).
fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else {
        a.max(b)
    }
}

/// `Math.min`: NaN when either side is NaN.
fn js_min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else {
        a.min(b)
    }
}

/// An array that supports fast negative indices. Like the `Int32Array` pair it
/// replaces, it doubles once when a write lands past the end (a write still
/// past the end is dropped) and reads past the end give NaN (`undefined`).
struct FastInt32Array {
    positive: Vec<i32>,
    negative: Vec<i32>,
}

impl FastInt32Array {
    fn new() -> Self {
        Self {
            positive: vec![0; 10],
            negative: vec![0; 10],
        }
    }
    fn side(&mut self, idx: i64) -> (&mut Vec<i32>, usize) {
        if idx < 0 {
            (&mut self.negative, (-idx - 1) as usize)
        } else {
            (&mut self.positive, idx as usize)
        }
    }
    fn get(&mut self, idx: i64) -> f64 {
        let (arr, idx) = self.side(idx);
        arr.get(idx).map_or(f64::NAN, |&value| f64::from(value))
    }
    fn set(&mut self, idx: i64, value: f64) {
        let (arr, idx) = self.side(idx);
        if idx >= arr.len() {
            arr.resize(arr.len() * 2, 0);
        }
        if let Some(slot) = arr.get_mut(idx) {
            *slot = value as i32; // `Int32Array` stores NaN as 0
        }
    }
}

/// An array that supports fast negative indices; unset slots read as `None`.
struct FastArrayNegativeIndices {
    positive: Vec<Option<usize>>,
    negative: Vec<Option<usize>>,
}

impl FastArrayNegativeIndices {
    fn new() -> Self {
        Self {
            positive: Vec::new(),
            negative: Vec::new(),
        }
    }
    fn get(&self, idx: i64) -> Option<usize> {
        let (arr, idx) = if idx < 0 {
            (&self.negative, (-idx - 1) as usize)
        } else {
            (&self.positive, idx as usize)
        };
        arr.get(idx).copied().flatten()
    }
    fn set(&mut self, idx: i64, value: Option<usize>) {
        let (arr, idx) = if idx < 0 {
            (&mut self.negative, (-idx - 1) as usize)
        } else {
            (&mut self.positive, idx as usize)
        };
        if idx >= arr.len() {
            arr.resize(idx + 1, None);
        }
        arr[idx] = value;
    }
}

#[cfg(test)]
mod tests {
    use super::MyersDiffAlgorithm;
    use crate::clock::{Clock, Timeout};
    use crate::diff_algorithm::{IDiffAlgorithm, ISequence, InfiniteTimeout};
    use std::cell::Cell;

    /// Stands in for `LinesSliceCharSequence` (22d): one element per UTF-16 unit.
    struct Elements(Vec<u32>);
    impl ISequence for Elements {
        fn get_element(&self, offset: u32) -> u32 {
            self.0[offset as usize]
        }
        fn length(&self) -> u32 {
            self.0.len() as u32
        }
        fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool {
            self.get_element(offset1) == self.get_element(offset2)
        }
    }
    fn chars(text: &str) -> Elements {
        Elements(text.encode_utf16().map(u32::from).collect())
    }
    /// `s1,e1,s2,e2` groups, as the oracle corpus prints them.
    fn run(a: &Elements, b: &Elements) -> String {
        let result = MyersDiffAlgorithm.compute(a, b, &mut InfiniteTimeout);
        let diffs: Vec<_> = result
            .diffs
            .iter()
            .map(|d| {
                let (r1, r2) = (d.seq1_range, d.seq2_range);
                format!(
                    "{},{},{},{}",
                    r1.start, r1.end_exclusive, r2.start, r2.end_exclusive
                )
            })
            .collect();
        format!("{}|{}", diffs.join(" "), result.hit_timeout)
    }

    // VS Code's `suite('myers')` test '1' only checks that this does not throw;
    // the value is what VS Code's own algorithm returns for it.
    #[test]
    fn vscode_myers_1() {
        let (s1, s2) = (chars("hello world"), chars("hallo welt"));
        assert_eq!(run(&s1, &s2), "1,2,1,2 7,9,7,8 10,11,9,10|false");
    }

    #[test]
    fn trivial_cases_return_one_whole_diff() {
        assert_eq!(run(&chars(""), &chars("")), "0,0,0,0|false");
        assert_eq!(run(&chars("abc"), &chars("")), "0,3,0,0|false");
        assert_eq!(run(&chars(""), &chars("abc")), "0,0,0,3|false");
        assert_eq!(run(&chars("abc"), &chars("abc")), "|false");
    }

    #[test]
    fn counts_utf16_units_not_characters() {
        // U+1F600 is two code units, so the replaced emoji spans [1, 3).
        assert_eq!(run(&chars("a\u{1F600}b"), &chars("axb")), "1,3,1,2|false");
    }

    #[test]
    fn an_expired_timeout_gives_the_trivial_diff() {
        struct Fake(Cell<u64>);
        impl Clock for Fake {
            fn now_ms(&self) -> u64 {
                self.0.get()
            }
        }
        let clock = Fake(Cell::new(0));
        let mut timeout = Timeout::new(&clock, 1);
        clock.0.set(1);
        let result = MyersDiffAlgorithm.compute(&chars("abc"), &chars("abd"), &mut timeout);
        assert!(result.hit_timeout);
        assert_eq!(result.diffs.len(), 1);
        assert_eq!(result.diffs[0].seq1_range.length(), 3);
    }

    #[test]
    fn matches_vscode_on_the_oracle_corpus() {
        let parse = |list: &str| {
            Elements(
                list.split(',')
                    .filter(|s| !s.is_empty())
                    .map(|s| s.parse().unwrap())
                    .collect(),
            )
        };
        let mut cases = 0;
        for line in include_str!("../tests/data/myers-oracle.txt").lines() {
            if line.starts_with('#') {
                continue;
            }
            let mut parts = line.splitn(3, ';');
            let (a, b, expected) = (
                parts.next().unwrap(),
                parts.next().unwrap(),
                parts.next().unwrap(),
            );
            assert_eq!(run(&parse(a), &parse(b)), expected, "case {a};{b}");
            cases += 1;
        }
        assert_eq!(cases, 437);
    }
}
