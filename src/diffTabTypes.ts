/**
 * Types shared by the extension host and the GGL Diff tab webview,
 * mirroring VS Code's `LinesDiff` shape in this project's own terms.
 */

/** A range of lines, 1-based, with `endExclusive` past the last line. */
export type LineSpan = { start: number; endExclusive: number };

/** A character range: 1-based lines, UTF-16 columns, end exclusive. */
export type CharSpan = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type DiffTabChange = {
  original: LineSpan;
  modified: LineSpan;
  inner: { original: CharSpan; modified: CharSpan }[];
};

export type DiffTabLayout = {
  hideUnchanged: boolean;
  contextLineCount: number;
  minimumLineCount: number;
  revealLineCount: number;
};
