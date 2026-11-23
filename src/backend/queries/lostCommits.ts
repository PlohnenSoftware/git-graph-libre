import { spawn } from "node:child_process";

import { killProcessTree } from "@/backend/queries/remoteTags";
import {
  discoverUnreachableCommitHashes,
  type FsckRun,
  type FsckRunner
} from "@/backend/queries/unreachableCommits";
import type { GitQueryError } from "@/backend/types";
import { type GitCommandRecorder, runGitCommand } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

/** Default wall-clock budget for one lost-commit scan (fsck + commit metadata). */
export const DEFAULT_LOST_COMMITS_TIMEOUT_MS = 30_000;

/** Command-log label for the `fsck` phase of the Reflog tab's lost-commit scan. */
export const FSCK_LOST_COMMITS_LABEL = "reflog.lostCommits.fsck";

/** Command-log label for reading subject and date of the discovered commits. */
export const LOST_COMMITS_DETAILS_LABEL = "reflog.lostCommits.details";

const NUL = "\0";
const UNIT_SEPARATOR = "\u001f";
const MAX_STDERR_BYTES = 64 * 1024;
const objectName = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

const DETAILS_FORMAT = ["%H", "%ct", "%s"].join("%x1f");

/**
 * Reads each discovered commit's hash, committer timestamp and subject in one
 * batched `git log --stdin` call, avoiding per-commit process overhead and
 * platform argv limits on large unreachable sets.
 */
export const LOST_COMMITS_DETAILS_ARGS = [
  "log",
  "--no-walk=unsorted",
  "--ignore-missing",
  "--stdin",
  "-z",
  "--no-show-signature",
  `--format=${DETAILS_FORMAT}`
];

/** One commit reachable by neither any ref nor any reflog. */
export type GitLostCommit = {
  /** Full commit hash. */
  hash: string;
  /** Committer timestamp in Unix seconds. */
  time: number;
  /** First line of the commit message. */
  subject: string;
};

/** Result of one opt-in lost-commit scan. Never rejects. */
export type GitLostCommitsResult = {
  /** Discovered commits, newest first. */
  commits: GitLostCommit[];
  /** True when stopped by the caller's AbortSignal. */
  canceled: boolean;
  /** True when the scan exceeded its timeout budget. */
  timedOut: boolean;
  /** Non-null on timeout or genuine Git/spawn failure; null on success or cancel. */
  error: GitQueryError | null;
};

export type LostCommitsDetailsRunner = (request: {
  binary: string;
  args: string[];
  cwd: string;
  stdin: string;
}) => Promise<string>;

export type LostCommitsInput = {
  repo: string;
  /** Resolved Git binary path (`config.gitPath()`). */
  gitPath: string;
  record?: GitCommandRecorder;
  /** Cancels an in-flight scan and kills its child process tree. */
  signal?: AbortSignal;
  /** Total timeout budget across `fsck` and metadata read; defaults to {@link DEFAULT_LOST_COMMITS_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Test seam for the `fsck` step. */
  fsckRunner?: FsckRunner;
  /** Test seam for the commit metadata step. */
  detailsRunner?: LostCommitsDetailsRunner;
};

type StopReason = "canceled" | "timedOut";

type BoundedProcessRequest = {
  binary: string;
  args: string[];
  cwd?: string;
  stdin?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  platform?: NodeJS.Platform;
};

type BoundedProcessRun = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  stopReason: StopReason | null;
};

function stopError(reason: StopReason, timeoutMs: number): Error {
  return new Error(
    reason === "canceled"
      ? "Lost-commit scan canceled."
      : `Lost-commit scan timed out after ${timeoutMs} ms.`
  );
}

/**
 * Runs one Git child process with an AbortSignal and a timeout, killing the
 * whole process tree when either fires. Kept read-only and non-interactive.
 */
export function runBoundedGitProcess(request: BoundedProcessRequest): Promise<BoundedProcessRun> {
  if (request.signal?.aborted) {
    return Promise.resolve({ stdout: "", stderr: "", exitCode: null, stopReason: "canceled" });
  }
  if (request.timeoutMs <= 0) {
    return Promise.resolve({ stdout: "", stderr: "", exitCode: null, stopReason: "timedOut" });
  }
  const platform = request.platform ?? process.platform;
  return new Promise((resolve, reject) => {
    const child = spawn(request.binary, request.args, {
      cwd: request.cwd,
      stdio: [request.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
      detached: platform !== "win32"
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let errBytes = 0;
    let stopReason: StopReason | null = null;

    const stop = (reason: StopReason) => {
      stopReason ??= reason;
      killProcessTree(child, platform);
    };
    const timer = setTimeout(() => stop("timedOut"), request.timeoutMs);
    const onAbort = () => stop("canceled");
    request.signal?.addEventListener("abort", onAbort, { once: true });

    const cleanup = () => {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    };

    if (request.stdin !== undefined && child.stdin !== null) {
      // A killed or failed child may close stdin before all hashes flush.
      child.stdin.on("error", () => {});
      child.stdin.end(request.stdin);
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      out.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (errBytes >= MAX_STDERR_BYTES) return;
      errBytes += chunk.length;
      err.push(chunk);
    });
    child.on("error", (error) => {
      cleanup();
      if (stopReason !== null) {
        resolve({ stdout: "", stderr: "", exitCode: null, stopReason });
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      cleanup();
      resolve({
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        exitCode: code,
        stopReason
      });
    });
  });
}

/** Races an injected async runner against abort and timeout for deterministic tests. */
function raceWithStop<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  onStop: (reason: StopReason) => void
): Promise<T> {
  if (signal?.aborted) {
    onStop("canceled");
    return Promise.reject(stopError("canceled", timeoutMs));
  }
  if (timeoutMs <= 0) {
    onStop("timedOut");
    return Promise.reject(stopError("timedOut", timeoutMs));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onStop("timedOut");
      reject(stopError("timedOut", timeoutMs));
    }, timeoutMs);
    const onAbort = () => {
      onStop("canceled");
      reject(stopError("canceled", timeoutMs));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    operation().then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      }
    );
  });
}

/**
 * Parses NUL-separated `%H<US>%ct<US>%s` records from `git log --no-walk -z`
 * into deduplicated lost commits ordered newest first.
 */
export function parseLostCommitRecords(stdout: string): GitLostCommit[] {
  if (stdout === "") return [];
  const byHash = new Map<string, GitLostCommit>();
  for (const record of stdout.split(NUL)) {
    if (record === "") continue;
    const fields = record.split(UNIT_SEPARATOR);
    const hash = fields[0]?.trim() ?? "";
    const time = Number.parseInt(fields[1] ?? "", 10);
    if (!objectName.test(hash) || !Number.isFinite(time)) continue;
    const subject = fields
      .slice(2)
      .join(UNIT_SEPARATOR)
      .replace(/\r?\n$/, "");
    if (!byHash.has(hash)) {
      byHash.set(hash, { hash, time, subject });
    }
  }
  return [...byHash.values()].sort((left, right) => {
    if (right.time !== left.time) return right.time - left.time;
    return left.hash.localeCompare(right.hash);
  });
}

function stoppedResult(reason: StopReason, timeoutMs: number, task: string): GitLostCommitsResult {
  if (reason === "canceled") {
    return { commits: [], canceled: true, timedOut: false, error: null };
  }
  return {
    commits: [],
    canceled: false,
    timedOut: true,
    error: {
      message: `Lost-commit scan timed out after ${timeoutMs} ms.`,
      stderr: null,
      exitCode: null,
      task
    }
  };
}

/**
 * Opt-in read-only scan for commits that no branch, tag, remote ref, or reflog
 * reaches. Reuses the hardened `discoverUnreachableCommitHashes` (`-c
 * core.commitGraph=false fsck --unreachable --no-reflogs --no-progress
 * --connectivity-only`) and then reads each commit's date and subject in one
 * batched `git log --no-walk --stdin` call. Never passes `--lost-found` and
 * never runs `gc` or `prune`.
 */
export async function loadLostCommits(input: LostCommitsInput): Promise<GitLostCommitsResult> {
  const timeoutMs =
    input.timeoutMs !== undefined && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
      ? input.timeoutMs
      : DEFAULT_LOST_COMMITS_TIMEOUT_MS;

  if (input.signal?.aborted) {
    return stoppedResult("canceled", timeoutMs, "fsck");
  }

  const binary = input.gitPath;
  const injectedFsck = input.fsckRunner;
  if (injectedFsck === undefined && binary === "") {
    return {
      commits: [],
      canceled: false,
      timedOut: false,
      error: {
        message: "A Git binary path is required to scan for lost commits.",
        stderr: null,
        exitCode: null,
        task: null
      }
    };
  }

  const deadline = Date.now() + timeoutMs;
  const remainingMs = () => Math.max(0, deadline - Date.now());
  let stopReason: StopReason | null = null;
  const markStopped = (reason: StopReason) => {
    stopReason ??= reason;
  };

  const fsckRunner: FsckRunner = async (request): Promise<FsckRun> => {
    if (injectedFsck !== undefined) {
      return raceWithStop(() => injectedFsck(request), remainingMs(), input.signal, markStopped);
    }
    const run = await runBoundedGitProcess({
      binary: request.binary,
      args: request.args,
      cwd: request.cwd ?? undefined,
      timeoutMs: remainingMs(),
      signal: input.signal
    });
    if (run.stopReason !== null) {
      markStopped(run.stopReason);
      throw stopError(run.stopReason, timeoutMs);
    }
    return { stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode };
  };

  const scan = await discoverUnreachableCommitHashes({
    repo: input.repo,
    gitPath: binary,
    record: input.record,
    label: FSCK_LOST_COMMITS_LABEL,
    runner: fsckRunner
  });

  if (stopReason !== null) {
    return stoppedResult(stopReason, timeoutMs, "fsck");
  }
  if (input.signal?.aborted) {
    return stoppedResult("canceled", timeoutMs, "fsck");
  }
  if (scan.error !== null) {
    return { commits: [], canceled: false, timedOut: false, error: scan.error };
  }

  const validHashes = scan.hashes.filter((hash) => objectName.test(hash));
  if (validHashes.length === 0) {
    return { commits: [], canceled: false, timedOut: false, error: null };
  }

  const stdin = `${validHashes.join("\n")}\n`;
  const injectedDetails = input.detailsRunner;

  try {
    const stdout = await runGitCommand(
      async () => {
        if (injectedDetails !== undefined) {
          return raceWithStop(
            () =>
              injectedDetails({
                binary,
                args: [...LOST_COMMITS_DETAILS_ARGS],
                cwd: input.repo,
                stdin
              }),
            remainingMs(),
            input.signal,
            markStopped
          );
        }
        const run = await runBoundedGitProcess({
          binary,
          args: [...LOST_COMMITS_DETAILS_ARGS],
          cwd: input.repo,
          stdin,
          timeoutMs: remainingMs(),
          signal: input.signal
        });
        if (run.stopReason !== null) {
          markStopped(run.stopReason);
          throw stopError(run.stopReason, timeoutMs);
        }
        if (run.exitCode !== 0) {
          const message = run.stderr.trim() || `git log exited with code ${run.exitCode}`;
          throw Object.assign(new Error(message), {
            stderr: run.stderr.trim(),
            exitCode: run.exitCode
          });
        }
        return run.stdout;
      },
      {
        label: LOST_COMMITS_DETAILS_LABEL,
        args: [...LOST_COMMITS_DETAILS_ARGS],
        repo: input.repo,
        record: input.record
      }
    );
    if (stopReason !== null) return stoppedResult(stopReason, timeoutMs, "log");
    if (input.signal?.aborted) return stoppedResult("canceled", timeoutMs, "log");
    return {
      commits: parseLostCommitRecords(stdout),
      canceled: false,
      timedOut: false,
      error: null
    };
  } catch (error: unknown) {
    if (stopReason !== null) return stoppedResult(stopReason, timeoutMs, "log");
    if (input.signal?.aborted) return stoppedResult("canceled", timeoutMs, "log");
    return {
      commits: [],
      canceled: false,
      timedOut: false,
      error: toGitQueryError(error, "Unable to read lost commit details")
    };
  }
}
