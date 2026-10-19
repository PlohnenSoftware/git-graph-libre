import { type DiffCell, type DiffRow, expandCollapsed } from "./rowModel";

export type DiffViewOptions = {
  lineHeight: number;
  tabSize: number;
  revealLineCount?: number;
  hiddenLines: string;
  showMoreAbove: string;
  showMoreBelow: string;
  showAll: string;
};

/** Render a fixed-height window; keep model objects intact for expandCollapsed's WeakMap. */
export function createDiffView(
  container: HTMLElement,
  initialRows: DiffRow[],
  options: DiffViewOptions
) {
  const make = (className: string): HTMLDivElement => {
    const element = document.createElement("div");
    element.className = className;
    return element;
  };
  const viewport = make("diff-viewport");
  const spacer = make("diff-spacer");
  const scrollbars = make("diff-scrollbars");
  const horizontal = [make("diff-horizontal"), make("diff-horizontal")];
  const tracks = horizontal.map(() => make("diff-horizontal-track"));
  const originalTabIndex = container.getAttribute("tabindex");
  const lineHeight = Math.max(1, options.lineHeight);
  const tabSize = Math.max(1, Math.floor(options.tabSize));
  const expansionLayout = {
    hideUnchanged: true,
    contextLineCount: 3,
    minimumLineCount: 3,
    revealLineCount: options.revealLineCount ?? 20
  };
  let rows = initialRows;
  let changes: number[] = [];
  let disposed = false;
  container.classList.add("ggl-diff");
  container.tabIndex = 0;
  container.style.setProperty("--diff-line-height", `${lineHeight}px`);
  container.style.setProperty("tab-size", `${tabSize}`);
  viewport.append(spacer);
  horizontal.forEach((bar, index) => {
    bar.append(tracks[index]);
  });
  scrollbars.append(...horizontal);
  container.replaceChildren(viewport, scrollbars);

  const drawCell = (cell: DiffCell | null, side: number): HTMLElement => {
    const half = make(`diff-half diff-side-${side}`);
    if (cell === null) {
      half.classList.add("diagonal-fill");
      return half;
    }
    const changed = cell.change !== "none";
    if (changed) half.classList.add(`line-${cell.change}`);
    const gutter = make("diff-gutter");
    if (changed) gutter.classList.add(`gutter-${cell.change}`);
    gutter.textContent = String(cell.lineNumber);
    const sign = make(changed ? `${cell.change}-sign` : "diff-sign");
    sign.textContent = changed ? (cell.change === "insert" ? "+" : "−") : "";
    const clip = make("diff-text-clip");
    const text = make("diff-text");
    for (const segment of cell.segments) {
      const span = document.createElement("span");
      span.textContent = segment.text;
      if (segment.highlight && changed) span.className = `char-${cell.change}`;
      text.append(span);
    }
    clip.append(text);
    half.append(gutter, sign, clip);
    return half;
  };
  const render = (): void => {
    if (disposed) return;
    scrollbars.style.width = viewport.clientWidth ? `${viewport.clientWidth}px` : "100%";
    const first = Math.max(0, Math.floor(viewport.scrollTop / lineHeight) - 20);
    const end = Math.min(
      rows.length,
      Math.ceil(
        (viewport.scrollTop + (viewport.clientHeight || container.clientHeight)) / lineHeight
      ) + 20
    );
    const fragment = document.createDocumentFragment();
    for (let index = first; index < end; index++) {
      const row = rows[index];
      const element = make("diff-row");
      element.dataset.row = String(index);
      element.style.top = `${index * lineHeight}px`;
      if (row.kind === "line") element.append(drawCell(row.left, 0), drawCell(row.right, 1));
      else {
        element.classList.add("diff-hidden-lines");
        const center = make("center");
        const label = document.createElement("span");
        label.textContent = options.hiddenLines.replace("{0}", String(row.hiddenCount));
        center.append(label);
        for (const [how, title] of [
          ["above", options.showMoreAbove],
          ["below", options.showMoreBelow],
          ["all", options.showAll]
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.region = String(row.id);
          button.dataset.expand = how;
          button.textContent = title;
          center.append(button);
        }
        element.append(center);
      }
      fragment.append(element);
    }
    spacer.replaceChildren(fragment);
  };
  const refresh = (): void => {
    changes = [];
    let previousChanged = false;
    let largestLine = 1;
    const widths = [0, 0];
    // Measure offscreen lines too, so horizontal range never shrinks on vertical scroll.
    const context = document.createElement("canvas").getContext("2d");
    const font = getComputedStyle(container);
    if (context) context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    rows.forEach((row, index) => {
      const changed =
        row.kind === "line" &&
        ((row.left !== null && row.left.change !== "none") ||
          (row.right !== null && row.right.change !== "none"));
      if (changed && !previousChanged) changes.push(index);
      previousChanged = changed;
      if (row.kind !== "line") return;
      [row.left, row.right].forEach((cell, side) => {
        if (cell === null) return;
        largestLine = Math.max(largestLine, cell.lineNumber);
        const text = cell.segments
          .map((segment) => segment.text)
          .join("")
          .replaceAll("\t", " ".repeat(tabSize));
        widths[side] = Math.max(widths[side], context?.measureText(text).width ?? text.length * 16);
      });
    });
    container.style.setProperty(
      "--diff-gutter-width",
      `calc(${String(largestLine).length}ch + 16px)`
    );
    tracks.forEach((track, side) => {
      track.style.width = `${widths[side] + 16}px`;
    });
    spacer.style.height = `${rows.length * lineHeight}px`;
    viewport.scrollTop = Math.min(
      viewport.scrollTop,
      Math.max(0, rows.length * lineHeight - viewport.clientHeight)
    );
    render();
  };
  const reveal = (direction: number): void => {
    if (disposed || changes.length === 0) return;
    const current = Math.floor(viewport.scrollTop / lineHeight);
    const target =
      direction > 0
        ? (changes.find((index) => index > current) ?? changes[0])
        : (changes.findLast((index) => index < current) ?? changes[changes.length - 1]);
    viewport.scrollTop = target * lineHeight;
    render();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "F7" || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    reveal(event.shiftKey ? -1 : 1);
  };
  const onClick = (event: MouseEvent): void => {
    const button =
      event.target instanceof Element ? event.target.closest("button[data-expand]") : null;
    const how = button?.getAttribute("data-expand");
    if (how !== "above" && how !== "below" && how !== "all") return;
    container.focus({ preventScroll: true });
    rows = expandCollapsed(rows, Number(button?.getAttribute("data-region")), how, expansionLayout);
    refresh();
  };
  const onHorizontal = horizontal.map((bar, side) => () => {
    container.style.setProperty(`--diff-scroll-${side}`, `${bar.scrollLeft}px`);
  });
  viewport.addEventListener("scroll", render);
  viewport.addEventListener("click", onClick);
  container.addEventListener("keydown", onKey);
  horizontal.forEach((bar, side) => {
    bar.addEventListener("scroll", onHorizontal[side]);
  });
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(render) : undefined;
  observer?.observe(viewport);
  window.addEventListener("resize", render);
  refresh();
  return {
    update(nextRows: DiffRow[]) {
      if (!disposed) {
        rows = nextRows;
        refresh();
      }
    },
    revealNextChange() {
      reveal(1);
    },
    revealPreviousChange() {
      reveal(-1);
    },
    dispose() {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", render);
      viewport.removeEventListener("scroll", render);
      viewport.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKey);
      horizontal.forEach((bar, side) => {
        bar.removeEventListener("scroll", onHorizontal[side]);
      });
      container.replaceChildren();
      container.classList.remove("ggl-diff");
      for (const name of [
        "--diff-line-height",
        "--diff-gutter-width",
        "--diff-scroll-0",
        "--diff-scroll-1",
        "tab-size"
      ])
        container.style.removeProperty(name);
      if (originalTabIndex === null) container.removeAttribute("tabindex");
      else container.setAttribute("tabindex", originalTabIndex);
    }
  };
}
