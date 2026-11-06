import { describe, expect, it } from "vitest";
import type { GitWorktree } from "@/backend/types";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import {
  buildWorktreeListLabels,
  prunableWorktrees,
  renderWorktreeList,
  type WorktreeRowAction,
  worktreeRowActions
} from "@/webview/worktreeList";

const labels = buildWorktreeListLabels(getWebviewLocalizedStrings((key) => key));
const english = buildWorktreeListLabels(getWebviewLocalizedStrings());

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: "/work/repo",
    head: "a".repeat(40),
    branch: "main",
    detached: false,
    bare: false,
    isMain: false,
    isCurrent: false,
    locked: null,
    prunable: null,
    ...overrides
  };
}

function render(worktrees: GitWorktree[]): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = renderWorktreeList(worktrees, english, 7);
  return root;
}

describe("worktreeRowActions", () => {
  const cases: Array<[string, Partial<GitWorktree>, WorktreeRowAction[]]> = [
    [
      "the main worktree, open elsewhere",
      { isMain: true },
      ["openNewWindow", "openHere", "switchGraph", "copyPath"]
    ],
    ["the current worktree", { isCurrent: true, isMain: true }, ["copyPath"]],
    ["a linked worktree", {}, ["openNewWindow", "openHere", "switchGraph", "copyPath", "remove"]],
    [
      "a locked linked worktree",
      { locked: { reason: "usb" } },
      ["openNewWindow", "openHere", "switchGraph", "copyPath", "remove"]
    ],
    ["a stale entry", { prunable: { reason: "gone" } }, ["repair", "removeStale", "copyPath"]],
    [
      "a bare main",
      { bare: true, isMain: true, branch: null, head: null },
      ["openNewWindow", "openHere", "copyPath"]
    ]
  ];
  it.each(cases)("%s", (_name, overrides, expected) => {
    expect(worktreeRowActions(worktree(overrides))).toEqual(expected);
  });
});

describe("prunableWorktrees", () => {
  it("is the stale entries that are not locked", () => {
    const stale = worktree({ path: "/a", prunable: { reason: "" } });
    const lockedStale = worktree({
      path: "/b",
      prunable: { reason: "" },
      locked: { reason: "" }
    });
    expect(prunableWorktrees([worktree({}), stale, lockedStale])).toEqual([stale]);
  });
});

describe("renderWorktreeList", () => {
  it("shows the folder, path, branch and the main and current badges", () => {
    const root = render([
      worktree({ path: "/work/repo", isMain: true, isCurrent: true }),
      worktree({ path: "/work/repo.worktrees/feature", branch: "feature" })
    ]);
    const rows = root.querySelectorAll(".worktreeRow");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".worktreeName")?.textContent).toBe("repo");
    expect(rows[0]?.querySelector(".worktreeName")?.getAttribute("title")).toBe("/work/repo");
    expect(rows[0]?.querySelector(".worktreePath")?.textContent).toBe("/work/repo");
    expect(rows[0]?.querySelector(".worktreeBranch")?.textContent).toBe("main");
    expect(
      [...(rows[0]?.querySelectorAll(".worktreeBadge") ?? [])].map((badge) => badge.textContent)
    ).toEqual(["main", "current"]);
    expect(rows[1]?.querySelector(".worktreeName")?.textContent).toBe("feature");
    expect(rows[1]?.querySelector(".worktreeBranch")?.textContent).toBe("feature");
    expect(rows[1]?.querySelectorAll(".worktreeBadge")).toHaveLength(0);
  });

  it("shows a detached HEAD by its short hash", () => {
    const root = render([worktree({ branch: null, detached: true, head: "abcdef0123456789" })]);
    expect(root.querySelector(".worktreeBranch")?.textContent).toBe("detached at abcdef0");
  });

  it("shows locked with and without a reason, and a missing folder", () => {
    const root = render([
      worktree({ path: "/a", locked: { reason: "on a stick" } }),
      worktree({ path: "/b", locked: { reason: "" } }),
      worktree({ path: "/c", prunable: { reason: "gitdir file points to non-existent location" } })
    ]);
    const badges = [...root.querySelectorAll(".worktreeRow")].map((row) =>
      [...row.querySelectorAll(".worktreeBadge")].map((badge) => badge.textContent)
    );
    expect(badges).toEqual([["locked: on a stick"], ["locked"], ["missing (moved or deleted)"]]);
    expect(root.querySelector(".worktreeBadge.prunable")).not.toBeNull();
  });

  it("shows a bare main as the repository itself, with no branch", () => {
    const root = render([worktree({ bare: true, isMain: true, branch: null, head: null })]);
    expect(root.querySelector(".worktreeBranch")?.textContent).toBe(
      "bare repository, no working tree"
    );
    expect([...root.querySelectorAll(".worktreeBadge")].map((badge) => badge.textContent)).toEqual([
      "main",
      "bare"
    ]);
  });

  it("escapes a path and a lock reason", () => {
    const root = render([
      worktree({ path: '/w/<img src=x onerror="1">', locked: { reason: "<b>x</b>" } })
    ]);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
    expect(root.querySelector(".worktreePath")?.textContent).toBe('/w/<img src=x onerror="1">');
  });

  it("offers Create always and Prune only while an unlocked entry is stale", () => {
    const footer = (worktrees: GitWorktree[]) =>
      [...render(worktrees).querySelectorAll<HTMLElement>("[data-worktree-footer]")].map(
        (button) => button.dataset.worktreeFooter
      );
    expect(footer([worktree({})])).toEqual(["create"]);
    expect(footer([])).toEqual(["create"]);
    expect(footer([worktree({ prunable: { reason: "" } })])).toEqual(["create", "prune"]);
    expect(footer([worktree({ prunable: { reason: "" }, locked: { reason: "" } })])).toEqual([
      "create"
    ]);
  });

  it("says so when Git lists nothing", () => {
    expect(render([]).querySelector(".worktreeEmpty")?.textContent).toBe(
      "Git lists no worktrees for this repository."
    );
  });

  it("builds every label from the localized strings", () => {
    expect(labels.title).toBe("ui.worktrees");
    expect(labels.actions.openNewWindow).toBe("action.worktreeOpenNewWindow");
    expect(english.create).toBe("Create Worktree…");
    expect(english.prune).toBe("Prune Stale Worktrees…");
  });
});
