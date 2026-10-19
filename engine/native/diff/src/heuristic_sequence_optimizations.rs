// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/heuristicSequenceOptimizations.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// Exactness: offsets are `u32`, but the TypeScript's arithmetic is signed, so
// every subtraction that can go below zero there is done in `i64` here.
// `String.prototype.trim` and the regular expression `\s` share one character
// set (`is_js_whitespace`), and lengths count UTF-16 code units. The word
// `findParent` callbacks take an `i64`, like `findWordContaining`.
use std::collections::VecDeque;

use crate::diff_algorithm::{ISequence, OffsetPair, SequenceDiff};
use crate::line_sequence::LineSequence;
use crate::lines_slice_char_sequence::{is_js_whitespace, LinesSliceCharSequence};
use crate::offset_range::OffsetRange;

pub fn optimize_sequence_diffs(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    let mut result = join_sequence_diffs_by_shifting(sequence1, sequence2, sequence_diffs);
    // Sometimes, calling this function twice improves the result.
    result = join_sequence_diffs_by_shifting(sequence1, sequence2, &result);
    shift_sequence_diffs(sequence1, sequence2, result)
}

fn element_before(sequence: &dyn ISequence, offset: u32, d: i64) -> u32 {
    sequence.get_element((i64::from(offset) - d) as u32)
}

/// Fixes `{ Baz, Bar }` to `{ Baz, Bar, Foo }` being two diffs, not one.
fn join_sequence_diffs_by_shifting(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    let Some((&first, rest)) = sequence_diffs.split_first() else {
        return Vec::new();
    };
    let mut result = vec![first];

    // First move them all to the left as much as possible and join them if possible
    for &diff in rest {
        let prev = result[result.len() - 1];
        let mut cur = diff;
        if cur.seq1_range.is_empty() || cur.seq2_range.is_empty() {
            let length = i64::from(cur.seq1_range.start) - i64::from(prev.seq1_range.end_exclusive);
            let mut d = 1;
            while d <= length {
                if element_before(sequence1, cur.seq1_range.start, d)
                    != element_before(sequence1, cur.seq1_range.end_exclusive, d)
                    || element_before(sequence2, cur.seq2_range.start, d)
                        != element_before(sequence2, cur.seq2_range.end_exclusive, d)
                {
                    break;
                }
                d += 1;
            }
            d -= 1;

            if d == length {
                // Merge previous and current diff
                let last = result.len() - 1;
                result[last] = SequenceDiff::new(
                    OffsetRange::new(
                        prev.seq1_range.start,
                        (i64::from(cur.seq1_range.end_exclusive) - length) as u32,
                    ),
                    OffsetRange::new(
                        prev.seq2_range.start,
                        (i64::from(cur.seq2_range.end_exclusive) - length) as u32,
                    ),
                );
                continue;
            }
            cur = cur.delta(-d);
        }
        result.push(cur);
    }

    let mut result2 = Vec::new();
    // Then move them all to the right and join them again if possible
    for i in 0..result.len() - 1 {
        let next = result[i + 1];
        let mut cur = result[i];
        if cur.seq1_range.is_empty() || cur.seq2_range.is_empty() {
            let length = i64::from(next.seq1_range.start) - i64::from(cur.seq1_range.end_exclusive);
            let mut d = 0;
            while d < length {
                if !sequence1.is_strongly_equal(
                    (i64::from(cur.seq1_range.start) + d) as u32,
                    (i64::from(cur.seq1_range.end_exclusive) + d) as u32,
                ) || !sequence2.is_strongly_equal(
                    (i64::from(cur.seq2_range.start) + d) as u32,
                    (i64::from(cur.seq2_range.end_exclusive) + d) as u32,
                ) {
                    break;
                }
                d += 1;
            }

            if d == length {
                // Merge previous and current diff, write to result!
                result[i + 1] = SequenceDiff::new(
                    OffsetRange::new(
                        (i64::from(cur.seq1_range.start) + length) as u32,
                        next.seq1_range.end_exclusive,
                    ),
                    OffsetRange::new(
                        (i64::from(cur.seq2_range.start) + length) as u32,
                        next.seq2_range.end_exclusive,
                    ),
                );
                continue;
            }
            if d > 0 {
                cur = cur.delta(d);
            }
        }
        result2.push(cur);
    }
    result2.push(result[result.len() - 1]);
    result2
}

/// The range an empty diff may move within: not onto the previous or next diff.
fn valid_range(prev_end: Option<u32>, next_start: Option<u32>, length: u32) -> OffsetRange {
    let start = prev_end.map_or(0, |end| i64::from(end) + 1);
    let end = next_start.map_or(i64::from(length), |s| i64::from(s) - 1);
    assert!(start <= end, "Invalid range: [{start}, {end})");
    OffsetRange::new(start as u32, end as u32)
}

// Aligns character level diffs at whitespace and other boundaries, e.g.
// `import { I[Arr, I]Bar }` becomes `import { [IArr, ]IBar }`.
fn shift_sequence_diffs(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    mut sequence_diffs: Vec<SequenceDiff>,
) -> Vec<SequenceDiff> {
    // `!sequence.getBoundaryScore`: the sequence has no boundary scores.
    if sequence1.get_boundary_score(0).is_none() || sequence2.get_boundary_score(0).is_none() {
        return sequence_diffs;
    }

    for i in 0..sequence_diffs.len() {
        let prev = i.checked_sub(1).map(|j| sequence_diffs[j]);
        let diff = sequence_diffs[i];
        let next = sequence_diffs.get(i + 1).copied();

        let seq1_valid_range = valid_range(
            prev.map(|p| p.seq1_range.end_exclusive),
            next.map(|n| n.seq1_range.start),
            sequence1.length(),
        );
        let seq2_valid_range = valid_range(
            prev.map(|p| p.seq2_range.end_exclusive),
            next.map(|n| n.seq2_range.start),
            sequence2.length(),
        );

        if diff.seq1_range.is_empty() {
            sequence_diffs[i] = shift_diff_to_better_position(
                diff,
                sequence1,
                sequence2,
                seq1_valid_range,
                seq2_valid_range,
            );
        } else if diff.seq2_range.is_empty() {
            sequence_diffs[i] = shift_diff_to_better_position(
                diff.swap(),
                sequence2,
                sequence1,
                seq2_valid_range,
                seq1_valid_range,
            )
            .swap();
        }
    }
    sequence_diffs
}

fn shift_diff_to_better_position(
    diff: SequenceDiff,
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    seq1_valid_range: OffsetRange,
    seq2_valid_range: OffsetRange,
) -> SequenceDiff {
    const MAX_SHIFT_LIMIT: i64 = 100; // To prevent performance issues
    let start1 = i64::from(diff.seq1_range.start);
    let start2 = i64::from(diff.seq2_range.start);
    let end2 = i64::from(diff.seq2_range.end_exclusive);

    // don't touch previous or next!
    let mut delta_before = 1;
    while start1 - delta_before >= i64::from(seq1_valid_range.start)
        && start2 - delta_before >= i64::from(seq2_valid_range.start)
        && sequence2.is_strongly_equal((start2 - delta_before) as u32, (end2 - delta_before) as u32)
        && delta_before < MAX_SHIFT_LIMIT
    {
        delta_before += 1;
    }
    delta_before -= 1;

    let mut delta_after = 0;
    while start1 + delta_after < i64::from(seq1_valid_range.end_exclusive)
        && end2 + delta_after < i64::from(seq2_valid_range.end_exclusive)
        && sequence2.is_strongly_equal((start2 + delta_after) as u32, (end2 + delta_after) as u32)
        && delta_after < MAX_SHIFT_LIMIT
    {
        delta_after += 1;
    }

    if delta_before == 0 && delta_after == 0 {
        return diff;
    }

    let mut best_delta = 0;
    let mut best_score = -1.0;
    // find best scored delta
    for delta in -delta_before..=delta_after {
        let score = |sequence: &dyn ISequence, offset: i64| {
            sequence
                .get_boundary_score((offset + delta) as u32)
                .expect("getBoundaryScore was checked")
        };
        let score = score(sequence1, start1) + score(sequence2, start2) + score(sequence2, end2);
        if score > best_score {
            best_score = score;
            best_delta = delta;
        }
    }
    diff.delta(best_delta)
}

pub fn remove_short_matches(
    _sequence1: &dyn ISequence,
    _sequence2: &dyn ISequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    let mut result: Vec<SequenceDiff> = Vec::new();
    for &s in sequence_diffs {
        let Some(last) = result.last_mut() else {
            result.push(s);
            continue;
        };
        let gap1 = i64::from(s.seq1_range.start) - i64::from(last.seq1_range.end_exclusive);
        let gap2 = i64::from(s.seq2_range.start) - i64::from(last.seq2_range.end_exclusive);
        if gap1 <= 2 || gap2 <= 2 {
            *last = SequenceDiff::new(
                last.seq1_range.join(s.seq1_range),
                last.seq2_range.join(s.seq2_range),
            );
        } else {
            result.push(s);
        }
    }
    result
}

/// The state `scanWord` closes over in the TypeScript.
struct WordScan<'a, F> {
    sequence1: &'a LinesSliceCharSequence,
    sequence2: &'a LinesSliceCharSequence,
    find_parent: F,
    force: bool,
    equal_mappings: VecDeque<SequenceDiff>,
    additional: Vec<SequenceDiff>,
    last_point: OffsetPair,
}

impl<F: Fn(&LinesSliceCharSequence, i64) -> Option<OffsetRange>> WordScan<'_, F> {
    fn scan_word(&mut self, pair: OffsetPair, equal_mapping: SequenceDiff) {
        if pair.offset1 < self.last_point.offset1 || pair.offset2 < self.last_point.offset2 {
            return;
        }
        let w1 = (self.find_parent)(self.sequence1, i64::from(pair.offset1));
        let w2 = (self.find_parent)(self.sequence2, i64::from(pair.offset2));
        let (Some(w1), Some(w2)) = (w1, w2) else {
            return;
        };
        let mut w = SequenceDiff::new(w1, w2);
        let equal_part = w
            .intersect(equal_mapping)
            .expect("the word meets its match");

        let mut equal_chars1 = equal_part.seq1_range.length();
        let mut equal_chars2 = equal_part.seq2_range.length();

        // The words do not touch previous equals mappings, as we would have
        // processed them already. But they might touch the next ones.
        while let Some(&next) = self.equal_mappings.front() {
            let intersects = next.seq1_range.intersects(w.seq1_range)
                || next.seq2_range.intersects(w.seq2_range);
            if !intersects {
                break;
            }

            let v1 = (self.find_parent)(self.sequence1, i64::from(next.seq1_range.start));
            let v2 = (self.find_parent)(self.sequence2, i64::from(next.seq2_range.start));
            // Because there is an intersection, we know that the words are not empty.
            let v = SequenceDiff::new(v1.expect("a word"), v2.expect("a word"));
            let equal_part = v.intersect(next).expect("the word meets its match");

            equal_chars1 += equal_part.seq1_range.length();
            equal_chars2 += equal_part.seq2_range.length();

            w = w.join(v);

            if w.seq1_range.end_exclusive >= next.seq1_range.end_exclusive {
                // The word extends beyond the next equal mapping.
                self.equal_mappings.pop_front();
            } else {
                break;
            }
        }

        // `(a + b) * 2 / 3` in the TypeScript, a float; for these integers
        // `x < s * 2 / 3` and `x * 3 < s * 2` agree.
        let equal_chars = equal_chars1 + equal_chars2;
        let word_chars = w.seq1_range.length() + w.seq2_range.length();
        if (self.force && equal_chars < word_chars) || equal_chars * 3 < word_chars * 2 {
            self.additional.push(w);
        }
        self.last_point = w.get_end_exclusives();
    }
}

/// `findParent` is `findWordContaining` or `findSubWordContaining`.
pub fn extend_diffs_to_entire_word_if_appropriate(
    sequence1: &LinesSliceCharSequence,
    sequence2: &LinesSliceCharSequence,
    sequence_diffs: &[SequenceDiff],
    find_parent: impl Fn(&LinesSliceCharSequence, i64) -> Option<OffsetRange>,
    force: bool,
) -> Vec<SequenceDiff> {
    let mut scan = WordScan {
        sequence1,
        sequence2,
        find_parent,
        force,
        equal_mappings: SequenceDiff::invert(sequence_diffs, sequence1.length()).into(),
        additional: Vec::new(),
        last_point: OffsetPair::ZERO,
    };
    while let Some(next) = scan.equal_mappings.pop_front() {
        if next.seq1_range.is_empty() {
            continue;
        }
        scan.scan_word(next.get_starts(), next);
        // The equal parts are not empty, so -1 gives us a character that is equal in both parts.
        scan.scan_word(next.get_end_exclusives().delta(-1), next);
    }
    merge_sequence_diffs(sequence_diffs, &scan.additional)
}

fn merge_sequence_diffs(
    sequence_diffs1: &[SequenceDiff],
    sequence_diffs2: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    let mut result: Vec<SequenceDiff> = Vec::new();
    let (mut i, mut j) = (0, 0);
    while i < sequence_diffs1.len() || j < sequence_diffs2.len() {
        let next = match (sequence_diffs1.get(i), sequence_diffs2.get(j)) {
            (Some(&sd1), sd2)
                if sd2.is_none_or(|sd2| sd1.seq1_range.start < sd2.seq1_range.start) =>
            {
                i += 1;
                sd1
            }
            _ => {
                j += 1;
                sequence_diffs2[j - 1]
            }
        };
        match result.last_mut() {
            Some(last) if last.seq1_range.end_exclusive >= next.seq1_range.start => {
                *last = last.join(next);
            }
            _ => result.push(next),
        }
    }
    result
}

/// The shared `do { ... } while (counter++ < 10 && shouldRepeat)` loop: joins a
/// diff to the previous result while `should_join(last, cur)`.
fn join_repeatedly(
    mut diffs: Vec<SequenceDiff>,
    should_join: impl Fn(SequenceDiff, SequenceDiff) -> bool,
) -> Vec<SequenceDiff> {
    if diffs.is_empty() {
        return diffs;
    }
    let mut counter = 0;
    loop {
        let mut should_repeat = false;
        let mut result = vec![diffs[0]];
        for &cur in &diffs[1..] {
            let last = result.len() - 1;
            if should_join(result[last], cur) {
                should_repeat = true;
                result[last] = result[last].join(cur);
            } else {
                result.push(cur);
            }
        }
        diffs = result;
        counter += 1;
        if counter > 10 || !should_repeat {
            return diffs;
        }
    }
}

pub fn remove_very_short_matching_lines_between_diffs(
    sequence1: &LineSequence,
    _sequence2: &LineSequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    join_repeatedly(sequence_diffs.to_vec(), |before, after| {
        let unchanged_range =
            OffsetRange::new(before.seq1_range.end_exclusive, after.seq1_range.start);
        // `replace(/\s/g, '')`, counted in UTF-16 units.
        let unchanged_text_without_ws = sequence1
            .get_text(unchanged_range)
            .encode_utf16()
            .filter(|&unit| !is_js_whitespace(unit))
            .count();
        unchanged_text_without_ws <= 4
            && (before.seq1_range.length() + before.seq2_range.length() > 5
                || after.seq1_range.length() + after.seq2_range.length() > 5)
    })
}
