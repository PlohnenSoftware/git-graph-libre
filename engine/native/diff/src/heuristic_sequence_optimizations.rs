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
use crate::diff_algorithm::{ISequence, SequenceDiff};
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
