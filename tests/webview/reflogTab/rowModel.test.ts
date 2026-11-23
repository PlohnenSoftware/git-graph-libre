import { describe, expect, it } from "vitest";
import { defaultReflogQuery, normalizeReflogQuery, REFLOG_SEARCH_CAP } from "@/reflogTabTypes";
import {
  applyData,
  applyLoading,
  badgeFor,
  entryDate,
  initialReflogState,
  markLoadingMore,
  relativeTime,
  selectorFor
} from "@/webview/reflogTab/rowModel";
import {
  DISPLAY,
  dataMessage,
  loadingMessage as fixtureLoading,
  LABELS,
  page,
  row
} from "./fixtures";

const loadingMessage = (overrides = {}) => fixtureLoading({ requestId: 2, ...overrides });

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

  it("formats the selector and keeps the relative-time helper", () => {
    const entry = row({ hash: "0123456789abcdef", index: 4 });
    expect(selectorFor(entry, "HEAD")).toBe("HEAD@{4}");
    expect(selectorFor(entry, null)).toBe("HEAD@{4}");
    const now = new Date(1_700_000_000_000 + 5 * 60_000);
    expect(relativeTime(entry, now, "en")).toBe("5 minutes ago");
  });

  it("shapes the date cell by the graph's dateFormat setting, hover included", () => {
    const entry = row();
    const now = new Date(1_700_000_000_000 + 5 * 60_000);
    // The graph's shape: bundle pattern, bundle month name, HH:MM clock.
    const full = entryDate(entry, DISPLAY, now, "en");
    expect(full.value).toMatch(/^\d{1,2} Nov 2023 \d{2}:\d{2}$/);
    expect(full.title).toBe(full.value);
    const only = entryDate(entry, { ...DISPLAY, dateFormat: "Date Only" }, now, "en");
    expect(only.value).toMatch(/^\d{1,2} Nov 2023$/);
    expect(only.title).toBe(full.title);
    const relative = entryDate(entry, { ...DISPLAY, dateFormat: "Relative" }, now, "en");
    expect(relative.value).toBe("5 minutes ago");
    expect(relative.title).toBe(full.title);
    // A pattern that needs no month name prints the month's number.
    const numeric = entryDate(
      entry,
      { ...DISPLAY, needMonthName: false, datePattern: "YYYY-MM-DD" },
      now,
      "en"
    );
    expect(numeric.value).toMatch(/^2023-11-\d{1,2} \d{2}:\d{2}$/);
  });

  it("carries the query, the picker refs and the cap flag from each message (F1-05)", () => {
    const query = {
      ref: "refs/stash",
      worktreePath: null,
      search: "needle",
      actions: ["stash"],
      onlyInReflog: true
    };
    const state = applyData(
      initialReflogState(),
      dataMessage({
        query,
        refOptions: [
          { ref: "HEAD", worktreePath: null, worktreeName: null, locked: null, prunable: null },
          {
            ref: "refs/stash",
            worktreePath: null,
            worktreeName: null,
            locked: null,
            prunable: null
          }
        ],
        page: page({ searchCapped: true })
      })
    );
    expect(state.query).toEqual(query);
    expect(state.refOptions.map((option) => option.ref)).toEqual(["HEAD", "refs/stash"]);
    expect(state.searchCapped).toBe(true);
    expect(REFLOG_SEARCH_CAP).toBe(5000);

    // A reload of the same query keeps its rows; a changed query starts over.
    const refreshing = applyLoading(state, loadingMessage({ requestId: 3, query }));
    expect(refreshing.loading).toBe(false);
    expect(refreshing.rows).toHaveLength(1);
    const changed = applyLoading(
      state,
      loadingMessage({
        requestId: 3,
        query: { ...query, search: "other" }
      })
    );
    expect(changed.loading).toBe(true);
    expect(changed.rows).toEqual([]);
    expect(changed.searchCapped).toBe(false);
  });

  it("normalizes a query from across the boundary field by field (F1-05)", () => {
    expect(normalizeReflogQuery(null)).toEqual(defaultReflogQuery());
    expect(normalizeReflogQuery("refs/heads/main")).toEqual(defaultReflogQuery());
    expect(
      normalizeReflogQuery({
        ref: "refs/heads/feat/x",
        search: "  needle  ",
        actions: ["stash", "bogus", "commit", "stash"],
        onlyInReflog: true
      })
    ).toEqual({
      ref: "refs/heads/feat/x",
      worktreePath: null,
      search: "needle",
      actions: ["commit", "stash"],
      onlyInReflog: true
    });
    for (const ref of [
      "-n1",
      "--upload-pack=touch /tmp/x",
      "refs/remotes/origin/main",
      "refs/tags/v1",
      "refs/heads/",
      "refs/heads/a\nb",
      42
    ]) {
      expect(normalizeReflogQuery({ ref }).ref, String(ref)).toBe("HEAD");
    }
    expect(
      normalizeReflogQuery({ ref: "refs/stash", search: 5, actions: "commit", onlyInReflog: "yes" })
    ).toEqual({
      ref: "refs/stash",
      worktreePath: null,
      search: "",
      actions: [],
      onlyInReflog: false
    });
  });

  it("keeps a worktree path only beside HEAD (F1-08)", () => {
    expect(normalizeReflogQuery({ ref: "HEAD", worktreePath: "/repos/linked" })).toEqual({
      ref: "HEAD",
      worktreePath: "/repos/linked",
      search: "",
      actions: [],
      onlyInReflog: false
    });
    // Branch and stash reflogs are shared: a worktree beside them is dropped.
    for (const ref of ["refs/heads/main", "refs/stash"]) {
      expect(normalizeReflogQuery({ ref, worktreePath: "/repos/linked" }).worktreePath).toBeNull();
    }
    for (const worktreePath of ["", 42, "/repos/a\nb", null]) {
      expect(
        normalizeReflogQuery({ ref: "HEAD", worktreePath }).worktreePath,
        String(worktreePath)
      ).toBeNull();
    }
  });

  it("takes the display settings from each message, so a change restyles the tab", () => {
    const changed = { ...DISPLAY, shortHashLength: 12, dateFormat: "Relative" as const };
    const state = applyData(initialReflogState(), dataMessage({ display: changed }));
    expect(state.display).toEqual(changed);
    const loading = applyLoading(state, loadingMessage({ display: DISPLAY }));
    expect(loading.display).toEqual(DISPLAY);
  });
});
