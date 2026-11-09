import { describe, expect, it } from "vitest";

import type {
  ReflogDataMessage,
  ReflogLabels,
  ReflogLoadingMessage,
  ReflogPage,
  ReflogRow
} from "@/reflogTabTypes";
import {
  applyData,
  applyLoading,
  badgeFor,
  fullDate,
  initialReflogState,
  markLoadingMore,
  relativeTime,
  selectorFor,
  shortHash
} from "@/webview/reflogTab/rowModel";

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

function loadingMessage(overrides: Partial<ReflogLoadingMessage> = {}): ReflogLoadingMessage {
  return {
    command: "reflogLoading",
    requestId: 2,
    repo: "/repos/one",
    locale: "en",
    labels: LABELS,
    ...overrides
  };
}

describe("reflog row model", () => {
  it("starts loading with nothing to draw", () => {
    const state = initialReflogState();
    expect(state.loading).toBe(true);
    expect(state.labels).toBeNull();
    expect(state.rows).toEqual([]);
  });

  it("applies a first page and clears loading", () => {
    const state = applyData(initialReflogState(), dataMessage());
    expect(state.loading).toBe(false);
    expect(state.rows).toHaveLength(1);
    expect(state.ref).toBe("HEAD");
    expect(state.error).toBeNull();
  });

  it("appends a Load more page behind the rows shown", () => {
    const first = applyData(initialReflogState(), dataMessage({ page: page({ hasMore: true }) }));
    const busy = markLoadingMore(first);
    expect(busy.loadingMore).toBe(true);
    const next = applyData(
      busy,
      dataMessage({
        requestId: 2,
        append: true,
        page: page({ rows: [row({ index: 5, hash: "b".repeat(40) })] })
      })
    );
    expect(next.loadingMore).toBe(false);
    expect(next.rows.map((entry) => entry.index)).toEqual([0, 5]);
  });

  it("never appends the same page twice when its reply is replayed", () => {
    const first = applyData(initialReflogState(), dataMessage());
    const appended = dataMessage({
      requestId: 2,
      append: true,
      page: page({ rows: [row({ index: 9 })] })
    });
    const once = applyData(first, appended);
    expect(applyData(once, appended).rows).toHaveLength(2);
  });

  it("drops a slow older reply behind a newer one (the request-id race)", () => {
    const newer = applyData(
      initialReflogState(),
      dataMessage({ requestId: 7, page: page({ rows: [row({ message: "commit: newer" })] }) })
    );
    const stale = applyData(
      newer,
      dataMessage({ requestId: 3, page: page({ rows: [row({ message: "commit: stale" })] }) })
    );
    expect(stale.rows[0].message).toBe("commit: newer");
    expect(stale.requestId).toBe(7);
  });

  it("keeps the rows on screen when a Load more page fails", () => {
    const first = applyData(initialReflogState(), dataMessage({ page: page({ hasMore: true }) }));
    const failed = applyData(
      markLoadingMore(first),
      dataMessage({
        requestId: 2,
        append: true,
        page: page({ rows: [], state: null, ref: null, error: "git went away" })
      })
    );
    expect(failed.rows).toHaveLength(1);
    expect(failed.error).toBe("git went away");
    expect(failed.hasMore).toBe(true);
    expect(failed.loadingMore).toBe(false);
  });

  it("keeps rows visible through a same-repo refresh, but starts a new repo over", () => {
    const loaded = applyData(initialReflogState(), dataMessage());
    const refreshing = applyLoading(loaded, loadingMessage());
    expect(refreshing.loading).toBe(false);
    expect(refreshing.rows).toHaveLength(1);
    const switched = applyLoading(loaded, loadingMessage({ repo: "/repos/two" }));
    expect(switched.loading).toBe(true);
    expect(switched.rows).toEqual([]);
    expect(switched.labels).toEqual(LABELS);
  });

  it("marks Load more busy only while more pages exist", () => {
    const done = applyData(initialReflogState(), dataMessage());
    expect(markLoadingMore(done)).toBe(done);
  });

  it("badges only the two marked states; reachable and unknown draw nothing", () => {
    expect(badgeFor(row({ state: "reflogOnly" }), LABELS)).toBe("Only in the reflog");
    expect(badgeFor(row({ state: "missing" }), LABELS)).toBe("Object no longer exists");
    expect(badgeFor(row({ state: "reachable" }), LABELS)).toBeNull();
    expect(badgeFor(row({ state: null }), LABELS)).toBeNull();
  });

  it("formats the short hash, the selector, and both times", () => {
    const entry = row({ hash: "0123456789abcdef", index: 4 });
    expect(shortHash(entry.hash)).toBe("0123456");
    expect(selectorFor(entry, "HEAD")).toBe("HEAD@{4}");
    expect(selectorFor(entry, null)).toBe("HEAD@{4}");
    const now = new Date(1_700_000_000_000 + 5 * 60_000);
    expect(relativeTime(entry, now, "en")).toBe("5 minutes ago");
    expect(fullDate(entry, "en")).toContain("2023");
  });
});
