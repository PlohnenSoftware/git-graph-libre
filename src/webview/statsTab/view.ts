import type { StatsLabels } from "@/statsTabTypes";

import {
  buildHeatmapGrid,
  HEAT_LEVELS,
  heatLevel,
  rankAuthors,
  type StatsViewState
} from "./model";

export type StatsViewCallbacks = {
  onRefresh: () => void;
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function folderName(repo: string): string {
  return repo.split("/").at(-1) || repo;
}

function header(state: StatsViewState, labels: StatsLabels, callbacks: StatsViewCallbacks) {
  const bar = element("header", "stats-header");
  bar.append(element("span", "stats-title", labels.title.replace("{0}", folderName(state.repo))));
  const repo = element("span", "stats-repo", folderName(state.repo));
  repo.title = state.repo;
  const refresh = element("button", "stats-refresh", labels.refresh);
  refresh.type = "button";
  refresh.disabled = state.loading;
  refresh.setAttribute("aria-busy", String(state.loading));
  refresh.addEventListener("click", callbacks.onRefresh);
  bar.append(repo, refresh);
  return bar;
}

function messageBlock(className: string, text: string, role?: string): HTMLElement {
  const block = element("p", className, text);
  if (role !== undefined) block.setAttribute("role", role);
  return block;
}

function contributorsSection(state: StatsViewState, labels: StatsLabels, authors: RankedAuthors) {
  const section = element("section", "stats-section stats-contributors-section");
  section.append(element("h2", "stats-heading", labels.contributors));
  const list = element("ol", "stats-authors");
  const counts = new Intl.NumberFormat(state.locale);
  const percents = new Intl.NumberFormat(state.locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
  for (const author of authors) {
    const row = element("li", "stats-author");
    const name = element("span", "stats-author-name", author.name);
    name.title = author.email === "" ? author.name : `${author.name} <${author.email}>`;
    const track = element("span", "stats-author-track");
    const bar = element("span", "stats-author-bar");
    bar.style.width = `${Math.round(author.relative * 100)}%`;
    track.append(bar);
    row.append(
      name,
      track,
      element("span", "stats-author-count", counts.format(author.commits)),
      element("span", "stats-author-share", percents.format(author.share))
    );
    list.append(row);
  }
  section.append(list);
  return section;
}

type RankedAuthors = ReturnType<typeof rankAuthors>;

/** A cell's hover text: the weekday, the hour and the count. */
function cellTitle(labels: StatsLabels, weekday: number, hour: number, count: number): string {
  const day = labels.weekdays[weekday] ?? String(weekday);
  const at = String(hour).padStart(2, "0");
  if (count === 0) return labels.cellNone.replace("{0}", day).replace("{1}", at);
  if (count === 1) return labels.cellOne.replace("{0}", day).replace("{1}", at);
  return labels.cellMany.replace("{0}", day).replace("{1}", at).replace("{2}", String(count));
}

function activitySection(state: StatsViewState, labels: StatsLabels) {
  const section = element("section", "stats-section stats-activity-section");
  section.append(element("h2", "stats-heading", labels.activity));
  section.append(element("p", "stats-activity-note", labels.activityNote));
  const result = state.result;
  const grid = buildHeatmapGrid(result?.state === "ok" ? result.cells : []);

  const table = element("table", "stats-heatmap");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(element("th", "stats-heat-corner"));
  for (let hour = 0; hour < 24; hour++) {
    // An hour number every six hours is enough to read the axis; every
    // cell's own title names its exact hour.
    headRow.append(element("th", "stats-heat-hour", hour % 6 === 0 ? String(hour) : ""));
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  grid.counts.forEach((row, weekday) => {
    const tr = element("tr", "stats-heat-row");
    const day = element("th", "stats-heat-weekday", labels.weekdaysShort[weekday] ?? "");
    day.title = labels.weekdays[weekday] ?? "";
    tr.append(day);
    row.forEach((count, hour) => {
      const cell = element("td", `stats-heat-cell stats-heat-level-${heatLevel(count, grid.max)}`);
      cell.title = cellTitle(labels, weekday, hour, count);
      cell.dataset.count = String(count);
      tr.append(cell);
    });
    body.append(tr);
  });
  table.append(head, body);
  section.append(table);

  const legend = element("div", "stats-legend");
  legend.append(element("span", "stats-legend-label", labels.less));
  for (let level = 0; level < HEAT_LEVELS; level++) {
    const cell = element("span", `stats-legend-cell stats-heat-level-${level}`);
    cell.setAttribute("aria-hidden", "true");
    legend.append(cell);
  }
  legend.append(element("span", "stats-legend-label", labels.more));
  section.append(legend);
  return section;
}

/**
 * Draws the tab from its state: a header naming the repository, then
 * the loading, unavailable or empty word, or the contributors and the
 * activity heatmap. Unavailable is its own block and never falls back
 * to anything (TQ2); empty (a repository with no commits) is a
 * different story from unavailable, and says so in its own words.
 */
export function createStatsView(root: HTMLElement, callbacks: StatsViewCallbacks) {
  root.classList.add("ggl-stats");
  return {
    render(state: StatsViewState): void {
      const { labels } = state;
      if (labels === null) {
        root.replaceChildren();
        return;
      }
      const children: HTMLElement[] = [header(state, labels, callbacks)];
      const main = element("main", "stats-main");
      if (state.loading && state.result === null) {
        main.append(messageBlock("stats-message stats-loading", labels.loading, "status"));
      } else if (state.result?.state === "unavailable") {
        const reason =
          labels.unavailableReasons[state.result.reason] ?? labels.unavailableReasons.failed ?? "";
        main.append(
          messageBlock(
            "stats-message stats-unavailable",
            `${labels.unavailable} ${reason}`.trim(),
            "alert"
          )
        );
      } else if (state.result?.state === "ok") {
        const authors = rankAuthors(state.result.authors);
        if (authors.length === 0) {
          main.append(messageBlock("stats-message stats-empty", labels.empty));
        } else {
          if (state.loading) {
            main.append(messageBlock("stats-message stats-loading", labels.loading, "status"));
          }
          main.append(contributorsSection(state, labels, authors), activitySection(state, labels));
        }
      }
      children.push(main);
      root.replaceChildren(...children);
    }
  };
}
