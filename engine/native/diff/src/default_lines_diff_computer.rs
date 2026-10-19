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
use core::fmt;
use std::collections::HashMap;
use std::panic::{catch_unwind, AssertUnwindSafe};

use crate::clock::{Clock, Timeout};
use crate::compute_moved_lines::{compute_moved_lines, trim};
use crate::diff_algorithm::{
    DiffAlgorithmResult, IDiffAlgorithm, ISequence, ITimeout, SequenceDiff,
};
use crate::dynamic_programming_diffing::DynamicProgrammingDiffing;
use crate::heuristic_sequence_optimizations::{
    extend_diffs_to_entire_word_if_appropriate, optimize_sequence_diffs, remove_short_matches,
    remove_very_short_matching_lines_between_diffs,
    remove_very_short_matching_text_between_long_diffs,
};
use crate::line_range::LineRange;
use crate::line_sequence::LineSequence;
use crate::lines_diff::{LinesDiff, LinesDiffOptions, MovedText};
use crate::lines_slice_char_sequence::LinesSliceCharSequence;
use crate::myers_diff_algorithm::MyersDiffAlgorithm;
use crate::offset_range::OffsetRange;
use crate::position::Position;
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

/// `DefaultLinesDiffComputer.computeMoves` (`defaultLinesDiffComputer.ts`
/// L188-L215): `computeMovedLines` (L199-L206), then each move's inner
/// changes from `refineDiff` over its two line ranges (L208-L212). The
/// refinement's `hitTimeout` is dropped there, as in VS Code.
fn compute_moves(
    flow: Flow,
    changes: &[DetailedLineRangeMapping],
    hashed_original_lines: &[u32],
    hashed_modified_lines: &[u32],
    timeout: &mut dyn ITimeout,
) -> Vec<MovedText> {
    let moves = compute_moved_lines(
        changes,
        flow.original,
        flow.modified,
        hashed_original_lines,
        hashed_modified_lines,
        timeout,
    );
    let mut moves_with_diffs = Vec::with_capacity(moves.len());
    for m in moves {
        let diff = SequenceDiff::new(m.original.to_offset_range(), m.modified.to_offset_range());
        let move_changes = refine_diff(flow, diff, timeout);
        let mappings = line_range_mapping_from_range_mappings(
            &move_changes.mappings,
            flow.original,
            flow.modified,
            true,
        );
        moves_with_diffs.push(MovedText::new(m, mappings));
    }
    moves_with_diffs
}

/// The "make sure all ranges are valid" `assertFn` of `computeDiff`
/// (`defaultLinesDiffComputer.ts` L154-L183), run as a debug assertion: every
/// change has inner changes, whose positions lie inside their lines, and line
/// ranges that lie inside their texts (`validatePosition`, `validateRange`).
fn changes_are_valid(
    changes: &[DetailedLineRangeMapping],
    original: &TextModel,
    modified: &TextModel,
) -> bool {
    let position_valid = |p: Position, text: &TextModel| {
        (1..=text.line_count()).contains(&p.line_number)
            && (1..=text.utf16_line(p.line_number).len() as u32 + 1).contains(&p.column)
    };
    let range_valid = |r: Range, text: &TextModel| {
        position_valid(r.start_position(), text) && position_valid(r.end_position(), text)
    };
    let lines_valid = |r: LineRange, text: &TextModel| {
        let lines = 1..=text.line_count() + 1;
        lines.contains(&r.start_line_number) && lines.contains(&r.end_line_number_exclusive)
    };
    changes.iter().all(|c| {
        c.inner_changes.as_ref().is_some_and(|inner| {
            inner.iter().all(|ic| {
                range_valid(ic.modified_range, modified) && range_valid(ic.original_range, original)
            })
        }) && lines_valid(c.modified, modified)
            && lines_valid(c.original, original)
    })
}

/// `DefaultLinesDiffComputer.computeDiff` (`defaultLinesDiffComputer.ts`
/// L27-L186), without the panic guard: it panics where VS Code throws, so
/// callers outside tests use [`compute_diff`]. A `max_computation_time_ms` of 0
/// (an `InfiniteTimeout`) is the caller's `timeout`. Helpers, in call order:
/// 1. [`trivial_diff`] (L28-L45);
/// 2. [`number_trimmed_lines`] (L50-L61), with the `LineSequence`s of L63-L64;
/// 3. [`align_lines`] (L66-L87), then `optimizeSequenceDiffs` and
///    `removeVeryShortMatchingLinesBetweenDiffs` (L89-L92, here);
/// 4. [`AlignmentScan::refine_alignments`] (L94-L142), using
///    [`refine_diff`] and the whitespace scan;
/// 5. `lineRangeMappingFromRangeMappings` (L144-L147, here);
/// 6. [`compute_moves`] (L149-L152);
/// 7. [`changes_are_valid`] (L154-L183), as a debug assertion.
pub fn compute_diff_with_timeout(
    original: &TextModel,
    modified: &TextModel,
    options: LinesDiffOptions,
    timeout: &mut dyn ITimeout,
) -> LinesDiff {
    if let Some(trivial) = trivial_diff(original, modified) {
        return trivial;
    }
    let flow = Flow {
        original,
        modified,
        consider_whitespace_changes: !options.ignore_trim_whitespace,
        extend_to_subwords: options.extend_to_subwords,
    };
    let (original_hashes, modified_hashes) = number_trimmed_lines(original, modified);
    let sequence1 = LineSequence::new(&original_hashes, original.lines());
    let sequence2 = LineSequence::new(&modified_hashes, modified.lines());

    let alignment = align_lines(flow, &sequence1, &sequence2, timeout);
    let mut line_alignments = optimize_sequence_diffs(&sequence1, &sequence2, &alignment.diffs);
    line_alignments =
        remove_very_short_matching_lines_between_diffs(&sequence1, &sequence2, &line_alignments);

    let mut scan = AlignmentScan {
        flow,
        alignments: Vec::new(),
        hit_timeout: alignment.hit_timeout,
        seq1_last_start: 0,
        seq2_last_start: 0,
    };
    scan.refine_alignments(&line_alignments, timeout);

    let changes =
        line_range_mapping_from_range_mappings(&scan.alignments, original, modified, false);
    let moves = if options.compute_moves {
        compute_moves(flow, &changes, &original_hashes, &modified_hashes, timeout)
    } else {
        Vec::new()
    };
    debug_assert!(changes_are_valid(&changes, original, modified));
    LinesDiff {
        changes,
        moves,
        hit_timeout: scan.hit_timeout,
    }
}

/// Where VS Code's `computeDiff` throws (a `TypeError` on an `undefined` line,
/// a `BugIndicatingError`), the port panics; this is that panic's message,
/// returned instead of unwinding into the caller.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiffError {
    pub message: String,
}

impl fmt::Display for DiffError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "diff computation failed: {}", self.message)
    }
}

impl std::error::Error for DiffError {}

/// The public entry point: `computeDiff` as VS Code runs it, timing out by
/// `clock` (a limit of 0 never expires), and returning a [`DiffError`] where
/// VS Code throws. A panic never leaves this function: the unwind is caught,
/// so a caller can fall back (the engine is built with `panic = "unwind"`).
/// The default panic hook still prints the panic message to stderr.
pub fn compute_diff<C: Clock>(
    original: &TextModel,
    modified: &TextModel,
    options: LinesDiffOptions,
    clock: &C,
) -> Result<LinesDiff, DiffError> {
    let mut timeout = Timeout::new(clock, options.max_computation_time_ms);
    catch_unwind(AssertUnwindSafe(|| {
        compute_diff_with_timeout(original, modified, options, &mut timeout)
    }))
    .map_err(|payload| DiffError {
        message: payload
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| payload.downcast_ref::<&str>().map(|s| (*s).to_string()))
            .unwrap_or_else(|| "unknown panic".to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        compute_diff, line_equality_score, number_trimmed_lines, trivial_diff, DiffError, Flow,
    };
    use crate::clock::SystemClock;
    use crate::lines_diff::LinesDiffOptions;
    use crate::text::TextModel;
    use crate::v8_math::math_log;

    fn options(compute_moves: bool) -> LinesDiffOptions {
        LinesDiffOptions {
            ignore_trim_whitespace: false,
            max_computation_time_ms: 0,
            compute_moves,
            extend_to_subwords: false,
        }
    }

    fn model(lines: &[&str]) -> TextModel {
        TextModel::from_lines(lines.iter().map(|l| (*l).to_string()).collect())
    }

    #[test]
    fn equal_short_texts_have_no_changes() {
        let (a, b) = (model(&["same"]), model(&["same"]));
        assert!(trivial_diff(&a, &b).unwrap().changes.is_empty());
        let empty = model(&[""]);
        assert!(trivial_diff(&empty, &empty).unwrap().changes.is_empty());
        assert!(trivial_diff(&model(&["a", "b"]), &model(&["a", "b"])).is_none());
    }

    #[test]
    fn a_single_empty_line_changes_the_whole_text() {
        let diff = trivial_diff(&model(&[""]), &model(&["ab", "c\u{1F600}"])).unwrap();
        let change = &diff.changes[0];
        assert_eq!((change.original.length(), change.modified.length()), (1, 2));
        let inner = &change.inner_changes.as_ref().unwrap()[0];
        // The modified end column counts the emoji as two UTF-16 units.
        assert_eq!(inner.original_range.to_string(), "[1,1 -> 1,1]");
        assert_eq!(inner.modified_range.to_string(), "[1,1 -> 2,4]");
    }

    #[test]
    fn lines_are_numbered_by_first_occurrence_of_their_javascript_trim() {
        let original = model(&["  a", "b\u{a0}", "a"]);
        let modified = model(&["\u{3000}b", "c", "a "]);
        let (h1, h2) = number_trimmed_lines(&original, &modified);
        assert_eq!((h1, h2), (vec![0, 1, 0], vec![1, 2, 0]));
    }

    #[test]
    fn equal_lines_score_by_length_and_others_by_a_constant() {
        let (a, b) = (model(&["abc", "", "x"]), model(&["abc", "", "y"]));
        let flow = Flow {
            original: &a,
            modified: &b,
            consider_whitespace_changes: true,
            extend_to_subwords: false,
        };
        assert_eq!(line_equality_score(flow, 0, 0), 1.0 + math_log(1.0 + 3.0));
        assert_eq!(line_equality_score(flow, 1, 1), 0.1);
        assert_eq!(line_equality_score(flow, 2, 2), 0.99);
    }

    #[test]
    fn a_whitespace_only_change_is_refined_unless_ignored() {
        let (a, b) = (model(&["a", " b", "c"]), model(&["a", "b", "c"]));
        let mut with = options(false);
        let diff = compute_diff(&a, &b, with, &SystemClock::new()).unwrap();
        assert_eq!(diff.changes.len(), 1);
        with.ignore_trim_whitespace = true;
        assert!(compute_diff(&a, &b, with, &SystemClock::new())
            .unwrap()
            .changes
            .is_empty());
    }

    /// One of 22g's oracle cases on which VS Code's `computeMovedLines` throws a
    /// `TypeError` (an `undefined` line in the extension loop): the unguarded
    /// flow panics there, and `compute_diff` returns an error instead.
    #[test]
    fn a_throwing_input_becomes_an_error_not_a_panic() {
        let original = model(&[
            "}",
            "",
            "  value += alpha[i] * 2;",
            "\treturn count + result;",
            "",
            "function totalgamma(x, y) {",
            "\treturn count + delta;",
            "}",
            "let égamma = 'items\u{1F600}';",
            "// result handling",
            "",
            "  ",
        ]);
        let modified = model(&[
            "// result handling",
            "",
            "  ",
            "",
            "for (let i = 0; i < index.length; i++) {",
            "}",
            "",
            "  value += alpha[i] * 2;",
            "\treturn count + result;",
            "// value handling",
            "function totalgamma(x, y) {   ",
            "\treturn count + delta;",
            "}",
        ]);
        let clock = SystemClock::new();
        let error: DiffError = compute_diff(&original, &modified, options(true), &clock)
            .expect_err("VS Code throws on this input");
        assert!(!error.message.is_empty());
        assert!(error.to_string().starts_with("diff computation failed: "));
        // Without moves the same texts diff normally, as in VS Code.
        assert!(!compute_diff(&original, &modified, options(false), &clock)
            .unwrap()
            .changes
            .is_empty());
    }
}
