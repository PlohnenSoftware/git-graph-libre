import { afterEach, describe, expect, it, vi } from "vitest";

import { applyData, applyLoading, initialBlameState } from "@/webview/blameTab/rowModel";
import { createBlameView } from "@/webview/blameTab/view";

import {
  commit,
  DISPLAY,
  dataMessage,
  hunk,
  LABELS,
  loadingMessage,
  OLD_HASH,
  payload,
  ZERO_HASH
} from "./fixtures";

const NOW = new Date(1_700_000_000_000 + 5 * 60_000);

function start() {
  document.body.innerHTML = '<div id="blameTab"></div>';
  const root = document.getElementById("blameTab") as HTMLElement;
  const onGutterWidthChange = vi.fn();
  const view = createBlameView(root, { onGutterWidthChange });
  return { root, view, onGutterWidthChange };
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
});
