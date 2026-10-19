import type * as vscode from "vscode";

import { getNonce } from "@/backend/utils/nonce";
import { buildExtensionUri } from "@/backend/utils/path";

/**
 * The GGL Diff tab's document, with the graph's CSP pattern
 * (`webviewHtml.ts`): nothing by default, styles from the extension, and
 * scripts only with this document's nonce, so no `unsafe-eval`. The tab shows
 * no images, so it has no `img-src`. Its data arrives later by message.
 */
export function buildDiffTabHtml(
  webview: Pick<vscode.Webview, "asWebviewUri" | "cspSource">,
  extensionPath: string
): string {
  const nonce = getNonce();
  const uri = (...parts: string[]) =>
    webview.asWebviewUri(buildExtensionUri(extensionPath, ...parts));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" type="text/css" href="${uri("media", "diff-tab", "vscode-diff.css")}">
<link rel="stylesheet" type="text/css" href="${uri("media", "diff-tab", "diff-tab.css")}">
<style>html, body, #diffTab { height: 100%; margin: 0; padding: 0; overflow: hidden; }
.diff-tab-message { margin: 0; padding: 12px 20px; color: var(--vscode-descriptionForeground, oklch(70% 0 0)); }</style>
</head>
<body><div id="diffTab"></div><script nonce="${nonce}" src="${uri("out", "diffTab.min.js")}"></script></body>
</html>`;
}
