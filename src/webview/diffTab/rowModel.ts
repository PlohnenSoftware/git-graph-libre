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

/** A half-open range of UTF-16 string indices within one line. */
type Interval = { start: number; end: number };

/** The part of `text` (line `lineNumber`) a span covers, or null if none. */
function spanOnLine(span: CharSpan, lineNumber: number, text: string): Interval | null {
  if (lineNumber < span.startLine || lineNumber > span.endLine) return null;
  const clamp = (column: number): number => Math.max(0, Math.min(column - 1, text.length));
  const start = lineNumber === span.startLine ? clamp(span.startColumn) : 0;
  const end = lineNumber === span.endLine ? clamp(span.endColumn) : text.length;
  return end > start ? { start, end } : null;
}

/** Sort intervals in place and merge those that overlap or touch. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Interval[] = [];
  for (const interval of intervals) {
    const open = merged.at(-1);
    if (open !== undefined && interval.start <= open.end)
      open.end = Math.max(open.end, interval.end);
    else merged.push(interval);
  }
  return merged;
}

function segmentsForLine(text: string, lineNumber: number, spans: CharSpan[]): DiffSegment[] {
  const intervals: Interval[] = [];
  for (const span of spans) {
    const interval = spanOnLine(span, lineNumber, text);
    if (interval !== null) intervals.push(interval);
  }
  if (intervals.length === 0) return [{ text, highlight: false }];
  const segments: DiffSegment[] = [];
  let cursor = 0;
  for (const interval of mergeIntervals(intervals)) {
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
 * The ported collapse rule: how many lines of an unchanged run stay visible
 * above and below its collapsed middle. Edge runs collapse at context +
 * minimum, keeping context lines only next to the change; middle runs at
 * 2 * context + minimum; a run that is the whole file collapses entirely.
 */
function visibleEdges(
  length: number,
  atStart: boolean,
  atEnd: boolean,
  layout: DiffTabLayout
): { top: number; bottom: number } {
  const context = layout.contextLineCount;
  const threshold = (atStart || atEnd ? context : 2 * context) + layout.minimumLineCount;
  const collapses = layout.hideUnchanged && length > 0 && length >= threshold;
  if (!collapses) return { top: length, bottom: 0 };
  return { top: atStart ? 0 : context, bottom: atEnd ? 0 : context };
}

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
  const pushUnchangedRun = (length: number, atStart: boolean, atEnd: boolean): void => {
    const { top: keepTop, bottom: keepBottom } = visibleEdges(length, atStart, atEnd, layout);
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
