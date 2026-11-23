/**
 * Gutter resizing for the blame view, mirroring the reflog table's
 * `columnResize.ts` and the graph table's interaction behind it: dragging
 * the gutter's right edge trades width with the source column, and the
 * gutter never falls under the graph's 40px minimum. The blame gutter is
 * one column, not a table, so the pair rule reduces to clamping that one
 * width; the ceiling keeps a dragged gutter from swallowing the source.
 * Pure arithmetic only; the view owns the DOM.
 */

/** The graph table's column minimum, in pixels. */
export const MIN_GUTTER_WIDTH = 40;

/** The widest the gutter may be dragged, in pixels. */
export const MAX_GUTTER_WIDTH = 800;

/** The gutter width before the user drags it, in pixels. */
export const DEFAULT_GUTTER_WIDTH = 280;

/** Clamp a gutter width to the range a drag may reach. */
export function clampGutterWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_GUTTER_WIDTH;
  return Math.min(MAX_GUTTER_WIDTH, Math.max(MIN_GUTTER_WIDTH, Math.round(width)));
}

/** The gutter width after dragging its edge by `delta` pixels. */
export function resizeGutterWidth(width: number, delta: number): number {
  return clampGutterWidth(width + delta);
}

/**
 * Validate a gutter width restored from the tab's saved state: one finite
 * number, clamped the way a drag clamps. Anything else is not a width
 * this tab wrote, and the view falls back to the default.
 */
export function normalizeGutterWidth(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return clampGutterWidth(raw);
}
