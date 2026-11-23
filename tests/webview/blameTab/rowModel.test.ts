import { describe, expect, it } from "vitest";

import {
  applyData,
  applyLoading,
  commitDate,
  heatAttribute,
  initialBlameState
} from "@/webview/blameTab/rowModel";

import {
  commit,
  DISPLAY,
  dataMessage,
  loadingMessage as fixtureLoading,
  hunk,
  LABELS,
  NEW_HASH,
  payload
} from "./fixtures";

const loadingMessage = (overrides = {}) => fixtureLoading({ requestId: 2, ...overrides });

describe("blame row model", () => {
  it("starts loading with nothing to draw", () => {
    const state = initialBlameState();
    expect(state.loading).toBe(true);
    expect(state.labels).toBeNull();
    expect(state.hunks).toEqual([]);
  });

  it("applies a first blame and clears loading", () => {
    const state = applyData(initialBlameState(), dataMessage());
    expect(state.loading).toBe(false);
    expect(state.hunks).toHaveLength(2);
    expect(state.blameState).toBe("lines");
    expect(state.totalLines).toBe(4);
    expect(state.error).toBeNull();
  });

  it("drops a slow older reply behind a newer one (the request-id race)", () => {
    const newer = applyData(
      initialBlameState(),
      dataMessage({
        requestId: 7,
        payload: payload({ hunks: [hunk({ commitHash: NEW_HASH })] })
      })
    );
    const stale = applyData(newer, dataMessage({ requestId: 3 }));
    expect(stale.hunks[0].commitHash).toBe(NEW_HASH);
    expect(stale.requestId).toBe(7);
    // An older loading notice is dropped the same way.
    expect(applyLoading(newer, loadingMessage({ requestId: 2 }))).toBe(newer);
  });

  it("keeps lines visible through a same-target refresh, but starts a new target over", () => {
    const loaded = applyData(initialBlameState(), dataMessage());
    const refreshing = applyLoading(loaded, loadingMessage());
    expect(refreshing.loading).toBe(false);
    expect(refreshing.hunks).toHaveLength(2);
    const switched = applyLoading(loaded, loadingMessage({ filePath: "src/other.ts" }));
    expect(switched.loading).toBe(true);
    expect(switched.hunks).toEqual([]);
    expect(switched.labels).toEqual(LABELS);
    const otherRepo = applyLoading(loaded, loadingMessage({ repo: "/repos/two" }));
    expect(otherRepo.loading).toBe(true);
    expect(otherRepo.hunks).toEqual([]);
  });

  it("carries the target line from each message", () => {
    const state = applyData(initialBlameState(), dataMessage({ targetLine: 3 }));
    expect(state.targetLine).toBe(3);
  });

  it("takes the display settings and typography from each message", () => {
    const display = { ...DISPLAY, shortHashLength: 12, dateFormat: "Relative" as const };
    const typography = { fontSize: 16, lineHeight: 24, tabSize: 2 };
    const state = applyData(initialBlameState(), dataMessage({ display, typography }));
    expect(state.display).toEqual(display);
    expect(state.typography).toEqual(typography);
    const loading = applyLoading(state, loadingMessage({ display: DISPLAY }));
    expect(loading.display).toEqual(DISPLAY);
  });

  it("names the heat hook for committed, uncommitted and unscored hunks", () => {
    expect(
      heatAttribute(
        hunk({ heat: { level: 0, uncommitted: false, commitHunkCount: 1, commitLineCount: 2 } })
      )
    ).toBe("0");
    expect(
      heatAttribute(
        hunk({ heat: { level: 9, uncommitted: false, commitHunkCount: 1, commitLineCount: 2 } })
      )
    ).toBe("9");
    expect(
      heatAttribute(
        hunk({ heat: { level: null, uncommitted: true, commitHunkCount: 1, commitLineCount: 1 } })
      )
    ).toBe("uncommitted");
    expect(
      heatAttribute(
        hunk({ heat: { level: null, uncommitted: false, commitHunkCount: 1, commitLineCount: 2 } })
      )
    ).toBe("none");
  });

  it("shapes the hunk date by the graph's dateFormat setting, hover included", () => {
    const entry = commit();
    const now = new Date(1_700_000_000_000 + 5 * 60_000);
    const full = commitDate(entry, DISPLAY, now, "en");
    expect(full.value).toMatch(/^\d{1,2} Nov 2023 \d{2}:\d{2}$/);
    expect(full.title).toBe(full.value);
    const only = commitDate(entry, { ...DISPLAY, dateFormat: "Date Only" }, now, "en");
    expect(only.value).toMatch(/^\d{1,2} Nov 2023$/);
    expect(only.title).toBe(full.title);
    const relative = commitDate(entry, { ...DISPLAY, dateFormat: "Relative" }, now, "en");
    expect(relative.value).toBe("5 minutes ago");
    expect(relative.title).toBe(full.title);
    const numeric = commitDate(
      entry,
      { ...DISPLAY, needMonthName: false, datePattern: "YYYY-MM-DD" },
      now,
      "en"
    );
    expect(numeric.value).toMatch(/^2023-11-\d{1,2} \d{2}:\d{2}$/);
  });
});
