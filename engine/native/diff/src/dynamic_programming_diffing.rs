// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/dynamicProgrammingDiffing.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8; `Array2D` is from
// src/vs/editor/common/diff/defaultLinesDiffComputer/utils.ts, kept private here.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// Exactness: scores are `f64` like JavaScript numbers, and ties are decided by
// exact `==`, as the TypeScript does. The equality score is assumed never to be
// NaN (VS Code's own score function cannot return one), which keeps every table
// cell written; the port asserts it in debug builds.
use crate::diff_algorithm::{
    DiffAlgorithmResult, IDiffAlgorithm, ISequence, ITimeout, SequenceDiff,
};
use crate::offset_range::OffsetRange;

/// The optional `equalityScore(offset1, offset2)` argument of `compute`.
pub type EqualityScore<'a> = &'a dyn Fn(u32, u32) -> f64;

/// A row-major table, `Array2D`: `get(x, y)` reads index `x + y * width`.
struct Array2D<T> {
    width: usize,
    array: Vec<T>,
}

impl<T: Copy + Default> Array2D<T> {
    fn new(width: u32, height: u32) -> Self {
        let (width, height) = (width as usize, height as usize);
        Self {
            width,
            array: vec![T::default(); width * height],
        }
    }
    fn get(&self, x: usize, y: usize) -> T {
        self.array[x + y * self.width]
    }
    fn set(&mut self, x: usize, y: usize, value: T) {
        self.array[x + y * self.width] = value;
    }
}

/// A O(MN) diffing algorithm that supports a score function.
/// The algorithm can be improved by processing the 2d array diagonally.
pub struct DynamicProgrammingDiffing;

impl IDiffAlgorithm for DynamicProgrammingDiffing {
    fn compute(
        &self,
        sequence1: &dyn ISequence,
        sequence2: &dyn ISequence,
        timeout: &mut dyn ITimeout,
    ) -> DiffAlgorithmResult {
        self.compute_with_score(sequence1, sequence2, timeout, None)
    }
}

impl DynamicProgrammingDiffing {
    /// `compute` with its optional fourth argument; `None` scores every match 1.
    pub fn compute_with_score(
        &self,
        sequence1: &dyn ISequence,
        sequence2: &dyn ISequence,
        timeout: &mut dyn ITimeout,
        equality_score: Option<EqualityScore>,
    ) -> DiffAlgorithmResult {
        if sequence1.length() == 0 || sequence2.length() == 0 {
            return DiffAlgorithmResult::trivial(sequence1, sequence2);
        }
        let (len1, len2) = (sequence1.length(), sequence2.length());

        // lcs_lengths.get(i, j): length of the longest common subsequence of
        // sequence1.substring(0, i + 1) and sequence2.substring(0, j + 1).
        let mut lcs_lengths = Array2D::<f64>::new(len1, len2);
        let mut directions = Array2D::<u8>::new(len1, len2);
        let mut lengths = Array2D::<u32>::new(len1, len2);

        // ==== Initializing lcs_lengths ====
        for s1 in 0..len1 as usize {
            for s2 in 0..len2 as usize {
                if !timeout.is_valid() {
                    return DiffAlgorithmResult::trivial_timed_out(sequence1, sequence2);
                }
                let horizontal_len = if s1 == 0 {
                    0.0
                } else {
                    lcs_lengths.get(s1 - 1, s2)
                };
                let vertical_len = if s2 == 0 {
                    0.0
                } else {
                    lcs_lengths.get(s1, s2 - 1)
                };

                let extended_seq_score =
                    if sequence1.get_element(s1 as u32) == sequence2.get_element(s2 as u32) {
                        let mut score = if s1 == 0 || s2 == 0 {
                            0.0
                        } else {
                            lcs_lengths.get(s1 - 1, s2 - 1)
                        };
                        if s1 > 0 && s2 > 0 && directions.get(s1 - 1, s2 - 1) == 3 {
                            // Prefer consecutive diagonals
                            score += f64::from(lengths.get(s1 - 1, s2 - 1));
                        }
                        score + equality_score.map_or(1.0, |f| f(s1 as u32, s2 as u32))
                    } else {
                        -1.0
                    };

                let new_value = horizontal_len.max(vertical_len).max(extended_seq_score);
                debug_assert!(!new_value.is_nan(), "the equality score must not be NaN");

                if new_value == extended_seq_score {
                    // Prefer diagonals
                    let prev_len = if s1 > 0 && s2 > 0 {
                        lengths.get(s1 - 1, s2 - 1)
                    } else {
                        0
                    };
                    lengths.set(s1, s2, prev_len + 1);
                    directions.set(s1, s2, 3);
                } else if new_value == horizontal_len {
                    lengths.set(s1, s2, 0);
                    directions.set(s1, s2, 1);
                } else if new_value == vertical_len {
                    lengths.set(s1, s2, 0);
                    directions.set(s1, s2, 2);
                }
                lcs_lengths.set(s1, s2, new_value);
            }
        }

        // ==== Backtracking ====
        let mut result: Vec<SequenceDiff> = Vec::new();
        let mut last_aligning_pos_s1 = i64::from(len1);
        let mut last_aligning_pos_s2 = i64::from(len2);

        let mut report_decreasing_aligning_positions = |s1: i64, s2: i64| {
            if s1 + 1 != last_aligning_pos_s1 || s2 + 1 != last_aligning_pos_s2 {
                result.push(SequenceDiff::new(
                    OffsetRange::new((s1 + 1) as u32, last_aligning_pos_s1 as u32),
                    OffsetRange::new((s2 + 1) as u32, last_aligning_pos_s2 as u32),
                ));
            }
            last_aligning_pos_s1 = s1;
            last_aligning_pos_s2 = s2;
        };

        let mut s1 = i64::from(len1) - 1;
        let mut s2 = i64::from(len2) - 1;
        while s1 >= 0 && s2 >= 0 {
            let direction = directions.get(s1 as usize, s2 as usize);
            if direction == 3 {
                report_decreasing_aligning_positions(s1, s2);
                s1 -= 1;
                s2 -= 1;
            } else if direction == 1 {
                s1 -= 1;
            } else {
                s2 -= 1;
            }
        }
        report_decreasing_aligning_positions(-1, -1);
        result.reverse();
        DiffAlgorithmResult {
            diffs: result,
            hit_timeout: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::DynamicProgrammingDiffing;
    use crate::diff_algorithm::{IDiffAlgorithm, ISequence, ITimeout, InfiniteTimeout};

    struct Elements(Vec<u32>);
    impl ISequence for Elements {
        fn get_element(&self, offset: u32) -> u32 {
            self.0[offset as usize]
        }
        fn length(&self) -> u32 {
            self.0.len() as u32
        }
        fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool {
            self.0[offset1 as usize] == self.0[offset2 as usize]
        }
    }

    /// `isValid` succeeds `limit` times, then fails (a negative limit never fails).
    struct CountingTimeout {
        limit: i64,
        calls: i64,
    }
    impl ITimeout for CountingTimeout {
        fn is_valid(&mut self) -> bool {
            self.calls += 1;
            self.limit < 0 || self.calls <= self.limit
        }
    }

    fn chars(text: &str) -> Elements {
        Elements(text.encode_utf16().map(u32::from).collect())
    }

    /// `s1,e1,s2,e2` groups, as the oracle corpus prints them.
    fn run(a: &Elements, b: &Elements, mode: &str, limit: i64) -> String {
        let score = |o1: u32, o2: u32| {
            let n = i64::from(a.0[o1 as usize]) * 7 + i64::from(b.0[o2 as usize]) * 3;
            let sum = n + i64::from(o1) + i64::from(o2);
            if sum % 5 == 0 {
                0.1
            } else {
                0.99 + f64::from((o1 * 3 + o2) % 4) / 10.0
            }
        };
        let mut timeout = CountingTimeout { limit, calls: 0 };
        let result = DynamicProgrammingDiffing.compute_with_score(
            a,
            b,
            &mut timeout,
            (mode == "f").then_some(&score),
        );
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

    // VS Code's `suite('myers')` test '1' has a dead `true ? Myers : DynamicProgramming`
    // branch, so it never runs this algorithm; the value is what VS Code returns for it.
    #[test]
    fn vscode_myers_test_1_input() {
        let (s1, s2) = (chars("hello world"), chars("hallo welt"));
        assert_eq!(run(&s1, &s2, "u", -1), "1,2,1,2 7,9,7,8 10,11,9,10|false");
    }

    #[test]
    fn trivial_cases_return_one_whole_diff() {
        assert_eq!(run(&chars(""), &chars(""), "u", -1), "0,0,0,0|false");
        assert_eq!(run(&chars("abc"), &chars(""), "u", -1), "0,3,0,0|false");
        assert_eq!(run(&chars(""), &chars("abc"), "u", -1), "0,0,0,3|false");
        assert_eq!(run(&chars("abc"), &chars("abc"), "u", -1), "|false");
    }

    #[test]
    fn counts_utf16_units_not_characters() {
        let (a, b) = (chars("a\u{1F600}b"), chars("axb"));
        assert_eq!(run(&a, &b, "u", -1), "1,3,1,2|false");
    }

    #[test]
    fn an_expired_timeout_gives_the_trivial_diff() {
        let (a, b) = (chars("abcd"), chars("abcd"));
        assert_eq!(run(&a, &b, "u", 3), "0,4,0,4|true");
        assert_eq!(run(&a, &b, "u", 16), "|false");
    }

    #[test]
    fn the_trait_method_scores_every_match_one() {
        let (a, b) = (chars("hello world"), chars("hallo welt"));
        let result = DynamicProgrammingDiffing.compute(&a, &b, &mut InfiniteTimeout);
        assert_eq!(result.diffs.len(), 3);
        assert!(!result.hit_timeout);
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
        for line in include_str!("../tests/data/dynamic-programming-oracle.txt").lines() {
            if line.starts_with('#') {
                continue;
            }
            let mut parts = line.splitn(5, ';');
            let (a, b, mode, limit, expected) = (
                parts.next().unwrap(),
                parts.next().unwrap(),
                parts.next().unwrap(),
                parts.next().unwrap().parse().unwrap(),
                parts.next().unwrap(),
            );
            assert_eq!(
                run(&parse(a), &parse(b), mode, limit),
                expected,
                "case {line}"
            );
            cases += 1;
        }
        assert_eq!(cases, 619);
    }
}
