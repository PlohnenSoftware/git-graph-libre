import type * as vscode from "vscode";

import { getNonce } from "@/backend/utils/nonce";
import { buildExtensionUri } from "@/backend/utils/path";
import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import * as l10n from "@/l10n";
import type { GitGraphViewState } from "@/types";

import type { RepoManager } from "./repoManager";
import { getWebviewLocalizedStrings } from "./webviewL10n";
import { buildWebviewStatusStrip } from "./webviewStatusStrip";
import { buildWebviewToolbar } from "./webviewToolbar";

/**
 * Safely escape JSON for embedding in HTML script tags.
 * Prevents XSS by escaping characters that could break out of script context.
 */
function escapeJsonForHtml(obj: object): string {
  return JSON.stringify(obj)
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(">", String.raw`\u003e`)
    .replaceAll("&", String.raw`\u0026`);
}

export function buildWebviewHtml(opts: {
  webview: vscode.Webview;
  config: Config;
  extensionPath: string;
  extensionState: ExtensionState;
  repoManager: RepoManager;
  extensionVersion: string;
}): { html: string; isGraphLoaded: boolean } {
  const { webview, config, extensionPath, extensionState, repoManager, extensionVersion } = opts;
  const nonce = getNonce();
  const l10nStrings = getWebviewLocalizedStrings();
  const viewState: GitGraphViewState = {
    autoCenterCommitDetailsView: config.autoCenterCommitDetailsView(),
    commitDetailsCompactFolders: config.commitDetailsCompactFolders(),
    commitDetailsFileViewMode: config.commitDetailsFileViewMode(),
    contextMenuActionsVisibility: config.contextMenuActionsVisibility(),
    dateFormat: config.dateFormat(),
    fetchAvatars: config.fetchAvatars() && extensionState.isAvatarStorageAvailable(),
    showSignatureColumn: config.showSignatureColumn(),
    graphColors: config.graphColors(),
    customBranchGlobPatterns: config.customBranchGlobPatterns(),
    graphFontSize: config.graphFontSize(),
    graphRowHeight: config.graphRowHeight(),
    graphStyle: config.graphStyle(),
    revealHighlightColor: config.revealHighlightColor(),
    includeReflog: config.includeReflog(),
    includeUnreachableCommits: config.includeUnreachableCommits(),
    initialLoadCommits: config.initialLoadCommits(),
    lastActiveRepo: extensionState.getLastActiveRepo(),
    loadMoreCommits: config.loadMoreCommits(),
    muteCommitsNotAncestorsOfHead: config.muteCommitsNotAncestorsOfHead(),
    muteMergeCommits: config.muteMergeCommits(),
    boldCheckedOutCommit: config.boldCheckedOutCommit(),
    fetchTagsByDefault: config.fetchTagsByDefault(),
    onlyFollowFirstParent: config.onlyFollowFirstParent(),
    repos: repoManager.getRepos(),
    showCurrentBranchByDefault: config.showCurrentBranchByDefault(),
    showRemoteBranches: config.showRemoteBranches(),
    showStashes: config.showStashes(),
    showTags: config.showTags(),
    shortHashLength: config.shortHashLength()
  };

  const numRepos = Object.keys(viewState.repos).length;
  let styleVars = `--git-graph-font-size:${viewState.graphFontSize}px; --git-graph-row-height:${viewState.graphRowHeight}px; --ngg-reveal-highlight:${viewState.revealHighlightColor}; `,
    colorParams = "";
  for (let i = 0; i < viewState.graphColors.length; i++) {
    styleVars += `--git-graph-color${i}:${viewState.graphColors[i]}; `;
    colorParams += `[data-color="${i}"]{--git-graph-color:var(--git-graph-color${i});} `;
  }

  const mediaUri = (file: string) =>
    webview.asWebviewUri(buildExtensionUri(extensionPath, "media", file));
  const compiledOutputUri = (file: string) =>
    webview.asWebviewUri(buildExtensionUri(extensionPath, "out", file));

  let body: string;
  if (numRepos > 0) {
    body = `<body style="${styleVars}">
		<div id="topBar">
		${buildWebviewStatusStrip(l10nStrings, extensionVersion)}
		${buildWebviewToolbar(l10nStrings)}
		</div>
		<div id="settingsWidgetBacking" hidden></div>
		<aside id="settingsWidget" role="dialog" aria-modal="true" tabindex="-1" aria-label="${l10nStrings.repositorySettings}" hidden></aside>
		<div id="content">
			<div id="commitGraph"></div>
			<div id="commitTable"></div>
		</div>
		<div id="footer"></div>
		<ul id="contextMenu" role="menu"></ul>
			<div id="dialogBacking"></div>
			<div id="dialog"></div>
		<script nonce="${nonce}">const viewState = ${escapeJsonForHtml(viewState)};</script>
		<script nonce="${nonce}">const l10n = ${escapeJsonForHtml(l10nStrings)};</script>
		<script src="${compiledOutputUri("web.min.js")}"></script>
		</body>`;
  } else {
    body = `<body class="unableToLoad" style="${styleVars}">
		<h2>${l10nStrings.unableToLoadGitGraph}</h2>
		<p>${l10nStrings.noGitRepository}</p>
		<p>${l10nStrings.noGit}</p>
		</body>`;
  }

  const html = `<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src data:;">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link rel="stylesheet" type="text/css" href="${mediaUri("main.css")}">
			<link rel="stylesheet" type="text/css" href="${mediaUri("dropdown.css")}">
			<title>${l10n.t("outputChannel.text")}</title>
			<style>${colorParams}"</style>
		</head>
		${body}
	</html>`;

  return { html, isGraphLoaded: numRepos > 0 };
}
