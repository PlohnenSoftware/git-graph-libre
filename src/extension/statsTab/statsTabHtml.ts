import type * as vscode from "vscode";

import { getNonce } from "@/backend/utils/nonce";
import { buildExtensionUri } from "@/backend/utils/path";

/**
 * The Statistics tab's document, with the Reflog tab's CSP pattern
 * (`reflogTabHtml.ts`): nothing by default, styles from the extension,
 * and scripts only with this document's nonce, so no `unsafe-eval`. The
 * tab shows no images, so it has no `img-src`. Its data arrives later
 * by message.
 */
export function buildStatsTabHtml(
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
<link rel="stylesheet" type="text/css" href="${uri("media", "tokens.css")}">
<link rel="stylesheet" type="text/css" href="${uri("media", "stats-tab", "stats-tab.css")}">
<style>html, body, #statsTab { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body><div id="statsTab"></div><script nonce="${nonce}" src="${uri("out", "statsTab.min.js")}"></script></body>
</html>`;
}
