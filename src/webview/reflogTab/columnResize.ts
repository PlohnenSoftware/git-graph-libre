/**
 * Column widths for the reflog table, modeled on the graph table's
 * flexible description column (`makeTableResizable`/`resizeTableColumn`
 * in the graph webview): the fixed columns keep explicit widths and
 * Message, whose cells already wrap, is the column that gives and
 * takes width. Widening a fixed column shrinks Message, narrowing one
 * grows it, and fitting a set of widths to a new container width
 * changes Message first. No column may fall under the graph's 40px
 * minimum while dragging. Pure arithmetic only; the view owns the DOM.
 *
 * Widths are content widths, as the graph sets them on its header
 * cells: a column's rendered width is its width here plus the header
 * cells' 8px of padding on each side.
 */

/** The graph table's column minimum, in pixels. */
export const MIN_COLUMN_WIDTH = 40;

/** How many columns the reflog table draws. */
export const REFLOG_COLUMN_COUNT = 7;

/** The flexible column: Message, between Sub-action and Commit. */
export const MESSAGE_COLUMN_INDEX = 3;

/** A header cell's padding on both sides together, in pixels. */
export const COLUMN_SIDE_PADDING_PX = 16;

/**
 * The widths the table starts with, one per column (Index, Action,
 * Sub-action, Message, Commit, Date, State). Each fixed column's
 * default fits its header label — in every bundled language — and
 * its usual content on one line: a five-digit index, the longest
 * action word beside its dot, a sub-action pill, a hash at the
 * default `shortHashLength`, a date-and-time in the bundle's
 * "DD MM YYYY" shape with its three-letter months, and the longer
 * state badge. Message's default is only its starting share; the
 * fit to the container decides what it actually gets. Every
 * default sits at or above `MIN_COLUMN_WIDTH`, so a column the user
 * widened can always be dragged back down to its default.
 */
export const DEFAULT_COLUMN_WIDTHS: readonly number[] = [52, 116, 112, 320, 88, 140, 168];

/** A fresh copy of the default widths, safe for the caller to mutate. */
export function defaultColumnWidths(): number[] {
  return [...DEFAULT_COLUMN_WIDTHS];
}

/**
 * The two columns a drag at boundary `col` trades between: the column
 * on the boundary's left gives or takes against Message, except at
 * Message's own right edge, where Message trades against Commit.
 */
function dragPair(col: number): { left: number; other: number } {
  return col === MESSAGE_COLUMN_INDEX
    ? { left: col, other: col + 1 }
    : { left: col, other: MESSAGE_COLUMN_INDEX };
}

/**
 * Clamp a drag at boundary `col` (between columns `col` and `col + 1`)
 * so neither side of its trade drops below the minimum.
 */
export function clampColumnResizeDelta(widths: number[], col: number, delta: number): number {
  const { left, other } = dragPair(col);
  let clamped = delta;
  if (widths[left] + clamped < MIN_COLUMN_WIDTH) clamped = MIN_COLUMN_WIDTH - widths[left];
  if (widths[other] - clamped < MIN_COLUMN_WIDTH) clamped = widths[other] - MIN_COLUMN_WIDTH;
  return clamped;
}

/**
 * The widths after dragging boundary `col` by `delta` pixels. The
 * trade keeps the total width, so a drag can never make the table
 * wider than the container it already fits.
 */
export function resizeColumnWidths(widths: number[], col: number, delta: number): number[] {
  const { left, other } = dragPair(col);
  const clamped = clampColumnResizeDelta(widths, col, delta);
  const next = [...widths];
  next[left] += clamped;
  next[other] -= clamped;
  return next;
}

function totalWidth(widths: number[]): number {
  return widths.reduce((sum, width) => sum + width, 0);
}

/**
 * Takes `excess` pixels off the fixed columns in place, each in
 * proportion to how far it sits above the minimum, so a small
 * column keeps the width its header needs while the wide ones
 * give most. Returns what could not be taken because every fixed
 * column already sits at the minimum.
 */
function shrinkFixedColumns(widths: number[], excess: number): number {
  let remaining = excess;
  const slack = widths.map((width, index) =>
    index === MESSAGE_COLUMN_INDEX ? 0 : Math.max(width - MIN_COLUMN_WIDTH, 0)
  );
  const totalSlack = totalWidth(slack);
  if (totalSlack === 0) return remaining;
  widths.forEach((width, index) => {
    if (index === MESSAGE_COLUMN_INDEX || slack[index] === 0) return;
    const give = Math.min(Math.round((excess * slack[index]) / totalSlack), slack[index]);
    widths[index] = width - give;
    remaining -= give;
  });
  // Rounding leaves at most a pixel per column unaccounted for; the
  // widest fixed columns settle it, one pixel at a time.
  const widestFirst = widths
    .map((width, index) => ({ width, index }))
    .filter(({ index }) => index !== MESSAGE_COLUMN_INDEX)
    .sort((a, b) => b.width - a.width);
  for (const { index } of widestFirst) {
    if (remaining <= 0) break;
    const give = Math.min(remaining, widths[index] - MIN_COLUMN_WIDTH);
    widths[index] -= give;
    remaining -= give;
  }
  return remaining;
}

/**
 * Scales every column down in proportion to its width so their total
 * is exactly `available`. Only for a container narrower than the sum
 * of the minimums, where fitting at all means going below them; the
 * columns clip their cells with an ellipsis instead of scrolling.
 */
function scaleToAvailable(widths: number[], available: number): number[] {
  const total = totalWidth(widths);
  const scaled = widths.map((width) => Math.floor((width * available) / total));
  let remainder = available - totalWidth(scaled);
  // The leftover pixels go to the widest columns first.
  const widestFirst = scaled
    .map((width, index) => ({ width, index }))
    .sort((a, b) => b.width - a.width);
  for (const { index } of widestFirst) {
    if (remainder <= 0) break;
    scaled[index] += 1;
    remainder -= 1;
  }
  return scaled;
}

/**
 * The widths fitted to a container `containerWidth` pixels wide, so
 * the rendered table is never wider than its container. Message
 * absorbs the difference first — a wider container grows only it, a
 * narrower one shrinks it down to the minimum — and saved widths
 * that still do not fit are then scaled back on the fixed columns.
 * A container that reports no width yet (the table is not laid out)
 * leaves the widths unchanged.
 */
export function fitColumnWidthsToContainer(widths: number[], containerWidth: number): number[] {
  const available = Math.floor(containerWidth) - REFLOG_COLUMN_COUNT * COLUMN_SIDE_PADDING_PX;
  if (!Number.isFinite(available) || available <= 0) return [...widths];
  const next = [...widths];
  next[MESSAGE_COLUMN_INDEX] += available - totalWidth(next);
  if (next[MESSAGE_COLUMN_INDEX] >= MIN_COLUMN_WIDTH) return next;
  const excess = MIN_COLUMN_WIDTH - next[MESSAGE_COLUMN_INDEX];
  next[MESSAGE_COLUMN_INDEX] = MIN_COLUMN_WIDTH;
  const remaining = shrinkFixedColumns(next, excess);
  // Rounding can take a pixel too many off the fixed columns;
  // Message, the flexible column, takes those back.
  if (remaining < 0) next[MESSAGE_COLUMN_INDEX] -= remaining;
  if (remaining <= 0) return next;
  return scaleToAvailable(next, available);
}

/**
 * Validate widths restored from the tab's saved state: exactly one
 * finite number per column, each raised to the minimum the way the
 * graph raises a stored width below it. Anything else is not widths
 * this tab wrote, and the table falls back to its defaults. Fitting
 * them to the panel's current width is the view's job, through
 * `fitColumnWidthsToContainer`.
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
