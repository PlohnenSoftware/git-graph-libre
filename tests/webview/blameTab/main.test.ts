import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlameHostMessage, BlameWebviewMessage } from "@/blameTabTypes";

import { dataMessage, hunk, loadingMessage, NEW_HASH, OLD_HASH, payload } from "./fixtures";

// Each test loads a fresh copy of the script, which posts to its own list.
// The saved webview state is one object the script reads once and replaces
// wholesale, exactly as a document reload would hand it back.
async function start(saved: unknown = null) {
  const posted: BlameWebviewMessage[] = [];
  const box = { value: saved };
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: unknown) => posted.push(message as BlameWebviewMessage),
    getState: () => box.value,
    setState: (value: unknown) => {
      box.value = value;
    }
  }));
  document.body.innerHTML = '<div id="blameTab"></div>';
  const root = document.getElementById("blameTab") as HTMLElement;
  vi.resetModules();
  await import("@/webview/blameTab/main");
  return { posted, root, savedState: () => box.value };
}

function send(message: BlameHostMessage, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent("message", { data: message, origin }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("blame tab webview", () => {
  it("reports ready as soon as it starts", async () => {
    const { posted, root } = await start();
    expect(posted).toEqual([{ command: "ready" }]);
    expect(root.childElementCount).toBe(0);
  });

  it("shows loading, then the blamed file", async () => {
    const { root } = await start();
    send(loadingMessage());
    expect(root.querySelector(".blame-loading")).not.toBeNull();
    send(dataMessage());
    expect(root.querySelectorAll(".blame-hunk")).toHaveLength(2);
    expect(root.querySelectorAll(".blame-line")).toHaveLength(4);
  });

  it("ignores a stale reply that lands behind a newer one", async () => {
    const { root } = await start();
    send(dataMessage({ requestId: 5, payload: payload({ totalLines: 2, hunks: [hunk()] }) }));
    send(dataMessage({ requestId: 2 }));
    expect(root.querySelector(".blame-line-count")?.textContent).toBe("2 lines");
    expect(root.querySelectorAll(".blame-hunk")).toHaveLength(1);
  });

  it("keeps the dragged gutter width per repository across a reload", async () => {
    const first = await start();
    send(dataMessage());
    const body = first.root.querySelector(".blame-body") as HTMLElement;
    first.root
      .querySelector<HTMLElement>(".blame-gutter-resize")
      ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 100 }));
    body.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 160 }));
    body.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    // The default 280 plus the 60px drag.
    expect(first.savedState()).toEqual({
      gutterWidthByRepo: { "/repos/one": 340 },
      hotspotMode: "age"
    });
    expect(first.root.querySelectorAll(".blame-line")).toHaveLength(4);

    const second = await start(first.savedState());
    send(dataMessage());
    expect(
      second.root
        .querySelector<HTMLElement>(".blame-body")
        ?.style.getPropertyValue("--blame-gutter-width")
    ).toBe("340px");

    // Another repository has no saved width of its own.
    send(dataMessage({ repo: "/repos/two" }));
    expect(
      second.root
        .querySelector<HTMLElement>(".blame-body")
        ?.style.getPropertyValue("--blame-gutter-width")
    ).toBe("280px");
  });

  it("ignores messages from another origin", async () => {
    const { root } = await start();
    send(dataMessage(), "https://example.invalid");
    expect(root.childElementCount).toBe(0);
  });

  it("posts blameHead, blameLatest and openFile commands from header and notice actions", async () => {
    const { root, posted } = await start();
    send(dataMessage({ requestId: 1, unsavedBuffer: true }));
    root.querySelector<HTMLButtonElement>(".blame-head-btn")?.click();
    expect(posted.at(-1)).toEqual({ command: "blameHead" });

    send(dataMessage({ requestId: 2, rev: "a".repeat(40) }));
    send({ command: "blameRepoChanged", repo: "/repos/one" });
    expect(root.querySelector(".blame-repo-changed-text")?.textContent).toBe("Repository changed");
    root.querySelector<HTMLButtonElement>(".blame-latest-btn")?.click();
    expect(posted.at(-1)).toEqual({ command: "blameLatest" });

    send(
      dataMessage({
        requestId: 3,
        payload: payload({ state: "untracked", commits: {}, hunks: [], totalLines: 0 })
      })
    );
    root.querySelector<HTMLButtonElement>(".blame-open-file-btn")?.click();
    expect(posted.at(-1)).toEqual({ command: "openFile" });
  });

  it("posts rewind, navigate, setOptions and clearIgnoredCommit messages to the host", async () => {
    const { posted, root } = await start();
    send(
      dataMessage({
        rev: NEW_HASH,
        targetLine: 3,
        navigation: {
          backCount: 1,
          forwardCount: 1,
          canLatest: true,
          initialFilePath: "src/file.ts"
        },
        ignoreRevs: [OLD_HASH],
        payload: payload({ resolvedRev: NEW_HASH, hasIgnoreRevsFile: true })
      })
    );

    const rewindBtn = root.querySelector<HTMLButtonElement>(".blame-rewind-btn:not(:disabled)");
    rewindBtn?.click();
    root.querySelector<HTMLButtonElement>(".blame-nav-back")?.click();
    root.querySelector<HTMLButtonElement>(".blame-option-w")?.click();
    root.querySelector<HTMLButtonElement>(".blame-ignore-revs-file-chip")?.click();
    root.querySelector<HTMLButtonElement>(".blame-chip-remove")?.click();
    root.querySelector<HTMLButtonElement>(".blame-clear-ignored-btn")?.click();

    expect(posted).toEqual([
      { command: "ready" },
      { command: "rewind", rev: OLD_HASH, filePath: "src/file.ts", targetLine: 3 },
      { command: "navigate", direction: "back" },
      { command: "setOptions", options: { ignoreWhitespace: true }, targetLine: 3 },
      { command: "setOptions", options: { useIgnoreRevsFile: false }, targetLine: 3 },
      { command: "clearIgnoredCommit", commitHash: OLD_HASH, targetLine: 3 },
      { command: "clearIgnoredCommit", commitHash: null, targetLine: 3 }
    ]);
  });
});
