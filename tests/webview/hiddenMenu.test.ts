import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, setupHtml } from "./setup";

/**
 * The language switcher behind a double right-click on the version.
 *
 * It stays in English whatever the interface is set to: its purpose is to be
 * usable when the interface is in a language the reader cannot navigate, and
 * translating it would put the escape hatch behind the door it exists to open.
 */

const REPO = "/workspace/repo";

const viewStateFixture: GGL.GitGraphViewState = {
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
  language: "pl",
  languages: [
    { id: "en", label: "English" },
    { id: "nl", label: "Dutch" },
    { id: "pl", label: "Polish" }
  ]
};

function rightClick(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
}

async function mount() {
  setupHtml(viewStateFixture);
  const mock = createVscodeMock(null);
  vi.resetModules();
  await import("@/webview/main");
  return {
    version: document.getElementById("statusVersion") as HTMLElement,
    menu: document.getElementById("contextMenu") as HTMLElement,
    sent: mock.sentMessages
  };
}

describe("hidden menu", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("stays shut on a single right-click", async () => {
    const { version, menu } = await mount();

    rightClick(version);

    expect(menu.className).not.toContain("active");
  });

  it("opens on a second right-click", async () => {
    const { version, menu } = await mount();

    rightClick(version);
    rightClick(version);

    expect(menu.className).toContain("active");
    expect(menu.querySelector(".contextMenuHeaderTitle")?.textContent).toBe("Hidden menu");
    expect(menu.querySelector(".contextMenuHeaderCaption")?.textContent).toContain("this tab only");
  });

  it("lists every shipped language, marking the active one", async () => {
    const { version, menu } = await mount();

    rightClick(version);
    rightClick(version);

    const items = [...menu.querySelectorAll(".contextMenuItem")].map((item) => item.textContent);
    expect(items).toEqual(["English", "Dutch", "✓Polish"]);
  });

  it("asks the extension host for the language it was given", async () => {
    const { version, menu, sent } = await mount();

    rightClick(version);
    rightClick(version);
    const dutch = [...menu.querySelectorAll(".contextMenuItem")].find(
      (item) => item.textContent === "Dutch"
    ) as HTMLElement;
    dutch.click();

    expect(sent).toContainEqual({ command: "setTemporaryLanguage", language: "nl" });
  });

  // Two right-clicks minutes apart are two right-clicks, not a double.
  it("does not treat a slow pair as a double", async () => {
    vi.useFakeTimers();
    const { version, menu } = await mount();

    rightClick(version);
    vi.advanceTimersByTime(5000);
    rightClick(version);

    expect(menu.className).not.toContain("active");
  });

  it("never shows the platform menu over the version", async () => {
    const { version } = await mount();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    version.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe("hidden menu styles", () => {
  const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");

  it("styles the header as presentational chrome", () => {
    const header = css.match(/^\.contextMenuHeader \{[^}]+\}/m)?.[0] ?? "";

    expect(header).toContain("cursor: default;");
    expect(header).toContain("var(--vscode-menu-separatorBackground");
    expect(css).toContain(".contextMenuHeaderTitle");
    expect(css).toContain(".contextMenuHeaderCaption");
  });
});
