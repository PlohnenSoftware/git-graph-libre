import { afterEach, describe, expect, it, vi } from "vitest";

import type { StatsHostMessage, StatsWebviewMessage } from "@/statsTabTypes";

import { dataMessage, loadingMessage } from "./fixtures";

// Each test loads a fresh copy of the script, which posts to its own list.
async function start() {
  const posted: StatsWebviewMessage[] = [];
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: unknown) => posted.push(message as StatsWebviewMessage)
  }));
  document.body.innerHTML = '<div id="statsTab"></div>';
  const root = document.getElementById("statsTab") as HTMLElement;
  vi.resetModules();
  await import("@/webview/statsTab/main");
  return { posted, root };
}

function send(message: StatsHostMessage, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent("message", { data: message, origin }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("statistics tab webview", () => {
  it("reports ready as soon as it starts and draws nothing yet", async () => {
    const { posted, root } = await start();
    expect(posted).toEqual([{ command: "ready" }]);
    expect(root.childElementCount).toBe(0);
  });

  it("shows loading, then the data, and posts refresh from its button", async () => {
    const { posted, root } = await start();
    send(loadingMessage());
    expect(root.querySelector(".stats-loading")).not.toBeNull();
    send(dataMessage());
    expect(root.querySelectorAll(".stats-heat-row")).toHaveLength(7);
    root.querySelector<HTMLButtonElement>(".stats-refresh")?.click();
    expect(posted.filter((message) => message.command === "refresh")).toEqual([
      { command: "refresh" }
    ]);
  });

  it("ignores messages from another origin", async () => {
    const { root } = await start();
    send(dataMessage(), "https://elsewhere.example");
    expect(root.childElementCount).toBe(0);
  });
});
