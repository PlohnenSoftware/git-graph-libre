import { describe, expect, it } from "vitest";
import type * as vscode from "vscode";
import type { Config } from "@/config";
import type { RepoManager } from "@/extension/repoManager";
import { buildWebviewHtml } from "@/extension/webviewHtml";
import type { ExtensionState } from "@/extensionState";
import type { GitGraphViewState } from "@/types";

function makeConfig(): Config {
  return {
    autoCenterCommitDetailsView: () => true,
    commitDetailsCompactFolders: () => true,
    commitDetailsFileViewMode: () => "list",
    dateFormat: () => "Date & Time",
    dateType: () => "Author Date",
    fetchAvatars: () => false,
    graphColors: () => ["oklch(65% 0.16 250)"],
    customBranchGlobPatterns: () => [{ name: "Features", glob: "--glob=heads/feature/*" }],
    graphFontSize: () => 15,
    graphRowHeight: () => 30,
    graphStyle: () => "rounded",
    includeReflog: () => false,
    shortHashLength: () => 12,
    initialLoadCommits: () => 300,
    loadMoreCommits: () => 100,
    maxDepthOfRepoSearch: () => 0,
    onlyFollowFirstParent: () => false,
    showCurrentBranchByDefault: () => false,
    showRemoteBranches: () => true,
    showStashes: () => true,
    showTags: () => true,
    showStatusBarItem: () => true,
    showUncommittedChanges: () => true,
    tabIconColorTheme: () => "color",
    gitPath: () => "git"
  };
}

function extractViewState(html: string): GitGraphViewState {
  const match = html.match(/const viewState = (.*?);<\/script>/);
  if (match === null) throw new Error("Missing serialized viewState");
  return JSON.parse(match[1]) as GitGraphViewState;
}

describe("webview HTML", () => {
  it("passes visual settings to style variables and view state", () => {
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
    expect(viewState.commitDetailsCompactFolders).toBe(true);
    expect(viewState.commitDetailsFileViewMode).toBe("list");
    expect(viewState.graphFontSize).toBe(15);
    expect(viewState.graphRowHeight).toBe(30);
    expect(viewState.customBranchGlobPatterns).toEqual([
      { name: "Features", glob: "--glob=heads/feature/*" }
    ]);
    expect(viewState.shortHashLength).toBe(12);
    expect(result.html).toContain('id="settingsWidgetBacking" hidden');
    expect(result.html).toContain('id="settingsWidget" role="dialog" aria-modal="true"');
  });
});
