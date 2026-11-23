import { afterEach, describe, expect, it, vi } from "vitest";

import { applyData, applyLoading, initialBlameState } from "@/webview/blameTab/rowModel";
import { type BlameViewCallbacks, createBlameView } from "@/webview/blameTab/view";

import {
  commit,
  DISPLAY,
  dataMessage,
  hunk,
  LABELS,
  loadingMessage,
  NEW_HASH,
  OLD_HASH,
  payload,
  ZERO_HASH
} from "./fixtures";

const NOW = new Date(1_700_000_000_000 + 5 * 60_000);

function start(extra: Partial<BlameViewCallbacks> = {}) {
  document.body.innerHTML = '<div id="blameTab"></div>';
  const root = document.getElementById("blameTab") as HTMLElement;
  const onGutterWidthChange = vi.fn();
  const onBlameHead = vi.fn();
  const onBlameLatest = vi.fn();
  const onOpenFile = vi.fn();
  const onRewind = vi.fn();
  const onNavigate = vi.fn();
  const onOptionsChange = vi.fn();
  const onClearIgnoredCommit = vi.fn();
  const onFindStateChange = vi.fn();
  const view = createBlameView(root, {
    onGutterWidthChange,
    onBlameHead,
    onBlameLatest,
    onOpenFile,
    onRewind,
    onNavigate,
    onOptionsChange,
    onClearIgnoredCommit,
    onFindStateChange,
    ...extra
  });
  return {
    root,
    view,
    onGutterWidthChange,
    onBlameHead,
    onBlameLatest,
    onOpenFile,
    onRewind,
    onNavigate,
    onOptionsChange,
    onClearIgnoredCommit,
    onFindStateChange
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("blame tab view", () => {
  it("draws nothing before the localized labels arrive", () => {
    const { root, view } = start();
    view.render(initialBlameState(), NOW);
    expect(root.childElementCount).toBe(0);
  });

  it("shows the loading word while the first blame is in flight", () => {
    const { root, view } = start();
    view.render(applyLoading(initialBlameState(), loadingMessage()), NOW);
    expect(root.querySelector(".blame-loading")?.textContent).toBe("Loading blame…");
    expect(root.querySelector(".blame-repo")?.textContent).toBe("one");
  });

  it("renders grouped hunks: header, gutter blocks once per hunk, numbered source lines", () => {
    const { root, view } = start();
    view.render(applyData(initialBlameState(), dataMessage()), NOW);

    expect(root.querySelector(".blame-repo")?.textContent).toBe("one");
    expect(root.querySelector(".blame-path")?.textContent).toBe("src/file.ts");
    // Working-tree blame: the localized badge, not a hash.
    expect(root.querySelector(".blame-rev")?.textContent).toBe("Working Tree");
    expect(root.querySelector(".blame-line-count")?.textContent).toBe("4 lines");

    const bands = [...root.querySelectorAll<HTMLElement>(".blame-hunk")];
    expect(bands).toHaveLength(2);
    expect(bands[0].dataset.commit).toBe(OLD_HASH);
    expect(bands[0].dataset.heat).toBe("0");
    expect(bands[0].dataset.startLine).toBe("1");
    expect(bands[1].dataset.heat).toBe("9");
    expect(bands[1].dataset.startLine).toBe("3");

    const first = bands[0];
    // One commit block for both lines of the hunk, full text on hover.
    expect(first.querySelectorAll(".blame-summary")).toHaveLength(1);
    expect(first.querySelector(".blame-summary")?.textContent).toBe("Add the first lines");
    expect(first.querySelector<HTMLElement>(".blame-summary")?.title).toBe("Add the first lines");
    expect(first.querySelector(".blame-author")?.textContent).toBe("Ada");
    const hash = first.querySelector<HTMLElement>("code.blame-hash");
    expect(hash?.textContent).toBe("aaaaaaaa");
    expect(hash?.title).toBe(OLD_HASH);
    const date = first.querySelector<HTMLElement>(".blame-date");
    expect(date?.textContent).toMatch(/^\d{1,2} Nov 2023 \d{2}:\d{2}$/);
    expect(date?.title).toBe(date?.textContent);

    const numbers = [...root.querySelectorAll(".blame-line-number")].map((n) => n.textContent);
    expect(numbers).toEqual(["1", "2", "3", "4"]);
    const texts = [...root.querySelectorAll(".blame-line-text")].map((n) => n.textContent);
    expect(texts).toEqual([
      "export const one = 1;",
      "export const two = 2;",
      "export const three = 3;",
      ""
    ]);
  });

  it("shortens hashes to the configured length and follows dateFormat", () => {
    const { root, view } = start();
    const longHash = "0123456789abcdef0123456789abcdef01234567";
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          display: { ...DISPLAY, shortHashLength: 12, dateFormat: "Relative" },
          payload: payload({
            commits: { [longHash]: commit({ hash: longHash }) },
            hunks: [hunk({ commitHash: longHash })],
            totalLines: 2
          })
        })
      ),
      NOW
    );
    const hash = root.querySelector<HTMLElement>("code.blame-hash");
    expect(hash?.textContent).toBe("0123456789ab");
    expect(hash?.title).toBe(longHash);
    const date = root.querySelector<HTMLElement>(".blame-date");
    expect(date?.textContent).toBe("5 minutes ago");
    expect(date?.title).toMatch(/^\d{1,2} Nov 2023 \d{2}:\d{2}$/);
    // An out-of-range length clamps the way the graph's does.
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          display: { ...DISPLAY, shortHashLength: 1 },
          payload: payload({
            commits: { [longHash]: commit({ hash: longHash }) },
            hunks: [hunk({ commitHash: longHash })],
            totalLines: 2
          })
        })
      ),
      NOW
    );
    expect(root.querySelector("code.blame-hash")?.textContent).toBe("0123");
  });

  it("badges a blamed revision with its short hash", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({ rev: OLD_HASH, payload: payload({ resolvedRev: OLD_HASH }) })
      ),
      NOW
    );
    const rev = root.querySelector<HTMLElement>(".blame-rev");
    expect(rev?.textContent).toBe("aaaaaaaa");
    expect(rev?.title).toBe(OLD_HASH);
  });

  it("shows uncommitted hunks as such, with no fake hash", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          payload: payload({
            commits: {
              [ZERO_HASH]: commit({
                hash: ZERO_HASH,
                author: "Not Committed Yet",
                summary: "",
                uncommitted: true
              })
            },
            hunks: [
              hunk({
                commitHash: ZERO_HASH,
                heat: {
                  level: null,
                  uncommitted: true,
                  commitHunkCount: 1,
                  commitLineCount: 2
                }
              })
            ],
            totalLines: 2
          })
        })
      ),
      NOW
    );
    const band = root.querySelector<HTMLElement>(".blame-hunk");
    expect(band?.dataset.heat).toBe("uncommitted");
    expect(band?.querySelector(".blame-uncommitted")?.textContent).toBe("Uncommitted changes");
    expect(band?.querySelector("code.blame-hash")).toBeNull();
    expect(band?.querySelector(".blame-date")).toBeNull();
  });

  it("words every non-line state distinctly, and an error as an error", () => {
    const { root, view } = start();
    const states = [
      ["empty", ".blame-empty", LABELS.empty],
      ["binary", ".blame-binary", LABELS.binary],
      ["tooLarge", ".blame-too-large", LABELS.tooLarge],
      ["untracked", ".blame-untracked", LABELS.untracked],
      ["unborn", ".blame-unborn", LABELS.unborn]
    ] as const;
    for (const [state, selector, text] of states) {
      view.render(
        applyData(
          initialBlameState(),
          dataMessage({ payload: payload({ state, commits: {}, hunks: [], totalLines: 0 }) })
        ),
        NOW
      );
      expect(root.querySelector(selector)?.textContent, state).toBe(text);
      expect(root.querySelector(".blame-error"), state).toBeNull();
      expect(root.querySelector(".blame-hunk"), state).toBeNull();
    }
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          payload: payload({
            state: null,
            commits: {},
            hunks: [],
            totalLines: 0,
            error: "not a repository"
          })
        })
      ),
      NOW
    );
    expect(root.querySelector(".blame-error")?.textContent).toBe(
      "Unable to load the blame: not a repository"
    );
    expect(root.querySelector(".blame-error")?.getAttribute("role")).toBe("alert");
    expect(root.querySelector(".blame-empty")).toBeNull();
  });

  it("highlights the target line and scrolls it into view", () => {
    const { root, view } = start();
    const scrolled: unknown[] = [];
    // jsdom has no layout scrolling; record the call the view makes.
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: function (this: HTMLElement, options?: unknown) {
        scrolled.push({ line: this.dataset.line, options });
      },
      configurable: true
    });
    try {
      view.render(applyData(initialBlameState(), dataMessage({ targetLine: 3 })), NOW);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
    const target = root.querySelector('.blame-line[data-line="3"]');
    expect(target?.classList.contains("blame-target-line")).toBe(true);
    expect(root.querySelectorAll(".blame-target-line")).toHaveLength(1);
    expect(scrolled).toEqual([{ line: "3", options: { block: "center" } }]);
  });

  it("applies the editor typography as custom properties", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({ typography: { fontSize: 16, lineHeight: 24, tabSize: 2 } })
      ),
      NOW
    );
    expect(root.style.getPropertyValue("--blame-font-size")).toBe("16px");
    expect(root.style.getPropertyValue("--blame-line-height")).toBe("24px");
    expect(root.style.getPropertyValue("tab-size")).toBe("2");
  });

  it("widens and narrows the gutter by dragging, stops at 40px, and keeps every line", () => {
    const { root, view, onGutterWidthChange } = start();
    const state = { ...applyData(initialBlameState(), dataMessage()), gutterWidth: 280 };
    view.render(state, NOW);
    const body = root.querySelector<HTMLElement>(".blame-body");
    expect(body?.style.getPropertyValue("--blame-gutter-width")).toBe("280px");

    const drag = (from: number, to: number) => {
      const handle = root.querySelector<HTMLElement>(".blame-gutter-resize");
      expect(handle?.getAttribute("aria-label")).toBe("Resize blame gutter");
      handle?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: from }));
      body?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: to }));
      body?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    };
    drag(100, 140);
    expect(body?.style.getPropertyValue("--blame-gutter-width")).toBe("320px");
    expect(onGutterWidthChange).toHaveBeenCalledWith(320);
    expect(root.querySelectorAll(".blame-line")).toHaveLength(4);

    drag(100, -400);
    expect(body?.style.getPropertyValue("--blame-gutter-width")).toBe("40px");
    expect(onGutterWidthChange).toHaveBeenLastCalledWith(40);
    expect(root.querySelectorAll(".blame-line")).toHaveLength(4);

    // A reload re-renders from the kept width.
    view.render({ ...state, gutterWidth: 40 }, NOW);
    expect(
      root.querySelector<HTMLElement>(".blame-body")?.style.getPropertyValue("--blame-gutter-width")
    ).toBe("40px");
  });

  it("ignores a mouse move that is not part of a drag", () => {
    const { root, view, onGutterWidthChange } = start();
    view.render({ ...applyData(initialBlameState(), dataMessage()), gutterWidth: 280 }, NOW);
    const body = root.querySelector<HTMLElement>(".blame-body");
    body?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 400 }));
    body?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(body?.style.getPropertyValue("--blame-gutter-width")).toBe("280px");
    expect(onGutterWidthChange).not.toHaveBeenCalled();
  });

  it("displays the worktree folder name with a Worktree badge and full path on hover", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          repo: "/workspace/project.worktrees/feat-auth",
          repoMeta: { linkedWorktree: true, bare: false }
        })
      ),
      NOW
    );
    const repo = root.querySelector<HTMLElement>(".blame-repo");
    const badge = root.querySelector<HTMLElement>(".blame-worktree-badge");
    expect(repo?.textContent).toBe("feat-auth");
    expect(repo?.title).toBe("/workspace/project.worktrees/feat-auth");
    expect(badge?.textContent).toBe("Worktree");
    expect(badge?.title).toBe("/workspace/project.worktrees/feat-auth");
  });

  it("shows the Unsaved buffer pill and one-click Blame HEAD switch", () => {
    const { root, view, onBlameHead } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({ unsavedBuffer: true, payload: payload({ resolvedRev: OLD_HASH }) })
      ),
      NOW
    );
    const pill = root.querySelector<HTMLElement>(".blame-unsaved-pill");
    expect(pill?.textContent).toBe("Unsaved buffer");
    expect(pill?.title).toContain(OLD_HASH);
    const btn = root.querySelector<HTMLButtonElement>(".blame-head-btn");
    expect(btn?.textContent).toBe("Blame HEAD");
    btn?.click();
    expect(onBlameHead).toHaveBeenCalledTimes(1);
  });

  it("shows the localized bareWorkingTree notice and bare badge without an error or Open File", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          repo: "/repos/mirror.git",
          repoMeta: { linkedWorktree: false, bare: true },
          payload: payload({ state: "bareWorkingTree", commits: {}, hunks: [], totalLines: 0 })
        })
      ),
      NOW
    );
    expect(root.querySelector(".blame-bare-badge")?.textContent).toBe("bare");
    expect(root.querySelector(".blame-bare-working-tree")?.textContent).toBe(
      LABELS.bareWorkingTree
    );
    expect(root.querySelector(".blame-error")).toBeNull();
    expect(root.querySelector(".blame-open-file-btn")).toBeNull();
    expect(root.querySelector(".blame-heat")).toBeNull();
  });

  it("offers an Open File action on untracked and unborn states (and hides heat controls)", () => {
    const { root, view, onOpenFile } = start();
    for (const state of ["untracked", "unborn"] as const) {
      view.render(
        applyData(
          initialBlameState(),
          dataMessage({ payload: payload({ state, commits: {}, hunks: [], totalLines: 0 }) })
        ),
        NOW
      );
      const button = root.querySelector<HTMLButtonElement>(".blame-open-file-btn");
      expect(button?.textContent, state).toBe("Open File");
      expect(root.querySelector(".blame-heat"), state).toBeNull();
      button?.click();
    }
    expect(onOpenFile).toHaveBeenCalledTimes(2);
  });

  it("shows a subtle Repository changed notice with View latest on a pinned revision", () => {
    const { root, view, onBlameLatest } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          rev: OLD_HASH,
          repoChanged: true,
          payload: payload({ resolvedRev: OLD_HASH })
        })
      ),
      NOW
    );
    expect(root.querySelector(".blame-repo-changed-text")?.textContent).toBe("Repository changed");
    const button = root.querySelector<HTMLButtonElement>(".blame-latest-btn");
    expect(button?.textContent).toBe("View latest");
    button?.click();
    expect(onBlameLatest).toHaveBeenCalledTimes(1);
  });

  it("preserves scroll position across live refreshes and avoids resetting unchanged body DOM", () => {
    const { root, view } = start();
    const scrolled: unknown[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: function (this: HTMLElement) {
        scrolled.push(this.dataset.line);
      },
      configurable: true
    });
    try {
      const initial = applyData(initialBlameState(), dataMessage({ requestId: 1, targetLine: 3 }));
      view.render(initial, NOW);
      expect(scrolled).toEqual(["3"]);

      const scrollBefore = root.querySelector<HTMLElement>(".blame-scroll");
      expect(scrollBefore).not.toBeNull();
      if (scrollBefore !== null) {
        scrollBefore.scrollTop = 180;
        scrollBefore.scrollLeft = 24;
      }

      // Same-content live refresh reuses the existing scroll container without rebuilding DOM.
      const unchanged = applyData(
        initial,
        dataMessage({ requestId: 2, targetLine: 3, preserveScroll: true })
      );
      view.render(unchanged, NOW);
      expect(root.querySelector(".blame-scroll")).toBe(scrollBefore);
      expect(scrollBefore?.scrollTop).toBe(180);
      expect(scrolled).toEqual(["3"]);

      // Changed-content live refresh restores scrollTop/scrollLeft instead of jumping to targetLine.
      const changed = applyData(
        unchanged,
        dataMessage({
          requestId: 3,
          targetLine: 3,
          preserveScroll: true,
          payload: payload({
            hunks: [
              hunk({
                lines: [
                  { finalLine: 1, origLine: 1, content: "edited one" },
                  { finalLine: 2, origLine: 2, content: "edited two" }
                ]
              })
            ],
            totalLines: 2
          })
        })
      );
      view.render(changed, NOW);
      const scrollAfter = root.querySelector<HTMLElement>(".blame-scroll");
      expect(scrollAfter?.scrollTop).toBe(180);
      expect(scrollAfter?.scrollLeft).toBe(24);
      expect(scrolled).toEqual(["3"]);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("renders enabled rewind buttons on non-boundary hunks and disabled ones on boundary hunks", () => {
    const { root, view, onRewind } = start();
    const renamedPayload = payload({
      hunks: [
        hunk(), // boundary commit (OLD_HASH), previous: null
        hunk({
          commitHash: NEW_HASH,
          startLine: 3,
          origStartLine: 9,
          previous: { hash: OLD_HASH, path: "src/old-file.ts" },
          lines: [{ finalLine: 3, origLine: 9, content: "export const three = 3;" }],
          heat: { level: 9, uncommitted: false, commitHunkCount: 1, commitLineCount: 1 }
        })
      ]
    });
    view.render(applyData(initialBlameState(), dataMessage({ payload: renamedPayload })), NOW);

    const buttons = [...root.querySelectorAll<HTMLButtonElement>(".blame-rewind-btn")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[0].title).toBe("Initial commit for this file");

    expect(buttons[1].disabled).toBe(false);
    expect(buttons[1].title).toBe("View blame prior to this change (aaaaaaaa · src/old-file.ts)");
    buttons[1].click();
    expect(onRewind).toHaveBeenCalledWith({
      rev: OLD_HASH,
      filePath: "src/old-file.ts",
      targetLine: 9
    });
  });

  it("shows Back, Forward, Latest and rename notice from navigation state", () => {
    const { root, view, onNavigate } = start();
    // Initial working tree with empty stack hides navigation controls.
    view.render(applyData(initialBlameState(), dataMessage()), NOW);
    expect(root.querySelector(".blame-nav")).toBeNull();
    expect(root.querySelector(".blame-rename-notice")).toBeNull();

    // Rewound across a rename: Back enabled, Forward disabled, Latest enabled, rename notice shown.
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          filePath: "src/orig.ts",
          rev: OLD_HASH,
          navigation: {
            backCount: 1,
            forwardCount: 0,
            canLatest: true,
            initialFilePath: "src/renamed.ts"
          },
          payload: payload({ resolvedRev: OLD_HASH })
        })
      ),
      NOW
    );
    const back = root.querySelector<HTMLButtonElement>(".blame-nav-back");
    const forward = root.querySelector<HTMLButtonElement>(".blame-nav-forward");
    const latest = root.querySelector<HTMLButtonElement>(".blame-nav-latest");
    expect(back?.disabled).toBe(false);
    expect(forward?.disabled).toBe(true);
    expect(latest?.disabled).toBe(false);
    expect(root.querySelector(".blame-rename-notice")?.textContent).toContain("src/renamed.ts");

    back?.click();
    latest?.click();
    expect(onNavigate).toHaveBeenNthCalledWith(1, "back");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "latest");

    // Stepped back to working tree: Forward enabled, Back and Latest disabled.
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          navigation: {
            backCount: 0,
            forwardCount: 1,
            canLatest: false,
            initialFilePath: "src/renamed.ts"
          }
        })
      ),
      NOW
    );
    expect(root.querySelector<HTMLButtonElement>(".blame-nav-back")?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".blame-nav-forward")?.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>(".blame-nav-latest")?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>(".blame-nav-forward")?.click();
    expect(onNavigate).toHaveBeenLastCalledWith("forward");
  });

  it("renders option toggles, .git-blame-ignore-revs chip, and removable session ignore-rev chips", () => {
    const { root, view, onOptionsChange, onClearIgnoredCommit } = start();
    view.render(
      applyData(
        initialBlameState(),
        dataMessage({
          targetLine: 3,
          options: {
            ignoreWhitespace: true,
            detectMoves: false,
            detectCopies: false,
            useIgnoreRevsFile: true
          },
          ignoreRevs: [OLD_HASH, NEW_HASH],
          payload: payload({
            hasIgnoreRevsFile: true,
            ignoreRevsFileUsed: ".git-blame-ignore-revs"
          })
        })
      ),
      NOW
    );

    const wBtn = root.querySelector<HTMLButtonElement>(".blame-option-w");
    const mBtn = root.querySelector<HTMLButtonElement>(".blame-option-m");
    const cBtn = root.querySelector<HTMLButtonElement>(".blame-option-c");
    expect(wBtn?.getAttribute("aria-pressed")).toBe("true");
    expect(mBtn?.getAttribute("aria-pressed")).toBe("false");
    expect(cBtn?.getAttribute("aria-pressed")).toBe("false");

    wBtn?.click();
    expect(onOptionsChange).toHaveBeenCalledWith({ ignoreWhitespace: false }, 3);
    mBtn?.click();
    expect(onOptionsChange).toHaveBeenCalledWith({ detectMoves: true }, 3);
    cBtn?.click();
    expect(onOptionsChange).toHaveBeenCalledWith({ detectCopies: true }, 3);

    const ignoreFileChip = root.querySelector<HTMLButtonElement>(".blame-ignore-revs-file-chip");
    expect(ignoreFileChip?.textContent).toBe("Ignoring .git-blame-ignore-revs");
    expect(ignoreFileChip?.getAttribute("aria-pressed")).toBe("true");
    ignoreFileChip?.click();
    expect(onOptionsChange).toHaveBeenCalledWith({ useIgnoreRevsFile: false }, 3);

    const chips = [...root.querySelectorAll<HTMLElement>(".blame-ignore-rev-chip")];
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toContain("aaaaaaaa");
    chips[0].querySelector<HTMLButtonElement>(".blame-chip-remove")?.click();
    expect(onClearIgnoredCommit).toHaveBeenCalledWith(OLD_HASH, 3);

    root.querySelector<HTMLButtonElement>(".blame-clear-ignored-btn")?.click();
    expect(onClearIgnoredCommit).toHaveBeenCalledWith(null, 3);
  });

  it("supports Find & Author filter via Ctrl+F, typing, Enter/Shift+Enter, buttons and Escape", () => {
    const { root, view } = start();
    const scrolled: unknown[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: function (this: HTMLElement) {
        scrolled.push(this.dataset.line);
      },
      configurable: true
    });
    try {
      view.render(applyData(initialBlameState(), dataMessage()), NOW);
      expect(root.querySelector<HTMLElement>(".blame-find-bar")?.hidden).toBe(true);

      // Ctrl+F opens the find bar and focuses the search input.
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true })
      );
      const bar = root.querySelector<HTMLElement>(".blame-find-bar");
      expect(bar?.hidden).toBe(false);
      const input = root.querySelector<HTMLInputElement>("#blameFindInput");
      expect(document.activeElement).toBe(input);

      // Typing a source query updates counter and highlights active match.
      if (input !== null) {
        input.value = "const";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      expect(root.querySelector(".blame-find-count")?.textContent).toBe("1 / 3");
      expect(root.querySelectorAll(".blame-line.is-find-match")).toHaveLength(3);
      expect(
        root.querySelector('.blame-line[data-line="1"]')?.classList.contains("is-find-active")
      ).toBe(true);

      // Enter advances to next match; Shift+Enter reverses.
      const activeInput = root.querySelector<HTMLInputElement>("#blameFindInput");
      activeInput?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(root.querySelector(".blame-find-count")?.textContent).toBe("2 / 3");
      expect(
        root.querySelector('.blame-line[data-line="2"]')?.classList.contains("is-find-active")
      ).toBe(true);

      const inputAfterNext = root.querySelector<HTMLInputElement>("#blameFindInput");
      inputAfterNext?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true })
      );
      expect(root.querySelector(".blame-find-count")?.textContent).toBe("1 / 3");

      // Author search highlights the matching hunk.
      const authorInput = root.querySelector<HTMLInputElement>("#blameFindInput");
      if (authorInput !== null) {
        authorInput.value = "Ben";
        authorInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      expect(root.querySelector(".blame-find-count")?.textContent).toBe("1 / 1");
      expect(root.querySelectorAll(".blame-hunk.is-find-active-hunk")).toHaveLength(1);
      expect(scrolled.at(-1)).toBe("3");

      // Escape inside the input clears matches and closes the find bar.
      const escInput = root.querySelector<HTMLInputElement>("#blameFindInput");
      escInput?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(root.querySelector<HTMLElement>(".blame-find-bar")?.hidden).toBe(true);
      expect(root.querySelectorAll(".blame-line.is-find-match")).toHaveLength(0);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("preserves scrollTop on same-target reload instead of jumping back to targetLine", () => {
    const { root, view } = start();
    const scrolled: unknown[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: function (this: HTMLElement) {
        scrolled.push(this.dataset.line);
      },
      configurable: true
    });
    try {
      const first = applyData(initialBlameState(), dataMessage({ targetLine: 3 }));
      view.render(first, NOW);
      expect(scrolled).toEqual(["3"]);

      const scrollEl = root.querySelector<HTMLElement>(".blame-scroll");
      if (scrollEl !== null) scrollEl.scrollTop = 210;

      // Same-target reload (e.g. toggling -w) keeps scrollTop = 210 without calling scrollIntoView again.
      const reloaded = applyData(first, dataMessage({ requestId: 2, targetLine: 3 }));
      view.render(reloaded, NOW);
      expect(root.querySelector<HTMLElement>(".blame-scroll")?.scrollTop).toBe(210);
      expect(scrolled).toEqual(["3"]);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});
