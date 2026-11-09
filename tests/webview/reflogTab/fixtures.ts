import type { ReflogDataMessage, ReflogLabels, ReflogPage, ReflogRow } from "@/reflogTabTypes";

/** Shared reflog fixtures for the tab's test files. */
export const LABELS: ReflogLabels = {
  title: "Reflog: {0}",
  loading: "Loading reflog…",
  loadMore: "Load More",
  empty: "No reflog entries (empty wording).",
  loadError: "Unable to load the reflog: {0}",
  onlyInReflog: "Only in the reflog",
  objectMissing: "Object no longer exists",
  columnIndex: "Index",
  columnAction: "Action",
  columnSubAction: "Sub-action",
  columnMessage: "Message",
  columnHash: "Hash",
  columnTime: "Time",
  columnState: "State"
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
    ...overrides
  };
}

export function dataMessage(overrides: Partial<ReflogDataMessage> = {}): ReflogDataMessage {
  return {
    command: "reflogData",
    requestId: 1,
    append: false,
    repo: "/repos/one",
    locale: "en",
    labels: LABELS,
    page: page(),
    ...overrides
  };
}
