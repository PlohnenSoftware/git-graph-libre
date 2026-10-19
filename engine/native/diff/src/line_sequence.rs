// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/lineSequence.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
//
// The line identities (`trimmed_hash`) are numbered by the caller, as
// `defaultLinesDiffComputer.ts` numbers them with a `Map` in order of first
// occurrence of each trimmed line; this type only holds them.
use crate::diff_algorithm::ISequence;
use crate::offset_range::OffsetRange;

/// A sequence of lines: each element is the identity of a trimmed line.
pub struct LineSequence<'a> {
    trimmed_hash: &'a [u32],
    lines: &'a [String],
}

impl<'a> LineSequence<'a> {
    pub fn new(trimmed_hash: &'a [u32], lines: &'a [String]) -> Self {
        Self {
            trimmed_hash,
            lines,
        }
    }

    pub fn get_text(&self, range: OffsetRange) -> String {
        let end = (range.end_exclusive as usize).min(self.lines.len());
        let start = (range.start as usize).min(end);
        self.lines[start..end].join("\n")
    }
}

impl ISequence for LineSequence<'_> {
    fn get_element(&self, offset: u32) -> u32 {
        self.trimmed_hash[offset as usize]
    }

    fn length(&self) -> u32 {
        self.trimmed_hash.len() as u32
    }

    fn get_boundary_score(&self, length: u32) -> Option<f64> {
        let length = length as usize;
        let before = if length == 0 {
            0
        } else {
            get_indentation(&self.lines[length - 1])
        };
        let after = if length == self.lines.len() {
            0
        } else {
            get_indentation(&self.lines[length])
        };
        Some(1000.0 - f64::from(before + after))
    }

    fn is_strongly_equal(&self, offset1: u32, offset2: u32) -> bool {
        self.lines[offset1 as usize] == self.lines[offset2 as usize]
    }
}

/// The number of leading spaces and tabs.
fn get_indentation(text: &str) -> u32 {
    text.bytes()
        .take_while(|&b| b == b' ' || b == b'\t')
        .count() as u32
}

#[cfg(test)]
mod tests {
    use super::LineSequence;
    use crate::diff_algorithm::ISequence;
    use crate::offset_range::OffsetRange;

    fn owned(lines: &[&str]) -> Vec<String> {
        lines.iter().map(ToString::to_string).collect()
    }

    // Expected values come from running VS Code's `LineSequence`.
    #[test]
    fn scores_boundaries_by_surrounding_indentation() {
        let lines = owned(&["{", "  if (x) {", "    y();", "  }", "}"]);
        let hashes = [0, 1, 2, 3, 3];
        let seq = LineSequence::new(&hashes, &lines);
        let scores: Vec<_> = (0..=5).map(|l| seq.get_boundary_score(l)).collect();
        assert_eq!(
            scores,
            [1000.0, 998.0, 994.0, 994.0, 998.0, 1000.0].map(Some)
        );
        assert_eq!(seq.length(), 5);
        assert_eq!(seq.get_element(4), 3);
    }

    #[test]
    fn strong_equality_compares_untrimmed_lines() {
        let lines = owned(&["a", " a", "a"]);
        let hashes = [0, 0, 0];
        let seq = LineSequence::new(&hashes, &lines);
        assert!(seq.is_strongly_equal(0, 2));
        assert!(!seq.is_strongly_equal(0, 1));
    }

    #[test]
    fn get_text_joins_lines_and_clamps_like_slice() {
        let lines = owned(&["a", "b", "c"]);
        let hashes = [0, 1, 2];
        let seq = LineSequence::new(&hashes, &lines);
        assert_eq!(seq.get_text(OffsetRange::new(1, 3)), "b\nc");
        assert_eq!(seq.get_text(OffsetRange::new(2, 9)), "c");
        assert_eq!(seq.get_text(OffsetRange::new(5, 6)), "");
    }

    fn unescape(text: &str) -> String {
        let mut out = String::new();
        let mut chars = text.chars();
        while let Some(c) = chars.next() {
            if c != '\\' {
                out.push(c);
                continue;
            }
            out.push(match chars.next().unwrap() {
                'c' => ';',
                'p' => '|',
                't' => '\t',
                'n' => '\n',
                other => other,
            });
        }
        out
    }

    fn list(field: &str) -> Vec<&str> {
        field.split(',').filter(|s| !s.is_empty()).collect()
    }

    /// One decoded oracle line: the line count `n`, the lines, the hashes and
    /// the expected score, strong-equality and text fields.
    struct OracleCase<'a> {
        n: usize,
        lines: Vec<String>,
        hashes: Vec<u32>,
        scores: &'a str,
        strong: &'a str,
        texts: &'a str,
    }

    /// Splits one oracle corpus line (`n:lines;hashes;scores;strong;texts`).
    /// Not part of the port: a test helper split from the corpus test (D22F).
    fn parse_case(line: &str) -> OracleCase<'_> {
        let mut parts = line.splitn(5, ';');
        let (head, hashes, scores, strong, texts) = (
            parts.next().unwrap(),
            parts.next().unwrap(),
            parts.next().unwrap(),
            parts.next().unwrap(),
            parts.next().unwrap(),
        );
        let (n, lines_field) = head.split_once(':').unwrap();
        let n: usize = n.parse().unwrap();
        let lines: Vec<String> = if n == 0 {
            Vec::new()
        } else {
            lines_field.split('|').map(unescape).collect()
        };
        let hashes: Vec<u32> = list(hashes).iter().map(|h| h.parse().unwrap()).collect();
        OracleCase {
            n,
            lines,
            hashes,
            scores,
            strong,
            texts,
        }
    }

    /// Checks `length`, `get_element` and `get_boundary_score` against a case.
    fn check_elements_and_scores(case: &OracleCase, line: &str) {
        let seq = LineSequence::new(&case.hashes, &case.lines);
        assert_eq!(seq.length() as usize, case.n, "{line}");
        for (i, &hash) in case.hashes.iter().enumerate() {
            assert_eq!(seq.get_element(i as u32), hash, "{line}");
        }
        let scores: Vec<f64> = list(case.scores)
            .iter()
            .map(|s| s.parse().unwrap())
            .collect();
        for (l, expected) in scores.iter().enumerate() {
            assert_eq!(seq.get_boundary_score(l as u32), Some(*expected), "{line}");
        }
    }

    /// Checks `is_strongly_equal` for every pair of lines of a case.
    fn check_strong_equality(case: &OracleCase, line: &str) {
        let seq = LineSequence::new(&case.hashes, &case.lines);
        let mut bits = case.strong.chars();
        for i in 0..case.n {
            for j in 0..case.n {
                let expected = bits.next() == Some('1');
                assert_eq!(
                    seq.is_strongly_equal(i as u32, j as u32),
                    expected,
                    "{line}"
                );
            }
        }
    }

    /// Checks `get_text` for every range of a case.
    fn check_texts(case: &OracleCase, line: &str) {
        let seq = LineSequence::new(&case.hashes, &case.lines);
        let mut expected_texts = case.texts.split('|');
        for start in 0..=case.n {
            for end in start..=case.n {
                let range = OffsetRange::new(start as u32, end as u32);
                let expected = unescape(expected_texts.next().unwrap());
                assert_eq!(seq.get_text(range), expected, "{line}");
            }
        }
        assert_eq!(expected_texts.next(), None, "{line}");
    }

    #[test]
    fn matches_vscode_on_the_oracle_corpus() {
        let mut cases = 0;
        for line in include_str!("../tests/data/line-sequence-oracle.txt").lines() {
            if line.starts_with('#') {
                continue;
            }
            let case = parse_case(line);
            check_elements_and_scores(&case, line);
            check_strong_equality(&case, line);
            check_texts(&case, line);
            cases += 1;
        }
        assert_eq!(cases, 90);
    }
}
