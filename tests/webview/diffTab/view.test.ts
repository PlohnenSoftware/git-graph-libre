import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiffTabLayout } from "@/diffTabTypes";
import { buildRows, type DiffRow } from "@/webview/diffTab/rowModel";
import { createDiffView, type DiffViewOptions } from "@/webview/diffTab/view";

const OPTIONS: DiffViewOptions = {
  lineHeight: 20,
  tabSize: 4,
  hiddenLines: "{0} hidden lines",
  showMoreAbove: "Show more above",
  showMoreBelow: "Show more below",
  showAll: "Show all"
};
const LAYOUT: DiffTabLayout = {
  hideUnchanged: false,
  contextLineCount: 3,
  minimumLineCount: 3,
  revealLineCount: 20
};
const cell = (lineNumber: number, text = `line ${lineNumber}`) => ({
  lineNumber,
  change: "none" as const,
  segments: [{ text, highlight: false }]
});
const plainRows = (count: number): DiffRow[] =>
  Array.from({ length: count }, (_, index) => ({
    kind: "line",
    left: cell(index + 1),
    right: cell(index + 1)
  }));

function mount(rows: DiffRow[], options = OPTIONS) {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientHeight", { value: 200, configurable: true });
  document.body.append(container);
  const view = createDiffView(container, rows, options);
  const viewport = container.querySelector<HTMLDivElement>(".diff-viewport");
  if (!viewport) throw new Error("Missing vertical viewport");
  Object.defineProperty(viewport, "clientHeight", { value: 200, configurable: true });
  view.update(rows);
  const scrollTo = (top: number) => {
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event("scroll"));
  };
  return { container, viewport, view, scrollTo };
}
function click(container: HTMLElement, how: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[data-expand="${how}"]`);
  if (!button) throw new Error(`Missing ${how} expansion button`);
  button.click();
}
function collapsedRows() {
  const lines = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`);
  return buildRows(lines, lines, [], { ...LAYOUT, hideUnchanged: true });
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: (text: string) => ({ width: text.length * 8 })
  } as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("createDiffView", () => {
  it.each([10_000, 100_000])(
    "virtualizes %i rows with 20 rows of overscan on each side",
    (count) => {
      const { container, scrollTo } = mount(plainRows(count));
      expect(container.classList.contains("ggl-diff")).toBe(true);
      expect(container.querySelector<HTMLElement>(".diff-spacer")?.style.height).toBe(
        `${count * 20}px`
      );
      expect(container.querySelectorAll(".diff-row")).toHaveLength(30);
      scrollTo(20 * 500 + 3);
      const rendered = container.querySelectorAll<HTMLElement>(".diff-row");
      expect(rendered).toHaveLength(51);
      expect(rendered[0].dataset.row).toBe("480");
      expect(rendered[0].style.top).toBe("9600px");
      expect(rendered[50].dataset.row).toBe("530");
      scrollTo((count - 10) * 20);
      expect(container.querySelectorAll(".diff-row")).toHaveLength(30);
      expect(container.querySelector(".diff-row:last-child")?.getAttribute("data-row")).toBe(
        String(count - 1)
      );
    }
  );

  it("places decorations, signs, line numbers and safe text on the appropriate halves", () => {
    const rows: DiffRow[] = [
      {
        kind: "line",
        left: {
          ...cell(12),
          change: "delete",
          segments: [{ text: "<script>old</script>\t", highlight: true }]
        },
        right: { ...cell(15), change: "insert", segments: [{ text: "new", highlight: true }] }
      },
      { kind: "line", left: null, right: { ...cell(16), change: "insert" } }
    ];
    const { container } = mount(rows);
    expect(container.querySelector(".diff-side-0.line-delete .gutter-delete")?.textContent).toBe(
      "12"
    );
    expect(container.querySelector(".diff-side-1.line-insert .gutter-insert")?.textContent).toBe(
      "15"
    );
    expect(container.querySelector(".delete-sign")?.textContent).toBe("−");
    expect(container.querySelector(".insert-sign")?.textContent).toBe("+");
    expect(container.querySelector(".char-delete")?.textContent).toBe("<script>old</script>\t");
    expect(container.querySelector(".char-insert")?.textContent).toBe("new");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll(".diff-side-0.diagonal-fill")).toHaveLength(1);
    expect(container.style.getPropertyValue("tab-size")).toBe("4");
    expect(
      container.querySelector(".diff-side-1 .diff-gutter")?.classList.contains("gutter-delete")
    ).toBe(false);
  });

  it("keeps unchanged gutters plain and handles a right filler", () => {
    const { container } = mount([{ kind: "line", left: cell(1), right: null }]);
    expect(container.querySelector(".diff-gutter")?.textContent).toBe("1");
    expect(container.querySelector(".diff-sign")?.textContent).toBe("");
    expect(container.querySelector(".diff-side-1.diagonal-fill")).not.toBeNull();
    expect(
      container.querySelector(".line-delete, .line-insert, .gutter-delete, .gutter-insert")
    ).toBeNull();
  });

  it("scrolls each side's text independently without rebuilding its rows", () => {
    const rows = plainRows(100);
    rows[99] = {
      kind: "line",
      left: cell(100, "long\t".repeat(100)),
      right: cell(100, "r".repeat(500))
    };
    const { container, scrollTo } = mount(rows);
    const bars = container.querySelectorAll<HTMLDivElement>(".diff-horizontal");
    const tracks = container.querySelectorAll<HTMLElement>(".diff-horizontal-track");
    expect(tracks[0].style.width).toBe("6416px");
    expect(tracks[1].style.width).toBe("4016px");
    const first = container.querySelector(".diff-row");
    bars[0].scrollLeft = 123;
    bars[0].dispatchEvent(new Event("scroll"));
    expect(container.style.getPropertyValue("--diff-scroll-0")).toBe("123px");
    expect(container.style.getPropertyValue("--diff-scroll-1")).toBe("");
    expect(container.querySelector(".diff-row")).toBe(first);
    bars[1].scrollLeft = 42;
    bars[1].dispatchEvent(new Event("scroll"));
    scrollTo(1000);
    expect(container.style.getPropertyValue("--diff-scroll-0")).toBe("123px");
    expect(container.style.getPropertyValue("--diff-scroll-1")).toBe("42px");
    expect(tracks[0].style.width).toBe("6416px");
  });

  it("reveals the configured count above, then below, then all from the original row objects", () => {
    const rows = collapsedRows();
    const { container, viewport } = mount(rows, { ...OPTIONS, revealLineCount: 3 });
    expect(container.querySelector(".diff-hidden-lines")?.textContent).toContain(
      "100 hidden lines"
    );
    click(container, "above");
    expect(document.activeElement).toBe(container);
    expect(container.querySelector(".diff-gutter")?.textContent).toBe("1");
    expect(container.querySelector(".diff-hidden-lines")?.textContent).toContain("97 hidden lines");
    click(container, "below");
    expect(container.querySelector(".diff-row:last-child .diff-gutter")?.textContent).toBe("100");
    expect(container.querySelector(".diff-hidden-lines")?.textContent).toContain("94 hidden lines");
    click(container, "all");
    expect(container.querySelector(".diff-hidden-lines")).toBeNull();
    expect(container.querySelector<HTMLElement>(".diff-spacer")?.style.height).toBe("2000px");
    expect(viewport.scrollTop).toBe(0);
    expect(rows).toHaveLength(1);
  });

  it("defaults partial expansion to twenty lines", () => {
    const { container } = mount(collapsedRows());
    click(container, "above");
    expect(container.querySelector(".diff-hidden-lines")?.textContent).toContain("80 hidden lines");
    expect(container.querySelectorAll(".diff-row:not(.diff-hidden-lines)")).toHaveLength(20);
  });

  it("navigates change starts with F7, Shift+F7 and the methods, wrapping in both directions", () => {
    const rows = plainRows(100);
    for (const index of [5, 6, 40, 80])
      rows[index] = {
        kind: "line",
        left: { ...cell(index + 1), change: "delete" },
        right: null
      };
    const { container, viewport, view } = mount(rows);
    const key = (shiftKey = false) => {
      const event = new KeyboardEvent("keydown", { key: "F7", shiftKey, cancelable: true });
      container.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    };
    key();
    expect(viewport.scrollTop).toBe(100);
    key();
    expect(viewport.scrollTop).toBe(800);
    key(true);
    expect(viewport.scrollTop).toBe(100);
    view.revealPreviousChange();
    expect(viewport.scrollTop).toBe(1600);
    view.revealNextChange();
    expect(viewport.scrollTop).toBe(100);
    expect(container.querySelectorAll(".diff-row").length).toBeLessThanOrEqual(50);
  });

  it("rebuilds change navigation after partial expansion", () => {
    const lines = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`);
    const rows = buildRows(
      lines,
      lines,
      [
        {
          original: { start: 50, endExclusive: 51 },
          modified: { start: 50, endExclusive: 51 },
          inner: []
        }
      ],
      { ...LAYOUT, hideUnchanged: true }
    );
    const { container, view, viewport } = mount(rows, { ...OPTIONS, revealLineCount: 3 });
    view.revealNextChange();
    expect(viewport.scrollTop).toBe(80);
    viewport.scrollTop = 0;
    click(container, "above");
    view.revealNextChange();
    expect(viewport.scrollTop).toBe(140);
  });

  it("ignores unrelated keys and modifier combinations, and navigates unchanged files safely", () => {
    const { container, viewport, view } = mount(plainRows(50));
    for (const key of ["F6", "F7"]) {
      const event = new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
      container.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    view.revealNextChange();
    view.revealPreviousChange();
    expect(viewport.scrollTop).toBe(0);
  });

  it("updates the model and clamps scroll position for shorter and empty files", () => {
    const { container, viewport, view, scrollTo } = mount(plainRows(100));
    scrollTo(1200);
    view.update(plainRows(5));
    expect(viewport.scrollTop).toBe(0);
    expect(container.querySelectorAll(".diff-row")).toHaveLength(5);
    expect(container.style.getPropertyValue("--diff-gutter-width")).toBe("calc(1ch + 16px)");
    view.update([]);
    expect(container.querySelectorAll(".diff-row")).toHaveLength(0);
    expect(container.querySelector<HTMLElement>(".diff-spacer")?.style.height).toBe("0px");
  });

  it("rerenders on resize and removes all listeners and observers on dispose", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resized: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    const { container, viewport, view } = mount(plainRows(100));
    const bar = container.querySelector<HTMLDivElement>(".diff-horizontal");
    const removeViewport = vi.spyOn(viewport, "removeEventListener");
    const removeContainer = vi.spyOn(container, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    expect(observe).toHaveBeenCalledWith(viewport);
    Object.defineProperty(viewport, "clientHeight", { value: 400 });
    Object.defineProperty(viewport, "clientWidth", { value: 986 });
    resized?.();
    expect(container.querySelector<HTMLElement>(".diff-scrollbars")?.style.width).toBe("986px");
    expect(container.querySelectorAll(".diff-row")).toHaveLength(40);
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    window.dispatchEvent(new Event("resize"));
    expect(container.querySelectorAll(".diff-row")).toHaveLength(30);
    if (bar) {
      bar.scrollLeft = 30;
      bar.dispatchEvent(new Event("scroll"));
    }
    view.dispose();
    expect(container.style.getPropertyValue("--diff-scroll-0")).toBe("");
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeViewport.mock.calls.map(([name]) => name)).toEqual(["scroll", "click"]);
    expect(removeContainer).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(container.children).toHaveLength(0);
    expect(container.classList.contains("ggl-diff")).toBe(false);
    bar?.dispatchEvent(new Event("scroll"));
    expect(container.style.getPropertyValue("--diff-scroll-0")).toBe("");
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "F7" }));
    viewport.dispatchEvent(new Event("scroll"));
    view.update(plainRows(10));
    resized?.();
    expect(container.children).toHaveLength(0);
  });
});
