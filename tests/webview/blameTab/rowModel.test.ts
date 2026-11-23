import { describe, expect, it } from "vitest";

import {
  applyData,
  applyFindQuery,
  applyLoading,
  applyRepoChanged,
  closeFind,
  commitDate,
  computeFindMatches,
  heatAttribute,
  initialBlameState,
  openFind,
  stepFindMatch
} from "@/webview/blameTab/rowModel";

import {
  commit,
  DISPLAY,
  dataMessage,
  loadingMessage as fixtureLoading,
  hunk,
  LABELS,
  NEW_HASH,
  OLD_HASH,
  payload,
  ZERO_HASH
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

  it("carries unsavedBuffer, repoMeta, repoChanged and preserveScroll flags from messages", () => {
    const state = applyData(
      initialBlameState(),
      dataMessage({
        unsavedBuffer: true,
        repoMeta: { linkedWorktree: true, bare: false },
        repoChanged: false,
        preserveScroll: true
      })
    );
    expect(state.unsavedBuffer).toBe(true);
    expect(state.repoMeta).toEqual({ linkedWorktree: true, bare: false });
    expect(state.repoChanged).toBe(false);
    expect(state.preserveScroll).toBe(true);
  });

  it("marks repoChanged only when the notification matches the active repository", () => {
    const loaded = applyData(
      initialBlameState(),
      dataMessage({ repo: "/repos/one", rev: NEW_HASH })
    );
    const unrelated = applyRepoChanged(loaded, { command: "blameRepoChanged", repo: "/repos/two" });
    expect(unrelated).toBe(loaded);
    const marked = applyRepoChanged(loaded, { command: "blameRepoChanged", repo: "/repos/one" });
    expect(marked.repoChanged).toBe(true);
    expect(marked.preserveScroll).toBe(true);
    expect(marked.hunks).toEqual(loaded.hunks);
  });

  it("matches source lines, author, summary and commit hash case-insensitively and skips uncommitted metadata", () => {
    const base = payload();
    const uncommittedHunk = hunk({
      commitHash: ZERO_HASH,
      startLine: 5,
      lineCount: 1,
      lines: [{ finalLine: 5, origLine: 5, content: "const draft = true;" }],
      heat: { level: null, uncommitted: true, commitHunkCount: 1, commitLineCount: 1 }
    });
    const hunks = [...base.hunks, uncommittedHunk];
    const commits = {
      ...base.commits,
      [ZERO_HASH]: commit({
        hash: ZERO_HASH,
        author: "Not Committed Yet",
        summary: "",
        uncommitted: true
      })
    };

    expect(computeFindMatches(hunks, commits, "")).toEqual([]);
    // Source line matches across hunks.
    expect(computeFindMatches(hunks, commits, "EXPORT CONST")).toEqual([
      { hunkIndex: 0, line: 1, kind: "line" },
      { hunkIndex: 0, line: 2, kind: "line" },
      { hunkIndex: 1, line: 3, kind: "line" }
    ]);
    // Author match produces one hunk match anchored at startLine.
    expect(computeFindMatches(hunks, commits, "ben")).toEqual([
      { hunkIndex: 1, line: 3, kind: "hunk" }
    ]);
    // Summary match.
    expect(computeFindMatches(hunks, commits, "first lines")).toEqual([
      { hunkIndex: 0, line: 1, kind: "hunk" }
    ]);
    // Commit hash match.
    expect(computeFindMatches(hunks, commits, OLD_HASH.slice(0, 8))).toEqual([
      { hunkIndex: 0, line: 1, kind: "hunk" }
    ]);
    // Uncommitted lines match source text, not fake commit metadata.
    expect(computeFindMatches(hunks, commits, "draft")).toEqual([
      { hunkIndex: 2, line: 5, kind: "line" }
    ]);
    expect(computeFindMatches(hunks, commits, "not committed")).toEqual([]);
  });

  it("opens, steps with wrap-around, recomputes on same-repo data, and closes Find state", () => {
    let state = applyData(initialBlameState(), dataMessage());
    state = openFind(state);
    expect(state.findOpen).toBe(true);
    expect(openFind(state)).toBe(state);

    state = applyFindQuery(state, "const");
    expect(state.findMatches).toHaveLength(3);
    expect(state.findActiveIndex).toBe(0);

    state = stepFindMatch(state, 1);
    expect(state.findActiveIndex).toBe(1);
    state = stepFindMatch(state, 1);
    expect(state.findActiveIndex).toBe(2);
    state = stepFindMatch(state, 1);
    expect(state.findActiveIndex).toBe(0);
    state = stepFindMatch(state, -1);
    expect(state.findActiveIndex).toBe(2);

    // Same-repo data recomputes matches and preserves find bar open.
    const reloaded = applyData(state, dataMessage({ requestId: 2 }));
    expect(reloaded.findOpen).toBe(true);
    expect(reloaded.findQuery).toBe("const");
    expect(reloaded.findMatches).toHaveLength(3);
    expect(reloaded.findActiveIndex).toBe(2);

    // Switching repos resets find bar.
    const otherRepo = applyData(reloaded, dataMessage({ requestId: 3, repo: "/repos/two" }));
    expect(otherRepo.findOpen).toBe(false);
    expect(otherRepo.findQuery).toBe("");
    expect(otherRepo.findMatches).toEqual([]);

    const closed = closeFind(reloaded);
    expect(closed.findOpen).toBe(false);
    expect(closed.findQuery).toBe("");
    expect(closed.findMatches).toEqual([]);
    expect(closed.findActiveIndex).toBe(-1);
  });
});
