/**
 * Column resizing for the reflog table, mirroring the graph table's
 * interaction (`makeTableResizable`/`resizeTableColumn` in the graph
 * webview): dragging the edge between two columns trades width between
 * that pair, and neither side may fall under the graph's 40px minimum.
 * The graph's two special cases (its lanes column and its flexible
 * description column) have no counterpart here — every reflog column is
 * a plain fixed column, so the graph's generic pair rule is the whole
 * rule. Pure arithmetic only; the view owns the DOM.
 */

/** The graph table's column minimum, in pixels. */
export const MIN_COLUMN_WIDTH = 40;

/** How many columns the reflog table draws. */
export const REFLOG_COLUMN_COUNT = 7;

/**
 * Clamp a drag at boundary `col` (between columns `col` and `col + 1`)
 * so neither neighbour drops below the minimum — the graph's
 * `clampTableResizeDelta` for a fixed pair.
 */
export function clampColumnResizeDelta(widths: number[], col: number, delta: number): number {
  let clamped = delta;
  if (widths[col] + clamped < MIN_COLUMN_WIDTH) clamped = MIN_COLUMN_WIDTH - widths[col];
  if (widths[col + 1] - clamped < MIN_COLUMN_WIDTH) clamped = widths[col + 1] - MIN_COLUMN_WIDTH;
  return clamped;
}

/** The widths after dragging boundary `col` by `delta` pixels. */
export function resizeColumnWidths(widths: number[], col: number, delta: number): number[] {
  const clamped = clampColumnResizeDelta(widths, col, delta);
  const next = [...widths];
  next[col] += clamped;
  next[col + 1] -= clamped;
  return next;
}

/**
 * Validate widths restored from the tab's saved state: exactly one
 * finite number per column, each raised to the minimum the way the
 * graph raises a stored width below it. Anything else is not widths
 * this tab wrote, and the table falls back to its natural layout.
 */
export function normalizeColumnWidths(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== REFLOG_COLUMN_COUNT) return null;
  const widths: number[] = [];
  for (const value of raw) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    widths.push(Math.max(Math.trunc(value), MIN_COLUMN_WIDTH));
  }
  return widths;
}
