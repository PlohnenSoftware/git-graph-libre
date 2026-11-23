/**
 * Types shared by the extension host and the Blame tab webview (F4-03),
 * mirroring the GGL Diff tab's split in `diffTabTypes.ts` and the Reflog
 * tab's in `reflogTabTypes.ts`. The read itself is `loadBlame` in
 * `src/backend/queries/blame.ts` (F4-01) and the heat is `scoreBlameHunks`
 * in `src/blameHotspot.ts` (F4-02); these types only carry one blamed file
 * across the webview boundary.
 */

import type { GitBlameCommit, GitBlameHunk, GitBlameState } from "./backend/types";
import type { BlameHunkHeat } from "./blameHotspot";
import type { DateFormat } from "./types";

/** One blamed file to open: a repository, a path inside it, and where to land. */
export type BlameOpenTarget = {
  /** The repository root, as Git Graph Libre lists it. */
  repo: string;
  /** The file to blame, relative to the repository root (`src/app.ts`). */
  filePath: string;
  /**
   * The revision to blame at, or null/absent for the working tree. F4-03
   * opens working-tree blames; F4-05 rewinds through revisions.
   */
  rev?: string | null;
  /** The 1-based line to highlight and scroll to, or null for none. */
  targetLine?: number | null;
  /**
   * Unsaved editor text to blame through `git blame --contents -` (BQ6).
   * Absent for saved working-tree and historical revision blames.
   */
  contents?: string;
};

/**
 * Every state the Blame tab renders: F4-01's query states plus
 * `bareWorkingTree` when working-tree blame is attempted on a bare repository.
 */
export type BlameTabState = GitBlameState | "bareWorkingTree";

/** Repository layout facts carried to the Blame tab header and guards (F4-08). */
export type BlameRepoMeta = {
  /** True when the blamed repository is a linked worktree. */
  linkedWorktree: boolean;
  /** True when the blamed repository is a bare repository (no working tree). */
  bare: boolean;
};

/** Optional per-load inputs beyond `(repo, filePath, rev)`. */
export type BlameLoadOptions = {
  /** Unsaved editor text to blame through `git blame --contents -` (BQ6). */
  contents?: string;
};

/** One hunk as the tab draws it: the F4-01 hunk with its F4-02 heat. */
export type BlameHunkView = GitBlameHunk & {
  heat: BlameHunkHeat;
};

/** One blamed file, as `loadBlame` returned it and the source scored it. */
export type BlamePayload = {
  /** `lines`, `empty`, `binary`, `tooLarge`, `untracked`, `unborn` or `bareWorkingTree`; null on error. */
  state: BlameTabState | null;
  /** Every commit the hunks name, by hash. Empty unless `state` is `lines`. */
  commits: Record<string, GitBlameCommit>;
  /** The file's lines grouped into hunks, top to bottom. */
  hunks: BlameHunkView[];
  /** The commit OID the revision resolved to, or null for a working-tree blame and on an error. */
  resolvedRev: string | null;
  /** The blamed line count, as F4-01 counts it. */
  totalLines: number;
  /** The read failure's message; null when the read worked. */
  error: string | null;
};

/** Where the tab's blames come from; the extension host implements it. */
export type BlameSource = {
  load(
    repo: string,
    filePath: string,
    rev: string | null,
    options?: BlameLoadOptions
  ): Promise<BlamePayload>;
};

/**
 * The graph's display settings, carried to this tab the way the graph's
 * boot config carries them (`webviewHtml.ts`): read live through the
 * `config` accessors on every load, so a settings change restyles both
 * surfaces alike.
 */
export type BlameDisplay = {
  /** The `shortHashLength` setting, already clamped by its accessor. */
  shortHashLength: number;
  /** The `dateFormat` setting: which shape the hunk dates take. */
  dateFormat: DateFormat;
  /** The bundle's `time.dateformat` pattern (`DD MM YYYY` in English). */
  datePattern: string;
  /** The bundle's `time.needFormatMonth`: true when `MM` is a month name. */
  needMonthName: boolean;
  /** The bundle's twelve `month.*` names, January first. */
  months: string[];
};

/**
 * The editor's typography for the source column, read live from
 * `editor.fontSize`, `editor.lineHeight` and `editor.tabSize`, the way the
 * GGL Diff tab reads them (`diffTabPanel.ts`).
 */
export type BlameTypography = {
  /** `editor.fontSize`, in pixels. */
  fontSize: number;
  /** `editor.lineHeight` resolved to pixels (see `lineHeightInPixels` in the diff tab). */
  lineHeight: number;
  /** `editor.tabSize`. */
  tabSize: number;
};

/** The tab's localized text; `loadError`, `lineCount` and `title` keep their `{0}`. */
export type BlameLabels = {
  title: string;
  loading: string;
  empty: string;
  binary: string;
  tooLarge: string;
  untracked: string;
  unborn: string;
  loadError: string;
  workingTree: string;
  uncommitted: string;
  lineCount: string;
  resizeGutter: string;
  /** The graph's own `ui.commit` word, shared with its Commit column. */
  columnCommit: string;
  /** The graph's own `ui.date` word, shared with its Date column. */
  columnDate: string;
  /** The accessible name of the hotspot mode selector. */
  heatMode: string;
  /** The accessible name of the heat scale legend. */
  heatLegend: string;
  /** The legend's word for the coldest, oldest end of the scale. */
  heatOlder: string;
  /** The legend's word for the hottest, newest end of the scale. */
  heatNewer: string;
  /** Hotspot mode: rank-quantile recency (the default). */
  heatAge: string;
  /** Hotspot mode: fixed calendar-age bands. */
  heatCalendar: string;
  /** Hotspot mode: how often a hunk's commit touches the file. */
  heatChurn: string;
  /** Hotspot mode: no heat fills. */
  heatOff: string;
  /** Pill text when blaming unsaved editor edits via `--contents -` (BQ6). */
  unsavedBuffer: string;
  /** One-click switch from an unsaved buffer blame to `HEAD` (BQ6). */
  blameHead: string;
  /** Badge marking a linked worktree in the header (F4-08). */
  worktree: string;
  /** Badge marking a bare repository in the header (reuses `ui.worktreeBadgeBare`). */
  bare: string;
  /** Notice when working-tree blame is attempted on a bare repository. */
  bareWorkingTree: string;
  /** Action opening the blamed file in VS Code's editor (reuses `action.openFile`). */
  openFile: string;
  /** Subtle notice when the repository changed while a historical commit is pinned. */
  repoChanged: string;
  /** Action returning from a pinned historical commit to the latest view. */
  viewLatest: string;
};

/** The target fields every host message echoes, so the webview knows what it shows. */
type BlameTargetEcho = {
  repo: string;
  filePath: string;
  /** The requested revision, or null for the working tree. */
  rev: string | null;
  /** The 1-based line to highlight, or null for none. */
  targetLine: number | null;
  /** The VS Code display language, for the webview's relative times. */
  locale: string;
  labels: BlameLabels;
  /** The graph's display settings, read live for this load. */
  display: BlameDisplay;
  /** The editor typography, read live for this load. */
  typography: BlameTypography;
  /** True when the blamed text came from an unsaved editor buffer (`--contents -`). */
  unsavedBuffer?: boolean;
  /** Repository layout metadata for linked worktree and bare repository display. */
  repoMeta?: BlameRepoMeta;
  /** True when the repository changed while a historical commit is pinned. */
  repoChanged?: boolean;
};

/**
 * Extension host to webview: one blamed file, with the text to draw it.
 * Replies carry the `requestId` of the load that produced them, so the
 * webview can drop a slow older reply instead of letting it overwrite a
 * newer one.
 */
export type BlameDataMessage = BlameTargetEcho & {
  command: "blameData";
  requestId: number;
  payload: BlamePayload;
  /** True on live/manual refreshes so the webview preserves scroll position instead of jumping. */
  preserveScroll?: boolean;
};

/**
 * Extension host to webview: a load has started. Carries the labels and
 * locale on their own so the tab can say it is loading (in the user's
 * language) before the first blame lands.
 */
export type BlameLoadingMessage = BlameTargetEcho & {
  command: "blameLoading";
  requestId: number;
};

/**
 * Extension host to webview: the watched repository changed while a
 * historical commit is pinned, so the historical view stays intact and the
 * header can offer a manual jump to latest.
 */
export type BlameRepoChangedMessage = {
  command: "blameRepoChanged";
  repo: string;
};

/** Every message the extension host posts to the Blame tab. */
export type BlameHostMessage = BlameDataMessage | BlameLoadingMessage | BlameRepoChangedMessage;

/** Webview to extension host. */
export type BlameWebviewMessage =
  | { command: "ready" }
  | { command: "refresh" }
  | { command: "blameHead" }
  | { command: "blameLatest" }
  | { command: "openFile" };
