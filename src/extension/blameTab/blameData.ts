import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";

import { loadBlame } from "@/backend/queries/blame";
import { fetchCommitInfo } from "@/backend/queries/commitInfo";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { type BlameHotspotMode, scoreBlameHunks } from "@/blameHotspot";
import type {
  BlameCommitPopoverResult,
  BlameHistoryEntry,
  BlameLoadOptions,
  BlameNavigateDirection,
  BlameNavigationState,
  BlameOpenTarget,
  BlameOptions,
  BlamePayload,
  BlameSource
} from "@/blameTabTypes";
import { isBareCommonDir } from "../repoLayout";

/** The repository-root file GitHub and `BQ5` auto-detect for ignored revisions. */
export const ROOT_IGNORE_REVS_FILE = ".git-blame-ignore-revs";

const zeroRevision = /^0+$/;

export type BlameSourceDeps = {
  /** A Git instance rooted at the repository being read. */
  createGit: (repo: string) => SimpleGit;
  /**
   * The resolved Git binary (`config.gitPath()`), read live per load. The
   * blame query needs it only for an unsaved buffer, which F4-03 never
   * sends, but the request carries it the way F4-01 names it (`binary`).
   */
  gitPath: () => string;
  record?: GitCommandRecorder;
  /**
   * The heat mode every load is scored with; `age` (file-relative
   * rank-quantile recency) unless a test says otherwise. F4-04 draws the
   * levels; F4-03 only carries them as `data-heat` hooks.
   */
  mode?: BlameHotspotMode;
  /** The clock the calendar mode ages against; the current time unless a test pins it. */
  nowSeconds?: () => number;
};

/** Default blame option toggles (`BQ5`): plain blame, auto-apply `.git-blame-ignore-revs` when present. */
export function defaultBlameOptions(): BlameOptions {
  return {
    ignoreWhitespace: false,
    detectMoves: false,
    detectCopies: false,
    useIgnoreRevsFile: true
  };
}

/** True when `<repo>/.git-blame-ignore-revs` exists as a regular file on disk. */
export async function hasRootIgnoreRevsFile(repo: string): Promise<boolean> {
  if (repo === "") return false;
  try {
    const stats = await fs.stat(path.join(repo, ROOT_IGNORE_REVS_FILE));
    return stats.isFile();
  } catch {
    return false;
  }
}

/** A target line the tab may act on: a whole 1-based line, or none. */
export function normalizeBlameTargetLine(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

function isIgnorableCommitHash(value: string): boolean {
  if (value === "" || value.startsWith("-") || zeroRevision.test(value)) return false;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 32 || code === 127) return false;
  }
  return true;
}

const commitHashShape = /^[0-9a-f]{4,64}$/i;

/**
 * A hash the tab may act on (F4-06): hex only, never the all-zero OID Git
 * blames uncommitted lines on — the same boundary the Reflog tab checks
 * before revealing a commit in the graph.
 */
export function isBlameCommitHash(value: unknown): value is string {
  return typeof value === "string" && commitHashShape.test(value) && !zeroRevision.test(value);
}

/**
 * The Blame tab's data source: one CLI blame read (F4-01) per call, its
 * hunks scored for heat (F4-02) before they cross to the webview. Every
 * F4-01 state passes through unchanged — `binary`, `tooLarge`,
 * `untracked` and `unborn` stay distinct from an error — and a failure
 * keeps Git's own message, never an empty blame.
 *
 * When `.git-blame-ignore-revs` exists at the repository root, it is
 * passed automatically unless `options.useIgnoreRevsFile === false` (`BQ5`).
 * When the file does not exist, `--ignore-revs-file` is never passed.
 */
export function createBlameSource(deps: BlameSourceDeps): BlameSource {
  const mode: BlameHotspotMode = deps.mode ?? "age";
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  return {
    async load(
      repo: string,
      filePath: string,
      rev: string | null,
      options?: BlameLoadOptions
    ): Promise<BlamePayload> {
      const hasIgnoreRevsFile = await hasRootIgnoreRevsFile(repo);
      const useIgnoreRevsFile = options?.useIgnoreRevsFile ?? true;
      const ignoreRevsFile = hasIgnoreRevsFile && useIgnoreRevsFile ? ROOT_IGNORE_REVS_FILE : null;
      const ignoreRevs =
        options?.ignoreRevs !== undefined && options.ignoreRevs.length > 0
          ? [...options.ignoreRevs]
          : undefined;
      // A bare repository has no working tree; show a localized notice instead
      // of a raw Git error, while revision blames (Commit Details) run normally.
      if (rev === null && options?.contents === undefined && isBareCommonDir(repo)) {
        return {
          state: "bareWorkingTree",
          commits: {},
          hunks: [],
          resolvedRev: null,
          totalLines: 0,
          error: null,
          hasIgnoreRevsFile,
          ignoreRevsFileUsed: null
        };
      }
      const result = await loadBlame(
        deps.createGit(repo),
        repo,
        {
          filePath,
          rev,
          ...(options?.contents !== undefined ? { contents: options.contents } : {}),
          binary: deps.gitPath(),
          ignoreWhitespace: options?.ignoreWhitespace === true,
          detectMoves: options?.detectMoves === true,
          detectCopies: options?.detectCopies === true,
          ignoreRevsFile,
          ignoreRevs
        },
        deps.record
      );
      if (result.error !== null) {
        return {
          state: null,
          commits: {},
          hunks: [],
          resolvedRev: null,
          totalLines: 0,
          error: result.error.message,
          hasIgnoreRevsFile,
          ignoreRevsFileUsed: null
        };
      }
      const heats = scoreBlameHunks(result.hunks, result.commits, mode, nowSeconds());
      return {
        state: result.state,
        commits: result.commits,
        hunks: result.hunks.map((hunk, index) => ({
          ...hunk,
          heat: heats[index] ?? {
            level: null,
            uncommitted: true,
            commitHunkCount: 0,
            commitLineCount: 0
          }
        })),
        resolvedRev: result.resolvedRev,
        totalLines: result.totalLines,
        error: null,
        hasIgnoreRevsFile,
        ignoreRevsFileUsed: result.ignoreRevsFileUsed
      };
    },

    /**
     * The commit popover's read (F4-06): the full message and identities
     * behind one hunk, through the same `fetchCommitInfo` the CLI commit
     * details read uses, so the popover and the graph never disagree.
     */
    async loadCommitPopover(repo: string, commitHash: string): Promise<BlameCommitPopoverResult> {
      if (!isBlameCommitHash(commitHash)) {
        return { details: null, error: `Not a commit hash: ${commitHash}` };
      }
      try {
        const info = await fetchCommitInfo(deps.createGit(repo), commitHash, repo, deps.record);
        return {
          details: {
            hash: info.hash,
            parents: info.parents,
            author: info.author,
            authorMail: info.email,
            authorTime: info.authorDate,
            committer: info.committer,
            committerMail: info.committerEmail,
            committerTime: info.committerDate,
            subject: info.body.split("\n", 1)[0] ?? "",
            message: info.body
          },
          error: null
        };
      } catch (error: unknown) {
        return {
          details: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export type BlameNavigatorSnapshot = {
  repo: string;
  filePath: string;
  rev: string | null;
  targetLine: number | null;
  navigation: BlameNavigationState;
  options: BlameOptions;
  ignoreRevs: string[];
  loadOptions: BlameLoadOptions;
};

/**
 * Stateful in-tab parent-rewind navigation stack (`Back`, `Forward`,
 * `Latest`) plus header blame options (`-w`, `-M`, `-C`,
 * `.git-blame-ignore-revs`) and per-session `--ignore-rev` list (F4-05).
 */
export function createBlameNavigator() {
  let repo = "";
  let current: BlameHistoryEntry = { rev: null, filePath: "", targetLine: null };
  let initial: { filePath: string; targetLine: number | null } = {
    filePath: "",
    targetLine: null
  };
  let backStack: BlameHistoryEntry[] = [];
  let forwardStack: BlameHistoryEntry[] = [];
  let options: BlameOptions = defaultBlameOptions();
  let ignoreRevs: string[] = [];

  const canLatest = (): boolean =>
    current.rev !== null || (initial.filePath !== "" && current.filePath !== initial.filePath);

  return {
    open(target: BlameOpenTarget): void {
      repo = target.repo;
      const targetLine = normalizeBlameTargetLine(target.targetLine);
      current = {
        filePath: target.filePath,
        rev: target.rev ?? null,
        targetLine
      };
      initial = { filePath: target.filePath, targetLine };
      backStack = [];
      forwardStack = [];
      options = defaultBlameOptions();
      ignoreRevs = [];
    },

    rewind(next: { rev: string; filePath: string; targetLine?: number | null }): boolean {
      if (repo === "" || next.rev === "" || next.filePath === "") return false;
      backStack.push({ ...current });
      forwardStack = [];
      current = {
        rev: next.rev,
        filePath: next.filePath,
        targetLine: normalizeBlameTargetLine(next.targetLine)
      };
      return true;
    },

    navigate(direction: BlameNavigateDirection): boolean {
      if (repo === "") return false;
      if (direction === "back") {
        const prev = backStack.pop();
        if (prev === undefined) return false;
        forwardStack.push({ ...current });
        current = prev;
        return true;
      }
      if (direction === "forward") {
        const next = forwardStack.pop();
        if (next === undefined) return false;
        backStack.push({ ...current });
        current = next;
        return true;
      }
      if (!canLatest()) return false;
      backStack = [];
      forwardStack = [];
      current = {
        rev: null,
        filePath: initial.filePath,
        targetLine: initial.targetLine
      };
      return true;
    },

    /** Pin the current file at `HEAD` (the unsaved buffer's "Blame HEAD", F4-08). */
    blameHead(): boolean {
      if (repo === "") return false;
      current = { ...current, rev: "HEAD" };
      return true;
    },

    setOptions(patch: Partial<BlameOptions>, targetLine?: number | null): boolean {
      if (repo === "") return false;
      options = {
        ignoreWhitespace:
          typeof patch.ignoreWhitespace === "boolean"
            ? patch.ignoreWhitespace
            : options.ignoreWhitespace,
        detectMoves:
          typeof patch.detectMoves === "boolean" ? patch.detectMoves : options.detectMoves,
        detectCopies:
          typeof patch.detectCopies === "boolean" ? patch.detectCopies : options.detectCopies,
        useIgnoreRevsFile:
          typeof patch.useIgnoreRevsFile === "boolean"
            ? patch.useIgnoreRevsFile
            : options.useIgnoreRevsFile
      };
      if (targetLine !== undefined) {
        current = { ...current, targetLine: normalizeBlameTargetLine(targetLine) };
      }
      return true;
    },

    ignoreCommit(commitHash: string, targetLine?: number | null): boolean {
      const trimmed = commitHash.trim();
      if (repo === "" || !isIgnorableCommitHash(trimmed) || ignoreRevs.includes(trimmed)) {
        return false;
      }
      ignoreRevs = [...ignoreRevs, trimmed];
      if (targetLine !== undefined) {
        current = { ...current, targetLine: normalizeBlameTargetLine(targetLine) };
      }
      return true;
    },

    clearIgnoredCommit(commitHash?: string | null, targetLine?: number | null): boolean {
      if (repo === "") return false;
      if (commitHash === undefined || commitHash === null) {
        if (ignoreRevs.length === 0) return false;
        ignoreRevs = [];
      } else {
        if (!ignoreRevs.includes(commitHash)) return false;
        ignoreRevs = ignoreRevs.filter((item) => item !== commitHash);
      }
      if (targetLine !== undefined) {
        current = { ...current, targetLine: normalizeBlameTargetLine(targetLine) };
      }
      return true;
    },

    snapshot(): BlameNavigatorSnapshot {
      return {
        repo,
        filePath: current.filePath,
        rev: current.rev,
        targetLine: current.targetLine,
        navigation: {
          backCount: backStack.length,
          forwardCount: forwardStack.length,
          canLatest: canLatest(),
          initialFilePath: initial.filePath
        },
        options: { ...options },
        ignoreRevs: [...ignoreRevs],
        loadOptions: { ...options, ignoreRevs: [...ignoreRevs] }
      };
    }
  };
}
