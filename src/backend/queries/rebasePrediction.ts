/**
 * Conflict prediction for a planned interactive-rebase todo (F2-08).
 *
 * Simulates the planned todo in order using `git merge-tree --write-tree
 * --merge-base=<parent> <accumulated> <commit>` (Git 2.40+), chaining each
 * clean result's tree OID into the next step and stopping at the first
 * conflict (exit status 1). Non-dropped entries (`pick`, `reword`, `edit`,
 * `squash`, `fixup`) each replay their commit's diff against its own first
 * parent (or the empty tree for a root commit) onto the accumulated tree;
 * `drop` entries are skipped. Conflicted file paths are parsed strictly from
 * `-z --name-only --no-messages` output, never from human-readable messages.
 *
 * Limits:
 * - This models a merge, not Git's exact rebase.
 * - Rename detection and whitespace settings may differ from an actual rebase.
 * - The cost grows with the range, so probes are capped at `probeLimit`
 *   (default {@link DEFAULT_PREDICTION_PROBE_LIMIT}) and capped runs are
 *   reported explicitly.
 * - Requires Git 2.40 or newer (`merge-tree --write-tree --merge-base`).
 */

import { spawn } from "node:child_process";

import type { SimpleGit } from "simple-git";

import type { TodoAction } from "@/backend/rebase/todo";
import type {
  GitQueryError,
  GitRebasePredictionEntry,
  GitRebasePredictionResult
} from "@/backend/types";
import { type GitCommandRecorder, runGitCommand, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

/** Maximum number of non-dropped commits simulated before reporting `"capped"`. */
export const DEFAULT_PREDICTION_PROBE_LIMIT = 20;

const MIN_MERGE_TREE_MAJOR = 2;
const MIN_MERGE_TREE_MINOR = 40;
const EMPTY_TREE_SHA1 = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const EMPTY_TREE_SHA256 = "6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321";
const FULL_HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const VALID_ACTIONS: ReadonlySet<string> = new Set<TodoAction>([
  "pick",
  "reword",
  "edit",
  "squash",
  "fixup",
  "drop"
]);
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const NUL = "\0";

export type GitMajorMinorVersion = {
  readonly major: number;
  readonly minor: number;
};

/**
 * Capability check seam for Git 2.40+ (`merge-tree --write-tree --merge-base`).
 * Tests inject `() => Promise.resolve(false)` to verify the unsupported path
 * without swapping the host Git binary.
 */
export type MergeTreeSupportCheck = () => Promise<boolean>;

export type RebasePredictionInput = {
  readonly repo: string;
  /** Exclusive base revision (`base..HEAD`), or `null` for `--root` rebases. */
  readonly base: string | null;
  readonly entries: readonly GitRebasePredictionEntry[];
  /** Resolved git binary path (`config.gitPath()`). */
  readonly binary: string;
  /** Maximum number of non-dropped steps to simulate before reporting `"capped"`. */
  readonly probeLimit?: number;
  /** Injectable capability check (defaults to `git --version` >= 2.40). */
  readonly checkMergeTreeSupport?: MergeTreeSupportCheck;
  readonly recordGitCommand?: GitCommandRecorder;
};

export type MergeTreeParsedOutput = {
  readonly treeOid: string;
  readonly conflictFiles: string[];
};

type MergeTreeRun = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

type ReplayStepState =
  | { readonly kind: "continue"; readonly accumulatedTree: string; readonly probedCount: number }
  | {
      readonly kind: "conflict";
      readonly conflictHash: string;
      readonly conflictFiles: string[];
      readonly probedCount: number;
    }
  | { readonly kind: "unavailable"; readonly probedCount: number }
  | { readonly kind: "error"; readonly error: GitQueryError; readonly probedCount: number };

function queryError(message: string, stderr: string | null = null): GitQueryError {
  return { message, stderr, exitCode: null, task: null };
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.codePointAt(i);
    if (code !== undefined && (code < 0x20 || code === 0x7f)) return true;
  }
  return false;
}

function emptyTreeForHash(hash: string): string {
  return hash.length === 64 ? EMPTY_TREE_SHA256 : EMPTY_TREE_SHA1;
}

function normalizeProbeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PREDICTION_PROBE_LIMIT;
  return Math.max(1, Math.floor(limit));
}

function validateInput(
  base: string | null,
  entries: readonly GitRebasePredictionEntry[]
): string | null {
  if (base !== null) {
    if (base === "") return "A base revision is required.";
    if (base.startsWith("-")) return "A base revision cannot start with a dash.";
    if (hasControlChar(base)) return "A base revision cannot contain control characters.";
  }
  for (const entry of entries) {
    if (!VALID_ACTIONS.has(entry.action)) {
      return `Unsupported todo action "${entry.action}".`;
    }
    if (!FULL_HASH.test(entry.hash)) {
      return `Invalid commit hash "${entry.hash}".`;
    }
  }
  return null;
}

/** Parses the leading `major.minor` pair from `git --version` output. */
export function parseGitVersion(stdout: string): GitMajorMinorVersion | null {
  const versionStart = stdout.search(/\d/);
  if (versionStart === -1) return null;
  const parts = stdout
    .slice(versionStart)
    .split(/[^\d]+/)
    .filter((part) => part !== "");
  if (parts.length < 2) return null;
  const major = Number.parseInt(parts[0], 10);
  const minor = Number.parseInt(parts[1], 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  return { major, minor };
}

/** Whether `version` is Git 2.40 or newer (`merge-tree --write-tree --merge-base`). */
export function supportsMergeTreeMergeBase(version: GitMajorMinorVersion | null): boolean {
  if (version === null) return false;
  if (version.major > MIN_MERGE_TREE_MAJOR) return true;
  return version.major === MIN_MERGE_TREE_MAJOR && version.minor >= MIN_MERGE_TREE_MINOR;
}

/**
 * Parses `git merge-tree --write-tree -z --name-only [--no-messages]` output.
 *
 * The first NUL-terminated token is the top-level tree OID. When `exitCode`
 * is 1, subsequent non-empty tokens up to the first empty token are the
 * conflicted file paths (deduplicated, preserving order). Anything after the
 * empty separator token (informational messages, if present) is ignored.
 */
export function parseMergeTreeOutput(
  stdout: string,
  exitCode: number
): MergeTreeParsedOutput | null {
  const tokens = stdout.split(NUL);
  const treeOid = tokens[0]?.trim() ?? "";
  if (!FULL_HASH.test(treeOid)) return null;

  if (exitCode === 0) {
    return { treeOid: treeOid.toLowerCase(), conflictFiles: [] };
  }

  const seen = new Set<string>();
  const conflictFiles: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined || token === "") break;
    if (!seen.has(token)) {
      seen.add(token);
      conflictFiles.push(token);
    }
  }
  return { treeOid: treeOid.toLowerCase(), conflictFiles };
}

function spawnMergeTree(binary: string, args: string[], cwd: string): Promise<MergeTreeRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let totalBytes = 0;
    let limitError: Error | null = null;

    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes <= MAX_OUTPUT_BYTES) {
        target.push(chunk);
        return;
      }
      limitError ??= new Error(`git merge-tree exceeded the ${MAX_OUTPUT_BYTES} byte output limit`);
      child.kill("SIGKILL");
    };

    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (error) => reject(limitError ?? error));
    child.on("close", (code) => {
      if (limitError !== null) {
        reject(limitError);
        return;
      }
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code
      });
    });
  });
}

async function checkDefaultMergeTreeSupport(
  git: SimpleGit,
  repo: string,
  record?: GitCommandRecorder
): Promise<boolean> {
  const stdout = await runGitRaw(git, {
    label: "rebasePrediction.version",
    kind: "query",
    args: ["--version"],
    repo,
    record
  });
  return supportsMergeTreeMergeBase(parseGitVersion(stdout));
}

async function resolveBaseTree(
  git: SimpleGit,
  repo: string,
  base: string,
  record?: GitCommandRecorder
): Promise<string | null> {
  try {
    const value = (
      await runGitRaw(git, {
        label: "rebasePrediction.baseTree",
        kind: "query",
        args: ["rev-parse", "--verify", "--quiet", "--end-of-options", `${base}^{tree}`],
        repo,
        record
      })
    ).trim();
    return FULL_HASH.test(value) ? value.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function readFirstParents(
  git: SimpleGit,
  repo: string,
  entries: readonly GitRebasePredictionEntry[],
  record?: GitCommandRecorder
): Promise<Map<string, string | null>> {
  const uniqueHashes: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.hash.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueHashes.push(key);
    }
  }
  const stdout = await runGitRaw(git, {
    label: "rebasePrediction.parents",
    kind: "query",
    args: [
      "log",
      "--no-walk=unsorted",
      "--no-show-signature",
      "--format=%H %P",
      "--end-of-options",
      ...uniqueHashes,
      "--"
    ],
    repo,
    record
  });
  const parents = new Map<string, string | null>();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const parts = trimmed.split(" ");
    const commitHash = parts[0]?.toLowerCase();
    if (commitHash === undefined || !FULL_HASH.test(commitHash)) continue;
    const firstParent = parts[1]?.toLowerCase() ?? null;
    parents.set(
      commitHash,
      firstParent !== null && FULL_HASH.test(firstParent) ? firstParent : null
    );
  }
  return parents;
}

async function probeSingleStep(
  input: RebasePredictionInput,
  accumulatedTree: string,
  entryHash: string,
  mergeBase: string,
  probedCount: number
): Promise<ReplayStepState> {
  const args = [
    "-c",
    "core.quotePath=false",
    "merge-tree",
    "--write-tree",
    "-z",
    "--name-only",
    "--no-messages",
    `--merge-base=${mergeBase}`,
    "--end-of-options",
    accumulatedTree,
    entryHash
  ];
  const run = await runGitCommand(() => spawnMergeTree(input.binary, args, input.repo), {
    label: "rebasePrediction.mergeTree",
    kind: "query",
    args,
    repo: input.repo,
    record: input.recordGitCommand
  });

  if (run.exitCode === 129) {
    return { kind: "unavailable", probedCount };
  }
  if (run.exitCode !== 0 && run.exitCode !== 1) {
    const message = run.stderr.trim() || `git merge-tree exited with code ${run.exitCode}`;
    return { kind: "error", error: queryError(message, run.stderr.trim() || null), probedCount };
  }

  const parsed = parseMergeTreeOutput(run.stdout, run.exitCode);
  if (parsed === null) {
    return {
      kind: "error",
      error: queryError("Unexpected git merge-tree output."),
      probedCount
    };
  }
  if (run.exitCode === 1) {
    return {
      kind: "conflict",
      conflictHash: entryHash,
      conflictFiles: parsed.conflictFiles,
      probedCount
    };
  }
  return {
    kind: "continue",
    accumulatedTree: parsed.treeOid,
    probedCount
  };
}

function replayEntries(
  input: RebasePredictionInput,
  initialTree: string,
  entries: readonly GitRebasePredictionEntry[],
  firstParents: ReadonlyMap<string, string | null>
): Promise<ReplayStepState> {
  const initialState: ReplayStepState = {
    kind: "continue",
    accumulatedTree: initialTree,
    probedCount: 0
  };
  // Chained reducer rather than `await` inside a loop (Sonar S9382).
  return entries.reduce<Promise<ReplayStepState>>(async (previousPromise, entry, index) => {
    const previous = await previousPromise;
    if (previous.kind !== "continue") return previous;
    const hash = entry.hash.toLowerCase();
    const firstParent = firstParents.get(hash);
    if (firstParent === undefined) {
      return {
        kind: "error",
        error: queryError(`Commit "${entry.hash}" was not found.`),
        probedCount: previous.probedCount
      };
    }
    const mergeBase = firstParent ?? emptyTreeForHash(hash);
    return probeSingleStep(input, previous.accumulatedTree, hash, mergeBase, index + 1);
  }, Promise.resolve(initialState));
}

function buildFinalResult(
  finalState: ReplayStepState,
  totalSteps: number,
  probeLimit: number
): GitRebasePredictionResult {
  switch (finalState.kind) {
    case "conflict":
      return {
        status: "conflict",
        conflictHash: finalState.conflictHash,
        conflictFiles: finalState.conflictFiles,
        probedCount: finalState.probedCount,
        totalSteps,
        probeLimit,
        error: null
      };
    case "unavailable":
      return {
        status: "unavailable",
        conflictHash: null,
        conflictFiles: [],
        probedCount: 0,
        totalSteps,
        probeLimit,
        error: null
      };
    case "error":
      return {
        status: "error",
        conflictHash: null,
        conflictFiles: [],
        probedCount: finalState.probedCount,
        totalSteps,
        probeLimit,
        error: finalState.error
      };
    case "continue":
      return {
        status: totalSteps > probeLimit ? "capped" : "clean",
        conflictHash: null,
        conflictFiles: [],
        probedCount: finalState.probedCount,
        totalSteps,
        probeLimit,
        error: null
      };
  }
}

/**
 * Predicts whether the planned todo will stop on a conflict, and names the
 * first conflicting commit and its conflicted files. Read-only with respect to
 * the working tree and index (`git merge-tree --write-tree` operates on the
 * object database only).
 */
export async function predictRebaseConflicts(
  git: SimpleGit,
  input: RebasePredictionInput
): Promise<GitRebasePredictionResult> {
  const probeLimit = normalizeProbeLimit(input.probeLimit);
  const activeEntries = input.entries.filter((entry) => entry.action !== "drop");
  const totalSteps = activeEntries.length;

  const inputProblem = validateInput(input.base, input.entries);
  if (inputProblem !== null) {
    return {
      status: "error",
      conflictHash: null,
      conflictFiles: [],
      probedCount: 0,
      totalSteps,
      probeLimit,
      error: queryError(inputProblem)
    };
  }

  try {
    const supported =
      input.checkMergeTreeSupport === undefined
        ? await checkDefaultMergeTreeSupport(git, input.repo, input.recordGitCommand)
        : await input.checkMergeTreeSupport();
    if (!supported) {
      return {
        status: "unavailable",
        conflictHash: null,
        conflictFiles: [],
        probedCount: 0,
        totalSteps,
        probeLimit,
        error: null
      };
    }

    if (totalSteps === 0) {
      return {
        status: "clean",
        conflictHash: null,
        conflictFiles: [],
        probedCount: 0,
        totalSteps: 0,
        probeLimit,
        error: null
      };
    }

    const firstHash = activeEntries[0]?.hash ?? "";
    const initialTree =
      input.base === null
        ? emptyTreeForHash(firstHash)
        : await resolveBaseTree(git, input.repo, input.base, input.recordGitCommand);
    if (initialTree === null) {
      return {
        status: "error",
        conflictHash: null,
        conflictFiles: [],
        probedCount: 0,
        totalSteps,
        probeLimit,
        error: queryError(`"${input.base ?? ""}" is not an existing commit.`)
      };
    }

    const entriesToProbe = activeEntries.slice(0, probeLimit);
    const firstParents = await readFirstParents(
      git,
      input.repo,
      entriesToProbe,
      input.recordGitCommand
    );
    const finalState = await replayEntries(input, initialTree, entriesToProbe, firstParents);
    return buildFinalResult(finalState, totalSteps, probeLimit);
  } catch (error: unknown) {
    return {
      status: "error",
      conflictHash: null,
      conflictFiles: [],
      probedCount: 0,
      totalSteps,
      probeLimit,
      error: toGitQueryError(error, "Unable to predict rebase conflicts")
    };
  }
}
