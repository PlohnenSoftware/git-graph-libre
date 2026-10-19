import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DiffTabLabels,
  DiffTabPayload,
  DiffTabShowMessage,
  DiffTabWebviewMessage
} from "@/diffTabTypes";

const LABELS: DiffTabLabels = {
  hiddenLines: "{0} hidden lines",
  showMoreAbove: "Show More Above",
  showMoreBelow: "Show More Below",
  showAll: "Show All",
  binaryFile: "Binary file",
  tooLarge: "Too large",
  loadError: "Unable to load the diff: {0}"
};
const DIFF: DiffTabPayload = {
  kind: "diff",
  originalLines: ["one", "two", "three"],
  modifiedLines: ["one", "TWO", "three", "four"],
  changes: [
    {
      original: { start: 2, endExclusive: 3 },
      modified: { start: 2, endExclusive: 3 },
      inner: [
        {
          original: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 4 },
          modified: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 4 }
        }
      ]
    },
    {
      original: { start: 4, endExclusive: 4 },
      modified: { start: 4, endExclusive: 5 },
      inner: []
    }
  ]
};

// Each test loads a fresh copy of the script, which posts to its own list.
async function start() {
  const posted: DiffTabWebviewMessage[] = [];
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: unknown) => posted.push(message as DiffTabWebviewMessage),
    getState: () => null,
    setState: () => {}
  }));
  document.body.innerHTML = '<div id="diffTab"></div>';
  const root = document.getElementById("diffTab") as HTMLElement;
  vi.resetModules();
  await import("@/webview/diffTab/main");
  return { posted, root, painted: () => posted.filter((m) => m.command === "painted") };
}

function show(payload: DiffTabPayload, origin = window.location.origin) {
  const data: DiffTabShowMessage = {
    command: "show",
    payload,
    layout: { hideUnchanged: false, contextLineCount: 3, minimumLineCount: 3, revealLineCount: 20 },
    lineHeight: 20,
    tabSize: 4,
    labels: LABELS
  };
  window.dispatchEvent(new MessageEvent("message", { data, origin }));
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: (text: string) => ({ width: text.length * 8 })
  } as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("GGL Diff tab webview", () => {
  it("reports ready as soon as it starts", async () => {
    const { posted, root } = await start();
    expect(posted).toEqual([{ command: "ready" }]);
    expect(root.childElementCount).toBe(0);
  });

  it("renders a diff's rows with the view's decorations", async () => {
    const { root, painted } = await start();
    show(DIFF);
    expect(root.classList.contains("ggl-diff")).toBe(true);
    expect(root.querySelectorAll(".diff-row")).toHaveLength(4);
    expect(root.querySelector(".line-delete .char-delete")?.textContent).toBe("two");
    expect(root.querySelector(".line-insert .char-insert")?.textContent).toBe("TWO");
    expect(root.querySelectorAll(".diagonal-fill")).toHaveLength(1);
    expect(document.activeElement).toBe(root);
    expect(painted()).toEqual([{ command: "painted", ms: expect.any(Number), rows: 4 }]);
  });

  it.each([
    [{ kind: "binary" } as const, "Binary file"],
    [{ kind: "tooLarge" } as const, "Too large"],
    [{ kind: "error", message: "boom" } as const, "Unable to load the diff: boom"]
  ])("shows the message for %o", async (payload, text) => {
    const { root, painted } = await start();
    show(payload);
    expect(root.querySelector(".diff-tab-message")?.textContent).toBe(text);
    expect(root.classList.contains("ggl-diff")).toBe(false);
    expect(painted()).toEqual([{ command: "painted", ms: expect.any(Number), rows: 0 }]);
  });

  it("replaces one payload with the next, and posts painted only once", async () => {
    const { root, painted } = await start();
    show(DIFF);
    show({ kind: "binary" });
    expect(root.classList.contains("ggl-diff")).toBe(false);
    expect(root.querySelectorAll(".diff-row")).toHaveLength(0);
    expect(root.textContent).toBe("Binary file");
    show(DIFF);
    expect(root.querySelector(".diff-tab-message")).toBeNull();
    expect(root.querySelectorAll(".diff-row")).toHaveLength(4);
    expect(painted()).toHaveLength(1);
    expect(painted()[0]).toMatchObject({ rows: 4 });
  });

  it("ignores messages from another origin", async () => {
    const { posted, root } = await start();
    show(DIFF, "https://example.invalid");
    expect(root.childElementCount).toBe(0);
    expect(posted).toEqual([{ command: "ready" }]);
  });
});
