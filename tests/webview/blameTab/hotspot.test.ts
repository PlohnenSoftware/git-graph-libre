import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitBlameCommit } from "@/backend/types";
import type { BlameHostMessage, BlameHunkView } from "@/blameTabTypes";
import {
  applyData,
  applyHotspotMode,
  initialBlameState,
  normalizeHotspotMode
} from "@/webview/blameTab/rowModel";
import { createBlameView } from "@/webview/blameTab/view";

import { commit, dataMessage, hunk, payload } from "./fixtures";

const NOW = new Date(1_800_000_000_000);
/** Three days after the fixture's newer commit (1_800_000_000). */
const THREE_DAYS_AFTER_NEWER = 1_800_000_000 + 3 * 86_400;

/** A 40-character hash for the n-th commit of a test file. */
function hashOf(index: number): string {
  return (index + 1).toString(16).padStart(2, "0").repeat(20);
}

function timed(hash: string, authorTime: number): GitBlameCommit {
  return commit({
    hash,
    authorTime,
    committerTime: authorTime,
    summary: `commit ${hash.slice(0, 2)}`,
    boundary: false
  });
}

/** A one-line hunk owned by `commitHash`, starting at `line`. */
function lineHunk(commitHash: string, line: number): BlameHunkView {
  return hunk({
    commitHash,
    startLine: line,
    origStartLine: line,
    lineCount: 1,
    lines: [{ finalLine: line, origLine: line, content: `line ${line}` }],
    heat: { level: null, uncommitted: false, commitHunkCount: 1, commitLineCount: 1 }
  });
}

function fileWith(hunks: BlameHunkView[], commits: Record<string, GitBlameCommit>) {
  return dataMessage({
    payload: payload({ commits, hunks, totalLines: hunks.length, resolvedRev: null })
  });
}

function start(onHotspotModeChange = vi.fn()) {
  document.body.innerHTML = '<div id="blameTab"></div>';
  const root = document.getElementById("blameTab") as HTMLElement;
  const view = createBlameView(root, { onHotspotModeChange });
  return { root, view, onHotspotModeChange };
}

function heats(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>(".blame-hunk")].map(
    (band) => band.dataset.heat ?? ""
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("normalizeHotspotMode", () => {
  it("keeps the four modes and falls back to age for anything else", () => {
    expect(normalizeHotspotMode("calendar")).toBe("calendar");
    expect(normalizeHotspotMode("churn")).toBe("churn");
    expect(normalizeHotspotMode("off")).toBe("off");
    expect(normalizeHotspotMode("age")).toBe("age");
    expect(normalizeHotspotMode("rainbow")).toBe("age");
    expect(normalizeHotspotMode(undefined)).toBe("age");
    expect(normalizeHotspotMode(3)).toBe("age");
  });
});

describe("hotspot heat in the webview", () => {
  it("maps ten distinct ages onto the heat steps 0 (oldest) through 9 (newest)", () => {
    const hashes = Array.from({ length: 10 }, (_, index) => hashOf(index));
    const commits = Object.fromEntries(
      hashes.map((hash, index) => [hash, timed(hash, 1_700_000_000 + index * 1000)])
    );
    const hunks = hashes.map((hash, index) => lineHunk(hash, index + 1));
    const { root, view } = start();
    view.render(applyData(initialBlameState(), fileWith(hunks, commits)), NOW);
    expect(heats(root)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("draws the legend as Older, ten swatches on the heat tokens, then Newer", () => {
    const { root, view } = start();
    view.render(applyData(initialBlameState(), dataMessage()), NOW);
    const legend = root.querySelector<HTMLElement>(".blame-heat");
    expect(legend?.getAttribute("role")).toBe("group");
    expect(legend?.getAttribute("aria-label")).toBe("Heat scale, from older to newer");
    expect(legend?.querySelector(".blame-heat-end:first-child")?.textContent).toBe("Older");
    const swatches = [...root.querySelectorAll<HTMLElement>(".blame-heat-swatch")];
    expect(swatches).toHaveLength(10);
    expect(swatches.map((swatch) => swatch.className)).toEqual(
      Array.from({ length: 10 }, (_, step) => `blame-heat-swatch blame-heat-swatch-${step}`)
    );
    expect(root.querySelector(".blame-heat-scale")?.getAttribute("aria-hidden")).toBe("true");
    expect(legend?.lastElementChild?.previousElementSibling?.textContent).toBe("Newer");
  });

  it("offers the modes in order with the saved one selected", () => {
    const { root, view } = start();
    view.render(applyData(initialBlameState("churn"), dataMessage({ requestId: 1 })), NOW);
    const select = root.querySelector<HTMLSelectElement>(".blame-heat-select");
    expect(select?.getAttribute("aria-label")).toBe("Hotspot mode");
    expect([...(select?.options ?? [])].map((option) => option.value)).toEqual([
      "age",
      "calendar",
      "churn",
      "off"
    ]);
    expect(select?.value).toBe("churn");
    expect([...(select?.options ?? [])].map((option) => option.textContent)).toEqual([
      "Age",
      "Calendar",
      "Churn",
      "Off"
    ]);
  });

  it("reports a chosen mode to the caller, and never for an unknown value", () => {
    const { root, view, onHotspotModeChange } = start();
    view.render(applyData(initialBlameState(), dataMessage()), NOW);
    const select = root.querySelector<HTMLSelectElement>(".blame-heat-select");
    if (select === null) throw new Error("no mode selector");
    select.value = "calendar";
    select.dispatchEvent(new Event("change"));
    expect(onHotspotModeChange).toHaveBeenLastCalledWith("calendar");
  });

  it("draws no scale and no heat in Off, and the selector stays", () => {
    const off = applyHotspotMode(applyData(initialBlameState(), dataMessage()), "off");
    const { root, view } = start();
    view.render(off, NOW);
    expect(heats(root)).toEqual(["none", "none"]);
    expect(root.querySelector(".blame-heat-scale")).toBeNull();
    expect(root.querySelector(".blame-heat-swatch")).toBeNull();
    expect(root.querySelector<HTMLSelectElement>(".blame-heat-select")?.value).toBe("off");
  });

  it("recomputes the heat for a new mode without a host round-trip", () => {
    const loaded = applyData(initialBlameState(), dataMessage(), THREE_DAYS_AFTER_NEWER);
    // Age: the older commit is 0 and the newer one 9 (the fixture's ranks).
    expect(loaded.hunks.map((band) => band.heat.level)).toEqual([0, 9]);
    // Calendar: the older commit is over two years old, the newer one three days.
    const calendar = applyHotspotMode(loaded, "calendar", THREE_DAYS_AFTER_NEWER);
    expect(calendar.hotspotMode).toBe("calendar");
    expect(calendar.hunks.map((band) => band.heat.level)).toEqual([0, 7]);
  });

  it("scores churn by recency times the hunks a commit owns in the file", () => {
    const old = "aa".repeat(20);
    const recent = "bb".repeat(20);
    const commits = { [old]: timed(old, 1_700_000_000), [recent]: timed(recent, 1_800_000_000) };
    const hunks = [lineHunk(old, 1), lineHunk(recent, 2), lineHunk(old, 3), lineHunk(old, 4)];
    const churn = applyData(
      initialBlameState("churn"),
      fileWith(hunks, commits),
      THREE_DAYS_AFTER_NEWER
    );
    // The old commit owns three hunks, the recent one a single hunk: 1.5 against 1.
    expect(churn.hunks.map((band) => band.heat.level)).toEqual([9, 6, 9, 9]);
  });

  it("keeps uncommitted hunks uncommitted in every mode", () => {
    const zero = "0".repeat(40);
    const commits = {
      [zero]: commit({ hash: zero, uncommitted: true, summary: "" }),
      [hashOf(0)]: timed(hashOf(0), 1_700_000_000)
    };
    const hunks = [lineHunk(zero, 1), lineHunk(hashOf(0), 2)];
    for (const mode of ["age", "calendar", "churn", "off"] as const) {
      const scored = applyData(
        initialBlameState(mode),
        fileWith(hunks, commits),
        THREE_DAYS_AFTER_NEWER
      );
      expect(scored.hunks[0].heat.uncommitted, mode).toBe(true);
      expect(scored.hunks[0].heat.level, mode).toBeNull();
    }
    const { root, view } = start();
    view.render(applyData(initialBlameState("churn"), fileWith(hunks, commits)), NOW);
    // One committed commit is the file's only rank, so its churn is the top step.
    expect(heats(root)).toEqual(["uncommitted", "9"]);
  });
});

describe("same-commit highlight", () => {
  // Commit A owns lines 1, 5 and 9; commit B owns line 3. Hunks are not adjacent.
  const a = hashOf(0);
  const b = hashOf(1);
  const commits = { [a]: timed(a, 1_700_000_000), [b]: timed(b, 1_800_000_000) };
  const hunks = [lineHunk(a, 1), lineHunk(b, 3), lineHunk(a, 5), lineHunk(a, 9)];

  function drawn() {
    const { root, view } = start();
    view.render(applyData(initialBlameState(), fileWith(hunks, commits)), NOW);
    const bands = [...root.querySelectorAll<HTMLElement>(".blame-hunk")];
    const marked = () => bands.map((band) => band.classList.contains("is-same-commit"));
    return { root, bands, marked };
  }

  it("marks every hunk of the hovered commit, across non-adjacent lines", () => {
    const { root, bands, marked } = drawn();
    bands[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(marked()).toEqual([true, false, true, true]);
    // Moving to another commit moves the mark.
    bands[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(marked()).toEqual([false, true, false, false]);
    // Leaving the file clears it.
    root.querySelector(".blame-body")?.dispatchEvent(new MouseEvent("mouseleave"));
    expect(marked()).toEqual([false, false, false, false]);
  });

  it("marks the same way for keyboard focus, and clears when focus leaves the file", () => {
    const { bands, marked } = drawn();
    expect(bands.every((band) => band.tabIndex === 0)).toBe(true);
    bands[3].dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(marked()).toEqual([true, false, true, true]);
    // Focus moving between two hunks of one commit keeps the mark.
    bands[2].dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: bands[3] }));
    expect(marked()).toEqual([true, false, true, true]);
    bands[2].dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    expect(marked()).toEqual([false, false, false, false]);
  });
});

// The webview script runs once per document, as main.test.ts loads it.
async function startWebview(saved: unknown) {
  const box = { value: saved };
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: () => undefined,
    getState: () => box.value,
    setState: (value: unknown) => {
      box.value = value;
    }
  }));
  document.body.innerHTML = '<div id="blameTab"></div>';
  const root = document.getElementById("blameTab") as HTMLElement;
  vi.resetModules();
  await import("@/webview/blameTab/main");
  return { root, savedState: () => box.value };
}

function sendData(): void {
  const message: BlameHostMessage = dataMessage();
  window.dispatchEvent(
    new MessageEvent("message", { data: message, origin: window.location.origin })
  );
}

describe("hotspot mode in the webview script", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws with the saved mode, saves each change, and restores the choice on reload", async () => {
    const first = await startWebview({ hotspotMode: "churn" });
    sendData();
    // Churn, not the host's age scores: the old commit owns half the file's churn.
    expect(heats(first.root)).toEqual(["5", "9"]);

    const select = first.root.querySelector<HTMLSelectElement>(".blame-heat-select");
    if (select === null) throw new Error("no mode selector");
    select.value = "off";
    select.dispatchEvent(new Event("change"));
    expect(heats(first.root)).toEqual(["none", "none"]);
    expect(first.savedState()).toMatchObject({ hotspotMode: "off" });

    const second = await startWebview(first.savedState());
    sendData();
    expect(heats(second.root)).toEqual(["none", "none"]);
    expect(second.root.querySelector<HTMLSelectElement>(".blame-heat-select")?.value).toBe("off");
  });

  it("falls back to age when the saved mode is unknown", async () => {
    const webview = await startWebview({ hotspotMode: "rainbow" });
    sendData();
    expect(heats(webview.root)).toEqual(["0", "9"]);
    expect(webview.root.querySelector<HTMLSelectElement>(".blame-heat-select")?.value).toBe("age");
  });
});
