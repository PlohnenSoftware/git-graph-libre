import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyData,
  applyLoading,
  initialReflogState,
  markLoadingMore
} from "@/webview/reflogTab/rowModel";
import { createReflogView } from "@/webview/reflogTab/view";

import { DISPLAY, dataMessage, LABELS, page, row } from "./fixtures";

const NOW = new Date(1_700_000_000_000 + 5 * 60_000);

function start() {
  document.body.innerHTML = '<div id="reflogTab"></div>';
  const root = document.getElementById("reflogTab") as HTMLElement;
  const onLoadMore = vi.fn();
  const onColumnWidthsChange = vi.fn();
  const view = createReflogView(root, { onLoadMore, onColumnWidthsChange });
  return { root, view, onLoadMore, onColumnWidthsChange };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("reflog tab view", () => {
  it("draws nothing before the localized labels arrive", () => {
    const { root, view } = start();
    view.render(initialReflogState(), NOW);
    expect(root.childElementCount).toBe(0);
  });

  it("shows the loading word while the first page is in flight", () => {
    const { root, view } = start();
    const state = applyLoading(initialReflogState(), {
      command: "reflogLoading",
      requestId: 1,
      repo: "/repos/one",
      locale: "en",
      labels: LABELS,
      display: DISPLAY
    });
    view.render(state, NOW);
    expect(root.querySelector(".reflog-loading")?.textContent).toBe("Loading reflog…");
    expect(root.querySelector(".reflog-repo")?.textContent).toBe("one");
  });

  it("renders every column, with the full hash and date on hover", () => {
    const { root, view } = start();
    const entry = row({
      index: 3,
      kind: "rebase",
      sub: "pick",
      message: "rebase (pick): fix typo",
      hash: "0123456789abcdef0123456789abcdef01234567",
      state: "reflogOnly"
    });
    view.render(
      applyData(initialReflogState(), dataMessage({ page: page({ rows: [entry] }) })),
      NOW
    );
    const headers = [...root.querySelectorAll("th")].map((cell) => cell.textContent);
    expect(headers).toEqual([
      "Index",
      "Action",
      "Sub-action",
      "Message",
      "Commit",
      "Date",
      "State"
    ]);
    const cells = [...root.querySelectorAll<HTMLTableCellElement>("tbody td")];
    expect(cells[0].textContent).toBe("3");
    expect(cells[0].title).toBe("HEAD@{3}");
    expect(cells[1].textContent).toBe("Rebase");
    const actionSpan = cells[1].querySelector<HTMLElement>(".reflog-action");
    expect(actionSpan?.getAttribute("data-kind")).toBe("rebase");
    expect(actionSpan?.title).toBe("rebase");
    expect(actionSpan?.querySelector(".reflog-kind-dot")?.className).toBe(
      "reflog-kind-dot reflog-kind-rebase"
    );
    expect(cells[2].textContent).toBe("Pick");
    const subTag = cells[2].querySelector<HTMLElement>(".reflog-sub");
    expect(subTag?.className).toBe("reflog-sub reflog-sub-tag reflog-sub-intent-advance");
    expect(subTag?.title).toBe("pick");
    expect(cells[3].textContent).toBe("rebase (pick): fix typo");
    expect(cells[4].textContent).toBe("01234567");
    expect(cells[4].querySelector("code")?.title).toBe(entry.hash);
    expect(cells[5].textContent).toMatch(/^\d{1,2} Nov 2023 \d{2}:\d{2}$/);
    expect(cells[5].title).toBe(cells[5].textContent);
    expect(cells[6].querySelector(".reflog-badge")?.textContent).toBe("Only in the reflog");
    expect(root.querySelector(".reflog-ref")?.textContent).toBe("HEAD");
  });

  it("shortens hashes to the configured length and follows dateFormat (F1-04F)", () => {
    const { root, view } = start();
    const entry = row({ hash: "0123456789abcdef0123456789abcdef01234567" });
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({
          display: { ...DISPLAY, shortHashLength: 12, dateFormat: "Relative" },
          page: page({ rows: [entry] })
        })
      ),
      NOW
    );
    const cells = [...root.querySelectorAll<HTMLTableCellElement>("tbody td")];
    expect(cells[4].textContent).toBe("0123456789ab");
    expect(cells[4].querySelector("code")?.title).toBe(entry.hash);
    expect(cells[5].textContent).toBe("5 minutes ago");
    expect(cells[5].title).toMatch(/^\d{1,2} Nov 2023 \d{2}:\d{2}$/);
    // An out-of-range length clamps the way the graph's does.
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({
          display: { ...DISPLAY, shortHashLength: 1 },
          page: page({ rows: [entry] })
        })
      ),
      NOW
    );
    expect(root.querySelector("code.reflog-hash")?.textContent).toBe("0123");
  });

  it("badges a missing object and leaves reachable and unknown rows unmarked", () => {
    const { root, view } = start();
    const state = applyData(
      initialReflogState(),
      dataMessage({
        page: page({
          rows: [
            row({ index: 0, state: "missing" }),
            row({ index: 1, state: "reachable" }),
            row({ index: 2, state: null })
          ]
        })
      })
    );
    view.render(state, NOW);
    const badges = [...root.querySelectorAll(".reflog-badge")].map((b) => b.textContent);
    expect(badges).toEqual(["Object no longer exists"]);
  });

  it("shows a missing sub-action as a dash, not a blank", () => {
    const { root, view } = start();
    view.render(applyData(initialReflogState(), dataMessage()), NOW);
    expect(root.querySelector(".reflog-sub")?.textContent).toBe("—");
    expect(root.querySelector(".reflog-sub")?.className).toBe("reflog-sub");
  });

  it("shows an unknown kind and sub-action as Git wrote them, neutral (F1-04)", () => {
    const { root, view } = start();
    const entry = row({
      kind: "frobnicate",
      sub: "detached-from-abc",
      message: "frobnicate (detached-from-abc): custom tool text"
    });
    view.render(
      applyData(initialReflogState(), dataMessage({ page: page({ rows: [entry] }) })),
      NOW
    );
    const actionSpan = root.querySelector<HTMLElement>(".reflog-action");
    expect(actionSpan?.textContent).toBe("frobnicate");
    expect(actionSpan?.querySelector(".reflog-kind-dot")?.className).toBe(
      "reflog-kind-dot reflog-kind-other"
    );
    const subTag = root.querySelector<HTMLElement>(".reflog-sub");
    expect(subTag?.textContent).toBe("detached-from-abc");
    expect(subTag?.className).toBe("reflog-sub reflog-sub-tag reflog-sub-intent-neutral");
    expect(subTag?.title).toBe("detached-from-abc");
  });

  it("words the empty reflog with the expiry explanation", () => {
    const { root, view } = start();
    for (const reflogState of ["empty", "none"] as const) {
      const state = applyData(
        initialReflogState(),
        dataMessage({ page: page({ rows: [], state: reflogState }) })
      );
      view.render(state, NOW);
      expect(root.querySelector(".reflog-empty")?.textContent).toBe(LABELS.empty);
      expect(root.querySelector(".reflog-error")).toBeNull();
      expect(root.querySelector("table")).toBeNull();
    }
  });

  it("keeps an error distinct from empty", () => {
    const { root, view } = start();
    const state = applyData(
      initialReflogState(),
      dataMessage({ page: page({ rows: [], state: null, ref: null, error: "not a repository" }) })
    );
    view.render(state, NOW);
    expect(root.querySelector(".reflog-error")?.textContent).toBe(
      "Unable to load the reflog: not a repository"
    );
    expect(root.querySelector(".reflog-error")?.getAttribute("role")).toBe("alert");
    expect(root.querySelector(".reflog-empty")).toBeNull();
  });

  it("offers Load more only while more pages exist, disabled in flight", () => {
    const { root, view, onLoadMore } = start();
    const state = applyData(initialReflogState(), dataMessage({ page: page({ hasMore: true }) }));
    view.render(state, NOW);
    const button = root.querySelector<HTMLButtonElement>(".reflog-load-more");
    expect(button?.textContent).toBe("Load More Entries");
    expect(button?.disabled).toBe(false);
    button?.click();
    expect(onLoadMore).toHaveBeenCalledOnce();
    view.render(markLoadingMore(state), NOW);
    expect(root.querySelector<HTMLButtonElement>(".reflog-load-more")?.disabled).toBe(true);
    view.render(applyData(initialReflogState(), dataMessage()), NOW);
    expect(root.querySelector(".reflog-load-more")).toBeNull();
  });
});

describe("reflog table column resizing (F1-04F)", () => {
  const WIDTHS = [50, 110, 90, 300, 90, 130, 120];

  function renderWith(widths: number[] | null) {
    const started = start();
    const state = {
      ...applyData(
        initialReflogState(),
        dataMessage({ page: page({ rows: [row(), row({ index: 1, hash: "b".repeat(40) })] }) })
      ),
      columnWidths: widths
    };
    started.view.render(state, NOW);
    return { ...started, state };
  }

  function colWidths(root: HTMLElement): string[] {
    return [...root.querySelectorAll<HTMLElement>("colgroup col")].map((col) => col.style.width);
  }

  function drag(root: HTMLElement, col: number, from: number, to: number) {
    const handle = root.querySelector<HTMLElement>(`.resizeCol[data-col="${col}"]`);
    handle?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: from }));
    const headRow = root.querySelector(".reflog-head-row") as HTMLElement;
    headRow.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: to }));
    headRow.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }

  it("puts the graph's resizeCol handle on every column edge", () => {
    const { root } = renderWith(null);
    const handles = [...root.querySelectorAll<HTMLElement>(".resizeCol")].map(
      (handle) => `${handle.className}:${handle.dataset.col}`
    );
    expect(handles).toEqual([
      "resizeCol right:0",
      "resizeCol left:0",
      "resizeCol right:1",
      "resizeCol left:1",
      "resizeCol right:2",
      "resizeCol left:2",
      "resizeCol right:3",
      "resizeCol left:3",
      "resizeCol right:4",
      "resizeCol left:4",
      "resizeCol right:5",
      "resizeCol left:5"
    ]);
    // No saved widths yet: the table still sizes itself.
    expect(root.querySelector("table")?.classList.contains("fixedLayout")).toBe(false);
  });

  it("widens and narrows by dragging, stops at 40px, and keeps every row", () => {
    const { root, view, state, onColumnWidthsChange } = renderWith([...WIDTHS]);
    expect(root.querySelector("table")?.classList.contains("fixedLayout")).toBe(true);
    expect(colWidths(root)).toEqual(["50px", "110px", "90px", "300px", "90px", "130px", "120px"]);

    drag(root, 3, 100, 140);
    expect(colWidths(root)).toEqual(["50px", "110px", "90px", "340px", "50px", "130px", "120px"]);
    expect(onColumnWidthsChange).toHaveBeenCalledWith([50, 110, 90, 340, 50, 130, 120]);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(2);

    drag(root, 3, 100, -400);
    expect(colWidths(root)).toEqual(["50px", "110px", "90px", "40px", "350px", "130px", "120px"]);
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith([50, 110, 90, 40, 350, 130, 120]);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(2);

    // A reload re-renders from the kept widths: same table, same rows.
    view.render({ ...state, columnWidths: [50, 110, 90, 40, 350, 130, 120] }, NOW);
    expect(colWidths(root)).toEqual(["50px", "110px", "90px", "40px", "350px", "130px", "120px"]);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("freezes the natural layout into fixed widths on the first drag", () => {
    const { root, onColumnWidthsChange } = renderWith(null);
    for (const [index, cell] of [...root.querySelectorAll("th")].entries()) {
      Object.defineProperty(cell, "clientWidth", { value: 66 + index * 20, configurable: true });
    }
    drag(root, 0, 100, 110);
    // Rendered widths minus the 16px of side padding, then the drag's trade.
    expect(onColumnWidthsChange).toHaveBeenCalledWith([60, 60, 90, 110, 130, 150, 170]);
    expect(root.querySelector("table")?.classList.contains("fixedLayout")).toBe(true);
  });

  it("ignores a mouse move that is not part of a drag", () => {
    const { root, onColumnWidthsChange } = renderWith([...WIDTHS]);
    const headRow = root.querySelector(".reflog-head-row") as HTMLElement;
    headRow.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 400 }));
    headRow.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(colWidths(root)).toEqual(["50px", "110px", "90px", "300px", "90px", "130px", "120px"]);
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
  });
});
