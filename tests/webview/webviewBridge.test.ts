import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import { webviewBridgeFactory } from "@/extension/webviewBridge";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage } from "@/types";

type ReceiveMessage = (msg: RequestMessage) => void | Promise<void>;

function missingReceiveMessage(): never {
  throw new Error("message handler was not registered");
}

function createHarness() {
  let receiveMessage: ReceiveMessage = missingReceiveMessage;
  const posted: unknown[] = [];
  const events: string[] = [];
  const mute = vi.fn(() => events.push("mute"));
  const unmute = vi.fn(() => events.push("unmute"));
  const webview = {
    onDidReceiveMessage: vi.fn((handler: ReceiveMessage) => {
      receiveMessage = handler;
      return { dispose: vi.fn() };
    }),
    postMessage: vi.fn((msg: unknown) => {
      posted.push(msg);
      return Promise.resolve(true);
    })
  } as unknown as vscode.Webview;
  const repoFileWatcher = {
    mute,
    unmute
  } as unknown as RepoFileWatcher;

  const bridge = webviewBridgeFactory(webview, repoFileWatcher);

  return {
    bridge,
    events,
    posted,
    receiveMessage,
    repoFileWatcher: { mute, unmute },
    webview
  };
}

describe("webviewBridgeFactory", () => {
  it("does not mute the repo watcher when no handler is registered", async () => {
    const { receiveMessage, repoFileWatcher } = createHarness();

    await receiveMessage({ command: "loadRepos", check: false });

    expect(repoFileWatcher.mute).not.toHaveBeenCalled();
    expect(repoFileWatcher.unmute).not.toHaveBeenCalled();
  });

  it("mutes while a registered handler runs and unmutes afterward", async () => {
    const { bridge, events, receiveMessage, repoFileWatcher } = createHarness();

    bridge.onMessage("loadRepos", async () => {
      events.push("handler");
    });
    await receiveMessage({ command: "loadRepos", check: false });

    expect(events).toEqual(["mute", "handler", "unmute"]);
    expect(repoFileWatcher.mute).toHaveBeenCalledTimes(1);
    expect(repoFileWatcher.unmute).toHaveBeenCalledTimes(1);
  });

  it("unmutes the repo watcher when a handler throws", async () => {
    const { bridge, events, receiveMessage, repoFileWatcher } = createHarness();

    bridge.onMessage("loadRepos", async () => {
      events.push("handler");
      throw new Error("load failed");
    });

    await expect(receiveMessage({ command: "loadRepos", check: false })).rejects.toThrow(
      "load failed"
    );

    expect(events).toEqual(["mute", "handler", "unmute"]);
    expect(repoFileWatcher.mute).toHaveBeenCalledTimes(1);
    expect(repoFileWatcher.unmute).toHaveBeenCalledTimes(1);
  });
});
