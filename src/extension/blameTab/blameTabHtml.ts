import type * as vscode from "vscode";

import { getNonce } from "@/backend/utils/nonce";
import { buildExtensionUri } from "@/backend/utils/path";

/**
 * The Blame tab's document, with the GGL Diff tab's CSP pattern
 * (`diffTabHtml.ts`): nothing by default, styles from the extension, and
 * scripts only with this document's nonce, so no `unsafe-eval`. Images
 * are the commit popover's cached avatars only (F4-06), carried as data
 * URIs. Its data arrives later by message.
 */
export function buildBlameTabHtml(
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" type="text/css" href="${uri("media", "tokens.css")}">
<link rel="stylesheet" type="text/css" href="${uri("media", "blame-tab", "blame-tab.css")}">
<style>html, body, #blameTab { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body><div id="blameTab"></div><script nonce="${nonce}" src="${uri("out", "blameTab.min.js")}"></script></body>
</html>`;
}
