import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildTelemetryNotice } from "@/extension/webviewTelemetryNotice";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/repo";

const baseViewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  showSignatureColumn: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [],
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  revealHighlightColor: "oklch(90% 0.25 150 / 0.42)",
  includeReflog: false,
  includeUnreachableCommits: false,
  initialLoadCommits: 300,
  lastActiveRepo: REPO,
  loadMoreCommits: 75,
  muteCommitsNotAncestorsOfHead: false,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8,
  telemetryConsent: "unset"
};

const l10nStrings = getWebviewLocalizedStrings();

describe("telemetry notice markup", () => {
  it("shows the notice while the question is unanswered", () => {
    const html = buildTelemetryNotice(l10nStrings, "unset");

    expect(html).toContain('id="telemetryNotice"');
    expect(html).not.toContain("hidden");
    expect(html).toContain("neither accepted nor rejected");
  });

  // Emitted either way, so the webview can toggle it without rebuilding the
  // document — which would reload the webview and drop the graph state.
  it.each<GGL.TelemetryConsent>(["enabled", "disabled"])(
    "emits the notice hidden once the answer is %s",
    (consent) => {
      const html = buildTelemetryNotice(l10nStrings, consent);

      expect(html).toContain('id="telemetryNotice"');
      expect(html).toContain("hidden");
    }
  );

  it("escapes the localized message", () => {
    const html = buildTelemetryNotice(
      { ...l10nStrings, telemetryUndecided: '<img src=x onerror="alert(1)">' },
      "unset"
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("telemetry notice styles", () => {
  const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");

  it("styles the notice from theme tokens with OKLCH fallbacks", () => {
    const rule = css.match(/^\.telemetryNotice \{[^}]+\}/m)?.[0] ?? "";

    expect(rule).toContain("--vscode-notifications-background");
    expect(rule).toContain("var(--ngg-neutral-overlay-subtle)");
    expect(rule).toContain("var(--vscode-panel-border");
  });
});

describe("telemetry notice in the graph", () => {
  async function mountGraph(consent: GGL.TelemetryConsent) {
    setupHtml({ ...baseViewState, telemetryConsent: consent });
    createVscodeMock(null);
    // main.ts wires itself to the document on import, so the shell has to
    // exist first and the module registry has to be cleared, or the previous
    // test's instance stays bound to a detached document.
    vi.resetModules();
    await import("@/webview/main");
    return document.getElementById("telemetryNotice") as HTMLElement;
  }

  it("renders inside the top bar so the sticky header offset tracks it", async () => {
    const notice = await mountGraph("unset");

    expect(notice.hidden).toBe(false);
    expect(notice.closest("#topBar")).not.toBeNull();
  });

  it("hides the notice as soon as the answer is pushed in", async () => {
    const notice = await mountGraph("unset");

    receive({ command: "telemetryConsentChanged", consent: "enabled" });

    expect(notice.hidden).toBe(true);
  });

  // Someone can clear the setting back to unset in settings.json, and the
  // question is open again.
  it("brings the notice back when the answer is cleared", async () => {
    const notice = await mountGraph("enabled");
    expect(notice.hidden).toBe(true);

    receive({ command: "telemetryConsentChanged", consent: "unset" });

    expect(notice.hidden).toBe(false);
  });
});
