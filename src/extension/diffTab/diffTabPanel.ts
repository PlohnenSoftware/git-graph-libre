import * as vscode from "vscode";

import { buildExtensionUri } from "@/backend/utils/path";
import type {
  DiffTabLabels,
  DiffTabPayload,
  DiffTabRequest,
  DiffTabShowMessage,
  DiffTabSource,
  DiffTabWebviewMessage
} from "@/diffTabTypes";
import * as l10n from "@/l10n";

import { buildDiffTabHtml } from "./diffTabHtml";

export type DiffTabDeps = {
  extensionPath: string;
  outputChannel: Pick<vscode.OutputChannel, "appendLine">;
};

type DiffTab = { show(request: DiffTabRequest, loading: Promise<DiffTabPayload>): void };

// One tab at a time, reused like the diff editor's preview tab.
let current: DiffTab | undefined;

/**
 * Open the GGL Diff tab, or retitle and reveal the one already open. The load
 * starts now, alongside the webview's start-up, and its payload is posted
 * once both are done, so a cold open costs the slower of the two.
 */
export function openDiffTab(
  request: DiffTabRequest,
  source: DiffTabSource,
  deps: DiffTabDeps
): void {
  const loading = source.load(request).catch(
    (error: unknown): DiffTabPayload => ({
      kind: "error",
      message: error instanceof Error ? error.message : String(error)
    })
  );
  current ??= createDiffTab(request.title, deps);
  current.show(request, loading);
}

function createDiffTab(title: string, deps: DiffTabDeps): DiffTab {
  // `retainContextWhenHidden` keeps the document alive while its tab is in
  // the background, so every open after the first is one message.
  const panel = vscode.window.createWebviewPanel(
    "git-graph-libre.diffTab",
    title,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        buildExtensionUri(deps.extensionPath, "media"),
        buildExtensionUri(deps.extensionPath, "out")
      ]
    }
  );
  panel.webview.html = buildDiffTabHtml(panel.webview, deps.extensionPath);
  let ready = false;
  let last: DiffTabShowMessage | undefined;
  let latestOpen = 0;
  const post = (message: DiffTabShowMessage): void => {
    void panel.webview.postMessage(message);
  };
  const tab: DiffTab = {
    show(request, loading) {
      const open = ++latestOpen;
      panel.title = request.title;
      panel.reveal(vscode.ViewColumn.Active);
      void loading.then((payload) => {
        if (open !== latestOpen || current !== tab) return;
        last = { command: "show", payload, ...readViewSettings(), labels: readLabels() };
        if (ready) post(last);
      });
    }
  };
  const received = panel.webview.onDidReceiveMessage((message: DiffTabWebviewMessage) => {
    if (message.command === "ready") {
      // Also after a reload or a restore: the new document needs the payload.
      ready = true;
      if (last) post(last);
    } else if (message.command === "painted") {
      deps.outputChannel.appendLine(
        `[diffTab] painted ms=${Math.round(Number(message.ms))} rows=${Number(message.rows)}`
      );
    }
  });
  panel.onDidDispose(() => {
    received.dispose();
    if (current === tab) current = undefined;
  });
  return tab;
}

function readViewSettings(): Pick<DiffTabShowMessage, "layout" | "lineHeight" | "tabSize"> {
  const diffEditor = vscode.workspace.getConfiguration("diffEditor");
  const editor = vscode.workspace.getConfiguration("editor");
  const count = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  return {
    layout: {
      hideUnchanged: diffEditor.get("hideUnchangedRegions.enabled") === true,
      contextLineCount: count(diffEditor.get("hideUnchangedRegions.contextLineCount"), 3),
      minimumLineCount: count(diffEditor.get("hideUnchangedRegions.minimumLineCount"), 3),
      revealLineCount: count(diffEditor.get("hideUnchangedRegions.revealLineCount"), 20)
    },
    lineHeight: lineHeightInPixels(
      count(editor.get("lineHeight"), 0),
      count(editor.get("fontSize"), 14)
    ),
    tabSize: count(editor.get("tabSize"), 4)
  };
}

/**
 * `editor.lineHeight` in pixels. 0 derives it from the font size, at × 1.5 as
 * D44 specifies (VS Code's ratio on macOS; it uses × 1.35 elsewhere, an open
 * question in D44's report). Values below 8 multiply the font size, as the
 * setting's description says, and VS Code never draws a line under 8 pixels.
 */
function lineHeightInPixels(lineHeight: number, fontSize: number): number {
  let pixels = lineHeight;
  if (lineHeight === 0) pixels = fontSize * 1.5;
  else if (lineHeight < 8) pixels = lineHeight * fontSize;
  return Math.max(8, Math.round(pixels));
}

function readLabels(): DiffTabLabels {
  return {
    hiddenLines: l10n.t("diffTab.hiddenLines"),
    showMoreAbove: l10n.t("diffTab.showMoreAbove"),
    showMoreBelow: l10n.t("diffTab.showMoreBelow"),
    showAll: l10n.t("diffTab.showAll"),
    binaryFile: l10n.t("diffTab.binaryFile"),
    tooLarge: l10n.t("diffTab.tooLarge"),
    loadError: l10n.t("diffTab.loadError")
  };
}
