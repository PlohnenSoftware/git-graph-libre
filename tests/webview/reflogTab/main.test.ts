import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReflogHostMessage, ReflogWebviewMessage } from "@/reflogTabTypes";

import { dataMessage, LABELS, page, row } from "./fixtures";

// Each test loads a fresh copy of the script, which posts to its own list.
async function start() {
  const posted: ReflogWebviewMessage[] = [];
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: unknown) => posted.push(message as ReflogWebviewMessage),
    getState: () => null,
    setState: () => {}
  }));
  document.body.innerHTML = '<div id="reflogTab"></div>';
  const root = document.getElementById("reflogTab") as HTMLElement;
  vi.resetModules();
  await import("@/webview/reflogTab/main");
  return { posted, root };
}

function send(message: ReflogHostMessage, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent("message", { data: message, origin }));
}

afterEach(() => {
  vi.unstubAllGlobals();
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
    send({
      command: "reflogLoading",
      requestId: 1,
      repo: "/repos/one",
      locale: "en",
      labels: LABELS
    });
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

  it("ignores messages from another origin", async () => {
    const { root } = await start();
    send(dataMessage(), "https://example.invalid");
    expect(root.childElementCount).toBe(0);
  });
});
