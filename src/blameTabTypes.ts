/**
 * Types shared by the extension host and the Blame tab webview (F4-03,
 * F4-04, F4-05, F4-08), mirroring the GGL Diff tab's split in `diffTabTypes.ts`
 * and the Reflog tab's in `reflogTabTypes.ts`. The read itself is
 * `loadBlame` in `src/backend/queries/blame.ts` (F4-01) and the heat is
 * `scoreBlameHunks` in `src/blameHotspot.ts` (F4-02); these types only
 * carry one blamed file and its navigation/options state across the
 * webview boundary.
 */

import type { GitBlameCommit, GitBlameHunk, GitBlameState } from "./backend/types";
import type { BlameHunkHeat } from "./blameHotspot";
import type { DateFormat, IssueLinkingConfig } from "./types";

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

/**
 * Header blame option toggles (F4-05, decision BQ5): plain blame by
 * default, with `.git-blame-ignore-revs` at the repository root enabled
 * automatically when the file exists.
 */
export type BlameOptions = {
  /** Pass `-w`: ignore whitespace when comparing parent and child. */
  ignoreWhitespace: boolean;
  /** Pass `-M`: detect lines moved or copied within the same file. */
  detectMoves: boolean;
  /** Pass `-C`: detect lines moved or copied from other files changed in the same commit. */
  detectCopies: boolean;
  /**
   * Pass `--ignore-revs-file=.git-blame-ignore-revs` when the repository
   * root has a `.git-blame-ignore-revs` file (`BQ5`, true by default).
   */
  useIgnoreRevsFile: boolean;
};

/** Options passed to `BlameSource.load` for one blame read (F4-05). */
export type BlameLoadOptions = Partial<BlameOptions> & {
  /** Per-session commit hashes skipped via `--ignore-rev=<hash>`. */
  ignoreRevs?: readonly string[];
  /** Unsaved editor text to blame through `git blame --contents -` (BQ6). */
  contents?: string;
};

/** One entry on the Blame tab's Back/Forward parent-rewind stack (F4-05). */
export type BlameHistoryEntry = {
  rev: string | null;
  filePath: string;
  targetLine: number | null;
};

/** Direction for in-tab revision history navigation (F4-05). */
export type BlameNavigateDirection = "back" | "forward" | "latest";

/**
 * Snapshot of the panel's Back/Forward/Latest navigation stack echoed on
 * every host message so the header can draw its controls and rename notice.
 */
export type BlameNavigationState = {
  /** Entries available to pop on Back. */
  backCount: number;
  /** Entries available to pop on Forward. */
  forwardCount: number;
  /** True when the tab is not already at its initial working-tree target. */
  canLatest: boolean;
  /** The file path the tab opened on before any rewinds across renames. */
  initialFilePath: string;
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
  /** True when `.git-blame-ignore-revs` exists at the repository root (F4-05). */
  hasIgnoreRevsFile?: boolean;
  /** The `--ignore-revs-file` path used for this read, or null when none was passed (F4-05). */
  ignoreRevsFileUsed?: string | null;
};

/**
 * One commit's full details for the commit popover (F4-06): the message
 * the blame porcelain only summarizes, in the shape the graph's commit
 * details already use (`GitCommitDetails` without its file list).
 */
export type BlameCommitPopoverDetails = {
  hash: string;
  parents: string[];
  author: string;
  authorMail: string;
  /** When the change was authored, in Unix seconds. */
  authorTime: number;
  committer: string;
  committerMail: string;
  /** When the commit was made, in Unix seconds. */
  committerTime: number;
  /** The commit subject (the first line of `message`). */
  subject: string;
  /** The full commit message, subject first, trailing blank lines trimmed. */
  message: string;
};

/** A popover details read: the details, or the failure's message. */
export type BlameCommitPopoverResult = {
  details: BlameCommitPopoverDetails | null;
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
  /**
   * The full commit details behind one hunk, for the commit popover and
   * Copy Commit Message (F4-06). Optional so a bare blame fake keeps
   * working; the CLI source implements it.
   */
  loadCommitPopover?(repo: string, commitHash: string): Promise<BlameCommitPopoverResult>;
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
  /** Accessible label for the per-hunk parent-blame rewind button (F4-05). */
  rewind: string;
  /** Rewind tooltip when the path stayed the same (`{0}` = short parent hash). */
  rewindTo: string;
  /** Rewind tooltip when the file was renamed (`{0}` = short parent hash, `{1}` = parent path). */
  rewindToPath: string;
  /** Tooltip on a boundary / file-creation hunk where blame cannot go earlier. */
  initialCommit: string;
  /** Header Back navigation button label. */
  navBack: string;
  /** Header Forward navigation button label. */
  navForward: string;
  /** Header Latest navigation button label. */
  navLatest: string;
  /** Header Latest navigation button tooltip. */
  navLatestTitle: string;
  /** Header rename badge when current `filePath` differs from `initialFilePath` (`{0}`). */
  renamedFrom: string;
  /** Header toggle tooltip/label for `-w`. */
  optionIgnoreWhitespace: string;
  /** Header toggle tooltip/label for `-M`. */
  optionDetectMoves: string;
  /** Header toggle tooltip/label for `-C`. */
  optionDetectCopies: string;
  /** Header chip label when `.git-blame-ignore-revs` is active. */
  ignoringRevsFile: string;
  /** Header chip label when `.git-blame-ignore-revs` is present but turned off. */
  ignoreRevsFileOff: string;
  /** Header chip label for a per-session `--ignore-rev` commit (`{0}` = short hash). */
  ignoringCommit: string;
  /** Accessible label for removing one session `--ignore-rev` chip (`{0}` = short hash). */
  removeIgnoredCommit: string;
  /** Header button label to clear all session ignored commits. */
  clearIgnoredCommits: string;
  /** Header button label to toggle the in-tab Find bar. */
  findToggle: string;
  /** Placeholder and accessible label for the in-tab Find input. */
  findPlaceholder: string;
  /** Match counter pattern (`{0} / {1}`). */
  findCount: string;
  /** Previous match button label. */
  findPrev: string;
  /** Next match button label. */
  findNext: string;
  /** Close find bar button label. */
  findClose: string;
  /** Accessible name of a hunk's commit header button, which opens the popover (F4-06). */
  showCommitDetails: string;
  /** Accessible name of the commit popover's close button (F4-06). */
  popoverClose: string;
  /** The popover's word when its commit details could not be read (`{0}` = the failure). */
  popoverLoadError: string;
  /** Popover action: reveal the hunk's commit in the graph (F4-06). */
  showCommitInGraph: string;
  /** Popover action: the graph's own `action.openInGglDiff` word (F4-06). */
  openInGglDiff: string;
  /** Popover action: add the commit to the session `--ignore-rev` list (F4-06). */
  ignoreCommitSession: string;
  /** Popover action: the graph's own `action.copyCommitHash` word (F4-06). */
  copyCommitHash: string;
  /** Popover action: copy the full commit message (F4-06). */
  copyCommitMessage: string;
  /** Popover and line-number action: open the file in VS Code at a line (F4-06). */
  openFileAtLine: string;
  /** Uncommitted popover action: blame the same file at `HEAD` (F4-06). */
  viewBlameAtHead: string;
  /** The uncommitted popover's one-line explanation (F4-06). */
  uncommittedExplanation: string;
  /** The graph's own `detail.commit` word, colon included (F4-06). */
  detailCommit: string;
  /** The graph's own `detail.author` word, colon included (F4-06). */
  detailAuthor: string;
  /** The graph's own `detail.authorDate` word, colon included (F4-06). */
  detailAuthorDate: string;
  /** The graph's own `detail.committer` word, colon included (F4-06). */
  detailCommitter: string;
  /** The graph's own `detail.committerDate` word, colon included (F4-06). */
  detailCommitterDate: string;
  /** The graph's own `detail.date` word, colon included (F4-06). */
  detailDate: string;
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
  /** Current Back/Forward/Latest navigation state (F4-05). */
  navigation?: BlameNavigationState;
  /** Active header blame option toggles (F4-05). */
  options?: BlameOptions;
  /** Per-session commit hashes ignored with `--ignore-rev` (F4-05). */
  ignoreRevs?: string[];
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

/**
 * Extension host to webview: one commit's full details for the popover
 * (F4-06), answering a `loadCommitPopover` by its `requestId`, with the
 * author's cached avatar (a data URI, or null) and the repository's
 * issue-linking config the graph linkifies with.
 */
export type BlameCommitPopoverMessage = {
  command: "blameCommitPopover";
  requestId: number;
  commitHash: string;
  details: BlameCommitPopoverDetails | null;
  avatar: string | null;
  issueLinking: IssueLinkingConfig | null;
  error: string | null;
};

/** Every message the extension host posts to the Blame tab. */
export type BlameHostMessage =
  | BlameDataMessage
  | BlameLoadingMessage
  | BlameRepoChangedMessage
  | BlameCommitPopoverMessage;

/** Webview to extension host: rewind to a hunk's parent commit and pre-rename path. */
export type BlameRewindMessage = {
  command: "rewind";
  rev: string;
  filePath: string;
  targetLine: number | null;
};

/** Webview to extension host: step Back, Forward, or jump to Latest. */
export type BlameNavigateMessage = {
  command: "navigate";
  direction: BlameNavigateDirection;
};

/** Webview to extension host: toggle `-w`, `-M`, `-C` or `.git-blame-ignore-revs`. */
export type BlameSetOptionsMessage = {
  command: "setOptions";
  options: Partial<BlameOptions>;
  targetLine?: number | null;
};

/** Webview to extension host: add a commit hash to the session `--ignore-rev` list. */
export type BlameIgnoreCommitMessage = {
  command: "ignoreCommit";
  commitHash: string;
  targetLine?: number | null;
};

/**
 * Webview to extension host: remove one commit hash from the session
 * `--ignore-rev` list, or clear all session ignored commits when
 * `commitHash` is null or omitted.
 */
export type BlameClearIgnoredCommitMessage = {
  command: "clearIgnoredCommit";
  commitHash?: string | null;
  targetLine?: number | null;
};

/** Webview to extension host: read one commit's full details for the popover (F4-06). */
export type BlameLoadCommitPopoverMessage = {
  command: "loadCommitPopover";
  requestId: number;
  commitHash: string;
};

/** Webview to extension host: reveal a hunk's commit in the graph (F4-06). */
export type BlameShowCommitInGraphMessage = {
  command: "showCommitInGraph";
  commitHash: string;
};

/**
 * Webview to extension host: open the blamed file's diff for one commit
 * (F4-06) — the file at `commitHash` against its `previous` commit and
 * pre-rename path, or against nothing when the commit created the file.
 */
export type BlameOpenCommitFileDiffMessage = {
  command: "openCommitFileDiff";
  commitHash: string;
  /** The file's path at `commitHash` (the hunk's origin path). */
  filePath: string;
  previousHash: string | null;
  previousPath: string | null;
};

/** Webview to extension host: open the blamed file in VS Code at a 1-based line (F4-06). */
export type BlameOpenFileAtLineMessage = {
  command: "openFileAtLine";
  line: number;
};

/** Webview to extension host: copy a commit's hash or full message (F4-06). */
export type BlameCopyTextMessage = {
  command: "copyText";
  kind: "hash" | "message";
  commitHash: string;
};

/** Webview to extension host. */
export type BlameWebviewMessage =
  | { command: "ready" }
  | { command: "refresh" }
  | { command: "blameHead" }
  | { command: "blameLatest" }
  | { command: "openFile" }
  | BlameRewindMessage
  | BlameNavigateMessage
  | BlameSetOptionsMessage
  | BlameIgnoreCommitMessage
  | BlameClearIgnoredCommitMessage
  | BlameLoadCommitPopoverMessage
  | BlameShowCommitInGraphMessage
  | BlameOpenCommitFileDiffMessage
  | BlameOpenFileAtLineMessage
  | BlameCopyTextMessage;
