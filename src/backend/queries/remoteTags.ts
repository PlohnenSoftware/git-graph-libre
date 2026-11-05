import { type ChildProcess, spawn } from "node:child_process";

import type { QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitCommand } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

/**
 * Remote tag status: which remotes hold each local tag, read with
 * `git ls-remote`.
 *
 * Why this does not use `runGitRaw` (simple-git): `git ls-remote` is a
 * network read that can hang on a dead host, a key touch or a passphrase.
 * Sharing the graph's Git queue would stall every other query behind it, and
 * simple-git offers no way to kill the process tree, close stdin or hide the
 * Windows console. So each read is its own bounded process, still wrapped in
 * `runGitCommand`, so it is traced, recorded and redacted like every other
 * Git call. Each read has:
 *
 * - a timeout, after which the whole process tree is killed (a process group
 *   off Windows, `taskkill /T` on Windows), so a hung `ssh` or remote helper
 *   cannot outlive it;
 * - a 16 MB output cap; a remote that prints more is reported as
 *   "unavailable", never as a partial answer;
 * - an `AbortSignal`, so a closed panel or a repository switch ends the reads;
 * - at most {@link MAX_CONCURRENT_READS} remotes at a time.
 *
 * Non-interactive without overriding the user's SSH setup: stdin is ignored,
 * `SSH_ASKPASS_REQUIRE=never` stops OpenSSH from using an askpass program, and
 * off Windows the child runs in its own session, which has no controlling
 * terminal, so nothing can open `/dev/tty` to prompt. `GIT_SSH_COMMAND`,
 * `GIT_SSH` and `core.sshCommand` are deliberately left alone, so `BatchMode`
 * is not forced: doing so would replace the user's own ssh command. A prompt
 * that cannot be answered fails the read, or the timeout ends it.
 */

type RemoteTagsInput = {
  repo: string;
  gitPath: string;
  recordGitCommand?: GitCommandRecorder;
  /** Ends every running and pending read; the result then carries an error. */
  signal?: AbortSignal;
  /** Per-process limit in milliseconds; defaults to {@link READ_TIMEOUT_MS}. */
  timeoutMs?: number;
};

const READ_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
export const MAX_CONCURRENT_READS = 4;

type ProcessRunOptions = {
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  platform?: NodeJS.Platform;
};

type ReadError = Error & { stderr?: string; exitCode?: number | null };

function readError(message: string, stderr = "", exitCode: number | null = null): ReadError {
  return Object.assign(new Error(message), { stderr, exitCode });
}

/**
 * Ends a child and everything it started. Off Windows the child leads its own
 * process group (see `detached`), so one `SIGKILL` to the negative pid takes
 * the group. On Windows `kill()` ends only the direct child, so `taskkill /T`
 * walks the tree; it runs from the system directory, never through `PATH`.
 */
export function killProcessTree(
  child: Pick<ChildProcess, "pid" | "kill">,
  platform: NodeJS.Platform = process.platform,
  start: typeof spawn = spawn
): void {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    if (platform === "win32") {
      const root = process.env.SystemRoot ?? String.raw`C:\Windows`;
      const killer = start(
        String.raw`${root}\System32\taskkill.exe`,
        ["/pid", String(pid), "/T", "/F"],
        {
          stdio: "ignore",
          windowsHide: true
        }
      );
      killer.on("error", () => child.kill());
      return;
    }
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

function runProcess(gitPath: string, args: string[], options: ProcessRunOptions): Promise<string> {
  const platform = options.platform ?? process.platform;
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(readError("Remote tag read aborted"));
      return;
    }
    const child = spawn(gitPath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "",
        SSH_ASKPASS: "",
        SSH_ASKPASS_REQUIRE: "never",
        GCM_INTERACTIVE: "Never"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: platform !== "win32"
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outBytes = 0;
    let errBytes = 0;
    let failure: ReadError | null = null;
    const fail = (error: ReadError) => {
      failure ??= error;
      killProcessTree(child, platform);
    };
    const timer = setTimeout(
      () => fail(readError(`git timed out after ${options.timeoutMs} ms`)),
      options.timeoutMs
    );
    const onAbort = () => fail(readError("Remote tag read aborted"));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const settle = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      outBytes += chunk.length;
      if (outBytes > MAX_OUTPUT_BYTES) fail(readError("git output exceeded the 16 MB limit"));
      else out.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (errBytes >= MAX_STDERR_BYTES) return;
      errBytes += chunk.length;
      err.push(chunk);
    });
    child.on("error", (error) => {
      settle();
      reject(failure ?? error);
    });
    child.on("close", (code) => {
      settle();
      const stderr = Buffer.concat(err).toString("utf8");
      if (failure !== null) reject(Object.assign(failure, { stderr }));
      else if (code === 0) resolve(Buffer.concat(out).toString("utf8"));
      else reject(readError(`git exited with code ${code}`, stderr, code));
    });
  });
}

/** Runs `task` over `items`, at most `limit` at a time, keeping result order. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function remoteTags(input: RemoteTagsInput): Promise<QueryResult<"remoteTags">> {
  try {
    const read = (label: string, args: string[]) =>
      runGitCommand(
        () =>
          runProcess(input.gitPath, args, {
            cwd: input.repo,
            timeoutMs: input.timeoutMs ?? READ_TIMEOUT_MS,
            signal: input.signal
          }),
        { label, args, repo: input.repo, record: input.recordGitCommand }
      );
    const [localOutput, remotesOutput] = await Promise.all([
      read("remoteTags.local", [
        "for-each-ref",
        "--format=%(objectname)%09%(refname)%09%(*objectname)",
        "refs/tags"
      ]),
      read("remoteTags.remotes", ["remote"])
    ]);
    const localTags = localOutput
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [objectHash, ref, peeledHash] = line.trim().split("\t");
        return { objectHash, ref, hash: peeledHash || objectHash };
      });
    const remotes =
      localTags.length === 0 ? [] : remotesOutput.trim().split(/\r?\n/).filter(Boolean);
    const results = await mapWithLimit(remotes, MAX_CONCURRENT_READS, async (remote) => {
      try {
        const output = await read("remoteTags.remote", [
          "-c",
          "credential.interactive=false",
          "ls-remote",
          "--tags",
          "--refs",
          "--",
          remote
        ]);
        return new Set(output.trim().split(/\r?\n/));
      } catch {
        return null;
      }
    });
    if (input.signal?.aborted) throw readError("Remote tag read aborted");
    return {
      tags: Object.fromEntries(
        localTags.map(({ ref, hash, objectHash }) => [
          ref.slice("refs/tags/".length),
          {
            hash,
            remotes: remotes.filter((_, index) => results[index]?.has(`${objectHash}\t${ref}`))
          }
        ])
      ),
      unavailableRemotes: remotes.filter((_, index) => results[index] === null),
      error: null
    };
  } catch (error: unknown) {
    return {
      tags: {},
      unavailableRemotes: [],
      error: toGitQueryError(error, "Unable to load remote tags")
    };
  }
}
