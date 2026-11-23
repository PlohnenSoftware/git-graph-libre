import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyData,
  applyLoading,
  applyLostCommits,
  initialReflogState,
  markLoadingMore
} from "@/webview/reflogTab/rowModel";
import { createReflogView } from "@/webview/reflogTab/view";

import {
  DISPLAY,
  dataMessage,
  LABELS,
  loadingMessage,
  lostCommit,
  lostCommitsMessage,
  page,
  REF_OPTIONS,
  row,
  worktreeOption
} from "./fixtures";

const NOW = new Date(1_700_000_000_000 + 5 * 60_000);

function start() {
  document.body.innerHTML = '<div id="reflogTab"></div>';
  const root = document.getElementById("reflogTab") as HTMLElement;
  const onLoadMore = vi.fn();
  const onColumnWidthsChange = vi.fn();
  const onQueryChange = vi.fn();
  const onScanLostCommits = vi.fn();
  const onCancelLostCommitsScan = vi.fn();
  const onCloseLostCommits = vi.fn();
  const onCreateLostCommitBranch = vi.fn();
  const view = createReflogView(root, {
    onLoadMore,
    onColumnWidthsChange,
    onQueryChange,
    onScanLostCommits,
    onCancelLostCommitsScan,
    onCloseLostCommits,
    onCreateLostCommitBranch
  });
  return {
    root,
    view,
    onLoadMore,
    onColumnWidthsChange,
    onQueryChange,
    onScanLostCommits,
    onCancelLostCommitsScan,
    onCloseLostCommits,
    onCreateLostCommitBranch
  };
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
    const state = applyLoading(initialReflogState(), loadingMessage());
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

describe("reflog search, filters and ref picker (F1-05)", () => {
  const QUERY = {
    ref: "refs/heads/main",
    worktreePath: null,
    search: "needle",
    actions: ["reset"],
    onlyInReflog: true
  };

  it("renders the controls with the query's values and the picker's refs", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({ query: QUERY, page: page({ ref: "refs/heads/main" }) })
      ),
      NOW
    );
    const refPicker = root.querySelector<HTMLSelectElement>("#reflogRefPicker");
    expect(refPicker?.getAttribute("aria-label")).toBe("Ref");
    expect([...(refPicker?.options ?? [])].map((o) => [o.value, o.textContent, o.title])).toEqual([
      ["0", "HEAD", "HEAD"],
      ["1", "main", "refs/heads/main"],
      ["2", "Stash (refs/stash)", "refs/stash"]
    ]);
    expect(refPicker?.value).toBe("1");
    const search = root.querySelector<HTMLInputElement>("#reflogSearch");
    expect(search?.value).toBe("needle");
    expect(search?.placeholder).toBe("Search reflog messages…");
    const actions = root.querySelector<HTMLSelectElement>("#reflogActionFilter");
    expect(actions?.options[0]?.textContent).toBe("All actions");
    expect(actions?.value).toBe("reset");
    expect(actions?.querySelector('option[value="reset"]')?.textContent).toBe("Reset");
    const only = root.querySelector<HTMLInputElement>("#reflogOnlyFilter");
    expect(only?.checked).toBe(true);
    expect(only?.closest("label")?.textContent).toContain("Only in the reflog");
    expect(root.querySelector(".reflog-ref")?.textContent).toBe("refs/heads/main");
  });

  it("rebuilds the query from the controls' live values on every change", () => {
    const { root, view, onQueryChange } = start();
    view.render(applyData(initialReflogState(), dataMessage()), NOW);
    const refPicker = root.querySelector<HTMLSelectElement>(
      "#reflogRefPicker"
    ) as HTMLSelectElement;
    refPicker.value = "2";
    refPicker.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { ref: "refs/stash", worktreePath: null, search: "", actions: [], onlyInReflog: false },
      "instant"
    );

    const search = root.querySelector<HTMLInputElement>("#reflogSearch") as HTMLInputElement;
    search.value = "  abc  ";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { ref: "refs/stash", worktreePath: null, search: "abc", actions: [], onlyInReflog: false },
      "search"
    );

    const actions = root.querySelector<HTMLSelectElement>(
      "#reflogActionFilter"
    ) as HTMLSelectElement;
    actions.value = "rebase";
    actions.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      {
        ref: "refs/stash",
        worktreePath: null,
        search: "abc",
        actions: ["rebase"],
        onlyInReflog: false
      },
      "instant"
    );

    const only = root.querySelector<HTMLInputElement>("#reflogOnlyFilter") as HTMLInputElement;
    only.checked = true;
    only.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      {
        ref: "refs/stash",
        worktreePath: null,
        search: "abc",
        actions: ["rebase"],
        onlyInReflog: true
      },
      "instant"
    );

    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(search.value).toBe("");
    expect(onQueryChange).toHaveBeenLastCalledWith(
      {
        ref: "refs/stash",
        worktreePath: null,
        search: "",
        actions: ["rebase"],
        onlyInReflog: true
      },
      "instant"
    );
  });

  it("words a filter that matched nothing apart from an empty reflog", () => {
    const { root, view } = start();
    const filtered = dataMessage({
      query: { ref: "HEAD", worktreePath: null, search: "nope", actions: [], onlyInReflog: false },
      page: page({ rows: [], state: "entries" })
    });
    view.render(applyData(initialReflogState(), filtered), NOW);
    expect(root.querySelector(".reflog-no-matches")?.textContent).toBe("No matching entries.");
    // The controls stay, so the filter can be changed or cleared.
    expect(root.querySelector("#reflogSearch")).not.toBeNull();

    const noReflog = dataMessage({
      query: {
        ref: "refs/heads/main",
        worktreePath: null,
        search: "nope",
        actions: [],
        onlyInReflog: false
      },
      page: page({ rows: [], state: "none", ref: "refs/heads/main" })
    });
    view.render(applyData(initialReflogState(), noReflog), NOW);
    expect(root.querySelector(".reflog-no-matches")).toBeNull();
    expect(root.querySelector(".reflog-empty")?.textContent).toBe(LABELS.empty);
  });

  it("shows the search-cap note with the locale-formatted cap", () => {
    const { root, view } = start();
    view.render(
      applyData(initialReflogState(), dataMessage({ page: page({ searchCapped: true }) })),
      NOW
    );
    const note = root.querySelector(".reflog-cap-note");
    expect(note?.textContent).toBe(
      "The search limit of 5,000 entries was reached; older entries may not be shown."
    );
    expect(note?.getAttribute("role")).toBe("status");
  });

  it("keeps the focused search box, its pending text and its cursor across a render", () => {
    const { root, view } = start();
    const state = applyData(initialReflogState(), dataMessage());
    view.render(state, NOW);
    const search = root.querySelector<HTMLInputElement>("#reflogSearch") as HTMLInputElement;
    search.focus();
    search.value = "abc";
    search.setSelectionRange(1, 1);
    // A reply for the older (empty) search lands while "abc" is typed
    // but not yet sent: the newer text and the focus survive it.
    view.render(state, NOW);
    const again = root.querySelector<HTMLInputElement>("#reflogSearch");
    expect(document.activeElement).toBe(again);
    expect(again?.value).toBe("abc");
    expect(again?.selectionStart).toBe(1);
    // A different repository starts its search from its own query.
    view.render(applyData(initialReflogState(), dataMessage({ repo: "/repos/two" })), NOW);
    expect(root.querySelector<HTMLInputElement>("#reflogSearch")?.value).toBe("");
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
    return [...root.querySelectorAll<HTMLElement>("thead th")].map((cell) => cell.style.width);
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

describe("reflog worktrees and bare repositories (F1-08)", () => {
  it("names whose HEAD is shown and marks locked and missing worktrees in the picker", () => {
    const { root, view, onQueryChange } = start();
    const locked = worktreeOption({ locked: { reason: "on a stick" } });
    const missing = worktreeOption({
      worktreePath: "/repos/gone",
      worktreeName: "gone",
      prunable: { reason: "gitdir file points to non-existent location" }
    });
    const noReason = worktreeOption({
      worktreePath: "/repos/plain",
      worktreeName: "plain",
      locked: { reason: "" }
    });
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({ refOptions: [...REF_OPTIONS, locked, missing, noReason] })
      ),
      NOW
    );
    // With linked worktrees to tell apart, even this worktree's HEAD is named.
    expect(root.querySelector(".reflog-ref")?.textContent).toBe("HEAD of worktree one");
    const refPicker = root.querySelector<HTMLSelectElement>(
      "#reflogRefPicker"
    ) as HTMLSelectElement;
    expect([...refPicker.options].map((option) => option.textContent)).toEqual([
      "HEAD",
      "main",
      "Stash (refs/stash)",
      "HEAD of worktree linked, locked: on a stick",
      "HEAD of worktree gone, missing (moved or deleted)",
      "HEAD of worktree plain, locked"
    ]);
    expect([...refPicker.options].map((option) => option.title)).toContain("/repos/linked");

    refPicker.value = "3";
    refPicker.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      {
        ref: "HEAD",
        worktreePath: "/repos/linked",
        search: "",
        actions: [],
        onlyInReflog: false
      },
      "instant"
    );
  });

  it("headers another worktree's HEAD with its folder and full path", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({
          query: {
            ref: "HEAD",
            worktreePath: "/repos/linked",
            search: "",
            actions: [],
            onlyInReflog: false
          },
          refOptions: [...REF_OPTIONS, worktreeOption()]
        })
      ),
      NOW
    );
    const ref = root.querySelector(".reflog-ref");
    expect(ref?.textContent).toBe("HEAD of worktree linked");
    expect(ref?.getAttribute("title")).toBe("/repos/linked");
    const refPicker = root.querySelector<HTMLSelectElement>("#reflogRefPicker");
    expect(refPicker?.value).toBe("3");
  });

  it("tells the bare story only for a bare HEAD with no reflog", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({ bare: true, page: page({ rows: [], state: "none" }) })
      ),
      NOW
    );
    expect(root.querySelector(".reflog-bare-note")?.textContent).toBe(LABELS.bareHeadNote);

    // A bare branch with no reflog keeps the ordinary empty wording.
    view.render(
      applyData(
        initialReflogState(),
        dataMessage({
          bare: true,
          query: {
            ref: "refs/heads/main",
            worktreePath: null,
            search: "",
            actions: [],
            onlyInReflog: false
          },
          page: page({ rows: [], state: "none", ref: "refs/heads/main" })
        })
      ),
      NOW
    );
    expect(root.querySelector(".reflog-bare-note")).toBeNull();
    expect(root.querySelector(".reflog-empty")?.textContent).toBe(LABELS.empty);

    // And a bare HEAD that does keep entries just shows them.
    view.render(applyData(initialReflogState(), dataMessage({ bare: true })), NOW);
    expect(root.querySelector(".reflog-bare-note")).toBeNull();
    expect(root.querySelector("table")).not.toBeNull();
  });
});

describe("reflog lost-commit scan view (F1-07)", () => {
  it("shows only the opt-in scan button while idle, then progress and cancel while scanning", () => {
    const { root, view, onScanLostCommits, onCancelLostCommitsScan } = start();
    const base = applyData(initialReflogState(), dataMessage());
    view.render(base, NOW);
    expect(root.querySelector(".reflog-lost-panel")).toBeNull();
    const scanBtn = root.querySelector<HTMLButtonElement>("#reflogLostScanBtn");
    expect(scanBtn?.textContent).toBe("Scan for Lost Commits…");
    expect(scanBtn?.disabled).toBe(false);
    scanBtn?.click();
    expect(onScanLostCommits).toHaveBeenCalledOnce();

    const scanning = applyLostCommits(
      base,
      lostCommitsMessage({ status: "scanning", commits: [] })
    );
    view.render(scanning, NOW);
    expect(root.querySelector<HTMLButtonElement>("#reflogLostScanBtn")?.disabled).toBe(true);
    expect(root.querySelector(".reflog-lost-progress")?.textContent).toContain(
      "Scanning repository for lost commits…"
    );
    const cancelBtn = root.querySelector<HTMLButtonElement>("#reflogLostCancelBtn");
    expect(cancelBtn?.textContent).toBe("Cancel");
    cancelBtn?.click();
    expect(onCancelLostCommitsScan).toHaveBeenCalledOnce();
  });

  it("renders discovered lost commits with GC warning and Create Branch Here… per row", () => {
    const { root, view, onCreateLostCommitBranch, onCloseLostCommits } = start();
    const base = applyData(initialReflogState(), dataMessage());
    const itemA = lostCommit({
      hash: "0123456789abcdef0123456789abcdef01234567",
      subject: "abandoned feature"
    });
    const itemB = lostCommit({
      hash: "fedcba9876543210fedcba9876543210fedcba98",
      subject: ""
    });
    const done = applyLostCommits(
      base,
      lostCommitsMessage({
        status: "done",
        commits: [itemA, itemB],
        busyHash: itemB.hash,
        feedback: { kind: "success", message: 'Created branch "saved" at 12345678.' }
      })
    );
    view.render(done, NOW);

    expect(root.querySelector(".reflog-lost-count")?.textContent).toBe("2");
    expect(root.querySelector(".reflog-lost-gc-note")?.textContent).toContain("garbage collection");
    expect(root.querySelector(".reflog-lost-feedback-success")?.textContent).toBe(
      'Created branch "saved" at 12345678.'
    );
    const rows = [...root.querySelectorAll(".reflog-lost-row")];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector("code.reflog-hash")?.textContent).toBe("01234567");
    expect(rows[0].querySelector(".reflog-lost-subject")?.textContent).toBe("abandoned feature");
    expect(rows[1].querySelector(".reflog-lost-subject")?.textContent).toBe("—");

    const buttons = [...root.querySelectorAll<HTMLButtonElement>(".reflog-lost-action-btn")];
    expect(buttons[0].textContent).toBe("Create Branch Here…");
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
    buttons[0].click();
    expect(onCreateLostCommitBranch).toHaveBeenCalledWith(itemA.hash);

    root.querySelector<HTMLButtonElement>("#reflogLostCloseBtn")?.click();
    expect(onCloseLostCommits).toHaveBeenCalledOnce();
  });

  it("renders empty, canceled, timed-out, and error states distinctly", () => {
    const { root, view } = start();
    const base = applyData(initialReflogState(), dataMessage());

    view.render(applyLostCommits(base, lostCommitsMessage({ status: "done", commits: [] })), NOW);
    expect(root.querySelector(".reflog-lost-empty")?.textContent).toContain("No lost commits");
    expect(root.querySelector(".reflog-lost-table")).toBeNull();

    view.render(
      applyLostCommits(base, lostCommitsMessage({ status: "canceled", commits: [] })),
      NOW
    );
    expect(root.querySelector(".reflog-lost-status")?.textContent).toBe(
      "Lost-commit scan canceled."
    );

    view.render(
      applyLostCommits(base, lostCommitsMessage({ status: "timedOut", commits: [] })),
      NOW
    );
    expect(root.querySelector(".reflog-lost-error")?.textContent).toContain("timed out");
    expect(root.querySelector(".reflog-lost-error")?.getAttribute("role")).toBe("alert");

    view.render(
      applyLostCommits(
        base,
        lostCommitsMessage({ status: "error", commits: [], error: "fsck failed" })
      ),
      NOW
    );
    expect(root.querySelector(".reflog-lost-error")?.textContent).toBe(
      "Unable to scan for lost commits: fsck failed"
    );
  });
});
