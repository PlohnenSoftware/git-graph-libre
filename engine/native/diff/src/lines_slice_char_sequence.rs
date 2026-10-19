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
use crate::offset_range::OffsetRange;
use crate::position::Position;
use crate::range::Range;
use crate::text::TextModel;
use crate::utils::is_space;

/// The characters of a range of lines as one sequence, with `\n` between lines.
pub struct LinesSliceCharSequence {
    range: Range,
    elements: Vec<u16>,
    first_element_offset_by_line_idx: Vec<u32>,
    line_start_offsets: Vec<u32>,
    trimmed_ws_lengths_by_line_idx: Vec<u32>,
}

/// `String.prototype.trim`'s set: WhiteSpace and LineTerminator (ECMAScript).
pub(crate) fn is_js_whitespace(unit: u16) -> bool {
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
            range,
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

fn is_word_char(code: u32) -> bool {
    (CHAR_A..=CHAR_Z).contains(&code)
        || (CHAR_UPPER_A..=CHAR_UPPER_Z).contains(&code)
        || (CHAR_0..=CHAR_9).contains(&code)
}

fn is_upper_case(code: u32) -> bool {
    (CHAR_UPPER_A..=CHAR_UPPER_Z).contains(&code)
}

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

    /// `getCategory` for a real element.
    fn of(code: u32) -> Self {
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
        // `getCategory(length > 0 ? elements[length - 1] : -1)`: -1 is the end,
        // and a `length` past the end reads `undefined`, which is `Other`.
        let prev = match length.checked_sub(1) {
            None => CharBoundaryCategory::End,
            Some(i) => at(i as usize).map_or(CharBoundaryCategory::Other, CharBoundaryCategory::of),
        };
        let next = at(length as usize).map_or(CharBoundaryCategory::End, CharBoundaryCategory::of);

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

/// `translateOffset`'s `preference`.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Preference {
    Left,
    Right,
}

impl LinesSliceCharSequence {
    /// Maps an element offset back to a position in the original lines.
    pub fn translate_offset(&self, offset: u32, preference: Preference) -> Position {
        // The last line whose first element is at or before `offset`; the
        // offsets are strictly increasing and the first is 0.
        let i = self
            .first_element_offset_by_line_idx
            .partition_point(|&value| value <= offset)
            - 1;
        let line_offset = offset - self.first_element_offset_by_line_idx[i];
        let trimmed = if line_offset == 0 && preference == Preference::Left {
            0
        } else {
            self.trimmed_ws_lengths_by_line_idx[i]
        };
        Position::new(
            self.range.start_line_number + i as u32,
            1 + self.line_start_offsets[i] + line_offset + trimmed,
        )
    }

    pub fn translate_range(&self, range: OffsetRange) -> Range {
        let pos1 = self.translate_offset(range.start, Preference::Right);
        let pos2 = self.translate_offset(range.end_exclusive, Preference::Left);
        if pos2 < pos1 {
            return Range::from_positions(pos2, pos2);
        }
        Range::from_positions(pos1, pos2)
    }

    pub fn count_lines_in(&self, range: OffsetRange) -> u32 {
        self.translate_offset(range.end_exclusive, Preference::Right)
            .line_number
            - self
                .translate_offset(range.start, Preference::Right)
                .line_number
    }

    pub fn extend_to_full_lines(&self, range: OffsetRange) -> OffsetRange {
        let offsets = &self.first_element_offset_by_line_idx;
        // findLastMonotonous(x <= start) ?? 0
        let start = offsets
            .partition_point(|&x| x <= range.start)
            .checked_sub(1)
            .map_or(0, |i| offsets[i]);
        // findFirstMonotonous(end <= x) ?? elements.length
        let end = offsets
            .get(offsets.partition_point(|&x| x < range.end_exclusive))
            .copied()
            .unwrap_or(self.elements.len() as u32);
        OffsetRange::new(start, end)
    }
}

impl LinesSliceCharSequence {
    /// `getText`, as UTF-16 units: a range may split a surrogate pair, which a
    /// Rust `String` cannot hold, and the callers only trim and measure it.
    pub fn get_text(&self, range: OffsetRange) -> Vec<u16> {
        self.elements[range.start as usize..range.end_exclusive as usize].to_vec()
    }

    /// `text`: the whole sequence.
    pub fn text(&self) -> Vec<u16> {
        self.elements.clone()
    }

    fn is_word_at(&self, offset: usize) -> bool {
        is_word_char(u32::from(self.elements[offset]))
    }

    fn is_upper_at(&self, offset: usize) -> bool {
        is_upper_case(u32::from(self.elements[offset]))
    }

    /// The word that contains the element at `offset`.
    pub fn find_word_containing(&self, offset: i64) -> Option<OffsetRange> {
        if offset < 0 || offset >= self.elements.len() as i64 {
            return None;
        }
        let offset = offset as usize;
        if !self.is_word_at(offset) {
            return None;
        }
        let mut start = offset;
        while start > 0 && self.is_word_at(start - 1) {
            start -= 1;
        }
        let mut end = offset;
        while end < self.elements.len() && self.is_word_at(end) {
            end += 1;
        }
        Some(OffsetRange::new(start as u32, end as u32))
    }

    /// `fooBar` has the two sub-words `foo` and `bar`. Like the TypeScript, it
    /// tests the uppercase rule on the element at `start`/`end` themselves, so
    /// an uppercase `offset` gives an empty range.
    pub fn find_sub_word_containing(&self, offset: i64) -> Option<OffsetRange> {
        if offset < 0 || offset >= self.elements.len() as i64 {
            return None;
        }
        let offset = offset as usize;
        if !self.is_word_at(offset) {
            return None;
        }
        let mut start = offset;
        while start > 0 && self.is_word_at(start - 1) && !self.is_upper_at(start) {
            start -= 1;
        }
        let mut end = offset;
        while end < self.elements.len() && self.is_word_at(end) && !self.is_upper_at(end) {
            end += 1;
        }
        Some(OffsetRange::new(start as u32, end as u32))
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
        // Past the end, the previous element reads `undefined`: category Other.
        assert_eq!(s.boundary_score(3), 22.0);
        // Never between a carriage return and the line feed that follows it.
        let s = seq(&["a\r", "b"], Range::new(1, 1, 2, 2), true);
        assert_eq!(scores(&s), [20.0, 20.0, 0.0, 150.0, 20.0]);
    }

    fn pos(s: &LinesSliceCharSequence, offset: u32, pref: Preference) -> (u32, u32) {
        let p = s.translate_offset(offset, pref);
        (p.line_number, p.column)
    }

    #[test]
    fn translating_offsets_and_ranges() {
        // Elements: a b \n c d (the margins are trimmed off).
        let lines = ["  ab", "  cd  "];
        let s = seq(&lines, Range::new(1, 1, 2, 100), false);
        assert_eq!(pos(&s, 0, Preference::Right), (1, 3));
        assert_eq!(pos(&s, 0, Preference::Left), (1, 1));
        assert_eq!(pos(&s, 2, Preference::Right), (1, 5));
        assert_eq!(pos(&s, 3, Preference::Right), (2, 3));
        assert_eq!(pos(&s, 3, Preference::Left), (2, 1));
        assert_eq!(
            s.translate_range(OffsetRange::new(3, 5)),
            Range::new(2, 3, 2, 5)
        );
        assert_eq!(
            s.translate_range(OffsetRange::new(2, 3)),
            Range::new(1, 5, 2, 1)
        );
        // The end, translated to the left, lands before the start: collapse.
        assert_eq!(
            s.translate_range(OffsetRange::new(3, 3)),
            Range::new(2, 1, 2, 1)
        );
        assert_eq!(s.count_lines_in(OffsetRange::new(0, 5)), 1);
        assert_eq!(s.count_lines_in(OffsetRange::new(3, 5)), 0);
    }

    #[test]
    fn translating_in_a_cut_slice_and_past_an_emoji() {
        // The first line starts at column 3 ("\u{1F600}" is columns 2 and 3).
        let s = seq(&["a\u{1F600}bc", "d"], Range::new(1, 4, 2, 2), true);
        assert_eq!(elements(&s), [98, 99, 10, 100]);
        assert_eq!(pos(&s, 0, Preference::Right), (1, 4));
        assert_eq!(pos(&s, 2, Preference::Right), (1, 6));
        assert_eq!(pos(&s, 3, Preference::Right), (2, 1));
    }

    #[test]
    fn extending_to_full_lines() {
        let s = seq(&["  ab", "  cd  "], Range::new(1, 1, 2, 100), false);
        let extend = |a, b| s.extend_to_full_lines(OffsetRange::new(a, b));
        assert_eq!(extend(1, 2), OffsetRange::new(0, 3));
        assert_eq!(extend(3, 4), OffsetRange::new(3, 5));
        assert_eq!(extend(0, 0), OffsetRange::new(0, 0));
    }

    #[test]
    fn finding_words_and_sub_words() {
        let s = seq(&["fooBar baz1"], Range::new(1, 1, 1, 100), true);
        let word = |o| s.find_word_containing(o);
        let sub = |o| s.find_sub_word_containing(o);
        assert_eq!(word(0), Some(OffsetRange::new(0, 6)));
        assert_eq!(word(10), Some(OffsetRange::new(7, 11)));
        assert_eq!((word(6), word(-1), word(11)), (None, None, None));
        assert_eq!(sub(1), Some(OffsetRange::new(0, 3)));
        assert_eq!(sub(4), Some(OffsetRange::new(3, 6)));
        assert_eq!(sub(3), Some(OffsetRange::new(3, 3))); // uppercase: empty
        assert_eq!((sub(6), sub(-1), sub(11)), (None, None, None));
    }

    #[test]
    fn words_are_ascii_only_and_text_is_in_units() {
        // "e", a combining acute accent, an emoji, then "ab": only ASCII
        // letters and digits are word characters.
        let s = seq(&["e\u{301}\u{1F600}ab"], Range::new(1, 1, 1, 100), true);
        assert_eq!(s.length(), 6);
        assert_eq!(s.find_word_containing(0), Some(OffsetRange::new(0, 1)));
        assert_eq!(s.find_word_containing(1), None);
        assert_eq!(s.find_word_containing(2), None);
        assert_eq!(s.find_word_containing(4), Some(OffsetRange::new(4, 6)));
        assert_eq!(s.get_text(OffsetRange::new(2, 3)), [0xD83D]); // half a pair
        assert_eq!(s.text(), [101, 0x301, 0xD83D, 0xDE00, 97, 98]);
    }

    #[test]
    fn strong_equality_compares_units_and_the_undefined_past_the_end() {
        let s = seq(&["aba"], Range::new(1, 1, 1, 100), true);
        assert!(s.is_strongly_equal(0, 2) && !s.is_strongly_equal(0, 1));
        assert!(s.is_strongly_equal(5, 9)); // undefined === undefined
        assert!(!s.is_strongly_equal(0, 9));
    }

    fn parse_units(list: &str) -> Vec<u16> {
        list.split(',')
            .filter(|s| !s.is_empty())
            .map(|s| u16::from_str_radix(s, 16).unwrap())
            .collect()
    }

    fn num_pair(text: &str, sep: char) -> (u32, u32) {
        let (a, b) = text.split_once(sep).unwrap();
        (a.parse().unwrap(), b.parse().unwrap())
    }

    fn span(r: Option<OffsetRange>) -> String {
        r.map_or("x".to_string(), |r| {
            format!("{}-{}", r.start, r.end_exclusive)
        })
    }

    fn pos_str(p: Position) -> String {
        format!("{}:{}", p.line_number, p.column)
    }

    /// The expected values come from running VS Code's TypeScript: see
    /// `tests/oracle/gen-lines_slice_char_sequence.mjs`.
    #[test]
    fn matches_vscode_on_the_oracle_corpus() {
        let mut cases = 0;
        for line in include_str!("../tests/data/lines-slice-char-sequence-oracle.txt").lines() {
            if line.starts_with('#') {
                continue;
            }
            let f: Vec<&str> = line.split(';').collect();
            assert_eq!(f.len(), 9, "{line}");
            let lines: Vec<String> = f[0]
                .split('|')
                .map(|l| String::from_utf16(&parse_units(l)).unwrap())
                .collect();
            let r: Vec<u32> = f[1].split(',').map(|n| n.parse().unwrap()).collect();
            let s = LinesSliceCharSequence::new(
                &TextModel::from_lines(lines),
                Range::new(r[0], r[1], r[2], r[3]),
                f[2] == "1",
            );
            let ctx = format!("case {cases}: {line}");
            let len = s.length();

            let elements: Vec<String> = (0..len)
                .map(|i| format!("{:x}", s.get_element(i)))
                .collect();
            assert_eq!(elements.join(","), f[3], "elements, {ctx}");
            let scores: Vec<String> = (0..=len + 2)
                .map(|i| s.boundary_score(i).to_string())
                .collect();
            assert_eq!(scores.join(","), f[4], "scores, {ctx}");
            let translated: Vec<String> = (0..=len + 2)
                .map(|i| {
                    let (right, left) = (
                        s.translate_offset(i, Preference::Right),
                        s.translate_offset(i, Preference::Left),
                    );
                    format!("{}/{}", pos_str(right), pos_str(left))
                })
                .collect();
            assert_eq!(translated.join(" "), f[5], "translateOffset, {ctx}");
            let words: Vec<String> = (-1..=i64::from(len) + 1)
                .map(|i| {
                    format!(
                        "{}~{}",
                        span(s.find_word_containing(i)),
                        span(s.find_sub_word_containing(i))
                    )
                })
                .collect();
            assert_eq!(words.join(" "), f[6], "words, {ctx}");

            for query in f[7].split(' ') {
                let (range, expected) = query.split_once('=').unwrap();
                let (a, b) = num_pair(range, '-');
                let range = OffsetRange::new(a, b);
                let tr = s.translate_range(range);
                let text: Vec<String> =
                    s.get_text(range).iter().map(|u| format!("{u:x}")).collect();
                let got = format!(
                    "{},{},{},{}/{}/{}/{}",
                    tr.start_line_number,
                    tr.start_column,
                    tr.end_line_number,
                    tr.end_column,
                    s.count_lines_in(range),
                    span(Some(s.extend_to_full_lines(range))),
                    text.join(".")
                );
                assert_eq!(got, expected, "range {range}, {ctx}");
            }
            for pair in f[8].split(' ') {
                let (offsets, expected) = pair.split_once('=').unwrap();
                let (a, b) = num_pair(offsets, '-');
                assert_eq!(s.is_strongly_equal(a, b), expected == "1", "{pair}, {ctx}");
            }
            cases += 1;
        }
        assert_eq!(cases, 412);
    }
}
