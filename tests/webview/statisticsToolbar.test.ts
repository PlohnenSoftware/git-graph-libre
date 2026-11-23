import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/repo";

const viewStateFixture: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  uncommittedFileViewMode: "tree",
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
  showTagRemotes: "all",
  mergeNoFastForward: true,
  pullBranchNoFastForward: false,
  createBranchCheckout: true,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8,
  language: "en",
  languages: [{ id: "en", label: "English" }]
};

async function mountWithEngine(engineState: GGL.EngineComponentStatus["state"]) {
  setupHtml(viewStateFixture);
  const strip = document.getElementById("statusStrip");
  if (strip !== null) strip.dataset.engine = engineState;
  const mock = createVscodeMock(null);
  vi.resetModules();
  await import("@/webview/main");
  mock.clearMessages();
  return {
    button: document.getElementById("statisticsBtn") as HTMLButtonElement,
    sent: mock.sentMessages
  };
}

describe("statistics toolbar button availability (F3-03)", () => {
  it("shows the button and posts showStatistics when the engine is active", async () => {
    const { button, sent } = await mountWithEngine("active");

    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(false);

    button.click();
    expect(sent).toContainEqual({ command: "showStatistics", repo: REPO });
  });

  it("hides and disables the button on boot when the engine is off or unavailable", async () => {
    for (const state of ["off", "unavailable"] as const) {
      const { button, sent } = await mountWithEngine(state);

      expect(button.hidden).toBe(true);
      expect(button.disabled).toBe(true);

      button.click();
      expect(sent.filter((msg) => msg.command === "showStatistics")).toHaveLength(0);
    }
  });

  it("toggles the button live when componentStatus reports a backend change", async () => {
    const { button, sent } = await mountWithEngine("active");
    expect(button.hidden).toBe(false);

    receive({
      command: "componentStatus",
      components: {
        git: { state: "ok", path: "git", version: "git version 2.51.0" },
        engine: { state: "off" },
        graphLoad: null
      }
    });
    expect(button.hidden).toBe(true);
    expect(button.disabled).toBe(true);
    button.click();
    expect(sent.filter((msg) => msg.command === "showStatistics")).toHaveLength(0);

    receive({
      command: "componentStatus",
      components: {
        git: { state: "ok", path: "git", version: "git version 2.51.0" },
        engine: { state: "active", version: "1.0.33", platform: "linux-x64" },
        graphLoad: "engine"
      }
    });
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(false);
    button.click();
    expect(sent).toContainEqual({ command: "showStatistics", repo: REPO });
  });
});
