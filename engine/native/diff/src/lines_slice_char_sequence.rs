// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/linesSliceCharSequence.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// Exactness: elements are UTF-16 code units (`charCodeAt`), so an astral
// character is two elements and every offset and column counts units. `trim`
// uses JavaScript's whitespace set, not Rust's. The `lines` argument is the
// UTF-16 text model of the original lines; the TypeScript's public `lines`
// field has no reader outside the constructor, so it is not kept.
use crate::diff_algorithm::ISequence;
use crate::range::Range;
use crate::text::TextModel;
use crate::utils::is_space;

/// The characters of a range of lines as one sequence, with `\n` between lines.
pub struct LinesSliceCharSequence {
    elements: Vec<u16>,
    first_element_offset_by_line_idx: Vec<u32>,
    line_start_offsets: Vec<u32>,
    trimmed_ws_lengths_by_line_idx: Vec<u32>,
}

/// `String.prototype.trim`'s set: WhiteSpace and LineTerminator (ECMAScript).
fn is_js_whitespace(unit: u16) -> bool {
    matches!(
        unit,
        0x09..=0x0D | 0x20 | 0xA0 | 0x1680 | 0x2000..=0x200A | 0x2028 | 0x2029 | 0x202F | 0x205F
            | 0x3000 | 0xFEFF
    )
}

impl LinesSliceCharSequence {
    /// Panics where the TypeScript throws: a line number outside `lines`.
    pub fn new(lines: &TextModel, range: Range, consider_whitespace_changes: bool) -> Self {
        let mut seq = Self {
            elements: Vec::new(),
            first_element_offset_by_line_idx: vec![0],
            line_start_offsets: Vec::new(),
            trimmed_ws_lengths_by_line_idx: Vec::new(),
        };
        for line_number in range.start_line_number..=range.end_line_number {
            let mut line = lines.utf16_line(line_number);
            let mut line_start_offset = 0;
            if line_number == range.start_line_number && range.start_column > 1 {
                line_start_offset = range.start_column - 1;
                // `substring` clamps its start to the string.
                line = &line[(line_start_offset as usize).min(line.len())..];
            }
            seq.line_start_offsets.push(line_start_offset);

            let mut trimmed_ws_length = 0;
            if !consider_whitespace_changes {
                let leading = line.iter().take_while(|&&u| is_js_whitespace(u)).count();
                trimmed_ws_length = leading as u32;
                line = &line[leading..];
                let end = line
                    .iter()
                    .rposition(|&u| !is_js_whitespace(u))
                    .map_or(0, |i| i + 1);
                line = &line[..end];
            }
            seq.trimmed_ws_lengths_by_line_idx.push(trimmed_ws_length);

            let line_length = if line_number == range.end_line_number {
                // May be negative, which makes the copy loop run zero times.
                let wanted = i64::from(range.end_column)
                    - 1
                    - i64::from(line_start_offset)
                    - i64::from(trimmed_ws_length);
                wanted.min(line.len() as i64).max(0) as usize
            } else {
                line.len()
            };
            seq.elements.extend_from_slice(&line[..line_length]);

            if line_number < range.end_line_number {
                seq.elements.push(u16::from(b'\n'));
                seq.first_element_offset_by_line_idx
                    .push(seq.elements.len() as u32);
            }
        }
        seq
    }
}

const CHAR_A: u32 = 97;
const CHAR_Z: u32 = 122;
const CHAR_UPPER_A: u32 = 65;
const CHAR_UPPER_Z: u32 = 90;
const CHAR_0: u32 = 48;
const CHAR_9: u32 = 57;

/// `CharBoundaryCategory`; the discriminants are never compared, only matched.
#[derive(Clone, Copy, PartialEq, Eq)]
enum CharBoundaryCategory {
    WordLower,
    WordUpper,
    WordNumber,
    End,
    Other,
    Separator,
    Space,
    LineBreakCr,
    LineBreakLf,
}

impl CharBoundaryCategory {
    fn boundary_score(self) -> f64 {
        match self {
            Self::WordLower | Self::WordUpper | Self::WordNumber => 0.0,
            Self::End | Self::LineBreakCr | Self::LineBreakLf => 10.0,
            Self::Other => 2.0,
            Self::Separator => 30.0,
            Self::Space => 3.0,
        }
    }

    /// `getCategory`; `None` is the TypeScript's `-1`, the end of the sequence.
    fn of(char_code: Option<u32>) -> Self {
        let Some(code) = char_code else {
            return Self::End;
        };
        match code {
            10 => Self::LineBreakLf,
            13 => Self::LineBreakCr,
            _ if is_space(code) => Self::Space,
            CHAR_A..=CHAR_Z => Self::WordLower,
            CHAR_UPPER_A..=CHAR_UPPER_Z => Self::WordUpper,
            CHAR_0..=CHAR_9 => Self::WordNumber,
            44 | 59 => Self::Separator, // ',' and ';'
            _ => Self::Other,
        }
    }
}

impl LinesSliceCharSequence {
    /// `getBoundaryScore`: how good a place `length` is to split the sequence.
    pub fn boundary_score(&self, length: u32) -> f64 {
        let at = |i: usize| self.elements.get(i).map(|&u| u32::from(u));
        let prev = CharBoundaryCategory::of(length.checked_sub(1).and_then(|i| at(i as usize)));
        let next = CharBoundaryCategory::of(at(length as usize));

        if prev == CharBoundaryCategory::LineBreakCr && next == CharBoundaryCategory::LineBreakLf {
            return 0.0; // don't break between \r and \n
        }
        if prev == CharBoundaryCategory::LineBreakLf {
            return 150.0; // prefer the linebreak before the change
        }
        let mut score = 0.0;
        if prev != next {
            score += 10.0;
            if prev == CharBoundaryCategory::WordLower && next == CharBoundaryCategory::WordUpper {
                score += 1.0;
            }
        }
        score + prev.boundary_score() + next.boundary_score()
    }
}

impl ISequence for LinesSliceCharSequence {
    fn get_element(&self, offset: u32) -> u32 {
        u32::from(self.elements[offset as usize])
    }

    fn length(&self) -> u32 {
        self.elements.len() as u32
    }

    /// `elements[offset1] === elements[offset2]`; two offsets past the end are
    /// both `undefined` and so equal, as in the TypeScript.
    fn get_boundary_score(&self, length: u32) -> Option<f64> {
        Some(self.boundary_score(length))
    }

    fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool {
        self.elements.get(offset1 as usize) == self.elements.get(offset2 as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seq(lines: &[&str], range: Range, ws: bool) -> LinesSliceCharSequence {
        let model = TextModel::from_lines(lines.iter().map(|l| l.to_string()).collect());
        LinesSliceCharSequence::new(&model, range, ws)
    }

    fn elements(s: &LinesSliceCharSequence) -> Vec<u32> {
        (0..s.length()).map(|i| s.get_element(i)).collect()
    }

    #[test]
    fn elements_of_a_slice() {
        let s = seq(&["  ab ", "c"], Range::new(1, 1, 2, 2), true);
        assert_eq!(elements(&s), [32, 32, 97, 98, 32, 10, 99]);
        let s = seq(&["  ab ", "c"], Range::new(1, 1, 2, 2), false);
        assert_eq!(elements(&s), [97, 98, 10, 99]);
        // A start column cuts the first line; an end column cuts the last.
        let s = seq(&["xyzw", "abcd"], Range::new(1, 3, 2, 3), true);
        assert_eq!(elements(&s), [122, 119, 10, 97, 98]);
    }

    #[test]
    fn elements_are_utf16_units() {
        // U+1F600 is a surrogate pair: two elements, and columns count units.
        let s = seq(&["a\u{1F600}b"], Range::new(1, 1, 1, 5), true);
        assert_eq!(elements(&s), [97, 0xD83D, 0xDE00, 98]);
        let s = seq(&["a\u{1F600}b"], Range::new(1, 1, 1, 3), true);
        assert_eq!(elements(&s), [97, 0xD83D]);
    }

    #[test]
    fn js_trim_set() {
        let s = seq(
            &["\u{A0}\u{3000}\u{FEFF}x\u{2028} "],
            Range::new(1, 1, 1, 100),
            false,
        );
        assert_eq!(elements(&s), [120]);
        assert!(!is_js_whitespace(0x85) && !is_js_whitespace(0x200B));
    }

    fn scores(s: &LinesSliceCharSequence) -> Vec<f64> {
        (0..=s.length()).map(|i| s.boundary_score(i)).collect()
    }

    #[test]
    fn boundary_scores() {
        let s = seq(&["ab,Cd", "x"], Range::new(1, 1, 2, 2), true);
        // Elements: a b , C d \n x (the end counts as a category).
        assert_eq!(scores(&s), [20.0, 0.0, 40.0, 40.0, 10.0, 20.0, 150.0, 20.0]);
        assert_eq!(s.get_boundary_score(2), Some(40.0));
        let s = seq(&["aB"], Range::new(1, 1, 1, 3), true);
        assert_eq!(scores(&s), [20.0, 11.0, 20.0]);
        // Never between a carriage return and the line feed that follows it.
        let s = seq(&["a\r", "b"], Range::new(1, 1, 2, 2), true);
        assert_eq!(scores(&s), [20.0, 20.0, 0.0, 150.0, 20.0]);
    }
}
