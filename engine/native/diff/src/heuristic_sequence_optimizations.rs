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

/// `optimizeSequenceDiffs` (`heuristicSequenceOptimizations.ts` L12-L20).
/// Calls, in order: `join_sequence_diffs_by_shifting` twice (L14, L17), then
/// `shift_sequence_diffs` (L18).
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

/// `joinSequenceDiffsByShifting` (`heuristicSequenceOptimizations.ts`
/// L34-L114): fixes `{ Baz, Bar }` to `{ Baz, Bar, Foo }` being two diffs.
/// Calls, in order: `shift_left_and_join` (L39-L72, the first pass), then
/// `shift_right_and_join` (L74-L113, the second pass). L35-L37, the empty
/// input, is here.
fn join_sequence_diffs_by_shifting(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    if sequence_diffs.is_empty() {
        return Vec::new();
    }
    let mut result = shift_left_and_join(sequence1, sequence2, sequence_diffs);
    shift_right_and_join(sequence1, sequence2, &mut result)
}

/// How far `cur` can move left, one element at a time, while both sequences
/// keep their elements (`joinSequenceDiffsByShifting` L49-L57 and `d--` at L57).
fn count_left_shift(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    cur: SequenceDiff,
    length: i64,
) -> i64 {
    let mut d = 1;
    while d <= length {
        let (start, end) = (
            cur.get_starts().delta(-d),
            cur.get_end_exclusives().delta(-d),
        );
        if sequence1.get_element(start.offset1) != sequence1.get_element(end.offset1)
            || sequence2.get_element(start.offset2) != sequence2.get_element(end.offset2)
        {
            break;
        }
        d += 1;
    }
    d - 1
}

/// `joinSequenceDiffsByShifting` L39-L72: first move them all to the left as
/// much as possible and join them if possible (the `result` array).
fn shift_left_and_join(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    let mut result = vec![sequence_diffs[0]];
    for &diff in &sequence_diffs[1..] {
        let last = result.len() - 1;
        let prev = result[last];
        let mut cur = diff;
        if cur.seq1_range.is_empty() || cur.seq2_range.is_empty() {
            let length = i64::from(cur.seq1_range.start) - i64::from(prev.seq1_range.end_exclusive);
            let d = count_left_shift(sequence1, sequence2, cur, length);
            if d == length {
                // Merge previous and current diff
                result[last] = SequenceDiff::from_offset_pairs(
                    prev.get_starts(),
                    cur.get_end_exclusives().delta(-length),
                );
                continue;
            }
            cur = cur.delta(-d);
        }
        result.push(cur);
    }
    result
}

/// How far `cur` can move right while both sequences stay strongly equal
/// (`joinSequenceDiffsByShifting` L82-L90).
fn count_right_shift(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    cur: SequenceDiff,
    length: i64,
) -> i64 {
    let mut d = 0;
    while d < length {
        let (start, end) = (cur.get_starts().delta(d), cur.get_end_exclusives().delta(d));
        if !sequence1.is_strongly_equal(start.offset1, end.offset1)
            || !sequence2.is_strongly_equal(start.offset2, end.offset2)
        {
            break;
        }
        d += 1;
    }
    d
}

/// `joinSequenceDiffsByShifting` L74-L113: then move them all to the right and
/// join them again if possible (`result2`, with the merge written into
/// `result` as the TypeScript does, and the last diff pushed at L109-L111).
fn shift_right_and_join(
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    result: &mut [SequenceDiff],
) -> Vec<SequenceDiff> {
    let mut result2 = Vec::new();
    for i in 0..result.len() - 1 {
        let next = result[i + 1];
        let mut cur = result[i];
        if cur.seq1_range.is_empty() || cur.seq2_range.is_empty() {
            let length = i64::from(next.seq1_range.start) - i64::from(cur.seq1_range.end_exclusive);
            let d = count_right_shift(sequence1, sequence2, cur, length);
            if d == length {
                // Merge previous and current diff, write to result!
                result[i + 1] = SequenceDiff::from_offset_pairs(
                    cur.get_starts().delta(length),
                    next.get_end_exclusives(),
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

/// The range an empty diff may move within: not onto the previous or next diff
/// (`shiftSequenceDiffs` L142-L143, the two `OffsetRange` constructions).
fn valid_range(prev_end: Option<u32>, next_start: Option<u32>, length: u32) -> OffsetRange {
    let start = prev_end.map_or(0, |end| i64::from(end) + 1);
    let end = next_start.map_or(i64::from(length), |s| i64::from(s) - 1);
    assert!(start <= end, "Invalid range: [{start}, {end})");
    OffsetRange::new(start as u32, end as u32)
}

/// `shiftSequenceDiffs` (`heuristicSequenceOptimizations.ts` L132-L153):
/// aligns character level diffs at whitespace and other boundaries, e.g.
/// `import { I[Arr, I]Bar }` becomes `import { [IArr, ]IBar }`. L133-L135
/// (no boundary scores) is here; `valid_range` replaces L142-L143, and each
/// empty diff goes to `shift_diff_to_better_position` (L145-L149).
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

const MAX_SHIFT_LIMIT: i64 = 100; // To prevent performance issues

/// How far the diff may move left and right without touching its neighbors
/// (`shiftDiffToBetterPosition` L158-L176: the `deltaBefore` loop with its
/// decrement at L167, then the `deltaAfter` loop).
fn shift_limits(
    diff: SequenceDiff,
    sequence2: &dyn ISequence,
    seq1_valid_range: OffsetRange,
    seq2_valid_range: OffsetRange,
) -> (i64, i64) {
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

    let mut delta_after = 0;
    while start1 + delta_after < i64::from(seq1_valid_range.end_exclusive)
        && end2 + delta_after < i64::from(seq2_valid_range.end_exclusive)
        && sequence2.is_strongly_equal((start2 + delta_after) as u32, (end2 + delta_after) as u32)
        && delta_after < MAX_SHIFT_LIMIT
    {
        delta_after += 1;
    }
    (delta_before - 1, delta_after)
}

/// The shift in `-delta_before..=delta_after` with the best boundary score
/// (`shiftDiffToBetterPosition` L185-L198; the first best wins).
fn best_shift(
    diff: SequenceDiff,
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    delta_before: i64,
    delta_after: i64,
) -> i64 {
    let start1 = i64::from(diff.seq1_range.start);
    let start2 = i64::from(diff.seq2_range.start);
    let end2 = i64::from(diff.seq2_range.end_exclusive);
    let mut best_delta = 0;
    let mut best_score = -1.0;
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
    best_delta
}

/// `shiftDiffToBetterPosition` (`heuristicSequenceOptimizations.ts`
/// L155-L201). Calls, in order: `shift_limits` (L158-L176), the no-shift
/// return (L178-L180, here), `best_shift` (L185-L198), and the final
/// `diff.delta(bestDelta)` (L200, here).
fn shift_diff_to_better_position(
    diff: SequenceDiff,
    sequence1: &dyn ISequence,
    sequence2: &dyn ISequence,
    seq1_valid_range: OffsetRange,
    seq2_valid_range: OffsetRange,
) -> SequenceDiff {
    let (delta_before, delta_after) =
        shift_limits(diff, sequence2, seq1_valid_range, seq2_valid_range);
    if delta_before == 0 && delta_after == 0 {
        return diff;
    }
    diff.delta(best_shift(
        diff,
        sequence1,
        sequence2,
        delta_before,
        delta_after,
    ))
}

/// `removeShortMatches` (`heuristicSequenceOptimizations.ts` L203-L220).
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
            *last = last.join(s);
        } else {
            result.push(s);
        }
    }
    result
}

/// The state `scanWord` closes over in `extendDiffsToEntireWordIfAppropriate`
/// (`heuristicSequenceOptimizations.ts` L229-L233: `equalMappings`,
/// `additional`, `lastPoint`; `findParent` and `force` are its parameters).
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
    /// `scanWord` (`heuristicSequenceOptimizations.ts` L235-L285), whole.
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

/// `extendDiffsToEntireWordIfAppropriate` (`heuristicSequenceOptimizations.ts`
/// L222-L299); `find_parent` is `findWordContaining` or `findSubWordContaining`.
/// Sets up the `WordScan` state (L229-L233), runs the loop over the equal
/// mappings (L287-L295) calling `WordScan::scan_word` (L235-L285), then
/// `merge_sequence_diffs` (L297-L298).
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

/// `mergeSequenceDiffs` (`heuristicSequenceOptimizations.ts` L301-L323).
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

/// The `do { ... } while (counter++ < 10 && shouldRepeat)` loop shared by
/// `removeVeryShortMatchingLinesBetweenDiffs` (`heuristicSequenceOptimizations.ts`
/// L331-L367) and `removeVeryShortMatchingTextBetweenLongDiffs` (L378-L438),
/// including the empty-input return (L327-L329, L374-L376). It joins a diff to
/// the previous result while `should_join(last, cur)`, the TypeScript's
/// `shouldJoinDiffs` closure.
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

/// `removeVeryShortMatchingLinesBetweenDiffs` (`heuristicSequenceOptimizations.ts`
/// L325-L370). Calls `join_repeatedly` (L326-L368 loop), with the closure
/// below as its `shouldJoinDiffs` (L344-L355).
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

/// `String.prototype.trim` on UTF-16 text, as `.trim()` at
/// `heuristicSequenceOptimizations.ts` L399 and L447.
fn trim_js(text: &[u16]) -> &[u16] {
    let first = text.iter().position(|&unit| !is_js_whitespace(unit));
    let last = text.iter().rposition(|&unit| !is_js_whitespace(unit));
    first
        .zip(last)
        .map_or(&[], |(first, last)| &text[first..=last])
}

/// The `max` of the weight formula (`heuristicSequenceOptimizations.ts` L416): `2 * 40 + 50`.
const MAX_WEIGHT_INPUT: f64 = 130.0;

/// The `cap` and pow terms of L421-L422 (`removeVeryShortMatchingTextBetweenLongDiffs`):
/// `Math.pow(Math.pow(cap(a), 1.5) + Math.pow(cap(b), 1.5), 1.5)`, with `cap`
/// at `MAX_WEIGHT_INPUT`, for the sizes (lines * 40 + length) of one diff's two sides.
fn diff_weight(size1: u32, size2: u32) -> f64 {
    let cap = |size: u32| f64::from(size).min(MAX_WEIGHT_INPUT).powf(1.5);
    (cap(size1) + cap(size2)).powf(1.5)
}

/// `shouldJoinDiffs` of `removeVeryShortMatchingTextBetweenLongDiffs`
/// (`heuristicSequenceOptimizations.ts` L391-L426): the size and text limits
/// (L392-L402), the line counts (L404-L412) and the weight test (L416-L425).
fn should_join_text_between_long_diffs(
    sequence1: &LinesSliceCharSequence,
    sequence2: &LinesSliceCharSequence,
    before: SequenceDiff,
    after: SequenceDiff,
) -> bool {
    let unchanged_range = OffsetRange::new(before.seq1_range.end_exclusive, after.seq1_range.start);

    let unchanged_line_count = sequence1.count_lines_in(unchanged_range);
    if unchanged_line_count > 5 || unchanged_range.length() > 500 {
        return false;
    }

    // `split(/\r\n|\r|\n/).length > 1` is true exactly when a line break occurs.
    let unchanged_text = sequence1.get_text(unchanged_range);
    let unchanged_text = trim_js(&unchanged_text);
    if unchanged_text.len() > 20
        || unchanged_text
            .iter()
            .any(|&unit| unit == 0x0A || unit == 0x0D)
    {
        return false;
    }

    let size = |sequence: &LinesSliceCharSequence, range: OffsetRange| {
        sequence.count_lines_in(range) * 40 + range.length()
    };
    let weight = |diff: SequenceDiff| {
        diff_weight(
            size(sequence1, diff.seq1_range),
            size(sequence2, diff.seq2_range),
        )
    };
    weight(before) + weight(after) > MAX_WEIGHT_INPUT.powf(1.5).powf(1.5) * 1.3
}

/// The per-diff body of the `forEachWithNeighbors` callback of
/// `removeVeryShortMatchingTextBetweenLongDiffs` (`heuristicSequenceOptimizations.ts`
/// L443-L470): marks a short prefix or suffix on the line as changed (L444-L458),
/// then limits the result to the space between `prev` and `next` (L460-L464).
fn extend_over_short_affixes(
    sequence1: &LinesSliceCharSequence,
    prev: Option<SequenceDiff>,
    cur: SequenceDiff,
    next: Option<SequenceDiff>,
) -> SequenceDiff {
    let mut new_diff = cur;

    let should_mark_as_changed = |text: &[u16]| {
        !text.is_empty()
            && trim_js(text).len() <= 3
            && cur.seq1_range.length() + cur.seq2_range.length() > 100
    };

    let full_range1 = sequence1.extend_to_full_lines(cur.seq1_range);
    let prefix = sequence1.get_text(OffsetRange::new(full_range1.start, cur.seq1_range.start));
    if should_mark_as_changed(&prefix) {
        // `deltaStart(-prefix.length)` can take the second range below zero
        // in the TypeScript; the intersection below clamps it back to the
        // previous diff's end, so clamping at zero gives the same result.
        let back = prefix.len() as u32;
        new_diff = SequenceDiff::new(
            new_diff.seq1_range.delta_start(-i64::from(back)),
            OffsetRange::new(
                new_diff.seq2_range.start.saturating_sub(back),
                new_diff.seq2_range.end_exclusive,
            ),
        );
    }
    let suffix = sequence1.get_text(OffsetRange::new(
        cur.seq1_range.end_exclusive,
        full_range1.end_exclusive,
    ));
    if should_mark_as_changed(&suffix) {
        new_diff = new_diff.delta_end(suffix.len() as i64);
    }

    let available_space = SequenceDiff::from_offset_pairs(
        prev.map_or(OffsetPair::ZERO, |p| p.get_end_exclusives()),
        next.map_or(OffsetPair::MAX, |n| n.get_starts()),
    );
    new_diff
        .intersect(available_space)
        .expect("the diff lies in its available space")
}

/// `removeVeryShortMatchingTextBetweenLongDiffs` (`heuristicSequenceOptimizations.ts`
/// L372-L473). Calls, in order: `join_repeatedly` with
/// `should_join_text_between_long_diffs` (L374-L438), then, for each diff with
/// its neighbors (`forEachWithNeighbors`, L440-L470), `extend_over_short_affixes`
/// and the joining of touching results into `newDiffs` (L465-L469, here).
pub fn remove_very_short_matching_text_between_long_diffs(
    sequence1: &LinesSliceCharSequence,
    sequence2: &LinesSliceCharSequence,
    sequence_diffs: &[SequenceDiff],
) -> Vec<SequenceDiff> {
    let diffs = join_repeatedly(sequence_diffs.to_vec(), |before, after| {
        should_join_text_between_long_diffs(sequence1, sequence2, before, after)
    });

    let mut new_diffs: Vec<SequenceDiff> = Vec::new();
    for (i, &cur) in diffs.iter().enumerate() {
        let prev = i.checked_sub(1).map(|j| diffs[j]);
        let result = extend_over_short_affixes(sequence1, prev, cur, diffs.get(i + 1).copied());
        match new_diffs.last_mut() {
            Some(last) if result.get_starts() == last.get_end_exclusives() => {
                *last = last.join(result);
            }
            _ => new_diffs.push(result),
        }
    }
    new_diffs
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::range::Range;
    use crate::text::TextModel;

    const CORPUS: &str = include_str!("../tests/data/heuristic-sequence-optimizations-oracle.txt");

    /// A sequence without boundary scores, like the generator's `PlainSequence`.
    struct Plain(Vec<u32>);

    impl ISequence for Plain {
        fn get_element(&self, offset: u32) -> u32 {
            self.0[offset as usize]
        }
        fn length(&self) -> u32 {
            self.0.len() as u32
        }
        fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool {
            self.0.get(offset1 as usize) == self.0.get(offset2 as usize)
        }
    }

    fn lines_of(field: &str) -> Vec<String> {
        field
            .split('|')
            .map(|line| {
                let units: Vec<u16> = line
                    .split(',')
                    .filter(|unit| !unit.is_empty())
                    .map(|unit| u16::from_str_radix(unit, 16).unwrap())
                    .collect();
                String::from_utf16(&units).unwrap()
            })
            .collect()
    }

    fn numbers_of(field: &str) -> Vec<u32> {
        field
            .split(',')
            .filter(|n| !n.is_empty())
            .map(|n| n.parse().unwrap())
            .collect()
    }

    fn range_of(field: &str) -> Range {
        let n: Vec<u32> = field.split(',').map(|n| n.parse().unwrap()).collect();
        Range::new(n[0], n[1], n[2], n[3])
    }

    fn diffs_of(field: &str) -> Vec<SequenceDiff> {
        if field == "." {
            return Vec::new();
        }
        let range = |part: &str| {
            let (start, end) = part.split_once('-').unwrap();
            OffsetRange::new(start.parse().unwrap(), end.parse().unwrap())
        };
        field
            .split(' ')
            .map(|diff| {
                let (a, b) = diff.split_once(':').unwrap();
                SequenceDiff::new(range(a), range(b))
            })
            .collect()
    }

    enum Scenario {
        Chars(LinesSliceCharSequence, LinesSliceCharSequence),
        Lines(Vec<String>, Vec<u32>, Vec<String>, Vec<u32>),
        Plain(Plain, Plain),
    }

    fn open_scenario(fields: &[&str]) -> Scenario {
        match fields[1] {
            "C" => {
                let slice = |lines: &str, range: &str| {
                    let model = TextModel::from_lines(lines_of(lines));
                    LinesSliceCharSequence::new(&model, range_of(range), fields[6] == "1")
                };
                Scenario::Chars(slice(fields[2], fields[3]), slice(fields[4], fields[5]))
            }
            "L" => Scenario::Lines(
                lines_of(fields[2]),
                numbers_of(fields[3]),
                lines_of(fields[4]),
                numbers_of(fields[5]),
            ),
            _ => Scenario::Plain(Plain(numbers_of(fields[2])), Plain(numbers_of(fields[3]))),
        }
    }

    fn run(scenario: &Scenario, op: &str, diffs: &[SequenceDiff]) -> Vec<SequenceDiff> {
        let word = |s: &LinesSliceCharSequence, i| s.find_word_containing(i);
        let sub_word = |s: &LinesSliceCharSequence, i| s.find_sub_word_containing(i);
        match (scenario, op) {
            (Scenario::Chars(a, b), "optimize") => optimize_sequence_diffs(a, b, diffs),
            (Scenario::Chars(a, b), "short") => remove_short_matches(a, b, diffs),
            (Scenario::Chars(a, b), "extend-word") => {
                extend_diffs_to_entire_word_if_appropriate(a, b, diffs, word, false)
            }
            (Scenario::Chars(a, b), "extend-word-force") => {
                extend_diffs_to_entire_word_if_appropriate(a, b, diffs, word, true)
            }
            (Scenario::Chars(a, b), "extend-sub") => {
                extend_diffs_to_entire_word_if_appropriate(a, b, diffs, sub_word, false)
            }
            (Scenario::Chars(a, b), "extend-sub-force") => {
                extend_diffs_to_entire_word_if_appropriate(a, b, diffs, sub_word, true)
            }
            (Scenario::Chars(a, b), "very-short-text") => {
                remove_very_short_matching_text_between_long_diffs(a, b, diffs)
            }
            (Scenario::Lines(l1, h1, l2, h2), _) => {
                let (a, b) = (LineSequence::new(h1, l1), LineSequence::new(h2, l2));
                match op {
                    "optimize" => optimize_sequence_diffs(&a, &b, diffs),
                    "short" => remove_short_matches(&a, &b, diffs),
                    _ => remove_very_short_matching_lines_between_diffs(&a, &b, diffs),
                }
            }
            (Scenario::Plain(a, b), "optimize") => optimize_sequence_diffs(a, b, diffs),
            (Scenario::Plain(a, b), "short") => remove_short_matches(a, b, diffs),
            _ => panic!("unknown operation {op}"),
        }
    }

    fn fnv(values: impl Iterator<Item = f64>) -> String {
        let mut hash = 0xcbf2_9ce4_8422_2325_u64;
        for value in values {
            for byte in value.to_bits().to_le_bytes() {
                hash = (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3);
            }
        }
        format!("{hash:x}")
    }

    #[test]
    fn weight_tables_match_v8() {
        let line = CORPUS.lines().find(|l| l.starts_with("W;")).unwrap();
        let f: Vec<&str> = line.split(';').collect();
        let powers = fnv((0..=130).map(|x| f64::from(x).powf(1.5)));
        let weights = (0..=130u32).flat_map(|x| (x..=130).map(move |y| diff_weight(x, y)));
        let threshold = MAX_WEIGHT_INPUT.powf(1.5).powf(1.5) * 1.3;
        assert_eq!(f[1], "8646");
        assert_eq!(f[2], powers, "Math.pow(x, 1.5)");
        assert_eq!(f[3], fnv(weights), "the weight formula");
        assert_eq!(f[4], format!("{:x}", threshold.to_bits()), "the threshold");
    }

    #[test]
    fn oracle_corpus() {
        let mut scenario = None;
        let mut cases = 0;
        for line in CORPUS
            .lines()
            .filter(|l| !l.starts_with('#') && !l.starts_with("W;"))
        {
            let fields: Vec<&str> = line.split(';').collect();
            if fields[0] == "S" {
                scenario = Some(open_scenario(&fields));
                continue;
            }
            let scenario = scenario.as_ref().unwrap();
            let got = run(scenario, fields[1], &diffs_of(fields[2]));
            assert_eq!(got, diffs_of(fields[3]), "{line}");
            cases += 1;
        }
        assert!(cases > 5000, "{cases}");
    }

    // The examples in the TypeScript's comments, on elements: shifting an
    // insertion to the left joins `{ Baz, Bar }` with `{ Baz, Bar, Foo }` style diffs.
    #[test]
    fn short_matches_join_across_one_or_two_elements() {
        let plain = Plain(vec![0; 20]);
        let d = |a, b, c, e| SequenceDiff::new(OffsetRange::new(a, b), OffsetRange::new(c, e));
        let diffs = [d(0, 1, 0, 1), d(3, 4, 3, 4), d(8, 9, 8, 9)];
        assert_eq!(
            remove_short_matches(&plain, &plain, &diffs),
            [d(0, 4, 0, 4), d(8, 9, 8, 9)]
        );
        assert!(optimize_sequence_diffs(&plain, &plain, &[]).is_empty());
    }

    #[test]
    fn trim_uses_the_javascript_set() {
        let units: Vec<u16> = " \u{a0}\u{feff}ab\u{3000}\n".encode_utf16().collect();
        assert_eq!(trim_js(&units), [0x61, 0x62]);
        assert!(trim_js(&[0x20, 0x09]).is_empty());
        let nel: Vec<u16> = "\u{85}".encode_utf16().collect();
        assert_eq!(trim_js(&nel).len(), 1);
    }
}
