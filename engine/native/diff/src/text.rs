// The UTF-16 text model (Phase 17, "Exactness rules"): lines split the way
// a VS Code text model splits them (on `\r\n`, `\n` and `\r`, endings
// removed; `splitLines` in microsoft/vscode src/vs/base/common/strings.ts),
// and every line converted once to UTF-16 code units, because VS Code's
// character sequences, columns and lengths count UTF-16 units (`charCodeAt`,
// `string.length`). Source commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.

/// Splits `text` into lines on `\r\n`, `\n` and `\r`. A trailing line
/// ending yields a final empty line, and the empty text is one empty line.
pub fn split_lines(text: &str) -> Vec<String> {
    let mut lines = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\r' || bytes[i] == b'\n' {
            lines.push(text[start..i].to_string());
            if bytes[i] == b'\r' && bytes.get(i + 1) == Some(&b'\n') {
                i += 1;
            }
            i += 1;
            start = i;
        } else {
            i += 1;
        }
    }
    lines.push(text[start..].to_string());
    lines
}

/// The length VS Code reports for a line: its UTF-16 code-unit count.
pub fn utf16_len(line: &str) -> u32 {
    line.encode_utf16().count() as u32
}

/// One document side: its lines as text and as UTF-16 code units.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TextModel {
    lines: Vec<String>,
    utf16_lines: Vec<Vec<u16>>,
}

impl TextModel {
    pub fn from_text(text: &str) -> Self {
        Self::from_lines(split_lines(text))
    }
    pub fn from_lines(lines: Vec<String>) -> Self {
        let utf16_lines = lines
            .iter()
            .map(|line| line.encode_utf16().collect())
            .collect();
        Self { lines, utf16_lines }
    }
    pub fn lines(&self) -> &[String] {
        &self.lines
    }
    pub fn line_count(&self) -> u32 {
        self.lines.len() as u32
    }
    /// The line's UTF-16 code units (1-based line number).
    pub fn utf16_line(&self, line_number: u32) -> &[u16] {
        &self.utf16_lines[(line_number - 1) as usize]
    }
    /// The line's `charCodeAt` at a 0-based UTF-16 offset (1-based line).
    pub fn char_code_at(&self, line_number: u32, utf16_offset: u32) -> u16 {
        self.utf16_line(line_number)[utf16_offset as usize]
    }
}

#[cfg(test)]
mod tests {
    use super::{split_lines, TextModel};
    #[test]
    fn splits_like_a_text_model() {
        assert_eq!(split_lines(""), [""]);
        assert_eq!(split_lines("a\n"), ["a", ""]);
        assert_eq!(split_lines("a\r\nb\rc\nd"), ["a", "b", "c", "d"]);
        assert_eq!(split_lines("\r\n\r"), ["", "", ""]);
    }
    #[test]
    fn counts_utf16_units() {
        let model = TextModel::from_text("a\u{1F600}b\nx");
        assert_eq!(model.line_count(), 2);
        assert_eq!(model.utf16_line(1), [0x61, 0xD83D, 0xDE00, 0x62]); // emoji = surrogate pair
        assert_eq!(model.char_code_at(1, 3), 0x62);
        assert_eq!(model.utf16_line(1).len(), 4); // JS "a😀b".length
    }
}
