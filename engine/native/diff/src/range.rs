// Ported from microsoft/vscode src/vs/editor/common/core/range.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use core::fmt;

use crate::position::Position;

/// A range in the editor; the constructor swaps reversed ends, exactly as
/// VS Code's does. Columns are UTF-16 code units, 1-based.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Range {
    pub start_line_number: u32,
    pub start_column: u32,
    pub end_line_number: u32,
    pub end_column: u32,
}

impl Range {
    pub fn new(
        start_line_number: u32,
        start_column: u32,
        end_line_number: u32,
        end_column: u32,
    ) -> Self {
        if start_line_number > end_line_number
            || (start_line_number == end_line_number && start_column > end_column)
        {
            Self {
                start_line_number: end_line_number,
                start_column: end_column,
                end_line_number: start_line_number,
                end_column: start_column,
            }
        } else {
            Self {
                start_line_number,
                start_column,
                end_line_number,
                end_column,
            }
        }
    }
    pub fn from_positions(start: Position, end: Position) -> Self {
        Self::new(start.line_number, start.column, end.line_number, end.column)
    }
    pub fn is_empty(self) -> bool {
        self.start_line_number == self.end_line_number && self.start_column == self.end_column
    }
    pub fn start_position(self) -> Position {
        Position::new(self.start_line_number, self.start_column)
    }
    pub fn end_position(self) -> Position {
        Position::new(self.end_line_number, self.end_column)
    }
}

impl fmt::Display for Range {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{},{} -> {},{}]",
            self.start_line_number, self.start_column, self.end_line_number, self.end_column
        )
    }
}

#[cfg(test)]
mod tests {
    use super::Range;
    use crate::position::Position;
    #[test]
    fn basics() {
        let r = Range::new(2, 5, 2, 1); // reversed ends are swapped, as in VS Code
        assert_eq!(r.to_string(), "[2,1 -> 2,5]");
        assert!(!r.is_empty() && Range::new(2, 5, 2, 5).is_empty());
        assert_eq!(
            Range::from_positions(Position::new(2, 1), Position::new(2, 5)),
            r
        );
        assert_eq!(
            (r.start_position(), r.end_position()),
            (Position::new(2, 1), Position::new(2, 5))
        );
    }
}
