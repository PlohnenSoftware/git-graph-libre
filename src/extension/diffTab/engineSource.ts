/**
 * The engine-backed `DiffTabSource` (release 1.9.0, slice D45): both texts
 * read in process where the engine can serve them, the diff computed by the
 * Phase 17 port through the 22j `diffTexts` seam. There is no CLI diff to
 * fall back to — Git's algorithm is a different one (decision X7) — so a
 * seam that cannot answer becomes the tab's `error` payload, and the
 * context key below keeps the tab from being offered at all. Nothing here
 * throws to the panel: every read answers text, binary or an error result.
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { type EngineAddon, loadEngineAddon } from "@/backend/engine/addon";
import { parseEngineCommitFile } from "@/backend/engine/details";
import {
  type CharRange,
  diffTexts,
  type LineRange,
  type LinesDiff
} from "@/backend/engine/diffTexts";
import { readStagedFile } from "@/backend/engine/stagedFile";
import { runGitCommand } from "@/backend/utils/gitRunner";
import { logBackendRoute } from "@/backend/utils/operationLog";
import type {
  CharSpan,
  DiffTabChange,
  DiffTabPayload,
  DiffTabRequest,
  DiffTabSide,
  DiffTabSource,
  LineSpan
} from "@/diffTabTypes";
import type { EngineBackend } from "@/types";
import { splitLines } from "@/webview/diffTab/rowModel";

/** The slice of the engine addon this source needs. */
export type EngineDiffTabAddon = Pick<
  EngineAddon,
  "loadCommitFile" | "loadIndexFile" | "diffTexts"
>;

export type EngineDiffTabSourceDeps = {
  /** The resolved git binary, read live (`config.gitPath`). */
  gitPath?: () => string;
  /** Read live on every load, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => EngineDiffTabAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

/** The context key D46's menus show on: true only while the tab can be fed. */
export const DIFF_TAB_AVAILABLE_CONTEXT = "git-graph-libre.diffTabAvailable";

/** How far into a blob git looks before deciding it is binary (`blob.rs`). */
const BINARY_SNIFF_LEN = 8000;
const BYTES_PER_MEBIBYTE = 1024 * 1024;

type SideText = { text: string } | { binary: true } | { error: string; reason: string };

/** The tab's engine-backed source; wire it with the extension's live deps. */
export function createEngineDiffTabSource(deps: EngineDiffTabSourceDeps = {}): DiffTabSource {
  return { load: (request) => loadDiffTab(request, deps) };
}

async function loadDiffTab(
  request: DiffTabRequest,
  deps: EngineDiffTabSourceDeps
): Promise<DiffTabPayload> {
  const started = performance.now();
  try {
    const [left, right] = await Promise.all([
      readSide(request.repo, request.left, deps),
      readSide(request.repo, request.right, deps)
    ]);
    const readMs = elapsedMs(started);
    if ("error" in left) return failurePayload(left, readMs);
    if ("error" in right) return failurePayload(right, readMs);
    if ("binary" in left || "binary" in right) {
      logBackendRoute("diffTab", `backend=engine read=${readMs} diff=0 lines=0 result=binary`);
      return { kind: "binary" };
    }
    return await diffSides(left.text, right.text, readMs, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failurePayload({ error: message, reason: "readFailed" }, elapsedMs(started));
  }
}

function failurePayload(
  failure: { error: string; reason: string },
  readMs: number
): DiffTabPayload {
  logBackendRoute("diffTab", `backend=cli reason=${failure.reason} read=${readMs} diff=0 lines=0`);
  return { kind: "error", message: failure.error };
}

async function diffSides(
  original: string,
  modified: string,
  readMs: number,
  deps: EngineDiffTabSourceDeps
): Promise<DiffTabPayload> {
  const settings = readDiffEditorSettings();
  if (
    isTooLarge(original, settings.maxFileSizeMb) ||
    isTooLarge(modified, settings.maxFileSizeMb)
  ) {
    logBackendRoute("diffTab", `backend=engine read=${readMs} diff=0 lines=0 result=tooLarge`);
    return { kind: "tooLarge" };
  }
  const originalLines = splitLines(original);
  const modifiedLines = splitLines(modified);
  const started = performance.now();
  const diff = await diffTexts(
    original,
    modified,
    {
      ignoreTrimWhitespace: settings.ignoreTrimWhitespace,
      maxComputationTimeMs: settings.maxComputationTimeMs,
      computeMoves: false
    },
    deps
  );
  const diffMs = elapsedMs(started);
  const lines = originalLines.length + modifiedLines.length;
  if (diff === null) {
    logBackendRoute(
      "diffTab",
      `backend=cli reason=diffUnavailable read=${readMs} diff=${diffMs} lines=${lines}`
    );
    return { kind: "error", message: "diff engine unavailable" };
  }
  const timeout = diff.hitTimeout ? " hitTimeout=1" : "";
  logBackendRoute(
    "diffTab",
    `backend=engine read=${readMs} diff=${diffMs} lines=${lines}${timeout}`
  );
  return { kind: "diff", originalLines, modifiedLines, changes: mapDiffTabChanges(diff) };
}

function elapsedMs(started: number): number {
  return Math.round(performance.now() - started);
}

/** Map the seam's VS Code-shaped result into the tab's own types. */
export function mapDiffTabChanges(diff: LinesDiff): DiffTabChange[] {
  return diff.changes.map((change) => ({
    original: toLineSpan(change.original),
    modified: toLineSpan(change.modified),
    inner: (change.innerChanges ?? []).map((inner) => ({
      original: toCharSpan(inner.original),
      modified: toCharSpan(inner.modified)
    }))
  }));
}

function toLineSpan(range: LineRange): LineSpan {
  return { start: range.startLineNumber, endExclusive: range.endLineNumberExclusive };
}

function toCharSpan(range: CharRange): CharSpan {
  return {
    startLine: range.startLineNumber,
    startColumn: range.startColumn,
    endLine: range.endLineNumber,
    endColumn: range.endColumn
  };
}

/* ---------- Reading each side ---------- */

async function readSide(
  repo: string,
  side: DiffTabSide,
  deps: EngineDiffTabSourceDeps
): Promise<SideText> {
  if (side.kind === "empty") return { text: "" };
  if (side.kind === "index") return readIndexSide(repo, side.path, deps);
  if (side.kind === "workingTree") return readWorkingTreeSide(repo, side.path);
  return readRevisionSide(repo, side.ref, side.path, deps);
}

async function readIndexSide(
  repo: string,
  filePath: string,
  deps: EngineDiffTabSourceDeps
): Promise<SideText> {
  const staged = await readStagedFile(repo, filePath, {
    gitPath: (deps.gitPath ?? (() => "git"))(),
    backend: deps.backend,
    addonProvider: deps.addonProvider,
    isVerified: deps.isVerified
  });
  if ("binary" in staged) return { binary: true };
  if ("missing" in staged) return { text: "" };
  return { text: staged.text };
}

/**
 * A file at a revision: the engine's `loadCommitFile`, with `git show`
 * behind it as in `DiffDocProvider` — except that binary is a valid answer
 * here (as in `readStagedFile`), not a fallback cue.
 */
async function readRevisionSide(
  repo: string,
  ref: string,
  filePath: string,
  deps: EngineDiffTabSourceDeps
): Promise<SideText> {
  const fromEngine = await readRevisionFromEngine(repo, ref, filePath, deps);
  if (fromEngine !== null) return fromEngine;
  const object = `${ref}:${filePath}`;
  let bytes: Buffer;
  try {
    bytes = await runGitCommand(
      () => showGitObject((deps.gitPath ?? (() => "git"))(), repo, object),
      {
        label: "diffTab.show",
        repo,
        args: ["show", object]
      }
    );
  } catch {
    return { text: "" };
  }
  return decodeBytes(bytes);
}

async function readRevisionFromEngine(
  repo: string,
  ref: string,
  filePath: string,
  deps: EngineDiffTabSourceDeps
): Promise<SideText | null> {
  const viaCli = (reason: string): null => {
    logBackendRoute("loadCommitFile", `backend=cli reason=${reason}`);
    return null;
  };
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return viaCli("setting");
  const isVerified = deps.isVerified ?? (() => false);
  if (!isVerified(repo)) return viaCli("unverified");
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  if (addon === null) return viaCli("engineUnavailable");
  if (typeof addon.loadCommitFile !== "function") return viaCli("noLoadCommitFile");
  try {
    const file = parseEngineCommitFile(await addon.loadCommitFile(repo, ref, filePath));
    if (file === null) return viaCli("malformedPayload");
    if (!file.binary && file.contents !== null) {
      logBackendRoute("loadCommitFile", "backend=engine");
      return { text: file.contents };
    }
    if (file.binary && file.contents === null) {
      logBackendRoute("loadCommitFile", "backend=engine");
      return { binary: true };
    }
    return viaCli("malformedPayload");
  } catch {
    return viaCli("engineThrew");
  }
}

/** A file on disk, never outside the repository; a missing file reads empty. */
async function readWorkingTreeSide(repo: string, filePath: string): Promise<SideText> {
  const absolutePath = resolveRepoFilePath(repo, filePath);
  if (absolutePath === null) {
    return { error: `path outside the repository: ${filePath}`, reason: "pathOutsideRepo" };
  }
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(absolutePath);
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "ENOENT" || code === "ENOTDIR") return { text: "" };
    const message = error instanceof Error ? error.message : String(error);
    return { error: message, reason: "readFailed" };
  }
  return decodeBytes(bytes);
}

/** Same rule as `resolveRepoFilePath` in `messageHandler.ts`. */
function resolveRepoFilePath(repo: string, filePath: string): string | null {
  const repoRoot = path.resolve(repo);
  const absolutePath = path.resolve(repoRoot, filePath);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return absolutePath;
}

/** Bytes to text the engine's way: an early NUL, or invalid UTF-8, is binary. */
function decodeBytes(bytes: Buffer): SideText {
  if (bytes.subarray(0, BINARY_SNIFF_LEN).includes(0)) return { binary: true };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { binary: true };
  }
}

/** `git show <object>` as raw bytes — the binary sniff needs bytes. */
function showGitObject(gitPath: string, repo: string, object: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    execFile(
      gitPath,
      ["show", object],
      { cwd: repo, encoding: "buffer", maxBuffer: 1024 * 1024 * 64 },
      (error, stdout) => {
        if (error instanceof Error) reject(error);
        else resolve(stdout);
      }
    );
  });
}

/* ---------- Settings and size ---------- */

type DiffEditorSettings = {
  ignoreTrimWhitespace: boolean;
  maxComputationTimeMs: number;
  maxFileSizeMb: number;
};

/** The user's `diffEditor.*` settings, at VS Code's defaults when unreadable. */
function readDiffEditorSettings(): DiffEditorSettings {
  const diffEditor = vscode.workspace.getConfiguration("diffEditor");
  const count = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  const ignoreTrimWhitespace = diffEditor.get("ignoreTrimWhitespace");
  return {
    ignoreTrimWhitespace: typeof ignoreTrimWhitespace === "boolean" ? ignoreTrimWhitespace : true,
    maxComputationTimeMs: count(diffEditor.get("maxComputationTime"), 5000),
    maxFileSizeMb: count(diffEditor.get("maxFileSize"), 50)
  };
}

/** Larger than `diffEditor.maxFileSize` megabytes; 0 means no limit. */
function isTooLarge(text: string, maxFileSizeMb: number): boolean {
  return maxFileSizeMb > 0 && Buffer.byteLength(text, "utf8") > maxFileSizeMb * BYTES_PER_MEBIBYTE;
}

/* ---------- Availability and the context key ---------- */

export type DiffTabAvailabilityDeps = {
  backend?: () => EngineBackend;
  addonProvider?: () => Pick<EngineAddon, "diffTexts"> | null;
};

/**
 * Whether the tab can be fed at all: the backend setting allows the engine
 * and the loaded addon exports `diffTexts`. The addon is not loaded on the
 * `git-cli` backend.
 */
export function isDiffTabAvailable(deps: DiffTabAvailabilityDeps = {}): boolean {
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return false;
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  return typeof addon?.diffTexts === "function";
}

/** Publish `isDiffTabAvailable` as the context key and return it. */
export function setDiffTabAvailableContext(deps: DiffTabAvailabilityDeps = {}): boolean {
  const available = isDiffTabAvailable(deps);
  void vscode.commands.executeCommand("setContext", DIFF_TAB_AVAILABLE_CONTEXT, available);
  return available;
}
