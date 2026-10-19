// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8 (line numbers in the doc
// comments refer to that file).
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// Exactness: lines are the UTF-16 text model's, so offsets, columns and the
// `length` in the alignment score count UTF-16 code units; line identities
// follow the `Map` numbering of JavaScript-trimmed lines. Where VS Code throws,
// the inner functions panic and the public entry point turns the panic into an
// error.
use std::collections::HashMap;

use crate::compute_moved_lines::{compute_moved_lines, trim};
use crate::diff_algorithm::{
    DiffAlgorithmResult, IDiffAlgorithm, ISequence, ITimeout, SequenceDiff,
};
use crate::dynamic_programming_diffing::DynamicProgrammingDiffing;
use crate::heuristic_sequence_optimizations::{
    extend_diffs_to_entire_word_if_appropriate, optimize_sequence_diffs, remove_short_matches,
    remove_very_short_matching_text_between_long_diffs,
};
use crate::line_range::LineRange;
use crate::line_sequence::LineSequence;
use crate::lines_diff::{LinesDiff, LinesDiffOptions, MovedText};
use crate::lines_slice_char_sequence::LinesSliceCharSequence;
use crate::myers_diff_algorithm::MyersDiffAlgorithm;
use crate::offset_range::OffsetRange;
use crate::range::Range;
use crate::range_mapping::{
    line_range_mapping_from_range_mappings, DetailedLineRangeMapping, LineRangeMapping,
    RangeMapping,
};
use crate::text::TextModel;
use crate::v8_math::math_log;

/// What every step of `computeDiff` reads: the two sides and the options that
/// reach `refineDiff` (`considerWhitespaceChanges` is `!ignoreTrimWhitespace`).
#[derive(Clone, Copy)]
struct Flow<'a> {
    original: &'a TextModel,
    modified: &'a TextModel,
    consider_whitespace_changes: bool,
    extend_to_subwords: bool,
}

/// The `{ mappings, hitTimeout }` object `refineDiff` returns.
struct Refinement {
    mappings: Vec<RangeMapping>,
    hit_timeout: bool,
}

/// `toLineRangeMapping` (`defaultLinesDiffComputer.ts` L266-L271): a sequence
/// diff over 0-based line offsets as 1-based line ranges.
fn to_line_range_mapping(sequence_diff: SequenceDiff) -> LineRangeMapping {
    let line_range = |r: OffsetRange| LineRange::new(r.start + 1, r.end_exclusive + 1);
    LineRangeMapping::new(
        line_range(sequence_diff.seq1_range),
        line_range(sequence_diff.seq2_range),
    )
}

/// `DefaultLinesDiffComputer.refineDiff` (`defaultLinesDiffComputer.ts`
/// L217-L263): the character-level diff of one line-level diff. Calls, in
/// order: [`to_line_range_mapping`] and `toRangeMapping2` (L218-L219), the two
/// `LinesSliceCharSequence`s (L221-L222), [`align_characters`] (L224-L226),
/// [`optimize_character_diffs`] (L230-L245, `check` is always `false`), and
/// the translation back into ranges (L247-L253, here).
fn refine_diff(flow: Flow, diff: SequenceDiff, timeout: &mut dyn ITimeout) -> Refinement {
    let range_mapping = to_line_range_mapping(diff).to_range_mapping2(flow.original, flow.modified);
    let slice1 = LinesSliceCharSequence::new(
        flow.original,
        range_mapping.original_range,
        flow.consider_whitespace_changes,
    );
    let slice2 = LinesSliceCharSequence::new(
        flow.modified,
        range_mapping.modified_range,
        flow.consider_whitespace_changes,
    );
    let result = align_characters(&slice1, &slice2, timeout);
    let diffs = optimize_character_diffs(&slice1, &slice2, result.diffs, flow.extend_to_subwords);
    let mappings = diffs
        .iter()
        .map(|d| {
            RangeMapping::new(
                slice1.translate_range(d.seq1_range),
                slice2.translate_range(d.seq2_range),
            )
        })
        .collect();
    Refinement {
        mappings,
        hit_timeout: result.hit_timeout,
    }
}

/// The algorithm choice of `refineDiff` (`defaultLinesDiffComputer.ts`
/// L224-L226): dynamic programming below 500 characters in total, Myers above.
fn align_characters(
    slice1: &LinesSliceCharSequence,
    slice2: &LinesSliceCharSequence,
    timeout: &mut dyn ITimeout,
) -> DiffAlgorithmResult {
    if slice1.length() + slice2.length() < 500 {
        DynamicProgrammingDiffing.compute(slice1, slice2, timeout)
    } else {
        MyersDiffAlgorithm.compute(slice1, slice2, timeout)
    }
}

/// The heuristic passes of `refineDiff` (`defaultLinesDiffComputer.ts`
/// L230-L245), in order: `optimizeSequenceDiffs` (L232), the whole-word
/// extension (L234), the sub-word extension when `extendToSubwords` is set
/// (L237-L240), `removeShortMatches` (L242) and
/// `removeVeryShortMatchingTextBetweenLongDiffs` (L244). The `check`
/// assertions (L231, L233, L235, L239, L243, L245) never run, as `check` is
/// `false`.
fn optimize_character_diffs(
    slice1: &LinesSliceCharSequence,
    slice2: &LinesSliceCharSequence,
    diffs: Vec<SequenceDiff>,
    extend_to_subwords: bool,
) -> Vec<SequenceDiff> {
    let mut diffs = optimize_sequence_diffs(slice1, slice2, &diffs);
    diffs = extend_diffs_to_entire_word_if_appropriate(
        slice1,
        slice2,
        &diffs,
        |seq, idx| seq.find_word_containing(idx),
        false,
    );
    if extend_to_subwords {
        diffs = extend_diffs_to_entire_word_if_appropriate(
            slice1,
            slice2,
            &diffs,
            |seq, idx| seq.find_sub_word_containing(idx),
            true,
        );
    }
    diffs = remove_short_matches(slice1, slice2, &diffs);
    remove_very_short_matching_text_between_long_diffs(slice1, slice2, &diffs)
}

/// The first two early returns of `computeDiff` (`defaultLinesDiffComputer.ts`
/// L28-L45): identical one-line (or empty) texts have no changes, and a side
/// that is a single empty line makes one change over the whole text.
fn trivial_diff(original: &TextModel, modified: &TextModel) -> Option<LinesDiff> {
    if original.line_count() <= 1 && original.lines() == modified.lines() {
        return Some(LinesDiff {
            changes: Vec::new(),
            moves: Vec::new(),
            hit_timeout: false,
        });
    }
    let single_empty_line =
        |text: &TextModel| text.line_count() == 1 && text.utf16_line(1).is_empty();
    if !(single_empty_line(original) || single_empty_line(modified)) {
        return None;
    }
    let whole = |text: &TextModel| {
        let last = text.line_count();
        Range::new(1, 1, last, text.utf16_line(last).len() as u32 + 1)
    };
    Some(LinesDiff {
        changes: vec![DetailedLineRangeMapping::new(
            LineRange::new(1, original.line_count() + 1),
            LineRange::new(1, modified.line_count() + 1),
            Some(vec![RangeMapping::new(whole(original), whole(modified))]),
        )],
        moves: Vec::new(),
        hit_timeout: false,
    })
}

/// The `perfectHashes` `Map` and the two `map` calls of `computeDiff`
/// (`defaultLinesDiffComputer.ts` L50-L61): every distinct JavaScript-trimmed
/// line gets the next number, original lines first, in order of first
/// occurrence. Lines are compared as UTF-16 units, like JavaScript strings.
fn number_trimmed_lines(original: &TextModel, modified: &TextModel) -> (Vec<u32>, Vec<u32>) {
    let mut perfect_hashes: HashMap<&[u16], u32> = HashMap::new();
    let original_hashes = get_or_create_hashes(original, &mut perfect_hashes);
    (
        original_hashes,
        get_or_create_hashes(modified, &mut perfect_hashes),
    )
}

/// `getOrCreateHash` (L51-L58) applied to every trimmed line of one side.
fn get_or_create_hashes<'a>(
    text: &'a TextModel,
    perfect_hashes: &mut HashMap<&'a [u16], u32>,
) -> Vec<u32> {
    (1..=text.line_count())
        .map(|line_number| {
            let next = perfect_hashes.len() as u32;
            *perfect_hashes
                .entry(trim(text.utf16_line(line_number)))
                .or_insert(next)
        })
        .collect()
}

/// The line-alignment `compute` call of `computeDiff` (`defaultLinesDiffComputer.ts`
/// L66-L87): dynamic programming with the equality score below 1700 lines in
/// total, Myers above.
fn align_lines(
    flow: Flow,
    sequence1: &LineSequence,
    sequence2: &LineSequence,
    timeout: &mut dyn ITimeout,
) -> DiffAlgorithmResult {
    if sequence1.length() + sequence2.length() >= 1700 {
        return MyersDiffAlgorithm.compute(sequence1, sequence2, timeout);
    }
    DynamicProgrammingDiffing.compute_with_score(
        sequence1,
        sequence2,
        timeout,
        Some(&|offset1, offset2| line_equality_score(flow, offset1, offset2)),
    )
}

/// The `equalityScore` callback of L69-L80: equal lines score `1 + Math.log(1 +
/// length)` (0.1 when empty), different ones 0.99. `Math.log` is
/// [`math_log`], the one V8 computes.
fn line_equality_score(flow: Flow, offset1: u32, offset2: u32) -> f64 {
    let modified_line = flow.modified.utf16_line(offset2 + 1);
    if flow.original.utf16_line(offset1 + 1) != modified_line {
        0.99
    } else if modified_line.is_empty() {
        0.1
    } else {
        1.0 + math_log(1.0 + modified_line.len() as f64)
    }
}

/// The state `scanForWhitespaceChanges` and the main loop of `computeDiff`
/// share (`defaultLinesDiffComputer.ts` L94, L120-L121 and `hitTimeout`).
struct AlignmentScan<'a> {
    flow: Flow<'a>,
    alignments: Vec<RangeMapping>,
    hit_timeout: bool,
    seq1_last_start: u32,
    seq2_last_start: u32,
}

impl AlignmentScan<'_> {
    /// Adds a refinement's mappings and timeout flag (L108-L114, L131-L138).
    fn absorb(&mut self, refinement: Refinement) {
        self.alignments.extend(refinement.mappings);
        self.hit_timeout |= refinement.hit_timeout;
    }

    /// `scanForWhitespaceChanges` (L96-L118): lines the alignment calls equal
    /// (their trimmed text matches) but that differ in whitespace are refined
    /// one by one, unless whitespace changes are ignored.
    fn scan_for_whitespace_changes(&mut self, equal_lines_count: u32, timeout: &mut dyn ITimeout) {
        if !self.flow.consider_whitespace_changes {
            return;
        }
        for i in 0..equal_lines_count {
            let seq1_offset = self.seq1_last_start + i;
            let seq2_offset = self.seq2_last_start + i;
            let (original, modified) = (self.flow.original, self.flow.modified);
            if original.utf16_line(seq1_offset + 1) != modified.utf16_line(seq2_offset + 1) {
                let diff = SequenceDiff::new(
                    OffsetRange::new(seq1_offset, seq1_offset + 1),
                    OffsetRange::new(seq2_offset, seq2_offset + 1),
                );
                let refinement = refine_diff(self.flow, diff, timeout);
                self.absorb(refinement);
            }
        }
    }

    /// The main loop of `computeDiff` (L123-L142): the whitespace scan of the
    /// equal lines before each line alignment, the alignment's own character
    /// diff, and a last scan after the final alignment.
    fn refine_alignments(&mut self, line_alignments: &[SequenceDiff], timeout: &mut dyn ITimeout) {
        for diff in line_alignments {
            debug_assert_eq!(
                i64::from(diff.seq1_range.start) - i64::from(self.seq1_last_start),
                i64::from(diff.seq2_range.start) - i64::from(self.seq2_last_start)
            );
            let equal_lines_count = diff.seq1_range.start - self.seq1_last_start;
            self.scan_for_whitespace_changes(equal_lines_count, timeout);
            self.seq1_last_start = diff.seq1_range.end_exclusive;
            self.seq2_last_start = diff.seq2_range.end_exclusive;
            let refinement = refine_diff(self.flow, *diff, timeout);
            self.absorb(refinement);
        }
        let remaining = self.flow.original.line_count() - self.seq1_last_start;
        self.scan_for_whitespace_changes(remaining, timeout);
    }
}
