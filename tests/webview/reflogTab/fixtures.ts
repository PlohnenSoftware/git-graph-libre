import {
  defaultReflogQuery,
  type ReflogDataMessage,
  type ReflogDisplay,
  type ReflogLabels,
  type ReflogLoadingMessage,
  type ReflogLostCommit,
  type ReflogLostCommitsMessage,
  type ReflogPage,
  type ReflogRefOption,
  type ReflogRow,
  repoRefOption
} from "@/reflogTabTypes";

/** Shared reflog fixtures for the tab's test files. */
export const LABELS: ReflogLabels = {
  title: "Reflog: {0}",
  loading: "Loading reflog…",
  loadMore: "Load More Entries",
  empty: "No reflog entries (empty wording).",
  loadError: "Unable to load the reflog: {0}",
  searchPlaceholder: "Search reflog messages…",
  filterRef: "Ref",
  filterAllActions: "All actions",
  noMatches: "No matching entries.",
  searchCapped: "The search limit of {0} entries was reached; older entries may not be shown.",
  onlyInReflog: "Only in the reflog",
  objectMissing: "Object no longer exists",
  bareHeadNote:
    "This is a bare repository, where Git keeps no HEAD reflog by default. Pick a branch above to see its reflog.",
  worktreeHead: "HEAD of worktree {0}",
  worktreeLocked: "locked: {0}",
  worktreeLockedNoReason: "locked",
  worktreeMissing: "missing (moved or deleted)",
  columnIndex: "Index",
  columnAction: "Action",
  columnSubAction: "Sub-action",
  columnMessage: "Message",
  columnCommit: "Commit",
  columnDate: "Date",
  columnState: "State",
  actions: {
    commit: "Commit",
    checkout: "Checkout",
    reset: "Reset",
    rebase: "Rebase",
    merge: "Merge",
    pull: "Pull",
    fetch: "Fetch",
    "cherry-pick": "Cherry-pick",
    revert: "Revert",
    branch: "Branch",
    stash: "Stash",
    clone: "Clone",
    other: "Other"
  },
  subActions: {
    initial: "Initial",
    amend: "Amend",
    merge: "Merge",
    start: "Start",
    pick: "Pick",
    squash: "Squash",
    fixup: "Fixup",
    reword: "Reword",
    edit: "Edit",
    continue: "Continue",
    abort: "Abort",
    finish: "Finish",
    "fast-forward": "Fast-forward",
    created: "Created",
    renamed: "Renamed",
    copied: "Copied",
    wip: "Work in progress",
    named: "Named"
  },
  lostCommits: {
    scan: "Scan for Lost Commits…",
    rescan: "Scan Again",
    close: "Close",
    cancel: "Cancel",
    title: "Lost Commits",
    scanning: "Scanning repository for lost commits…",
    gcNote:
      "These commits are not reached by any branch, tag, or reflog and will disappear permanently when Git runs garbage collection.",
    empty: "No lost commits found. Unreachable commits disappear when Git runs garbage collection.",
    canceled: "Lost-commit scan canceled.",
    timedOut:
      "Lost-commit scan timed out. For very large repositories, run git fsck in a terminal.",
    error: "Unable to scan for lost commits: {0}",
    createBranch: "Create Branch Here…"
  },
  menuCreateBranch: "Create Branch Here…",
  menuCreateTag: "Create Tag Here…",
  menuCheckoutDetached: "Check Out (Detached)",
  menuCopyHash: "Copy Hash",
  menuShowInGraph: "Show in Graph",
  menuResetBranch: "Reset Current Branch to Here…",
  menuMissingNote: "This commit object no longer exists in Git, so it cannot be recovered.",
  dialogCreateBranchTitle: "Enter the name of the branch {0}",
  dialogCreateBranchSubmit: "Create Branch",
  dialogAddTagTitle: "Add tag to commit {0}",
  dialogAddTagName: "Name",
  dialogAddTagType: "Type",
  dialogAddTagMessage: "Message",
  dialogAddTagTypeAnnotated: "Annotated",
  dialogAddTagTypeLightweight: "Lightweight (unsigned)",
  dialogAddTagLightweightNote:
    "Lightweight tags are a plain ref with no tag object, so they carry no message and cannot be signed.",
  dialogAddTagOptional: "Optional",
  dialogAddTagSubmit: "Add Tag",
  dialogCheckoutConfirm:
    "Are you sure you want to checkout commit {0}? This will result in a 'detached HEAD' state.",
  dialogResetConfirm: "Are you sure you want to reset {0} to commit {1}?",
  labelCurrentBranch: "the current branch",
  dialogResetSoft: "Soft - Keep all changes, but reset head",
  dialogResetMixed: "Mixed - Keep working tree, but reset index",
  dialogResetHard: "Hard - Discard all changes",
  dialogYesReset: "Yes, reset",
  dialogResetHardConfirm:
    "Hard reset to commit {0} will permanently discard all uncommitted staged and working-tree changes. Reset anyway?",
  dialogShowInGraphConfirm: "Commit {0} is only in the reflog, so it is not shown in the graph.",
  dialogShowInGraphNote:
    'Turn on "Include reflog" for this repository to include reflog-only commits in the graph and reveal this commit.',
  dialogShowInGraphSubmit: "Turn On Include Reflog",
  dialogYes: "Yes",
  dialogCancel: "Cancel",
  dialogDismiss: "Dismiss",
  errorInvalidCharacters: "Unable to {0}, one or more invalid characters entered.",
  errorUnableToCreateBranch: "Unable to Create Branch",
  errorUnableToAddTag: "Unable to Add Tag",
  errorUnableToCheckoutCommit: "Unable to Checkout Commit",
  errorUnableToReset: "Unable to Reset to Commit",
  errorUnableToCopyToClipboard: "Unable to Copy {0} to Clipboard",
  typeCommitHash: "Commit Hash"
};

/** The graph display settings at their English defaults. */
export const DISPLAY: ReflogDisplay = {
  shortHashLength: 8,
  dateFormat: "Date & Time",
  datePattern: "DD MM YYYY",
  needMonthName: true,
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
};

export function row(overrides: Partial<ReflogRow> = {}): ReflogRow {
  return {
    hash: "a".repeat(40),
    index: 0,
    time: 1_700_000_000,
    kind: "commit",
    sub: null,
    message: "commit: fix typo",
    state: "reachable",
    ...overrides
  };
}

export function page(overrides: Partial<ReflogPage> = {}): ReflogPage {
  return {
    rows: [row()],
    state: "entries",
    hasMore: false,
    ref: "HEAD",
    error: null,
    searchCapped: false,
    ...overrides
  };
}

/** The picker's options for a plain one-worktree repository. */
export const REF_OPTIONS: ReflogRefOption[] = [
  repoRefOption("HEAD"),
  repoRefOption("refs/heads/main"),
  repoRefOption("refs/stash")
];

/** Another worktree's `HEAD` as a picker option (F1-08). */
export function worktreeOption(overrides: Partial<ReflogRefOption> = {}): ReflogRefOption {
  return {
    ref: "HEAD",
    worktreePath: "/repos/linked",
    worktreeName: "linked",
    locked: null,
    prunable: null,
    ...overrides
  };
}

export function dataMessage(overrides: Partial<ReflogDataMessage> = {}): ReflogDataMessage {
  return {
    command: "reflogData",
    requestId: 1,
    append: false,
    repo: "/repos/one",
    query: defaultReflogQuery(),
    refOptions: REF_OPTIONS,
    bare: false,
    locale: "en",
    labels: LABELS,
    display: DISPLAY,
    page: page(),
    ...overrides
  };
}

export function loadingMessage(
  overrides: Partial<ReflogLoadingMessage> = {}
): ReflogLoadingMessage {
  return {
    command: "reflogLoading",
    requestId: 1,
    repo: "/repos/one",
    query: defaultReflogQuery(),
    refOptions: REF_OPTIONS,
    bare: false,
    locale: "en",
    labels: LABELS,
    display: DISPLAY,
    ...overrides
  };
}

export function lostCommit(overrides: Partial<ReflogLostCommit> = {}): ReflogLostCommit {
  return {
    hash: "0123456789abcdef0123456789abcdef01234567",
    time: 1_700_000_000,
    subject: "abandoned work",
    ...overrides
  };
}

export function lostCommitsMessage(
  overrides: Partial<ReflogLostCommitsMessage> = {}
): ReflogLostCommitsMessage {
  return {
    command: "reflogLostCommits",
    scanId: 1,
    repo: "/repos/one",
    status: "done",
    commits: [lostCommit()],
    error: null,
    busyHash: null,
    feedback: null,
    ...overrides
  };
}
