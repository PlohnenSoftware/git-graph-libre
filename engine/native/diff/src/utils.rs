// Ported from microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/utils.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8. Only `isSpace` is here so
// far; `Array2D` and `LineRangeFragment` arrive with the slices that use them.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.

const SPACE: u32 = 32;
const TAB: u32 = 9;

/// `isSpace`: a space or a tab, nothing else (a UTF-16 code unit, as a number).
pub fn is_space(char_code: u32) -> bool {
    char_code == SPACE || char_code == TAB
}

#[cfg(test)]
mod tests {
    use super::is_space;

    #[test]
    fn only_space_and_tab() {
        assert!(is_space(0x20) && is_space(0x09));
        for other in [0x0A, 0x0D, 0xA0, 0x3000, 0x2003, 0x41] {
            assert!(!is_space(other), "{other:#x}");
        }
    }
}
