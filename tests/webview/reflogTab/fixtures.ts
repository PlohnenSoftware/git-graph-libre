import {
  defaultReflogQuery,
  type ReflogDataMessage,
  type ReflogDisplay,
  type ReflogLabels,
  type ReflogLoadingMessage,
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
  }
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
