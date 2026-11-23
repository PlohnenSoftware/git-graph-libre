import { spawn } from "node:child_process";

import type { GitQueryError } from "@/backend/types";
import { GitCommandError, type GitCommandRecorder, runGitCommand } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

/**
 * The hardened `git fsck` unreachable-commit scan, shared by the graph load
 * (`loadCommits`) and, later, the Reflog tab's lost-commit scan (F1-07).
 *
 * Why this does not use `runGitRaw` (simple-git): `fsck` is a repository
 * verifier whose exit code is a bitmask over every integrity check it runs,
 * so an unrelated diagnostic (a stale commit-graph, a reference problem)
 * makes it exit non-zero even after it has written every unreachable object
 * to `stdout`. simple-git then discards that `stdout` and builds
 * `GitError.message` from `stdout` followed by `stderr`, burying the real
 * error under thousands of `unreachable ...` lines with no exit code. This
 * module spawns Git itself, the way `remoteTags` does, keeping the two
 * streams apart and recording the numeric exit code:
 *
 * - `-c core.commitGraph=false` keeps `fsck` from verifying the commit-graph
 *   at all (safe on every Git version), so a stale commit-graph cannot fail
 *   unreachable discovery;
 * - a non-zero exit that still produced parseable unreachable commit hashes
 *   yields those hashes — the scan worked, whatever else `fsck` disliked;
 * - a genuine failure surfaces only `stderr`, truncated, never `stdout`.
 *
 * The call is still wrapped in `runGitCommand`, so it is traced, recorded and
 * redacted like every other Git call; a non-zero exit records as a failure
 * whose message is the truncated `stderr` summary.
 */

/** The exact `fsck` invocation every unreachable scan in this project runs. */
export const FSCK_UNREACHABLE_ARGS = [
  "-c",
  "core.commitGraph=false",
  "fsck",
  "--unreachable",
  "--no-reflogs",
  "--no-progress",
  "--connectivity-only"
];

/** How much of `fsck`'s `stderr` an error or log line ever carries. */
export const MAX_FSCK_STDERR_CHARS = 2000;

const MAX_STDERR_BYTES = 64 * 1024;
const eolRegex = /\r\n|\r|\n/g;

/** One finished `fsck` run with its streams kept apart. */
export type FsckRun = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

/**
 * Runs one Git command and reports both streams and the exit code without
 * treating a non-zero exit as a rejection; only a spawn failure rejects.
 * Injectable so tests can drive the scan's exit-code handling directly.
 */
export type FsckRunner = (request: {
  binary: string;
  args: string[];
  cwd: string | null;
}) => Promise<FsckRun>;

export type UnreachableScanResult = {
  /** The unreachable (and dangling) commit hashes `fsck` reported, deduplicated. */
  hashes: string[];
  /** Set only on a genuine failure: no usable hashes behind a non-zero exit or a spawn error. */
  error: GitQueryError | null;
  /** `fsck`'s `stderr`, truncated to {@link MAX_FSCK_STDERR_CHARS}; never its `stdout`. */
  stderr: string;
  exitCode: number | null;
};

export type UnreachableScanInput = {
  repo: string | null;
  /**
   * Resolved git binary path, threaded from `config.gitPath()` the same way
   * `loadBranches` and `remoteTags` receive it. Without one (and without an
   * injected runner) the scan cannot run and reports an error instead.
   */
  gitPath?: string;
  record?: GitCommandRecorder;
  /** The command-log label; defaults to the graph load's. F1-07 passes its own. */
  label?: string;
  /** Test seam; production runs {@link spawnFsck}. */
  runner?: FsckRunner;
};

export function parseUnreachableCommitHashes(stdout: string): string[] {
  const hashes = new Set<string>();
  for (const line of stdout.split(eolRegex)) {
    const fields = line.trim().split(" ");
    const isUnreachableCommit = fields[0] === "unreachable" && fields[1] === "commit";
    const isDanglingCommit = fields[0] === "dangling" && fields[1] === "commit";
    const hash = fields[2];
    if ((isUnreachableCommit || isDanglingCommit) && hash !== undefined) {
      hashes.add(hash);
    }
  }
  return [...hashes];
}

/**
 * `stderr` made safe to log or show: trimmed, and cut to
 * {@link MAX_FSCK_STDERR_CHARS} with a marker when it ran longer.
 */
export function summarizeFsckStderr(stderr: string): string {
  const trimmed = stderr.trim();
  if (trimmed.length <= MAX_FSCK_STDERR_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_FSCK_STDERR_CHARS)}\n... (truncated)`;
}

/**
 * The scan's verdict on one finished run. Hashes behind a non-zero exit are
 * a success with diagnostics on `stderr`; no hashes behind one is the only
 * `fsck`-run failure, and its error is built from `stderr` alone.
 */
export function classifyFsckRun(run: FsckRun): UnreachableScanResult {
  const hashes = parseUnreachableCommitHashes(run.stdout);
  const stderr = summarizeFsckStderr(run.stderr);
  if (hashes.length > 0 || run.exitCode === 0) {
    return { hashes, error: null, stderr, exitCode: run.exitCode };
  }
  return {
    hashes,
    error: {
      message: stderr || `git fsck exited with code ${run.exitCode}`,
      stderr: stderr || null,
      exitCode: run.exitCode,
      task: "fsck"
    },
    stderr,
    exitCode: run.exitCode
  };
}

/**
 * The production runner: an async spawn that keeps `stdout` and `stderr`
 * apart and reports the numeric exit code, with the console hidden on
 * Windows as `remoteTags` does. `stderr` collection is capped; `stdout` is
 * the listing itself and is kept whole, as before.
 */
export const spawnFsck: FsckRunner = ({ binary, args, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: cwd ?? undefined,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let errBytes = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      out.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (errBytes >= MAX_STDERR_BYTES) return;
      errBytes += chunk.length;
      err.push(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        exitCode: code
      });
    });
  });

type FsckRunError = Error & { stderr?: string; exitCode?: number | null; fsckRun?: FsckRun };

function isFsckRun(value: unknown): value is FsckRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Record<string, unknown>;
  return typeof run.stdout === "string" && typeof run.stderr === "string";
}

/** The finished run a recorded failure carried, when `fsck` ran but exited non-zero. */
function fsckRunFromError(error: unknown): FsckRun | null {
  const cause = error instanceof GitCommandError ? error.cause : error;
  if (typeof cause !== "object" || cause === null) return null;
  const run = (cause as FsckRunError).fsckRun;
  return isFsckRun(run) ? run : null;
}

/**
 * Discovers a repository's unreachable commit hashes. Never rejects: every
 * failure comes back as `error` with `hashes` empty, so a caller for whom
 * the scan is optional enrichment can simply use `hashes` and move on.
 */
export async function discoverUnreachableCommitHashes(
  input: UnreachableScanInput
): Promise<UnreachableScanResult> {
  const binary = input.gitPath ?? "";
  if (input.runner === undefined && binary === "") {
    return {
      hashes: [],
      error: {
        message: "A Git binary path is required to scan for unreachable commits.",
        stderr: null,
        exitCode: null,
        task: null
      },
      stderr: "",
      exitCode: null
    };
  }
  const runner = input.runner ?? spawnFsck;
  try {
    const run = await runGitCommand(
      async (): Promise<FsckRun> => {
        const result = await runner({ binary, args: [...FSCK_UNREACHABLE_ARGS], cwd: input.repo });
        if (result.exitCode !== 0) {
          // Recorded as a failure with the stderr-only summary as its
          // message; the run itself rides along so the hashes survive.
          const summary = summarizeFsckStderr(result.stderr);
          const failure: FsckRunError = Object.assign(
            new Error(summary || `git fsck exited with code ${result.exitCode}`),
            { stderr: summary, exitCode: result.exitCode, fsckRun: result }
          );
          throw failure;
        }
        return result;
      },
      {
        label: input.label ?? "loadCommits.unreachable",
        args: [...FSCK_UNREACHABLE_ARGS],
        repo: input.repo,
        record: input.record
      }
    );
    return classifyFsckRun(run);
  } catch (error: unknown) {
    const run = fsckRunFromError(error);
    if (run !== null) return classifyFsckRun(run);
    return {
      hashes: [],
      error: toGitQueryError(error, "Unable to discover unreachable commits"),
      stderr: "",
      exitCode: null
    };
  }
}
