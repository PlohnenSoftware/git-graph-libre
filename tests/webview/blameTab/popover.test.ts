import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlameCommitPopoverMessage } from "@/blameTabTypes";
import {
  type BlamePopoverActions,
  type BlamePopoverContext,
  createBlamePopover
} from "@/webview/blameTab/popover";

import { commit, DISPLAY, hunk, LABELS, NEW_HASH, OLD_HASH, ZERO_HASH } from "./fixtures";

const NOW = new Date(1_700_000_000_000 + 5 * 60_000);

function start() {
  document.body.innerHTML = '<button id="anchor" type="button">Add the first lines</button>';
  const anchor = document.getElementById("anchor") as HTMLButtonElement;
  const actions: BlamePopoverActions = {
    onLoadDetails: vi.fn(),
    onShowInGraph: vi.fn(),
    onOpenDiff: vi.fn(),
    onRewind: vi.fn(),
    onIgnoreCommit: vi.fn(),
    onCopyText: vi.fn(),
    onOpenFileAtLine: vi.fn(),
    onBlameHead: vi.fn()
  };
  const popover = createBlamePopover(document, actions);
  return { anchor, actions, popover };
}

function context(overrides: Partial<BlamePopoverContext> = {}): BlamePopoverContext {
  return {
    commit: commit({ boundary: false, previous: { hash: NEW_HASH, path: "src/old.ts" } }),
    hunk: hunk({ previous: { hash: NEW_HASH, path: "src/old.ts" } }),
    labels: LABELS,
    display: DISPLAY,
    locale: "en",
    now: NOW,
    line: 2,
    ignored: false,
    ...overrides
  };
}

function detailsMessage(
  overrides: Partial<BlameCommitPopoverMessage> = {}
): BlameCommitPopoverMessage {
  return {
    command: "blameCommitPopover",
    requestId: 1,
    commitHash: OLD_HASH,
    details: {
      hash: OLD_HASH,
      parents: [NEW_HASH],
      author: "Ada",
      authorMail: "ada@example.test",
      authorTime: 1_700_000_000,
      committer: "Ada",
      committerMail: "ada@example.test",
      committerTime: 1_700_000_000,
      subject: "Add the first lines",
      message:
        "Add the first lines\n\nSee https://example.test/issues/1 and #42 for context.\nSecond body line."
    },
    avatar: "data:image/png;base64,AAAA",
    issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://example.test/issues/$1" },
    error: null,
    ...overrides
  };
}

const popoverEl = () => document.querySelector<HTMLElement>(".blame-popover");
const menuEl = () => document.querySelector<HTMLElement>(".blame-context-menu");
const actionButton = (id: string) =>
  document.querySelector<HTMLButtonElement>(`.blame-popover-action[data-action="${id}"]`);

afterEach(() => {
  document.body.replaceChildren();
});

describe("blame commit popover", () => {
  it("opens as a labelled dialog, asks for the details, and shows what blame already knows", () => {
    const { anchor, actions, popover } = start();
    anchor.focus();
    popover.open(anchor, context());

    const el = popoverEl();
    expect(el?.hidden).toBe(false);
    expect(el?.getAttribute("role")).toBe("dialog");
    expect(el?.getAttribute("aria-label")).toBe("Add the first lines");
    expect(actions.onLoadDetails).toHaveBeenCalledWith(OLD_HASH, 1);
    expect(el?.querySelector(".blame-popover-subject")?.textContent).toBe("Add the first lines");
    expect(el?.querySelector(".blame-popover-hash")?.textContent).toBe(OLD_HASH);
    expect(el?.querySelector(".blame-popover-body")?.textContent).toBe("Loading blame…");
    // Identical author and committer share one Date row, as in commit details.
    const meta = el?.querySelector(".blame-popover-meta")?.textContent ?? "";
    expect(meta).toContain("Author: ");
    expect(meta).toContain("Committer: ");
    expect(meta).toContain("Date: ");
    expect(meta).not.toContain("Author Date: ");
    expect(meta).toContain("ada@example.test");
    expect(document.activeElement).toBe(el);
  });

  it("fills in the linkified subject and body, and the cached avatar, when the reply lands", () => {
    const { anchor, popover } = start();
    popover.open(anchor, context());
    popover.applyDetails(detailsMessage());

    const body = popoverEl()?.querySelector(".blame-popover-body");
    const links = [...(body?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(links).toContain("https://example.test/issues/1");
    expect(links).toContain("https://example.test/issues/42");
    expect(body?.textContent).toContain("Second body line.");
    expect(body?.textContent).not.toContain("Add the first lines");
    const avatar = popoverEl()?.querySelector<HTMLImageElement>(".blame-popover-avatar");
    expect(avatar?.hidden).toBe(false);
    expect(avatar?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
  });

  it("drops a reply for another request or commit, and shows the failure word on an error", () => {
    const { anchor, popover } = start();
    popover.open(anchor, context());
    popover.applyDetails(detailsMessage({ requestId: 9 }));
    expect(popoverEl()?.querySelector(".blame-popover-body")?.textContent).toBe("Loading blame…");
    popover.applyDetails(detailsMessage({ details: null, avatar: null, error: "boom" }));
    const body = popoverEl()?.querySelector(".blame-popover-body");
    expect(body?.textContent).toBe("Unable to load the commit details: boom");
    expect(body?.getAttribute("role")).toBe("alert");
  });

  it("dismisses on Escape and returns focus to the commit header", () => {
    const { anchor, popover } = start();
    popover.open(anchor, context());
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(popoverEl()?.hidden).toBe(true);
    expect(document.activeElement).toBe(anchor);
  });

  it("dismisses on an outside click and toggles on a second header click", () => {
    const { anchor, popover } = start();
    popover.open(anchor, context());
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(popoverEl()?.hidden).toBe(true);
    popover.open(anchor, context());
    popover.open(anchor, context());
    expect(popoverEl()?.hidden).toBe(true);
  });

  it("runs every cross-surface action with the hunk's own facts", () => {
    const { anchor, actions, popover } = start();
    popover.open(anchor, context());
    actionButton("showCommitInGraph")?.click();
    expect(actions.onShowInGraph).toHaveBeenCalledWith(OLD_HASH);
    expect(popoverEl()?.hidden).toBe(true);

    popover.open(anchor, context());
    actionButton("openDiff")?.click();
    expect(actions.onOpenDiff).toHaveBeenCalledWith({
      commitHash: OLD_HASH,
      filePath: "src/file.ts",
      previousHash: NEW_HASH,
      previousPath: "src/old.ts"
    });

    popover.open(anchor, context());
    actionButton("rewind")?.click();
    expect(actions.onRewind).toHaveBeenCalledWith({
      rev: NEW_HASH,
      filePath: "src/old.ts",
      targetLine: 1
    });

    popover.open(anchor, context());
    actionButton("ignoreCommit")?.click();
    expect(actions.onIgnoreCommit).toHaveBeenCalledWith(OLD_HASH);

    popover.open(anchor, context());
    actionButton("copyHash")?.click();
    expect(actions.onCopyText).toHaveBeenCalledWith("hash", OLD_HASH);

    popover.open(anchor, context());
    actionButton("copyMessage")?.click();
    expect(actions.onCopyText).toHaveBeenCalledWith("message", OLD_HASH);

    popover.open(anchor, context());
    actionButton("openFileAtLine")?.click();
    expect(actions.onOpenFileAtLine).toHaveBeenCalledWith(2);
  });

  it("offers no rewind on a boundary hunk and no ignore for an already ignored commit", () => {
    const { anchor, popover } = start();
    popover.open(
      anchor,
      context({
        commit: commit({ boundary: true, previous: null }),
        hunk: hunk({ previous: null }),
        ignored: true
      })
    );
    expect(actionButton("rewind")).toBeNull();
    expect(actionButton("ignoreCommit")).toBeNull();
    expect(actionButton("showCommitInGraph")).not.toBeNull();
  });

  it("shows differing author and committer dates on their own rows", () => {
    const { anchor, popover } = start();
    popover.open(
      anchor,
      context({
        commit: commit({
          boundary: false,
          committer: "Cory",
          committerMail: "cory@example.test",
          committerTime: 1_700_100_000
        })
      })
    );
    const meta = popoverEl()?.querySelector(".blame-popover-meta")?.textContent ?? "";
    expect(meta).toContain("Author Date: ");
    expect(meta).toContain("Committer Date: ");
    expect(meta).toContain("cory@example.test");
  });

  it("shows the lightweight uncommitted popover without asking for details", () => {
    const { anchor, actions, popover } = start();
    popover.open(
      anchor,
      context({
        commit: commit({
          hash: ZERO_HASH,
          uncommitted: true,
          previous: { hash: OLD_HASH, path: "src/file.ts" }
        }),
        hunk: hunk({
          commitHash: ZERO_HASH,
          previous: { hash: OLD_HASH, path: "src/file.ts" },
          heat: { level: null, uncommitted: true, commitHunkCount: 0, commitLineCount: 2 }
        })
      })
    );
    expect(actions.onLoadDetails).not.toHaveBeenCalled();
    expect(popoverEl()?.querySelector(".blame-popover-subject")?.textContent).toBe(
      "Uncommitted changes"
    );
    expect(popoverEl()?.querySelector(".blame-popover-explanation")?.textContent).toBe(
      "These lines contain local changes that have not been committed yet."
    );
    expect(actionButton("showCommitInGraph")).toBeNull();
    actionButton("viewBlameAtHead")?.click();
    expect(actions.onBlameHead).toHaveBeenCalledOnce();
  });

  it("opens the same actions as a context menu and closes it on Escape", () => {
    const { anchor, actions, popover } = start();
    popover.openContextMenu(10, 10, anchor, context());
    const menu = menuEl();
    expect(menu?.hidden).toBe(false);
    expect(menu?.getAttribute("role")).toBe("menu");
    const item = menu?.querySelector<HTMLButtonElement>('[data-action="copyHash"]');
    expect(item?.getAttribute("role")).toBe("menuitem");
    item?.click();
    expect(actions.onCopyText).toHaveBeenCalledWith("hash", OLD_HASH);
    expect(menu?.hidden).toBe(true);

    popover.openContextMenu(10, 10, anchor, context());
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu?.hidden).toBe(true);
    expect(document.activeElement).toBe(anchor);
  });
});
