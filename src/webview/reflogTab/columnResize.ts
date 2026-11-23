/**
 * Column widths for the reflog table, modeled on the graph table's
 * resizing (`makeTableResizable`/`resizeTableColumn` in the graph
 * webview). Every boundary between two neighbours is dragged the
 * same way: it trades width between the two columns it separates,
 * and the total never changes, so a dragged table keeps fitting its
 * container. Message is the flexible column: it has no width of its
 * own beyond what the fixed columns leave, so the automatic fit
 * (`fitColumnWidthsToContainer`) derives it. A boundary next to
 * Message therefore changes only its fixed neighbour, and Message
 * absorbs the change. Pure arithmetic only; the view owns the DOM.
 *
 * Widths are content widths, as the graph sets them on its header
 * cells: a column's rendered width is its width here plus the header
 * cells' 8px of padding on each side.
 */

/** The graph table's column minimum, in pixels. */
export const MIN_COLUMN_WIDTH = 40;

/**
 * Message's minimum while the user drags a boundary next to it, in
 * pixels: the graph's description column minimum.
 */
export const MESSAGE_DRAG_MIN_WIDTH = 64;

/**
 * Message's working minimum for the automatic fit, in pixels: wide
 * enough that a message wraps into a few readable lines instead of
 * one word per line. The fit takes Message below it only once every
 * fixed column sits at `MIN_COLUMN_WIDTH`.
 */
export const MESSAGE_MIN_WIDTH = 200;

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
 * "DD MM YYYY" shape with its three-letter months, and the longest
 * state label, "Object no longer exists", as its pill. Message's
 * default is only a placeholder: the fit gives Message what the
 * fixed columns leave. Every default sits at or above
 * `MIN_COLUMN_WIDTH`, so a column the user widened can always be
 * dragged back down to its default.
 */
export const DEFAULT_COLUMN_WIDTHS: readonly number[] = [52, 116, 112, 320, 88, 140, 168];

/** A fresh copy of the default widths, safe for the caller to mutate. */
export function defaultColumnWidths(): number[] {
  return [...DEFAULT_COLUMN_WIDTHS];
}

/** The smallest width a column may take in a drag, in pixels. */
function dragFloor(widths: number[], index: number): number {
  if (index !== MESSAGE_COLUMN_INDEX) return MIN_COLUMN_WIDTH;
  // Message may not be dragged below its drag minimum, but a drag may
  // still leave it where it already is when it starts narrower.
  return Math.min(MESSAGE_DRAG_MIN_WIDTH, widths[index] ?? MESSAGE_DRAG_MIN_WIDTH);
}

/**
 * Clamp a drag at boundary `col` (between columns `col` and `col + 1`)
 * so neither side of its trade drops below its floor.
 */
export function clampColumnResizeDelta(widths: number[], col: number, delta: number): number {
  const left = col;
  const right = col + 1;
  const leftFloor = dragFloor(widths, left);
  const rightFloor = dragFloor(widths, right);
  let clamped = delta;
  if ((widths[left] ?? 0) + clamped < leftFloor) clamped = leftFloor - (widths[left] ?? 0);
  if ((widths[right] ?? 0) - clamped < rightFloor) clamped = (widths[right] ?? 0) - rightFloor;
  return clamped;
}

/**
 * The widths after dragging boundary `col` by `delta` pixels: the
 * column on its left takes the delta and the column on its right
 * gives it up. The trade keeps the total width, so a drag can never
 * make the table wider than the container it already fits.
 */
export function resizeColumnWidths(widths: number[], col: number, delta: number): number[] {
  const clamped = clampColumnResizeDelta(widths, col, delta);
  const next = [...widths];
  next[col] = (next[col] ?? 0) + clamped;
  next[col + 1] = (next[col + 1] ?? 0) - clamped;
  return next;
}

function totalWidth(widths: number[]): number {
  return widths.reduce((sum, width) => sum + width, 0);
}

/** The sum of the fixed columns, every column but Message. */
function fixedTotal(widths: number[]): number {
  return totalWidth(widths.filter((_, index) => index !== MESSAGE_COLUMN_INDEX));
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
    // Flooring, never rounding: a column may give a pixel less than
    // its exact share, never more, so the remainder is never negative.
    const give = Math.min(
      Math.floor((excess * (slack[index] ?? 0)) / totalSlack),
      slack[index] ?? 0
    );
    widths[index] = width - give;
    remaining -= give;
  });
  // Flooring leaves at most a pixel per column unaccounted for; the
  // widest fixed columns settle it, one pixel at a time.
  const widestFirst = widths
    .map((width, index) => ({ width, index }))
    .filter(({ index }) => index !== MESSAGE_COLUMN_INDEX)
    .sort((a, b) => b.width - a.width);
  for (const { index } of widestFirst) {
    if (remaining <= 0) break;
    const give = Math.min(remaining, (widths[index] ?? 0) - MIN_COLUMN_WIDTH);
    widths[index] = (widths[index] ?? 0) - give;
    remaining -= give;
  }
  return remaining;
}

/**
 * Scales every column in proportion to its width so their total is
 * exactly `available`. Only for a container narrower than the sum of
 * the minimums, where fitting at all means going below them; the
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
    scaled[index] = (scaled[index] ?? 0) + 1;
    remainder -= 1;
  }
  return scaled;
}

/**
 * The chosen widths fitted to a container `containerWidth` pixels
 * wide, so the rendered table is never wider than its container.
 * Message's stored entry is ignored: Message is what the fixed
 * columns leave. When that leaves at least `MESSAGE_MIN_WIDTH`, the
 * fixed columns keep their chosen widths. A narrower container takes
 * width in order: first the fixed columns, in proportion to their
 * slack above `MIN_COLUMN_WIDTH`, clipping their cells (and headers)
 * with an ellipsis, until Message is back at `MESSAGE_MIN_WIDTH`; only
 * once every fixed column sits at the minimum does Message go below
 * its working minimum, down to `MIN_COLUMN_WIDTH`. Because the fit
 * always starts from the chosen widths, widening grows the fixed
 * columns back before Message passes its working minimum. A container
 * that reports no width yet (the table is not laid out) leaves the
 * widths unchanged.
 */
export function fitColumnWidthsToContainer(widths: number[], containerWidth: number): number[] {
  const available = Math.floor(containerWidth) - REFLOG_COLUMN_COUNT * COLUMN_SIDE_PADDING_PX;
  if (!Number.isFinite(available) || available <= 0) return [...widths];
  const next = [...widths];
  const room = available - fixedTotal(next);
  if (room >= MESSAGE_MIN_WIDTH) {
    next[MESSAGE_COLUMN_INDEX] = room;
    return next;
  }
  const leftover = shrinkFixedColumns(next, MESSAGE_MIN_WIDTH - room);
  next[MESSAGE_COLUMN_INDEX] = MESSAGE_MIN_WIDTH - leftover;
  if ((next[MESSAGE_COLUMN_INDEX] ?? 0) >= MIN_COLUMN_WIDTH) return next;
  // Every fixed column is at its minimum and Message cannot keep even
  // its minimum: the panel is narrower than the sum of the minimums.
  next[MESSAGE_COLUMN_INDEX] = MIN_COLUMN_WIDTH;
  return scaleToAvailable(next, available);
}

/**
 * The six fixed widths, in column order, as the tab saves them per
 * repository. Message is not saved: the fit derives it from the
 * fixed widths at every panel width.
 */
export function savedColumnWidths(widths: number[]): number[] {
  return widths.filter((_, index) => index !== MESSAGE_COLUMN_INDEX);
}

/**
 * Validate widths restored from the tab's saved state. The current
 * format is the six fixed widths (`savedColumnWidths`); the seven-entry
 * format of the Q2 build is read by dropping its Message entry. Each
 * width is raised to the minimum the way the graph raises a stored
 * width below it. The result is the seven-column form the view holds,
 * with Message's entry set to its default placeholder. Anything else
 * is not widths this tab wrote, and the table falls back to its
 * defaults. Fitting them to the panel is the view's job.
 */
export function normalizeColumnWidths(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const fixed = raw.length === REFLOG_COLUMN_COUNT - 1 ? raw : null;
  const legacy =
    raw.length === REFLOG_COLUMN_COUNT
      ? raw.filter((_, index) => index !== MESSAGE_COLUMN_INDEX)
      : null;
  const source = fixed ?? legacy;
  if (source === null) return null;
  const widths: number[] = [];
  for (const value of source) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    widths.push(Math.max(Math.trunc(value), MIN_COLUMN_WIDTH));
  }
  widths.splice(
    MESSAGE_COLUMN_INDEX,
    0,
    DEFAULT_COLUMN_WIDTHS[MESSAGE_COLUMN_INDEX] ?? MESSAGE_MIN_WIDTH
  );
  return widths;
}
