import { afterEach, describe, expect, it, vi } from "vitest";

import { applyData, applyLoading, initialStatsState } from "@/webview/statsTab/model";
import { createStatsView } from "@/webview/statsTab/view";

import { dataMessage, loadingMessage, okResult } from "./fixtures";

function start() {
  document.body.innerHTML = '<div id="statsTab"></div>';
  const root = document.getElementById("statsTab") as HTMLElement;
  const onRefresh = vi.fn();
  const view = createStatsView(root, { onRefresh });
  return { root, view, onRefresh };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("statistics tab view", () => {
  it("draws nothing before the localized labels arrive", () => {
    const { root, view } = start();
    view.render(initialStatsState());
    expect(root.childElementCount).toBe(0);
  });

  it("shows the loading word while the first load is in flight", () => {
    const { root, view } = start();
    view.render(applyLoading(initialStatsState(), loadingMessage()));
    expect(root.querySelector(".stats-loading")?.textContent).toBe("Loading statistics…");
    expect(root.querySelector(".stats-repo")?.textContent).toBe("one");
    expect(root.querySelector<HTMLButtonElement>(".stats-refresh")?.disabled).toBe(true);
  });

  it("ranks contributors with a bar against the top author, the count and the share", () => {
    const { root, view } = start();
    view.render(applyData(initialStatsState(), dataMessage()));
    const rows = [...root.querySelectorAll(".stats-author")];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".stats-author-name")?.textContent).toBe("Ada");
    expect(rows[0]?.querySelector<HTMLElement>(".stats-author-name")?.title).toBe(
      "Ada <ada@example.test>"
    );
    expect(rows[0]?.querySelector<HTMLElement>(".stats-author-bar")?.style.width).toBe("100%");
    expect(rows[0]?.querySelector(".stats-author-count")?.textContent).toBe("3");
    expect(rows[0]?.querySelector(".stats-author-share")?.textContent).toBe("75%");
    expect(rows[1]?.querySelector(".stats-author-name")?.textContent).toBe("Lin");
    expect(rows[1]?.querySelector<HTMLElement>(".stats-author-bar")?.style.width).toBe("33%");
    expect(rows[1]?.querySelector(".stats-author-share")?.textContent).toBe("25%");
  });

  it("draws 7 heatmap rows of 24 cells and a five-cell legend, with titled cells", () => {
    const { root, view } = start();
    view.render(applyData(initialStatsState(), dataMessage()));
    const rows = [...root.querySelectorAll(".stats-heat-row")];
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.querySelectorAll(".stats-heat-cell")).toHaveLength(24);
    }
    expect(root.querySelectorAll(".stats-legend-cell")).toHaveLength(5);
    expect(root.querySelector(".stats-legend")?.textContent).toContain("Less");
    expect(root.querySelector(".stats-legend")?.textContent).toContain("More");

    const monday = rows[1];
    expect(monday?.querySelector(".stats-heat-weekday")?.textContent).toBe("Mon");
    const cells = [...(monday?.querySelectorAll<HTMLElement>(".stats-heat-cell") ?? [])];
    expect(cells[9]?.title).toBe("Monday at 09:00: 4 commits");
    expect(cells[9]?.className).toContain("stats-heat-level-4");
    expect(cells[10]?.title).toBe("Monday at 10:00: 1 commit");
    expect(cells[10]?.className).toContain("stats-heat-level-1");
    expect(cells[0]?.title).toBe("Monday at 00:00: no commits");
    expect(cells[0]?.className).toContain("stats-heat-level-0");
  });

  it("shows the empty wording for a repository with no commits, and no sections", () => {
    const { root, view } = start();
    view.render(
      applyData(initialStatsState(), dataMessage({ result: okResult({ authors: [], cells: [] }) }))
    );
    expect(root.querySelector(".stats-empty")?.textContent).toBe("No commits yet (empty wording).");
    expect(root.querySelector(".stats-authors")).toBeNull();
    expect(root.querySelector(".stats-heatmap")).toBeNull();
  });

  it("shows the unavailable state with its reason, never the empty wording", () => {
    const { root, view } = start();
    view.render(
      applyData(
        initialStatsState(),
        dataMessage({ result: { state: "unavailable", reason: "backendCli" } })
      )
    );
    const block = root.querySelector<HTMLElement>(".stats-unavailable");
    expect(block?.textContent).toBe(
      "Statistics are unavailable. Statistics need the Rust engine, but the backend setting uses the Git command line."
    );
    expect(block?.getAttribute("role")).toBe("alert");
    expect(root.querySelector(".stats-empty")).toBeNull();
    expect(root.querySelector(".stats-authors")).toBeNull();
  });

  it("asks for a refresh from its button, keeping the data while it reloads", () => {
    const { root, view, onRefresh } = start();
    const loaded = applyData(initialStatsState(), dataMessage());
    view.render(loaded);
    root.querySelector<HTMLButtonElement>(".stats-refresh")?.click();
    expect(onRefresh).toHaveBeenCalledOnce();
    view.render(applyLoading(loaded, loadingMessage({ requestId: 2 })));
    expect(root.querySelector(".stats-loading")).not.toBeNull();
    expect(root.querySelectorAll(".stats-author")).toHaveLength(2);
  });
});
