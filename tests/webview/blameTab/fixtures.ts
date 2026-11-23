import type { GitBlameCommit } from "@/backend/types";
import type {
  BlameDataMessage,
  BlameDisplay,
  BlameHunkView,
  BlameLabels,
  BlameLoadingMessage,
  BlamePayload,
  BlameTypography
} from "@/blameTabTypes";

/** Shared blame fixtures for the tab's test files. */
export const LABELS: BlameLabels = {
  title: "Blame: {0}",
  loading: "Loading blame…",
  empty: "This file has no lines to blame.",
  binary: "This is a binary file; there is no blame to show.",
  tooLarge: "This file is too large to blame here.",
  untracked: "This file is not tracked by Git yet, so it has no blame history.",
  unborn: "This repository has no commits yet, so this file has no blame history.",
  loadError: "Unable to load the blame: {0}",
  workingTree: "Working Tree",
  uncommitted: "Uncommitted changes",
  lineCount: "{0} lines",
  resizeGutter: "Resize blame gutter",
  columnCommit: "Commit",
  columnDate: "Date",
  heatMode: "Hotspot mode",
  heatLegend: "Heat scale, from older to newer",
  heatOlder: "Older",
  heatNewer: "Newer",
  heatAge: "Age",
  heatCalendar: "Calendar",
  heatChurn: "Churn",
  heatOff: "Off",
  unsavedBuffer: "Unsaved buffer",
  blameHead: "Blame HEAD",
  worktree: "Worktree",
  bare: "bare",
  bareWorkingTree:
    "This is a bare repository and has no working tree to blame. Open a file from Commit Details at a specific commit instead.",
  openFile: "Open File",
  repoChanged: "Repository changed",
  viewLatest: "View latest"
};

/** The graph display settings at their English defaults. */
export const DISPLAY: BlameDisplay = {
  shortHashLength: 8,
  dateFormat: "Date & Time",
  datePattern: "DD MM YYYY",
  needMonthName: true,
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
};

/** The editor typography at its defaults. */
export const TYPOGRAPHY: BlameTypography = { fontSize: 14, lineHeight: 21, tabSize: 4 };

export const OLD_HASH = "a".repeat(40);
export const NEW_HASH = "b".repeat(40);
export const ZERO_HASH = "0".repeat(40);

export function commit(overrides: Partial<GitBlameCommit> = {}): GitBlameCommit {
  return {
    hash: OLD_HASH,
    author: "Ada",
    authorMail: "ada@example.test",
    authorTime: 1_700_000_000,
    authorTz: "+0000",
    committer: "Ada",
    committerMail: "ada@example.test",
    committerTime: 1_700_000_000,
    committerTz: "+0000",
    summary: "Add the first lines",
    boundary: true,
    uncommitted: false,
    previous: null,
    filename: "src/file.ts",
    ...overrides
  };
}

export function hunk(overrides: Partial<BlameHunkView> = {}): BlameHunkView {
  return {
    commitHash: OLD_HASH,
    startLine: 1,
    lineCount: 2,
    origStartLine: 1,
    filename: "src/file.ts",
    previous: null,
    lines: [
      { finalLine: 1, origLine: 1, content: "export const one = 1;" },
      { finalLine: 2, origLine: 2, content: "export const two = 2;" }
    ],
    heat: { level: 0, uncommitted: false, commitHunkCount: 1, commitLineCount: 2 },
    ...overrides
  };
}

/** A two-commit payload: two old lines, then two newer lines. */
export function payload(overrides: Partial<BlamePayload> = {}): BlamePayload {
  const newer = commit({
    hash: NEW_HASH,
    author: "Ben",
    authorMail: "ben@example.test",
    authorTime: 1_800_000_000,
    committer: "Ben",
    committerMail: "ben@example.test",
    committerTime: 1_800_000_000,
    summary: "Extend the file",
    boundary: false,
    previous: { hash: OLD_HASH, path: "src/file.ts" }
  });
  return {
    state: "lines",
    commits: { [OLD_HASH]: commit(), [NEW_HASH]: newer },
    hunks: [
      hunk(),
      hunk({
        commitHash: NEW_HASH,
        startLine: 3,
        origStartLine: 3,
        previous: { hash: OLD_HASH, path: "src/file.ts" },
        lines: [
          { finalLine: 3, origLine: 3, content: "export const three = 3;" },
          { finalLine: 4, origLine: 4, content: "" }
        ],
        heat: { level: 9, uncommitted: false, commitHunkCount: 1, commitLineCount: 2 }
      })
    ],
    resolvedRev: null,
    totalLines: 4,
    error: null,
    ...overrides
  };
}

export function dataMessage(overrides: Partial<BlameDataMessage> = {}): BlameDataMessage {
  return {
    command: "blameData",
    requestId: 1,
    repo: "/repos/one",
    filePath: "src/file.ts",
    rev: null,
    targetLine: null,
    locale: "en",
    labels: LABELS,
    display: DISPLAY,
    typography: TYPOGRAPHY,
    payload: payload(),
    ...overrides
  };
}

export function loadingMessage(overrides: Partial<BlameLoadingMessage> = {}): BlameLoadingMessage {
  return {
    command: "blameLoading",
    requestId: 1,
    repo: "/repos/one",
    filePath: "src/file.ts",
    rev: null,
    targetLine: null,
    locale: "en",
    labels: LABELS,
    display: DISPLAY,
    typography: TYPOGRAPHY,
    ...overrides
  };
}
