/**
 * One file's staged copy — what the index holds — through the engine or the
 * CLI (release 1.9.0, slice D43).
 *
 * The engine already reads the index in process (`blob::index_file`), so the
 * GGL Diff tab need not spawn `git show :<path>` for every open. The addon
 * export is optional: a binary built before it loads without `loadIndexFile`
 * and lands on exactly the CLI behavior, which is why the engine version is
 * not bumped. The gating and the route log follow `DiffDocProvider`'s file
 * read, except that binary is a valid answer here, not a fallback cue.
 */

import { execFile } from "node:child_process";
import { runGitCommand } from "@/backend/utils/gitRunner";
import { logBackendRoute } from "@/backend/utils/operationLog";
import type { EngineBackend } from "@/types";
import { type EngineAddon, loadEngineAddon } from "./addon";
import { parseEngineCommitFile } from "./details";

/** The slice of the engine addon staged reads need. */
export type StagedFileAddon = Pick<EngineAddon, "loadIndexFile">;

/**
 * A file's staged copy: its text, a binary marker when the blob is not text,
 * or `missing` when the path is not in the index at all.
 */
export type StagedFile = { text: string } | { binary: true } | { missing: true };

export type StagedFileDeps = {
  /** The resolved git binary, for the CLI read (`config.gitPath()`). */
  gitPath: string;
  /** Read live on every call, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => StagedFileAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

/** How far into a blob git looks before deciding it is binary (`blob.rs`). */
const BINARY_SNIFF_LEN = 8000;

/** The staged copy of `filePath` in `repo`: the engine when it may serve it, the CLI otherwise. */
export async function readStagedFile(
  repo: string,
  filePath: string,
  deps: StagedFileDeps
): Promise<StagedFile> {
  return (await readFromEngine(repo, filePath, deps)) ?? readFromCli(repo, filePath, deps.gitPath);
}

/**
 * The staged copy from the engine, or null when the CLI must serve it: the
 * git-cli preference, an unverified repository, no loadable addon, an addon
 * without `loadIndexFile`, any engine throw, or a malformed payload.
 */
async function readFromEngine(
  repo: string,
  filePath: string,
  deps: StagedFileDeps
): Promise<StagedFile | null> {
  const viaCli = (reason: string) => {
    logBackendRoute("loadIndexFile", `backend=cli reason=${reason}`);
    return null;
  };
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return viaCli("setting");
  const isVerified = deps.isVerified ?? (() => false);
  if (!isVerified(repo)) return viaCli("unverified");
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  if (addon === null) return viaCli("engineUnavailable");
  if (typeof addon.loadIndexFile !== "function") return viaCli("noLoadIndexFile");
  try {
    const file = parseEngineCommitFile(await addon.loadIndexFile(repo, filePath));
    if (file === null) return viaCli("malformedPayload");
    // Strictly the engine's two shapes: text, or binary with no contents.
    if (!file.binary && file.contents !== null) {
      logBackendRoute("loadIndexFile", "backend=engine");
      return { text: file.contents };
    }
    if (file.binary && file.contents === null) {
      logBackendRoute("loadIndexFile", "backend=engine");
      return { binary: true };
    }
    return viaCli("malformedPayload");
  } catch {
    return viaCli("engineThrew");
  }
}

/**
 * The staged copy through `git show :<path>`. A failed show is a path the
 * index does not hold; a NUL byte early in the output, or output that is not
 * valid UTF-8, is binary — the engine's own contract, so the two agree.
 */
async function readFromCli(repo: string, filePath: string, gitPath: string): Promise<StagedFile> {
  const object = `:${filePath}`;
  let bytes: Buffer;
  try {
    bytes = await runGitCommand(() => showIndexFile(gitPath, repo, object), {
      label: "stagedFile.show",
      repo,
      args: ["show", object]
    });
  } catch {
    return { missing: true };
  }
  if (bytes.subarray(0, BINARY_SNIFF_LEN).includes(0)) return { binary: true };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { binary: true };
  }
}

/** `git show <object>` as raw bytes — the binary sniff needs bytes, not decoded text. */
function showIndexFile(gitPath: string, repo: string, object: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    execFile(
      gitPath,
      ["show", object],
      { cwd: repo, encoding: "buffer", maxBuffer: 1024 * 1024 * 64 },
      (error, stdout) => {
        if (error !== null) reject(error);
        else resolve(stdout);
      }
    );
  });
}
