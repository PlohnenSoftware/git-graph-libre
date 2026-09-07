import type { GitUncommittedChanges } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import {
  getStagingDropAction,
  isUncommittedSection,
  renderUncommittedDetailsRowHtml
} from "@/webview/uncommittedDetailsView";
import { describe, expect, it } from "vitest";

const l10n = {
  detailStaged: "Staged",
  detailUnstaged: "Unstaged",
  detailCollapseStaged: "Collapse staged files",
  detailExpandStaged: "Expand staged files",
  detailCollapseUnstaged: "Collapse unstaged files",
  detailExpandUnstaged: "Expand unstaged files",
  detailNoStagedFiles: "No staged changes",
  detailNoUnstagedFiles: "No unstaged changes",
  actionStageFile: "Stage File",
  actionUnstageFile: "Unstage File",
  detailResize: "Resize details",
  tooltipRenamedTo: " renamed to "
} as LocalizedStrings;

const changes: GitUncommittedChanges = {
  staged: [
    { path: "added.txt", oldPath: null, stagedKind: "A", unstagedKind: null },
    { path: "new.txt", oldPath: "old.txt", stagedKind: "R", unstagedKind: null }
  ],
  unstaged: [{ path: "work.txt", oldPath: null, stagedKind: null, unstagedKind: "M" }]
};

function render(sections = { stagedOpen: true, unstagedOpen: true }): string {
  return renderUncommittedDetailsRowHtml({ changes, l10n, sections, detailsHeight: 250 });
}

describe("getStagingDropAction", () => {
  it("maps cross-section drops to staging commands and ignores same-section drops", () => {
    expect(getStagingDropAction("unstaged", "staged")).toBe("stageFiles");
    expect(getStagingDropAction("staged", "unstaged")).toBe("unstageFiles");
    expect(getStagingDropAction("staged", "staged")).toBeNull();
    expect(getStagingDropAction("unstaged", "unstaged")).toBeNull();
  });

  it("recognizes only the staged and unstaged section names", () => {
    expect(isUncommittedSection("staged")).toBe(true);
    expect(isUncommittedSection("unstaged")).toBe(true);
    expect(isUncommittedSection("summary")).toBe(false);
    expect(isUncommittedSection(undefined)).toBe(false);
  });
});

describe("renderUncommittedDetailsRowHtml", () => {
  it("renders staged and unstaged panes with toggles and file rows", () => {
    document.body.innerHTML = `<table><tr>${render()}</tr></table>`;

    expect(document.getElementById("uncommittedStagedToggle")?.textContent).toContain("Staged");
    expect(document.getElementById("uncommittedUnstagedToggle")?.textContent).toContain("Unstaged");
    const items = [...document.querySelectorAll(".uncommittedFile")];
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.getAttribute("draggable")).toBe("true");
      expect(item.querySelector(".uncommittedStatus")).not.toBeNull();
      expect(item.querySelector(".gitFileName")).not.toBeNull();
      expect(item.querySelector(".uncommittedMoveFile")).not.toBeNull();
    }
  });

  it("emits the shared resize handle with its ARIA contract", () => {
    document.body.innerHTML = `<table><tr>${render()}</tr></table>`;

    const handle = document.getElementById("commitDetailsResizeHandle");
    expect(handle?.getAttribute("role")).toBe("separator");
    expect(handle?.getAttribute("aria-valuenow")).toBe("250");
    expect(handle?.getAttribute("aria-label")).toBeDefined();
  });

  it("marks each row with its section and path for drag payloads", () => {
    document.body.innerHTML = `<table><tr>${render()}</tr></table>`;

    const staged = document.querySelector('.uncommittedFile[data-filepath="added.txt"]');
    expect(staged?.getAttribute("data-section")).toBe("staged");
    const unstaged = document.querySelector('.uncommittedFile[data-filepath="work.txt"]');
    expect(unstaged?.getAttribute("data-section")).toBe("unstaged");
  });

  it("offers unstage on staged rows and stage on unstaged rows", () => {
    document.body.innerHTML = `<table><tr>${render()}</tr></table>`;

    const stagedButton = document.querySelector('.uncommittedMoveFile[data-filepath="added.txt"]');
    expect(stagedButton?.getAttribute("title")).toBe("Unstage File");
    expect(stagedButton?.querySelector("svg.octicon-arrow-down")).not.toBeNull();
    const unstagedButton = document.querySelector('.uncommittedMoveFile[data-filepath="work.txt"]');
    expect(unstagedButton?.getAttribute("title")).toBe("Stage File");
    expect(unstagedButton?.querySelector("svg.octicon-arrow-up")).not.toBeNull();
  });

  it("shows rename origins in tooltips instead of the row text", () => {
    document.body.innerHTML = `<table><tr>${render()}</tr></table>`;

    const renamed = document.querySelector('.uncommittedFile[data-filepath="new.txt"]');
    expect(renamed?.getAttribute("title")).toContain("old.txt renamed to new.txt");
    expect(renamed?.querySelector(".gitFileName")?.textContent).toBe("new.txt");
  });

  it("escapes hostile paths in names, tooltips, and attributes", () => {
    const hostile: GitUncommittedChanges = {
      staged: [{ path: '"><img src=x>', oldPath: null, stagedKind: "A", unstagedKind: null }],
      unstaged: []
    };
    const html = renderUncommittedDetailsRowHtml({
      changes: hostile,
      l10n,
      sections: { stagedOpen: true, unstagedOpen: true },
      detailsHeight: 250
    });

    expect(html).not.toContain('"><img src=x>');
    expect(html).toContain("&quot;&gt;&lt;img src=x&gt;");
  });

  it("renders empty states when a pane has no files", () => {
    const html = renderUncommittedDetailsRowHtml({
      changes: { staged: [], unstaged: [] },
      l10n,
      sections: { stagedOpen: true, unstagedOpen: true },
      detailsHeight: 250
    });
    document.body.innerHTML = `<table><tr>${html}</tr></table>`;

    expect(document.body.textContent).toContain("No staged changes");
    expect(document.body.textContent).toContain("No unstaged changes");
    expect(document.querySelector(".uncommittedFile")).toBeNull();
  });

  it("collapses closed panes and labels their toggles", () => {
    document.body.innerHTML = `<table><tr>${render({
      stagedOpen: false,
      unstagedOpen: true
    })}</tr></table>`;

    expect(document.getElementById("commitDetailsSummaryBody")?.className).toContain("hidden");
    expect(document.getElementById("commitDetailsFilesBody")?.className).not.toContain("hidden");
    expect(document.getElementById("uncommittedStagedToggle")?.getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(document.getElementById("uncommittedStagedToggle")?.getAttribute("aria-label")).toBe(
      "Expand staged files"
    );
  });
});
