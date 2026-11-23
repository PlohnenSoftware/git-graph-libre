import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReflogHostMessage, ReflogWebviewMessage } from "@/reflogTabTypes";

import { dataMessage, loadingMessage, page, row } from "./fixtures";

// Each test loads a fresh copy of the script, which posts to its own list.
// The saved webview state is one object the script reads once and replaces
// wholesale, exactly as a document reload would hand it back.
async function start(saved: unknown = null) {
  const posted: ReflogWebviewMessage[] = [];
  const box = { value: saved };
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: unknown) => posted.push(message as ReflogWebviewMessage),
    getState: () => box.value,
    setState: (value: unknown) => {
      box.value = value;
    }
  }));
  document.body.innerHTML = '<div id="reflogTab"></div>';
  const root = document.getElementById("reflogTab") as HTMLElement;
  vi.resetModules();
  await import("@/webview/reflogTab/main");
  return { posted, root, savedState: () => box.value };
}

function send(message: ReflogHostMessage, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent("message", { data: message, origin }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("reflog tab webview", () => {
  it("reports ready as soon as it starts", async () => {
    const { posted, root } = await start();
    expect(posted).toEqual([{ command: "ready" }]);
    expect(root.childElementCount).toBe(0);
  });

  it("shows loading, then the page, and asks for one more page per click", async () => {
    const { posted, root } = await start();
    send(loadingMessage());
    expect(root.querySelector(".reflog-loading")).not.toBeNull();
    send(dataMessage({ page: page({ hasMore: true }) }));
    expect(root.querySelectorAll("tbody tr")).toHaveLength(1);
    root.querySelector<HTMLButtonElement>(".reflog-load-more")?.click();
    root.querySelector<HTMLButtonElement>(".reflog-load-more")?.click();
    expect(posted.filter((m) => m.command === "loadMore")).toEqual([{ command: "loadMore" }]);
    send(
      dataMessage({
        requestId: 2,
        append: true,
        page: page({ rows: [row({ index: 8, hash: "c".repeat(40) })] })
      })
    );
    expect(root.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(root.querySelector(".reflog-load-more")).toBeNull();
  });

  it("ignores a stale reply that lands behind a newer one", async () => {
    const { root } = await start();
    send(dataMessage({ requestId: 5, page: page({ rows: [row({ message: "commit: newer" })] }) }));
    send(dataMessage({ requestId: 2, page: page({ rows: [row({ message: "commit: stale" })] }) }));
    expect(root.querySelector(".reflog-message")?.textContent).toBe("commit: newer");
  });

  it("keeps dragged column widths per repository across a reload (F1-04F)", async () => {
    // A reload hands the saved widths back through getState: the first
    // pass drags, the second pass starts from what the first one saved.
    const first = await start();
    send(dataMessage({ page: page({ hasMore: true }) }));
    for (const [index, cell] of [...first.root.querySelectorAll("th")].entries()) {
      Object.defineProperty(cell, "clientWidth", { value: 116 + index * 10, configurable: true });
    }
    const handle = first.root.querySelector<HTMLElement>('.resizeCol[data-col="3"]');
    handle?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 100 }));
    const headRow = first.root.querySelector(".reflog-head-row") as HTMLElement;
    headRow.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 120 }));
    headRow.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    // Natural 100..160, then +20 traded across the message/commit edge.
    const savedWidths = [100, 110, 120, 150, 120, 150, 160];
    expect(first.savedState()).toEqual({ columnWidthsByRepo: { "/repos/one": savedWidths } });
    // The loaded page is untouched by the drag.
    expect(first.root.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(first.root.querySelector(".reflog-load-more")).not.toBeNull();

    const second = await start(first.savedState());
    send(dataMessage({ page: page({ rows: [row(), row({ index: 1 })] }) }));
    const cols = [...second.root.querySelectorAll<HTMLElement>("thead th")].map(
      (cell) => cell.style.width
    );
    expect(cols).toEqual(savedWidths.map((width) => `${width}px`));
    expect(second.root.querySelector("table")?.classList.contains("fixedLayout")).toBe(true);
    expect(second.root.querySelectorAll("tbody tr")).toHaveLength(2);

    // Another repository has no saved widths of its own.
    send(dataMessage({ repo: "/repos/two" }));
    expect(second.root.querySelector("table")?.classList.contains("fixedLayout")).toBe(false);
  });

  it("debounces the search box and sends other filter changes at once (F1-05)", async () => {
    const { posted, root } = await start();
    send(dataMessage());
    vi.useFakeTimers();
    const search = root.querySelector<HTMLInputElement>("#reflogSearch") as HTMLInputElement;
    search.value = "nee";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.value = "needle";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(posted.filter((message) => message.command === "query")).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(posted.filter((message) => message.command === "query")).toEqual([
      {
        command: "query",
        query: {
          ref: "HEAD",
          worktreePath: null,
          search: "needle",
          actions: [],
          onlyInReflog: false
        }
      }
    ]);
    // An instant change after typing asks for the newest whole query now.
    search.value = "other";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const only = root.querySelector<HTMLInputElement>("#reflogOnlyFilter") as HTMLInputElement;
    only.checked = true;
    only.dispatchEvent(new Event("change", { bubbles: true }));
    expect(posted.filter((message) => message.command === "query")).toHaveLength(2);
    expect(posted.at(-1)).toEqual({
      command: "query",
      query: { ref: "HEAD", worktreePath: null, search: "other", actions: [], onlyInReflog: true }
    });
    vi.advanceTimersByTime(500);
    expect(posted.filter((message) => message.command === "query")).toHaveLength(2);
  });

  it("ignores messages from another origin", async () => {
    const { root } = await start();
    send(dataMessage(), "https://example.invalid");
    expect(root.childElementCount).toBe(0);
  });
});
