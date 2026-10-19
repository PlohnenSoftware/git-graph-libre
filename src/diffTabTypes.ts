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

/** One side of a comparison: a file at a revision, staged, on disk, or nothing. */
export type DiffTabSide =
  | { kind: "revision"; ref: string; path: string }
  | { kind: "index"; path: string }
  | { kind: "workingTree"; path: string }
  | { kind: "empty" };

export type DiffTabRequest = {
  repo: string;
  left: DiffTabSide;
  right: DiffTabSide;
  title: string;
};

export type DiffTabPayload =
  | {
      kind: "diff";
      originalLines: string[];
      modifiedLines: string[];
      changes: DiffTabChange[];
    }
  | { kind: "binary" }
  | { kind: "tooLarge" }
  | { kind: "error"; message: string };

/** Where the tab's data comes from; the extension host implements it. */
export type DiffTabSource = { load(request: DiffTabRequest): Promise<DiffTabPayload> };

/** The tab's localized text; `hiddenLines` and `loadError` keep their `{0}`. */
export type DiffTabLabels = {
  hiddenLines: string;
  showMoreAbove: string;
  showMoreBelow: string;
  showAll: string;
  binaryFile: string;
  tooLarge: string;
  loadError: string;
};

/** Extension host to webview: one payload, with the settings and text to draw it. */
export type DiffTabShowMessage = {
  command: "show";
  payload: DiffTabPayload;
  layout: DiffTabLayout;
  lineHeight: number;
  tabSize: number;
  labels: DiffTabLabels;
};

/** Webview to extension host. */
export type DiffTabWebviewMessage =
  | { command: "ready" }
  | { command: "painted"; ms: number; rows: number };
