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
use crate::diff_algorithm::{IDiffAlgorithm, ITimeout, SequenceDiff};
use crate::lines_slice_char_sequence::{is_js_whitespace, LinesSliceCharSequence};
use crate::myers_diff_algorithm::MyersDiffAlgorithm;
use crate::range::Range;
use crate::text::TextModel;
use crate::utils::is_space;

/// `String.prototype.trim` on UTF-16 units.
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

pub fn are_lines_similar(line1: &[u16], line2: &[u16], timeout: &mut dyn ITimeout) -> bool {
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
}
