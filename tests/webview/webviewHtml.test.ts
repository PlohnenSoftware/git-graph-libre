import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import { buildWebviewHtml } from "@/extension/webviewHtml";
import type { RepoManager } from "@/extension/repoManager";
import type { GitGraphViewState } from "@/types";
import type * as vscode from "vscode";
import { describe, expect, it } from "vitest";

function makeConfig(): Config {
  return {
    autoCenterCommitDetailsView: () => true,
    dateFormat: () => "Date & Time",
    dateType: () => "Author Date",
    fetchAvatars: () => false,
    graphColours: () => ["oklch(65% 0.16 250)"],
    graphFontSize: () => 15,
    graphRowHeight: () => 30,
    graphStyle: () => "rounded",
    initialLoadCommits: () => 300,
    loadMoreCommits: () => 100,
    maxDepthOfRepoSearch: () => 0,
    showCurrentBranchByDefault: () => false,
    showStatusBarItem: () => true,
    showUncommittedChanges: () => true,
    tabIconColourTheme: () => "colour",
    gitPath: () => "git"
  };
}

function extractViewState(html: string): GitGraphViewState {
  const match = html.match(/const viewState = (.*?);<\/script>/);
  if (match === null) throw new Error("Missing serialized viewState");
  return JSON.parse(match[1]) as GitGraphViewState;
}

describe("webview HTML", () => {
  it("passes graph density settings to style variables and view state", () => {
    const result = buildWebviewHtml({
      webview: {
        cspSource: "vscode-webview:",
        asWebviewUri: (uri: vscode.Uri) => `webview://${uri.fsPath}` as unknown as vscode.Uri
      } as unknown as vscode.Webview,
      config: makeConfig(),
      extensionPath: "/extension",
      extensionState: {
        isAvatarStorageAvailable: () => true,
        getLastActiveRepo: () => "/repo"
      } as ExtensionState,
      repoManager: {
        getRepos: () => ({ "/repo": { columnWidths: null } })
      } as unknown as RepoManager
    });

    const viewState = extractViewState(result.html);

    expect(result.html).toContain("--git-graph-font-size:15px;");
    expect(result.html).toContain("--git-graph-row-height:30px;");
    expect(viewState.graphFontSize).toBe(15);
    expect(viewState.graphRowHeight).toBe(30);
  });
});
