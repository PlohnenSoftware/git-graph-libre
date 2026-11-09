import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyData,
  applyLoading,
  initialReflogState,
  markLoadingMore
} from "@/webview/reflogTab/rowModel";
import { createReflogView } from "@/webview/reflogTab/view";

import { dataMessage, LABELS, page, row } from "./fixtures";

const NOW = new Date(1_700_000_000_000 + 5 * 60_000);

function start() {
  document.body.innerHTML = '<div id="reflogTab"></div>';
  const root = document.getElementById("reflogTab") as HTMLElement;
  const onLoadMore = vi.fn();
  const view = createReflogView(root, { onLoadMore });
  return { root, view, onLoadMore };
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
      labels: LABELS
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
    expect(headers).toEqual(["Index", "Action", "Sub-action", "Message", "Hash", "Time", "State"]);
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
    expect(cells[4].textContent).toBe("0123456");
    expect(cells[4].querySelector("code")?.title).toBe(entry.hash);
    expect(cells[5].textContent).toBe("5 minutes ago");
    expect(cells[5].title).toContain("2023");
    expect(cells[6].querySelector(".reflog-badge")?.textContent).toBe("Only in the reflog");
    expect(root.querySelector(".reflog-ref")?.textContent).toBe("HEAD");
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
    expect(button?.textContent).toBe("Load More");
    expect(button?.disabled).toBe(false);
    button?.click();
    expect(onLoadMore).toHaveBeenCalledOnce();
    view.render(markLoadingMore(state), NOW);
    expect(root.querySelector<HTMLButtonElement>(".reflog-load-more")?.disabled).toBe(true);
    view.render(applyData(initialReflogState(), dataMessage()), NOW);
    expect(root.querySelector(".reflog-load-more")).toBeNull();
  });
});
