/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License (see LICENSE.mit).
 * The collapse rule is ported from `UnchangedRegion.fromDiffs` in VS Code's
 * `src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts`
 * at commit 1356222d342e6a7b2dd5603107bcdb60a6d0653b. The rest is our own.
 */

import type { CharSpan, DiffTabChange, DiffTabLayout } from "@/diffTabTypes";

export type DiffSegment = { text: string; highlight: boolean };

export type DiffCell = {
  lineNumber: number;
  change: "none" | "insert" | "delete";
  segments: DiffSegment[];
};

export type DiffRow =
  | { kind: "line"; left: DiffCell | null; right: DiffCell | null }
  | {
      kind: "collapsed";
      id: number;
      originalStart: number;
      modifiedStart: number;
      hiddenCount: number;
    };

type CollapsedRow = Extract<DiffRow, { kind: "collapsed" }>;

// Hidden rows by collapsed-row identity, so `expandCollapsed` works from
// the rows alone; expand the objects `buildRows` returned, not copies.
const hiddenRowsByCollapsed = new WeakMap<CollapsedRow, DiffRow[]>();

/** Split text on `\r\n`, `\n` and `\r`, as VS Code's text model does. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

function segmentsForLine(text: string, lineNumber: number, spans: CharSpan[]): DiffSegment[] {
  const clamp = (column: number): number => Math.max(0, Math.min(column - 1, text.length));
  const intervals: { start: number; end: number }[] = [];
  for (const span of spans) {
    if (lineNumber < span.startLine || lineNumber > span.endLine) continue;
    const start = lineNumber === span.startLine ? clamp(span.startColumn) : 0;
    const end = lineNumber === span.endLine ? clamp(span.endColumn) : text.length;
    if (end > start) intervals.push({ start, end });
  }
  if (intervals.length === 0) return [{ text, highlight: false }];
  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [intervals[0]];
  for (const interval of intervals.slice(1)) {
    const open = merged[merged.length - 1];
    if (interval.start <= open.end) open.end = Math.max(open.end, interval.end);
    else merged.push(interval);
  }
  const segments: DiffSegment[] = [];
  let cursor = 0;
  for (const interval of merged) {
    if (interval.start > cursor)
      segments.push({ text: text.slice(cursor, interval.start), highlight: false });
    segments.push({ text: text.slice(interval.start, interval.end), highlight: true });
    cursor = interval.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });
  return segments;
}

const lineRow = (left: DiffCell | null, right: DiffCell | null): DiffRow => ({
  kind: "line",
  left,
  right
});
const plainCell = (lineNumber: number, text: string): DiffCell => ({
  lineNumber,
  change: "none",
  segments: [{ text, highlight: false }]
});
const changedCell = (
  lines: string[],
  lineNumber: number,
  spans: CharSpan[],
  change: DiffCell["change"]
): DiffCell => ({
  lineNumber,
  change,
  segments: segmentsForLine(lines[lineNumber - 1] ?? "", lineNumber, spans)
});

/**
 * Turn two texts' lines and their changes into side-by-side rows.
 * Aligning at inner-change boundaries inside a change is out of scope.
 */
export function buildRows(
  originalLines: string[],
  modifiedLines: string[],
  changes: DiffTabChange[],
  layout: DiffTabLayout
): DiffRow[] {
  const rows: DiffRow[] = [];
  let nextCollapsedId = 1;
  let originalCursor = 1;
  let modifiedCursor = 1;
  const unchangedRow = (originalLine: number, modifiedLine: number): DiffRow =>
    lineRow(
      plainCell(originalLine, originalLines[originalLine - 1] ?? ""),
      plainCell(modifiedLine, modifiedLines[modifiedLine - 1] ?? "")
    );
  const pushCollapsed = (
    originalStart: number,
    modifiedStart: number,
    hiddenCount: number
  ): void => {
    const hidden: DiffRow[] = [];
    for (let i = 0; i < hiddenCount; i++)
      hidden.push(unchangedRow(originalStart + i, modifiedStart + i));
    const collapsed: CollapsedRow = {
      kind: "collapsed",
      id: nextCollapsedId++,
      originalStart,
      modifiedStart,
      hiddenCount
    };
    hiddenRowsByCollapsed.set(collapsed, hidden);
    rows.push(collapsed);
  };
  // Ported collapse rule: edge runs collapse at context + minimum, middle
  // runs at 2 * context + minimum, the whole file entirely.
  const pushUnchangedRun = (length: number, atStart: boolean, atEnd: boolean): void => {
    const context = layout.contextLineCount;
    const minimum = layout.minimumLineCount;
    let keepTop = length;
    let keepBottom = 0;
    if (layout.hideUnchanged && length > 0) {
      if (atStart && atEnd) {
        if (length >= context + minimum) keepTop = 0;
      } else if (atStart) {
        if (length >= context + minimum) [keepTop, keepBottom] = [0, context];
      } else if (atEnd) {
        if (length >= context + minimum) keepTop = context;
      } else if (length >= 2 * context + minimum) [keepTop, keepBottom] = [context, context];
    }
    const hiddenCount = length - keepTop - keepBottom;
    for (let i = 0; i < keepTop; i++)
      rows.push(unchangedRow(originalCursor + i, modifiedCursor + i));
    if (hiddenCount > 0)
      pushCollapsed(originalCursor + keepTop, modifiedCursor + keepTop, hiddenCount);
    for (let i = 0; i < keepBottom; i++) {
      const offset = keepTop + hiddenCount + i;
      rows.push(unchangedRow(originalCursor + offset, modifiedCursor + offset));
    }
    originalCursor += length;
    modifiedCursor += length;
  };
  changes.forEach((change, index) => {
    pushUnchangedRun(change.original.start - originalCursor, index === 0, false);
    const originalCount = change.original.endExclusive - change.original.start;
    const modifiedCount = change.modified.endExclusive - change.modified.start;
    const originalSpans = change.inner.map((inner) => inner.original);
    const modifiedSpans = change.inner.map((inner) => inner.modified);
    for (let i = 0; i < Math.max(originalCount, modifiedCount); i++) {
      const left =
        i < originalCount
          ? changedCell(originalLines, change.original.start + i, originalSpans, "delete")
          : null;
      const right =
        i < modifiedCount
          ? changedCell(modifiedLines, change.modified.start + i, modifiedSpans, "insert")
          : null;
      rows.push(lineRow(left, right));
    }
    originalCursor = change.original.endExclusive;
    modifiedCursor = change.modified.endExclusive;
  });
  pushUnchangedRun(originalLines.length - originalCursor + 1, changes.length === 0, true);
  return rows;
}

/** Reveal a collapsed region wholly, or `revealLineCount` lines at its top or bottom. */
export function expandCollapsed(
  rows: DiffRow[],
  id: number,
  how: "all" | "above" | "below",
  layout: DiffTabLayout
): DiffRow[] {
  const index = rows.findIndex((row) => row.kind === "collapsed" && row.id === id);
  if (index < 0) return rows.slice();
  const collapsed = rows[index] as CollapsedRow;
  const hidden = hiddenRowsByCollapsed.get(collapsed);
  if (hidden === undefined) return rows.slice();
  const reveal =
    how === "all"
      ? collapsed.hiddenCount
      : Math.min(Math.max(layout.revealLineCount, 0), collapsed.hiddenCount);
  if (reveal <= 0) return rows.slice();
  const remaining = collapsed.hiddenCount - reveal;
  const replacement: DiffRow[] = [];
  if (how === "below" && remaining > 0) {
    const rest: CollapsedRow = { ...collapsed, hiddenCount: remaining };
    hiddenRowsByCollapsed.set(rest, hidden.slice(0, remaining));
    replacement.push(rest, ...hidden.slice(remaining));
  } else if (how === "above" && remaining > 0) {
    const rest: CollapsedRow = {
      ...collapsed,
      originalStart: collapsed.originalStart + reveal,
      modifiedStart: collapsed.modifiedStart + reveal,
      hiddenCount: remaining
    };
    hiddenRowsByCollapsed.set(rest, hidden.slice(reveal));
    replacement.push(...hidden.slice(0, reveal), rest);
  } else {
    replacement.push(...hidden);
  }
  return [...rows.slice(0, index), ...replacement, ...rows.slice(index + 1)];
}
