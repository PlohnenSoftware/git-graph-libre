import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import type { RepoManager } from "@/extension/repoManager";
import { buildTelemetryConsentScreen } from "@/extension/webviewConsentScreen";
import { buildWebviewHtml } from "@/extension/webviewHtml";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type { TelemetryConsent } from "@/types";

const l10nStrings = getWebviewLocalizedStrings();

/**
 * The screen that stands in for the graph while the telemetry question is open.
 * Blocking the graph is only acceptable because Set now always brings the
 * notification back, so that button is asserted from several angles.
 */
describe("telemetry consent screen markup", () => {
  const html = buildTelemetryConsentScreen(l10nStrings, "test-nonce", "--x: 1;");

  it("borrows the full-page message surface and says what it is waiting for", () => {
    expect(html).toContain('class="unableToLoad telemetryConsent"');
    expect(html).toContain("Waiting for your telemetry choice");
    expect(html).toContain("neither accepted nor rejected");
  });

  it("offers Set now as a centered action below the text", () => {
    expect(html).toContain('id="telemetryConsentBtn"');
    expect(html).toContain(">Set now<");
    expect(html.indexOf("telemetryConsentActions")).toBeGreaterThan(html.indexOf("<p>"));
  });

  // A question about data is not answerable without "which data".
  it("links to the disclosure", () => {
    expect(html).toContain('href="https://github.com/PlohnenSoftware/git-graph-libre#telemetry"');
    expect(html).toContain("What is sent?");
  });

  it("posts showTelemetryConsent from a nonced script", () => {
    expect(html).toContain('<script nonce="test-nonce">');
    expect(html).toContain('command: "showTelemetryConsent"');
  });

  // No graph, no toolbar, no web.min.js: nothing is mounted, so nothing has to
  // be torn down when the answer arrives.
  it("loads none of the graph document", () => {
    expect(html).not.toContain("web.min.js");
    expect(html).not.toContain('id="commitTable"');
    expect(html).not.toContain("const viewState");
  });

  it("escapes localized text", () => {
    const escaped = buildTelemetryConsentScreen(
      { ...l10nStrings, telemetrySetNow: '<img src=x onerror="alert(1)">' },
      "n",
      ""
    );

    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
  });
});

describe("telemetry consent screen styles", () => {
  const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");

  it("centers the action row and styles the button from theme tokens", () => {
    const actions = css.match(/^\.telemetryConsentActions \{[^}]+\}/m)?.[0] ?? "";
    const button = css.match(/^\.telemetryConsentBtn \{[^}]+\}/m)?.[0] ?? "";

    expect(actions).toContain("justify-content: center;");
    expect(button).toContain("var(--vscode-button-background");
    expect(button).toContain("var(--ngg-accent)");
    expect(button).toContain("var(--vscode-button-foreground");
  });

  // The banner this replaced is gone; a leftover rule would be dead weight.
  it("keeps no rules for the removed notice banner", () => {
    expect(css).not.toContain("telemetryNotice");
  });
});

describe("which screen the webview builds", () => {
  function build(consent: TelemetryConsent, repos: Record<string, unknown> = { "/repo": {} }) {
    return buildWebviewHtml({
      webview: {
        cspSource: "vscode-webview:",
        asWebviewUri: (uri: { fsPath: string }) => `webview://${uri.fsPath}`
      } as never,
      config: makeConfig(consent),
      extensionPath: "/extension",
      extensionState: {
        isAvatarStorageAvailable: () => true,
        getLastActiveRepo: () => "/repo"
      } as ExtensionState,
      repoManager: { getRepos: () => repos } as unknown as RepoManager,
      extensionVersion: "1.3.0"
    });
  }

  it("replaces the graph while the answer is unset", () => {
    const result = build("unset");

    expect(result.html).toContain('id="telemetryConsentBtn"');
    expect(result.html).not.toContain('id="commitTable"');
    // Not a mounted graph, so the panel rebuilds rather than posting messages
    // it has no listener for.
    expect(result.isGraphLoaded).toBe(false);
  });

  it.each<TelemetryConsent>(["enabled", "disabled"])(
    "builds the graph once the answer is %s",
    (consent) => {
      const result = build(consent);

      expect(result.html).toContain('id="commitTable"');
      expect(result.html).not.toContain('id="telemetryConsentBtn"');
      expect(result.isGraphLoaded).toBe(true);
    }
  );

  // A workspace with no repository cannot show a graph at all, so that screen
  // states the more fundamental blocker.
  it("still shows the no-repository screen ahead of the consent screen", () => {
    const result = build("unset", {});

    expect(result.html).toContain("unableToLoad");
    expect(result.html).not.toContain('id="telemetryConsentBtn"');
    expect(result.isGraphLoaded).toBe(false);
  });
});

function makeConfig(consent: TelemetryConsent): Config {
  return {
    autoCenterCommitDetailsView: () => true,
    commitDetailsCompactFolders: () => false,
    commitDetailsFileViewMode: () => "tree",
    contextMenuActionsVisibility: () => ({}) as never,
    dateFormat: () => "Date & Time",
    dateType: () => "Author Date",
    fetchAvatars: () => false,
    showSignatureColumn: () => false,
    graphColors: () => ["oklch(65% 0.16 250)"],
    customBranchGlobPatterns: () => [],
    graphFontSize: () => 13,
    graphRowHeight: () => 24,
    graphStyle: () => "rounded",
    revealHighlightColor: () => "oklch(90% 0.25 150 / 0.42)",
    includeReflog: () => false,
    includeUnreachableCommits: () => false,
    shortHashLength: () => 8,
    initialLoadCommits: () => 300,
    loadMoreCommits: () => 100,
    maxDepthOfRepoSearch: () => 0,
    muteCommitsNotAncestorsOfHead: () => false,
    muteMergeCommits: () => false,
    boldCheckedOutCommit: () => false,
    fetchTagsByDefault: () => false,
    onlyFollowFirstParent: () => false,
    showCurrentBranchByDefault: () => false,
    showRemoteBranches: () => true,
    showStashes: () => true,
    showTags: () => true,
    showStatusBarItem: () => true,
    showUncommittedChanges: () => true,
    telemetryConsent: () => consent,
    tabIconColorTheme: () => "color",
    gitPath: () => "git"
  } as unknown as Config;
}
