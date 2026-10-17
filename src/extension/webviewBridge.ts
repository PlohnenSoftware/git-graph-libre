import type * as vscode from "vscode";
import { traceRequest } from "@/backend/utils/operationLog";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage, ResponseMessage } from "@/types";

export function webviewBridgeFactory(webview: vscode.Webview, repoFileWatcher: RepoFileWatcher) {
  const handlers = new Map<string, (msg: RequestMessage) => void | Promise<void>>();

  webview.onDidReceiveMessage(async (msg: RequestMessage) => {
    const handler = handlers.get(msg.command);
    if (!handler) return;
    repoFileWatcher.mute();
    try {
      await traceRequest(msg.command, "requestId" in msg ? msg.requestId : undefined, async () =>
        handler(msg)
      );
    } finally {
      repoFileWatcher.unmute();
    }
  });

  return {
    post: (msg: ResponseMessage) => webview.postMessage(msg),
    onMessage: <T extends RequestMessage["command"]>(
      command: T,
      handler: (msg: Extract<RequestMessage, { command: T }>) => void | Promise<void>
    ) => {
      handlers.set(command, handler as (msg: RequestMessage) => void | Promise<void>);
    }
  };
}

export type WebviewBridge = ReturnType<typeof webviewBridgeFactory>;
