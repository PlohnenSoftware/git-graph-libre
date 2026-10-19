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
use crate::diff_algorithm::{
    DiffAlgorithmResult, IDiffAlgorithm, ISequence, ITimeout, SequenceDiff,
};
use crate::dynamic_programming_diffing::DynamicProgrammingDiffing;
use crate::heuristic_sequence_optimizations::{
    extend_diffs_to_entire_word_if_appropriate, optimize_sequence_diffs, remove_short_matches,
    remove_very_short_matching_text_between_long_diffs,
};
use crate::line_range::LineRange;
use crate::lines_slice_char_sequence::LinesSliceCharSequence;
use crate::myers_diff_algorithm::MyersDiffAlgorithm;
use crate::offset_range::OffsetRange;
use crate::range_mapping::{LineRangeMapping, RangeMapping};
use crate::text::TextModel;

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
