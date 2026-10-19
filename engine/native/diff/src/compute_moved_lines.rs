// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/computeMovedLines.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8 (with the helpers it
// uses from `base/common/arrays`, `arraysFind` and `map`: `SetMap` is a map
// from a key to a `Vec`, because its values are fresh objects, so its `Set`
// never merges any).
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// Exactness: lines are UTF-16 code units (`trim`, `length` and `charCodeAt`
// count them), every sort is stable like V8's, and the insertion-ordered
// `Set`s and `Map`s are `Vec`s. The `LineRangeMapping` result is all this
// file produces; `MovedText`'s inner changes come from `refineDiff` in
// `defaultLinesDiffComputer.ts`. Where VS Code would throw (a `TypeError` on
// an `undefined` line) this panics.
use std::collections::HashMap;

use crate::arrays_find::{find_last_idx_monotonous, find_last_monotonous, MonotonousArray};
use crate::diff_algorithm::{IDiffAlgorithm, ITimeout, SequenceDiff};
use crate::line_range::{LineRange, LineRangeSet};
use crate::lines_slice_char_sequence::{is_js_whitespace, LinesSliceCharSequence};
use crate::myers_diff_algorithm::MyersDiffAlgorithm;
use crate::range::Range;
use crate::range_mapping::{DetailedLineRangeMapping, LineRangeMapping};
use crate::text::TextModel;
use crate::utils::{is_space, LineRangeFragment};

/// `String.prototype.trim` on UTF-16 units (VS Code calls it at
/// `computeMovedLines.ts` L36, L258; not a function of its own there).
fn trim(line: &[u16]) -> &[u16] {
    let start = line
        .iter()
        .position(|&u| !is_js_whitespace(u))
        .unwrap_or(line.len());
    let end = line
        .iter()
        .rposition(|&u| !is_js_whitespace(u))
        .map_or(start, |i| i + 1);
    &line[start..end]
}

/// `areLinesSimilar` (`computeMovedLines.ts` L257-L290, whole function; its
/// inner `countNonWsChars`, L277-L285, is inline).
fn are_lines_similar(line1: &[u16], line2: &[u16], timeout: &mut dyn ITimeout) -> bool {
    if trim(line1) == trim(line2) {
        return true;
    }
    if line1.len() > 300 && line2.len() > 300 {
        return false;
    }
    // `new Range(1, 1, 1, line.length)`: the end column has no +1, as in VS Code.
    let slice = |line: &[u16]| {
        let text = TextModel::from_lines(vec![String::from_utf16_lossy(line)]);
        LinesSliceCharSequence::new(&text, Range::new(1, 1, 1, line.len() as u32), false)
    };
    let result = MyersDiffAlgorithm.compute(&slice(line1), &slice(line2), timeout);
    // Out-of-range reads are `charCodeAt` NaN: not a space, so they count.
    let non_space =
        |line: &[u16], idx: usize| line.get(idx).is_none_or(|&u| !is_space(u32::from(u)));
    let mut common_non_space_char_count = 0;
    for seq in SequenceDiff::invert(&result.diffs, line1.len() as u32) {
        for idx in seq.seq1_range.start..seq.seq1_range.end_exclusive {
            common_non_space_char_count += u32::from(non_space(line1, idx as usize));
        }
    }
    // `countNonWsChars` walks `line1.length` positions of the longer line.
    let longer = if line1.len() > line2.len() {
        line1
    } else {
        line2
    };
    let longer_line_length = (0..line1.len()).filter(|&i| non_space(longer, i)).count();
    f64::from(common_non_space_char_count) / longer_line_length as f64 > 0.6
        && longer_line_length > 10
}

/// `joinCloseConsecutiveMoves` (`computeMovedLines.ts` L292-L316, whole).
fn join_close_consecutive_moves(mut moves: Vec<LineRangeMapping>) -> Vec<LineRangeMapping> {
    if moves.is_empty() {
        return moves;
    }
    moves.sort_by_key(|m| m.original.start_line_number);
    let mut result = vec![moves[0].clone()];
    for current in &moves[1..] {
        let last = result.last_mut().expect("result starts non-empty");
        let original_dist = i64::from(current.original.start_line_number)
            - i64::from(last.original.end_line_number_exclusive);
        let modified_dist = i64::from(current.modified.start_line_number)
            - i64::from(last.modified.end_line_number_exclusive);
        if original_dist >= 0 && modified_dist >= 0 && original_dist + modified_dist <= 2 {
            *last = LineRangeMapping::new(
                last.original.join(current.original),
                last.modified.join(current.modified),
            );
        } else {
            result.push(current.clone());
        }
    }
    result
}

/// `removeMovesInSameDiff` (`computeMovedLines.ts` L318-L329, whole).
fn remove_moves_in_same_diff(
    changes: &[DetailedLineRangeMapping],
    moves: Vec<LineRangeMapping>,
) -> Vec<LineRangeMapping> {
    let mut changes_monotonous = MonotonousArray::new(changes);
    let mut kept = Vec::new();
    for m in moves {
        let before_end_of_move_original = changes_monotonous.find_last_monotonous(|c| {
            c.original.start_line_number < m.original.end_line_number_exclusive
        });
        let before_end_of_move_modified = usize::try_from(find_last_idx_monotonous(
            changes,
            |c| c.modified.start_line_number < m.modified.end_line_number_exclusive,
            0,
        ))
        .ok();
        // No change before the original end is VS Code's fresh placeholder
        // mapping, which is never the modified side's change.
        if before_end_of_move_original.is_none()
            || before_end_of_move_original != before_end_of_move_modified
        {
            kept.push(m);
        }
    }
    kept
}

/// `computeMovedLines` (`computeMovedLines.ts` L17-L43), the entry point: the
/// moved blocks of lines, as VS Code finds them. `hashed_*_lines` number equal
/// trimmed lines alike; `changes` is the line diff. Returns no moves when the
/// timeout expires partway. Helpers, in call order:
/// 1. [`compute_moves_from_simple_deletions_to_simple_insertions`] (L55-L96,
///    called at L25);
/// 2. [`compute_unchanged_moves`] (L98-L255, called at L30), split further
///    into [`collect_original_3_line_hashes`], [`compute_possible_mappings`],
///    [`select_moves`] and [`extend_moves`];
/// 3. [`join_close_consecutive_moves`] (L292-L316, called at L33);
/// 4. [`is_long_enough_move`] (the filter callback at L35-L39, with
///    `countWhere` L45-L53 inlined);
/// 5. [`remove_moves_in_same_diff`] (L318-L329, called at L40).
pub fn compute_moved_lines(
    changes: &[DetailedLineRangeMapping],
    original_lines: &TextModel,
    modified_lines: &TextModel,
    hashed_original_lines: &[u32],
    hashed_modified_lines: &[u32],
    timeout: &mut dyn ITimeout,
) -> Vec<LineRangeMapping> {
    let (mut moves, excluded_changes) = compute_moves_from_simple_deletions_to_simple_insertions(
        changes,
        original_lines,
        modified_lines,
        timeout,
    );
    if !timeout.is_valid() {
        return Vec::new();
    }

    let filtered_changes = changes
        .iter()
        .zip(&excluded_changes)
        .filter(|(_, &excluded)| !excluded)
        .map(|(c, _)| c)
        .collect();
    moves.extend(compute_unchanged_moves(
        filtered_changes,
        hashed_original_lines,
        hashed_modified_lines,
        original_lines,
        modified_lines,
        timeout,
    ));

    moves = join_close_consecutive_moves(moves);
    // Ignore too short moves
    moves.retain(|current| is_long_enough_move(current, original_lines));
    remove_moves_in_same_diff(changes, moves)
}

/// Split from `computeMovedLines` (`computeMovedLines.ts` L17-L43): the
/// callback of the "Ignore too short moves" filter at L35-L39, with
/// `countWhere` (L45-L53) inlined: the trimmed original lines of the move
/// are at least 15 characters joined, and at least two have 2+ characters.
fn is_long_enough_move(current: &LineRangeMapping, original_lines: &TextModel) -> bool {
    let (start, end) = (
        current.original.start_line_number - 1,
        current.original.end_line_number_exclusive - 1,
    );
    // `slice` clamps to the lines, so a move past the end is just shorter.
    let lines: Vec<&[u16]> = (start..end.min(original_lines.line_count()))
        .map(|i| trim(original_lines.utf16_line(i + 1)))
        .collect();
    let original_text_length =
        lines.iter().map(|l| l.len()).sum::<usize>() + lines.len().saturating_sub(1);
    original_text_length >= 15 && lines.iter().filter(|l| l.len() >= 2).count() >= 2
}

/// `computeMovesFromSimpleDeletionsToSimpleInsertions`
/// (`computeMovedLines.ts` L55-L96): pairs each pure deletion of 3+ lines with
/// the most similar pure insertion. Returns the moves and, per index into
/// `changes`, whether the change was consumed by one (VS Code's
/// `excludedChanges` set). The search at L74-L81 is [`most_similar_insertion`].
fn compute_moves_from_simple_deletions_to_simple_insertions(
    changes: &[DetailedLineRangeMapping],
    original_lines: &TextModel,
    modified_lines: &TextModel,
    timeout: &mut dyn ITimeout,
) -> (Vec<LineRangeMapping>, Vec<bool>) {
    let mut moves = Vec::new();
    let mut excluded_changes = vec![false; changes.len()];
    let deletions: Vec<LineRangeFragment> = changes
        .iter()
        .enumerate()
        .filter(|(_, c)| c.modified.is_empty() && c.original.length() >= 3)
        .map(|(i, c)| LineRangeFragment::new(c.original, original_lines, i))
        .collect();
    // A `Set` iterates in insertion order and deleting keeps the order.
    let mut insertions: Vec<LineRangeFragment> = changes
        .iter()
        .enumerate()
        .filter(|(_, c)| c.original.is_empty() && c.modified.length() >= 3)
        .map(|(i, c)| LineRangeFragment::new(c.modified, modified_lines, i))
        .collect();

    for deletion in &deletions {
        let (highest_similarity, best) = most_similar_insertion(deletion, &insertions);
        if let Some(idx) = best.filter(|_| highest_similarity > 0.90) {
            let insertion = insertions.remove(idx);
            moves.push(LineRangeMapping::new(deletion.range, insertion.range));
            excluded_changes[deletion.source] = true;
            excluded_changes[insertion.source] = true;
        }
        if !timeout.is_valid() {
            break;
        }
    }
    (moves, excluded_changes)
}

/// Split from `computeMovesFromSimpleDeletionsToSimpleInsertions`
/// (`computeMovedLines.ts` L55-L96): the inner loop at L74-L81, the highest
/// similarity (starting at -1, first one wins ties) and the index of the
/// insertion that has it.
fn most_similar_insertion(
    deletion: &LineRangeFragment,
    insertions: &[LineRangeFragment],
) -> (f64, Option<usize>) {
    let mut highest_similarity = -1.0;
    let mut best = None;
    for (idx, insertion) in insertions.iter().enumerate() {
        let similarity = deletion.compute_similarity(insertion);
        if similarity > highest_similarity {
            highest_similarity = similarity;
            best = Some(idx);
        }
    }
    (highest_similarity, best)
}

/// `PossibleMapping` (`computeMovedLines.ts` L117-L120).
struct PossibleMapping {
    modified_line_range: LineRange,
    original_line_range: LineRange,
}

/// The line-number sets of lines already part of a move (`modifiedSet` and
/// `originalSet`, `computeMovedLines.ts` L162-L163).
#[derive(Default)]
struct MovedSets {
    original: LineRangeSet,
    modified: LineRangeSet,
}

/// The three consecutive line hashes starting at 1-based line `i`: the
/// template-string key built at `computeMovedLines.ts` L112 and L129.
fn three_line_key(hashed_lines: &[u32], i: u32) -> (u32, u32, u32) {
    let i = i as usize;
    (hashed_lines[i - 1], hashed_lines[i], hashed_lines[i + 1])
}

/// `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255): finds blocks of
/// three or more lines that moved unchanged, grown over similar neighbors.
/// `changes` is the list without the changes consumed by the simple-move
/// pass. Helpers, in call order:
/// 1. [`collect_original_3_line_hashes`] (L108-L115);
/// 2. the `changes.sort` at L124 (inline here, stable like V8's);
/// 3. [`compute_possible_mappings`] (L117-L158, with its timeout exit at
///    L155-L157 returning no moves);
/// 4. [`select_moves`] (L160-L187);
/// 5. [`extend_moves`] (L189-L254).
fn compute_unchanged_moves(
    mut changes: Vec<&DetailedLineRangeMapping>,
    hashed_original_lines: &[u32],
    hashed_modified_lines: &[u32],
    original_lines: &TextModel,
    modified_lines: &TextModel,
    timeout: &mut dyn ITimeout,
) -> Vec<LineRangeMapping> {
    let original_3_line_hashes = collect_original_3_line_hashes(&changes, hashed_original_lines);
    changes.sort_by_key(|c| c.modified.start_line_number);
    let Some(possible_mappings) = compute_possible_mappings(
        &changes,
        &original_3_line_hashes,
        hashed_modified_lines,
        timeout,
    ) else {
        return Vec::new();
    };
    let (mut moves, mut sets) = select_moves(possible_mappings);
    extend_moves(
        &mut moves,
        &changes,
        (original_lines, modified_lines),
        &mut sets,
        timeout,
    );
    moves
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L108-L115, the `SetMap` of every three-line window of the original side of
/// each change, keyed by its hashes (a `Vec` per key: the values are fresh
/// objects, so VS Code's `Set` never merges any).
fn collect_original_3_line_hashes(
    changes: &[&DetailedLineRangeMapping],
    hashed_original_lines: &[u32],
) -> HashMap<(u32, u32, u32), Vec<LineRange>> {
    let mut original_3_line_hashes: HashMap<(u32, u32, u32), Vec<LineRange>> = HashMap::new();
    for change in changes {
        let mut i = change.original.start_line_number;
        while i + 2 < change.original.end_line_number_exclusive {
            original_3_line_hashes
                .entry(three_line_key(hashed_original_lines, i))
                .or_default()
                .push(LineRange::new(i, i + 3));
            i += 1;
        }
    }
    original_3_line_hashes
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L117-L158, every candidate mapping from a modified three-line window to
/// matching original windows, extending the previous window's mapping where
/// it continues it. `None` is the timeout exit at L155-L157 (VS Code returns
/// no moves). The per-change body (L127-L153) is
/// [`add_possible_mappings_for_change`].
fn compute_possible_mappings(
    changes: &[&DetailedLineRangeMapping],
    original_3_line_hashes: &HashMap<(u32, u32, u32), Vec<LineRange>>,
    hashed_modified_lines: &[u32],
    timeout: &mut dyn ITimeout,
) -> Option<Vec<PossibleMapping>> {
    let mut possible_mappings = Vec::new();
    for change in changes {
        add_possible_mappings_for_change(
            change.modified,
            original_3_line_hashes,
            hashed_modified_lines,
            &mut possible_mappings,
        );
        if !timeout.is_valid() {
            return None;
        }
    }
    Some(possible_mappings)
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// the body of the `for (const change of changes)` loop at L127-L153, for a
/// change whose modified range is `modified`. `last_mappings` (L127) holds
/// indices into `possible_mappings`, which later windows extend in place.
fn add_possible_mappings_for_change(
    modified: LineRange,
    original_3_line_hashes: &HashMap<(u32, u32, u32), Vec<LineRange>>,
    hashed_modified_lines: &[u32],
    possible_mappings: &mut Vec<PossibleMapping>,
) {
    let mut last_mappings: Vec<usize> = Vec::new();
    let mut i = modified.start_line_number;
    while i + 2 < modified.end_line_number_exclusive {
        let key = three_line_key(hashed_modified_lines, i);
        let original_ranges = original_3_line_hashes
            .get(&key)
            .map_or(&[][..], Vec::as_slice);
        last_mappings = match_modified_window(
            LineRange::new(i, i + 3),
            original_ranges,
            &last_mappings,
            possible_mappings,
        );
        i += 1;
    }
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L132-L152, the `original3LineHashes.forEach` over the original windows
/// that match one modified window. Returns the mappings (indices) it touched,
/// in order, as `nextMappings`; the callback's `return` at L141 is the
/// `if let` / `else` here.
fn match_modified_window(
    current_modified_range: LineRange,
    original_ranges: &[LineRange],
    last_mappings: &[usize],
    possible_mappings: &mut Vec<PossibleMapping>,
) -> Vec<usize> {
    let mut next_mappings = Vec::new();
    for &range in original_ranges {
        // does this match extend some last match?
        let extended = last_mappings.iter().copied().find(|&m| {
            let last = &possible_mappings[m];
            last.original_line_range.end_line_number_exclusive + 1
                == range.end_line_number_exclusive
                && last.modified_line_range.end_line_number_exclusive + 1
                    == current_modified_range.end_line_number_exclusive
        });
        if let Some(m) = extended {
            let last = &mut possible_mappings[m];
            last.original_line_range = LineRange::new(
                last.original_line_range.start_line_number,
                range.end_line_number_exclusive,
            );
            last.modified_line_range = LineRange::new(
                last.modified_line_range.start_line_number,
                current_modified_range.end_line_number_exclusive,
            );
            next_mappings.push(m);
        } else {
            possible_mappings.push(PossibleMapping {
                modified_line_range: current_modified_range,
                original_line_range: range,
            });
            next_mappings.push(possible_mappings.len() - 1);
        }
    }
    next_mappings
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L160-L187, longest candidates first (a stable sort, like V8's), each
/// reduced to the parts not yet in a move on either side, kept when 3+ lines
/// remain, then the moves sorted by original start. Returns the moves and the
/// sets of lines they cover.
fn select_moves(mut possible_mappings: Vec<PossibleMapping>) -> (Vec<LineRangeMapping>, MovedSets) {
    let mut moves = Vec::new();
    possible_mappings.sort_by(|a, b| {
        b.modified_line_range
            .length()
            .cmp(&a.modified_line_range.length())
    });

    let mut sets = MovedSets::default();
    for mapping in &possible_mappings {
        let diff_orig_to_mod = i64::from(mapping.modified_line_range.start_line_number)
            - i64::from(mapping.original_line_range.start_line_number);
        let modified_sections = sets.modified.subtract_from(mapping.modified_line_range);
        let original_translated_sections = sets
            .original
            .subtract_from(mapping.original_line_range)
            .get_with_delta(diff_orig_to_mod);
        let modified_intersected_sections =
            modified_sections.get_intersection(&original_translated_sections);
        for &s in modified_intersected_sections.ranges() {
            if s.length() < 3 {
                continue;
            }
            let original_line_range = s.delta(-diff_orig_to_mod);
            moves.push(LineRangeMapping::new(original_line_range, s));
            sets.modified.add_range(s);
            sets.original.add_range(original_line_range);
        }
    }

    moves.sort_by_key(|m| m.original.start_line_number);
    (moves, sets)
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L189-L254, the loop that grows each move over neighboring similar lines,
/// replacing it in `moves`. `changes` is sorted by modified start (L124); one
/// [`MonotonousArray`] serves every move (L189). Per move: the touching-change
/// extents (L190-L204, [`lines_around_move`]) and the two extensions
/// (L206-L252, [`extend_move`]).
fn extend_moves(
    moves: &mut [LineRangeMapping],
    changes: &[&DetailedLineRangeMapping],
    lines: (&TextModel, &TextModel),
    sets: &mut MovedSets,
    timeout: &mut dyn ITimeout,
) {
    let mut monotonous_changes = MonotonousArray::new(changes);
    for mv in moves {
        let (lines_above, lines_below) = lines_around_move(mv, changes, &mut monotonous_changes);
        extend_move(mv, lines_above, lines_below, lines, sets, timeout);
    }
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L190-L204, how many lines `linesAbove` (L194-L197) and `linesBelow`
/// (L201-L204) the changes touching `mv` reach beyond it. VS Code's `!` on the
/// searches becomes a panic if no change touches the move.
fn lines_around_move(
    mv: &LineRangeMapping,
    changes: &[&DetailedLineRangeMapping],
    monotonous_changes: &mut MonotonousArray<'_, &DetailedLineRangeMapping>,
) -> (i64, i64) {
    const NO_CHANGE: &str = "a change touches every move (`!` in VS Code)";
    let (original, modified) = (mv.original, mv.modified);
    let first_touching_change_orig = changes[monotonous_changes
        .find_last_monotonous(|c| c.original.start_line_number <= original.start_line_number)
        .expect(NO_CHANGE)];
    let first_touching_change_mod = find_last_monotonous(changes, |c| {
        c.modified.start_line_number <= modified.start_line_number
    })
    .expect(NO_CHANGE);
    let lines_above = (i64::from(original.start_line_number)
        - i64::from(first_touching_change_orig.original.start_line_number))
    .max(
        i64::from(modified.start_line_number)
            - i64::from(first_touching_change_mod.modified.start_line_number),
    );

    let last_touching_change_orig = changes[monotonous_changes
        .find_last_monotonous(|c| c.original.start_line_number < original.end_line_number_exclusive)
        .expect(NO_CHANGE)];
    let last_touching_change_mod = find_last_monotonous(changes, |c| {
        c.modified.start_line_number < modified.end_line_number_exclusive
    })
    .expect(NO_CHANGE);
    let lines_below = (i64::from(last_touching_change_orig.original.end_line_number_exclusive)
        - i64::from(original.end_line_number_exclusive))
    .max(
        i64::from(last_touching_change_mod.modified.end_line_number_exclusive)
            - i64::from(modified.end_line_number_exclusive),
    );
    (lines_above, lines_below)
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255):
/// L206-L251, extending one move up (L206-L224) and down (L226-L244) over
/// similar lines ([`count_similar_lines`]), recording the new lines in the
/// sets and replacing the move (L246-L251).
fn extend_move(
    mv: &mut LineRangeMapping,
    lines_above: i64,
    lines_below: i64,
    lines: (&TextModel, &TextModel),
    sets: &mut MovedSets,
    timeout: &mut dyn ITimeout,
) {
    let (original, modified) = (mv.original, mv.modified);
    let (o_start, o_end) = (
        i64::from(original.start_line_number),
        i64::from(original.end_line_number_exclusive),
    );
    let (m_start, m_end) = (
        i64::from(modified.start_line_number),
        i64::from(modified.end_line_number_exclusive),
    );
    let extend_to_top = count_similar_lines(
        lines_above,
        |n| (o_start - n - 1, m_start - n - 1),
        lines,
        sets,
        timeout,
    );
    if extend_to_top > 0 {
        sets.original.add_range(LineRange::new(
            (o_start - extend_to_top) as u32,
            original.start_line_number,
        ));
        sets.modified.add_range(LineRange::new(
            (m_start - extend_to_top) as u32,
            modified.start_line_number,
        ));
    }
    let extend_to_bottom = count_similar_lines(
        lines_below,
        |n| (o_end + n, m_end + n),
        lines,
        sets,
        timeout,
    );
    if extend_to_bottom > 0 {
        sets.original.add_range(LineRange::new(
            original.end_line_number_exclusive,
            (o_end + extend_to_bottom) as u32,
        ));
        sets.modified.add_range(LineRange::new(
            modified.end_line_number_exclusive,
            (m_end + extend_to_bottom) as u32,
        ));
    }
    if extend_to_top > 0 || extend_to_bottom > 0 {
        *mv = LineRangeMapping::new(
            LineRange::new(
                (o_start - extend_to_top) as u32,
                (o_end + extend_to_bottom) as u32,
            ),
            LineRange::new(
                (m_start - extend_to_top) as u32,
                (m_end + extend_to_bottom) as u32,
            ),
        );
    }
}

/// Split from `computeUnchangedMoves` (`computeMovedLines.ts` L98-L255): the
/// body shared by the two extension loops, `extendToTop` (L207-L219) and
/// `extendToBottom` (L227-L239): how many lines, up to `limit`, can join a
/// move. `line_numbers_at(n)` gives the original and modified line (1-based)
/// at step `n` (L208-L209, L228-L229).
fn count_similar_lines(
    limit: i64,
    line_numbers_at: impl Fn(i64) -> (i64, i64),
    (original_lines, modified_lines): (&TextModel, &TextModel),
    sets: &MovedSets,
    timeout: &mut dyn ITimeout,
) -> i64 {
    let contains =
        |set: &LineRangeSet, line: i64| u32::try_from(line).is_ok_and(|l| set.contains(l));
    let mut extend = 0;
    while extend < limit {
        let (orig_line, mod_line) = line_numbers_at(extend);
        if orig_line > i64::from(original_lines.line_count())
            || mod_line > i64::from(modified_lines.line_count())
        {
            break;
        }
        if contains(&sets.modified, mod_line) || contains(&sets.original, orig_line) {
            break;
        }
        // A line below 1 is `undefined` in VS Code, and `undefined.trim()` throws.
        assert!(orig_line >= 1 && mod_line >= 1, "TypeError: undefined line");
        if !are_lines_similar(
            original_lines.utf16_line(orig_line as u32),
            modified_lines.utf16_line(mod_line as u32),
            timeout,
        ) {
            break;
        }
        extend += 1;
    }
    extend
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diff_algorithm::InfiniteTimeout;

    fn u(s: &str) -> Vec<u16> {
        s.encode_utf16().collect()
    }
    fn similar(a: &str, b: &str) -> bool {
        are_lines_similar(&u(a), &u(b), &mut InfiniteTimeout)
    }

    #[test]
    fn trim_uses_the_javascript_set() {
        assert_eq!(trim(&u(" \t\u{a0}x y\u{3000}\u{feff}")), u("x y"));
        assert_eq!(trim(&u("  \t")), u(""));
        assert_eq!(trim(&u("")), u(""));
    }

    #[test]
    fn lines_are_similar_when_they_share_most_non_space_characters() {
        assert!(similar("  foo(bar, baz);", "foo(bar, baz);   "));
        assert!(similar(
            "const value = compute(a, b);",
            "const value = compute(a, c);"
        ));
        assert!(!similar("short", "tiny"));
        assert!(!similar("abc", "xyz"));
        let long1 = "a".repeat(301);
        assert!(!similar(&long1, &format!("{long1}b")));
    }

    fn lr(a: u32, b: u32, c: u32, d: u32) -> LineRangeMapping {
        use crate::line_range::LineRange;
        LineRangeMapping::new(LineRange::new(a, b), LineRange::new(c, d))
    }

    #[test]
    fn close_consecutive_moves_are_joined() {
        let moves = vec![
            lr(20, 24, 40, 44),
            lr(1, 5, 10, 14),
            lr(6, 8, 15, 17),
            lr(24, 25, 50, 51),
        ];
        // sorted by original start: [1,5)->[10,14) and [6,8)->[15,17) are one
        // line apart on each side (distance 2), so they join; the rest do not.
        let joined = join_close_consecutive_moves(moves);
        assert_eq!(
            joined,
            vec![lr(1, 8, 10, 17), lr(20, 24, 40, 44), lr(24, 25, 50, 51)]
        );
        assert!(join_close_consecutive_moves(Vec::new()).is_empty());
        // A move before the last one in modified order never joins.
        let joined = join_close_consecutive_moves(vec![lr(1, 3, 10, 12), lr(3, 5, 4, 6)]);
        assert_eq!(joined.len(), 2);
    }

    #[test]
    fn moves_inside_one_change_are_dropped() {
        use crate::line_range::LineRange;
        let change = |a, b, c, d| {
            DetailedLineRangeMapping::new(LineRange::new(a, b), LineRange::new(c, d), None)
        };
        let changes = vec![change(2, 4, 2, 4), change(10, 12, 20, 25)];
        // Moves come sorted by original start. The last has both ends in
        // change 1: dropped. The second has its original end in change 0 and
        // its modified end in change 1: kept. The first has no change before
        // its original end: kept.
        let moves = vec![lr(1, 2, 1, 2), lr(3, 4, 22, 24), lr(10, 11, 21, 22)];
        assert_eq!(
            remove_moves_in_same_diff(&changes, moves),
            vec![lr(1, 2, 1, 2), lr(3, 4, 22, 24)]
        );
    }

    fn model(lines: &[&str]) -> TextModel {
        TextModel::from_lines(lines.iter().map(|l| l.to_string()).collect())
    }

    #[test]
    fn a_deleted_block_matches_the_most_similar_inserted_block() {
        use crate::line_range::LineRange;
        let original = model(&[
            "keep",
            "alpha one",
            "alpha two",
            "alpha three",
            "keep too",
            "z",
        ]);
        let modified = model(&[
            "keep",
            "keep too",
            "beta",
            "beta",
            "beta",
            "alpha one",
            "alpha two",
            "alpha three",
            "z",
        ]);
        let change = |a, b, c, d| {
            DetailedLineRangeMapping::new(LineRange::new(a, b), LineRange::new(c, d), None)
        };
        let changes = vec![change(2, 5, 2, 2), change(6, 6, 3, 6), change(6, 6, 6, 9)];
        let (moves, excluded) = compute_moves_from_simple_deletions_to_simple_insertions(
            &changes,
            &original,
            &modified,
            &mut InfiniteTimeout,
        );
        assert_eq!(moves, vec![lr(2, 5, 6, 9)]);
        assert_eq!(excluded, [true, false, true]);
    }

    #[test]
    fn matching_three_line_windows_grow_into_one_move() {
        use crate::line_range::LineRange;
        let change = |a, b, c, d| {
            DetailedLineRangeMapping::new(LineRange::new(a, b), LineRange::new(c, d), None)
        };
        let (deleted, inserted) = (change(1, 5, 1, 1), change(9, 9, 5, 9));
        let moves = compute_unchanged_moves(
            vec![&inserted, &deleted], // sorted by modified start inside
            &[1, 2, 3, 4, 5, 6, 7, 8],
            &[5, 6, 7, 8, 1, 2, 3, 4],
            &model(&["a", "b", "c", "d", "e", "f", "g", "h"]),
            &model(&["e", "f", "g", "h", "a", "b", "c", "d"]),
            &mut InfiniteTimeout,
        );
        assert_eq!(moves, vec![lr(1, 5, 5, 9)]);
    }

    #[test]
    fn a_moved_block_is_found_and_short_ones_are_ignored() {
        use crate::line_range::LineRange;
        let change = |a, b, c, d| {
            DetailedLineRangeMapping::new(LineRange::new(a, b), LineRange::new(c, d), None)
        };
        let names = [
            "head one",
            "head two",
            "moved first line",
            "moved second line",
            "moved third line",
            "moved fourth line",
            "tail one",
            "tail two",
        ];
        let original = model(&names);
        let modified = model(&[
            names[0], names[1], names[6], names[7], names[2], names[3], names[4], names[5],
        ]);
        let (h_orig, h_mod) = ([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 7, 8, 3, 4, 5, 6]);
        let changes = vec![change(3, 7, 3, 3), change(9, 9, 5, 9)];
        let moves = compute_moved_lines(
            &changes,
            &original,
            &modified,
            &h_orig,
            &h_mod,
            &mut InfiniteTimeout,
        );
        assert_eq!(moves, vec![lr(3, 7, 5, 9)]);

        // The same shape with tiny lines is below 15 characters: no move.
        let tiny = model(&["a", "b", "c", "d"]);
        let tiny_mod = model(&["c", "d", "a", "b"]);
        let changes = vec![change(1, 3, 1, 1), change(5, 5, 3, 5)];
        let none = compute_moved_lines(
            &changes,
            &tiny,
            &tiny_mod,
            &[1, 2, 3, 4],
            &[3, 4, 1, 2],
            &mut InfiniteTimeout,
        );
        assert!(none.is_empty());
    }

    /// `limit` successful `isValid` calls, then every call fails (-1: never).
    struct CountingTimeout {
        limit: i64,
        calls: i64,
    }
    impl ITimeout for CountingTimeout {
        fn is_valid(&mut self) -> bool {
            let valid = self.limit < 0 || self.calls < self.limit;
            self.calls += 1;
            valid
        }
    }

    fn parse_lines(field: &str) -> TextModel {
        let lines = field.split('|').map(|line| {
            let units: Vec<u16> = line
                .split(',')
                .filter(|u| !u.is_empty())
                .map(|u| u16::from_str_radix(u, 16).unwrap())
                .collect();
            String::from_utf16(&units).unwrap()
        });
        TextModel::from_lines(lines.collect())
    }

    fn parse_numbers(field: &str) -> Vec<u32> {
        field
            .split(',')
            .filter(|n| !n.is_empty())
            .map(|n| n.parse().unwrap())
            .collect()
    }

    /// `os,oe,ms,me` groups separated by spaces.
    fn parse_mappings(field: &str) -> Vec<LineRangeMapping> {
        field
            .split(' ')
            .filter(|g| !g.is_empty())
            .map(|g| {
                let n = parse_numbers(g);
                lr(n[0], n[1], n[2], n[3])
            })
            .collect()
    }

    /// The expected values come from running VS Code's TypeScript: see
    /// `tests/oracle/gen-compute-moved-lines.mjs`.
    #[test]
    fn matches_vscode_on_the_oracle_corpus() {
        let (mut cases, mut with_moves, mut throws) = (0, 0, 0);
        for line in include_str!("../tests/data/compute-moved-lines-oracle.txt").lines() {
            if line.starts_with('#') {
                continue;
            }
            let f: Vec<&str> = line.split(';').collect();
            assert_eq!(f.len(), 7, "{line}");
            let (original, modified) = (parse_lines(f[0]), parse_lines(f[1]));
            let (h_original, h_modified) = (parse_numbers(f[2]), parse_numbers(f[3]));
            let changes: Vec<DetailedLineRangeMapping> = parse_mappings(f[4])
                .into_iter()
                .map(|m| DetailedLineRangeMapping::new(m.original, m.modified, None))
                .collect();
            let limit: i64 = f[5].parse().unwrap();
            let run = || {
                let mut timeout = CountingTimeout { limit, calls: 0 };
                compute_moved_lines(
                    &changes,
                    &original,
                    &modified,
                    &h_original,
                    &h_modified,
                    &mut timeout,
                )
            };
            let ctx = format!("case {cases}: {line}");
            if f[6] == "THROW" {
                throws += 1;
                assert!(
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(run)).is_err(),
                    "{ctx}"
                );
            } else {
                let moves = run();
                with_moves += usize::from(!moves.is_empty());
                assert_eq!(moves, parse_mappings(f[6]), "{ctx}");
            }
            cases += 1;
        }
        assert!(
            cases > 600 && with_moves > 250 && throws > 0,
            "{cases} {with_moves} {throws}"
        );
    }
}
