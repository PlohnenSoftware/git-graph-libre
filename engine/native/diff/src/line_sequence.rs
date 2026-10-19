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
