/**
 * Text and file diffs through the Phase 17 port of VS Code's algorithm
 * (release 1.9.0, sub-slice 22j).
 *
 * The addon exports are optional, like `loadIndexFile` (D43): a binary built
 * before them still loads, and this seam answers null — "unavailable" —
 * instead of an answer, which is why the engine version is not bumped. The
 * wire payload is VS Code's own `LinesDiff` shape; it is parsed strictly
 * here and mapped onto this project's types, so no wire shape leaks past
 * this file. A computation VS Code would throw on arrives as an
 * `Unsupported` rejection from the addon and also answers null: nothing
 * across this seam ever throws.
 *
 * There is no CLI equivalent — Git's diff is a different algorithm (decision
 * X7) — so null means the caller keeps its non-engine behavior, which for
 * the GGL Diff tab is not offering the tab at all.
 */

import { logBackendRoute } from "@/backend/utils/operationLog";
import type { EngineBackend } from "@/types";
import { type EngineAddon, loadEngineAddon } from "./addon";
import { parseEngineCommitFile } from "./details";

/** The slice of the engine addon the diff seam needs. */
export type DiffAddon = Pick<EngineAddon, "diffTexts" | "diffFileAtRevisions">;

export type DiffDeps = {
  /** Read live on every call, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => DiffAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

/** The four options of VS Code's computer; an omitted one is off, a limit of 0 is no limit. */
export type DiffTextsOptions = {
  ignoreTrimWhitespace?: boolean;
  maxComputationTimeMs?: number;
  computeMoves?: boolean;
  extendToSubwords?: boolean;
};

/** A range of lines: 1-based, `endLineNumberExclusive` past the last line. */
export type LineRange = { startLineNumber: number; endLineNumberExclusive: number };

/** A character range: 1-based lines, UTF-16 columns, end exclusive. */
export type CharRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

/**
 * One changed line range. `innerChanges` holds the character-level detail,
 * or null when the computer computed none (a pure insertion or deletion).
 */
export type DetailedLineChange = {
  original: LineRange;
  modified: LineRange;
  innerChanges: { original: CharRange; modified: CharRange }[] | null;
};

/** A block of text that moved, with its own line changes. */
export type MovedText = {
  original: LineRange;
  modified: LineRange;
  changes: DetailedLineChange[];
};

/** A whole-text diff: line changes, moved blocks, and whether the time limit was hit. */
export type LinesDiff = {
  changes: DetailedLineChange[];
  moves: MovedText[];
  hitTimeout: boolean;
};

/** A file diff between two revisions: the diff, or binary when a side is not text. */
export type FileDiff = LinesDiff | { binary: true };

/** The `options_json` argument both addon exports take. */
export function buildDiffOptions(options: DiffTextsOptions): string {
  return JSON.stringify({
    ignoreTrimWhitespace: options.ignoreTrimWhitespace === true,
    maxComputationTimeMs: timeLimit(options.maxComputationTimeMs),
    computeMoves: options.computeMoves === true,
    extendToSubwords: options.extendToSubwords === true
  });
}

/** A whole, non-negative millisecond limit; anything else is no limit (0). */
function timeLimit(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Diff two texts with the port, or null when it cannot answer: the git-cli
 * preference, no loadable addon, an addon without `diffTexts`, any addon
 * rejection (a `DiffError` included), or a malformed payload.
 */
export async function diffTexts(
  original: string,
  modified: string,
  options: DiffTextsOptions,
  deps: DiffDeps = {}
): Promise<LinesDiff | null> {
  const addon = loadDiffAddon("diffTexts", deps);
  if (addon === null) return null;
  if (typeof addon.diffTexts !== "function") {
    logBackendRoute("diffTexts", "backend=cli reason=noDiffTexts");
    return null;
  }
  try {
    const diff = parseLinesDiff(
      await addon.diffTexts(original, modified, buildDiffOptions(options))
    );
    if (diff === null) logBackendRoute("diffTexts", "backend=cli reason=malformedPayload");
    else logBackendRoute("diffTexts", "backend=engine");
    return diff;
  } catch {
    logBackendRoute("diffTexts", "backend=cli reason=engineThrew");
    return null;
  }
}

/**
 * Diff one file between revisions `from` and `to`, both blobs read in
 * process. `oldPath` names the file at `from`, `newPath` at `to`; a side
 * where it is absent reads as empty. Answers `{ binary: true }` when a side
 * is binary, and null under the same conditions as `diffTexts`, plus an
 * unverified repository.
 */
export async function diffFileAtRevisions(
  repo: string,
  from: string,
  to: string,
  oldPath: string,
  newPath: string,
  options: DiffTextsOptions,
  deps: DiffDeps = {}
): Promise<FileDiff | null> {
  const isVerified = deps.isVerified ?? (() => false);
  if (!isVerified(repo)) {
    logBackendRoute("diffFileAtRevisions", "backend=cli reason=unverified");
    return null;
  }
  const addon = loadDiffAddon("diffFileAtRevisions", deps);
  if (addon === null) return null;
  if (typeof addon.diffFileAtRevisions !== "function") {
    logBackendRoute("diffFileAtRevisions", "backend=cli reason=noDiffFileAtRevisions");
    return null;
  }
  try {
    const payload = await addon.diffFileAtRevisions(
      repo,
      from,
      to,
      oldPath,
      newPath,
      buildDiffOptions(options)
    );
    return decodeFileDiff(payload);
  } catch {
    logBackendRoute("diffFileAtRevisions", "backend=cli reason=engineThrew");
    return null;
  }
}

/** A file-diff payload is a `LinesDiff`, or the binary marker `load_commit_file` gives. */
function decodeFileDiff(payload: string): FileDiff | null {
  const diff = parseLinesDiff(payload);
  if (diff !== null) {
    logBackendRoute("diffFileAtRevisions", "backend=engine");
    return diff;
  }
  const file = parseEngineCommitFile(payload);
  if (file?.binary === true && file.contents === null) {
    logBackendRoute("diffFileAtRevisions", "backend=engine");
    return { binary: true };
  }
  logBackendRoute("diffFileAtRevisions", "backend=cli reason=malformedPayload");
  return null;
}

/**
 * The addon when the engine may serve a diff at all, logging the CLI reason
 * otherwise: the git-cli preference, or no loadable addon.
 */
function loadDiffAddon(operation: string, deps: DiffDeps): DiffAddon | null {
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") {
    logBackendRoute(operation, "backend=cli reason=setting");
    return null;
  }
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  if (addon === null) logBackendRoute(operation, "backend=cli reason=engineUnavailable");
  return addon;
}

/* ---------- Strict payload parsing: the wire shape stops here ---------- */

type WireLineRange = { startLineNumber: number; endLineNumberExclusive: number };
type WireRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};
type WireRangeMapping = { originalRange: WireRange; modifiedRange: WireRange };
type WireChange = {
  original: WireLineRange;
  modified: WireLineRange;
  innerChanges: WireRangeMapping[] | null;
};
type WireMove = {
  lineRangeMapping: { original: WireLineRange; modified: WireLineRange };
  changes: WireChange[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Line and column numbers are whole and never negative (`u32` in the crate). */
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isWireLineRange(value: unknown): value is WireLineRange {
  return isRecord(value) && isCount(value.startLineNumber) && isCount(value.endLineNumberExclusive);
}

function isWireRange(value: unknown): value is WireRange {
  return (
    isRecord(value) &&
    isCount(value.startLineNumber) &&
    isCount(value.startColumn) &&
    isCount(value.endLineNumber) &&
    isCount(value.endColumn)
  );
}

function isWireRangeMapping(value: unknown): value is WireRangeMapping {
  return isRecord(value) && isWireRange(value.originalRange) && isWireRange(value.modifiedRange);
}

function isWireChange(value: unknown): value is WireChange {
  if (!isRecord(value)) return false;
  const inner = value.innerChanges;
  return (
    isWireLineRange(value.original) &&
    isWireLineRange(value.modified) &&
    (inner === null || (Array.isArray(inner) && inner.every(isWireRangeMapping)))
  );
}

function isWireMove(value: unknown): value is WireMove {
  if (!isRecord(value) || !isRecord(value.lineRangeMapping)) return false;
  return (
    isWireLineRange(value.lineRangeMapping.original) &&
    isWireLineRange(value.lineRangeMapping.modified) &&
    Array.isArray(value.changes) &&
    value.changes.every(isWireChange)
  );
}

function mapChange(change: WireChange): DetailedLineChange {
  return {
    original: change.original,
    modified: change.modified,
    innerChanges:
      change.innerChanges === null
        ? null
        : change.innerChanges.map((inner) => ({
            original: inner.originalRange,
            modified: inner.modifiedRange
          }))
  };
}

function mapMove(move: WireMove): MovedText {
  return {
    original: move.lineRangeMapping.original,
    modified: move.lineRangeMapping.modified,
    changes: move.changes.map(mapChange)
  };
}

/**
 * Decode and validate a `LinesDiff` payload onto this project's types.
 * Anything malformed is null — never a partial diff the caller would have
 * to second-guess.
 */
export function parseLinesDiff(text: string): LinesDiff | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.hitTimeout !== "boolean") return null;
  if (!Array.isArray(parsed.changes) || !parsed.changes.every(isWireChange)) return null;
  if (!Array.isArray(parsed.moves) || !parsed.moves.every(isWireMove)) return null;
  return {
    changes: parsed.changes.map(mapChange),
    moves: parsed.moves.map(mapMove),
    hitTimeout: parsed.hitTimeout
  };
}
