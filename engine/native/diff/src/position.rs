// Ported from microsoft/vscode src/vs/editor/common/core/position.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.

/// A position in the editor (1-based line and UTF-16 column, both start at 1).
/// The derived order matches VS Code's `compareTo`: line, then column.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Position {
    pub line_number: u32,
    pub column: u32,
}

impl Position {
    pub fn new(line_number: u32, column: u32) -> Self {
        Self {
            line_number,
            column,
        }
    }
    pub fn delta(self, delta_line_number: i64, delta_column: i64) -> Self {
        Self::new(
            (i64::from(self.line_number) + delta_line_number) as u32,
            (i64::from(self.column) + delta_column) as u32,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::Position;
    #[test]
    fn ordering() {
        assert!(Position::new(1, 9) < Position::new(2, 1));
        assert_eq!(Position::new(2, 3).delta(1, -2), Position::new(3, 1));
    }
}
