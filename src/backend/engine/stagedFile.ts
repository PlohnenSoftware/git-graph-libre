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
 * `missing` when the path is not in the index at all, or `tooLarge` when the
 * blob is above `MAX_FILE_READ_BYTES`.
 */
export type StagedFile =
  | { text: string }
  | { binary: true }
  | { missing: true }
  | { tooLarge: true };

/**
 * The one ceiling for a single file read: 64 MiB, the CLI route's `maxBuffer`
 * and the engine's `MAX_READ_BYTES` (`file_read.rs`).
 */
export const MAX_FILE_READ_BYTES = 1024 * 1024 * 64;

/** The engine's too-large outcome: its error kind prefixes the message (`to_js_error`). */
export function isEngineTooLargeError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("TooLarge:");
}

/** The CLI route's too-large outcome: `execFile` overran `maxBuffer`. */
export function isMaxBufferError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
}

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
  } catch (error) {
    // Too large is the engine's answer, not a failure to retry on the CLI.
    if (isEngineTooLargeError(error)) {
      logBackendRoute("loadIndexFile", "backend=engine result=tooLarge");
      return { tooLarge: true };
    }
    return viaCli("engineThrew");
  }
}

/**
 * The staged copy through `git show :<path>`. A failed show is either a
 * gitlink (a submodule entry, whose commit usually is not in this object
 * database) or a path the index does not hold; only that failure path pays
 * for a second Git call, `git ls-files --stage`, to tell them apart. A NUL
 * byte early in the output, or output that is not valid UTF-8, is binary —
 * the engine's own contract, so the two agree.
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
  } catch (error) {
    if (isMaxBufferError(error)) return { tooLarge: true };
    const gitlink = await readIndexGitlink(repo, filePath, gitPath);
    return gitlink === null ? { missing: true } : { text: gitlink };
  }
  // `git show` of a gitlink whose commit IS in this repository prints that commit.
  // Only output that looks like a commit header pays for the gitlink check.
  if (startsLikeCommitHeader(bytes)) {
    const gitlink = await readIndexGitlink(repo, filePath, gitPath);
    if (gitlink !== null) return { text: gitlink };
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
      { cwd: repo, encoding: "buffer", maxBuffer: MAX_FILE_READ_BYTES },
      (error, stdout) => {
        if (error instanceof Error) reject(error);
        else resolve(stdout);
      }
    );
  });
}

/* ---------- Gitlinks on the CLI route ---------- */

/** The escape character that opens an ANSI color sequence. */
const ESC_CODE = 27;

/** How `git show` starts its header for a commit object. */
const COMMIT_HEADER_PREFIX = "commit ";

/** The digits of an object id as Git prints it. */
const LOWER_HEX_DIGITS = "0123456789abcdef";

/** The mode `git ls-tree` and `git ls-files --stage` print for a gitlink. */
const GITLINK_MODE = "160000";

/**
 * The text of a gitlink (submodule entry) in the GGL Diff tab: the one line
 * `git diff` shows for it. This is the diff-DISPLAY representation, shared with
 * the engine (`blob.rs`, `gitlink_text`) so both backends show the same thing;
 * it is NOT what `git show <rev>:<path>` prints (that command fails when the
 * submodule's commit is not in this repository, or prints the commit itself
 * when it is).
 */
export function gitlinkText(hash: string): string {
  return `Subproject commit ${hash}\n`;
}

/**
 * The pointed-at commit when `output` (NUL-separated `git ls-tree` or
 * `git ls-files --stage` records) holds a gitlink at exactly `filePath`, else
 * null. Both formats are `<mode> <rest>\t<path>`; the hash is the third word
 * of ls-tree (`<mode> commit <hash>`) and the second of ls-files
 * (`<mode> <hash> <stage>`).
 */
export function parseGitlinkEntry(output: string, filePath: string, format: "tree" | "stage") {
  for (const record of output.split("\0")) {
    const tab = record.indexOf("\t");
    if (tab < 0 || record.slice(tab + 1) !== filePath) continue;
    const words = record.slice(0, tab).split(" ");
    if (words[0] !== GITLINK_MODE) continue;
    if (format === "tree") return words[1] === "commit" ? (words[2] ?? null) : null;
    // Stage 0 only: a conflicted path has stages 1 to 3 and no single answer.
    return words[2] === "0" ? (words[1] ?? null) : null;
  }
  return null;
}

/**
 * Whether `git show` output begins like a commit header: a first line of
 * `commit <40 or 64 hex>`, optionally followed by a decoration such as
 * ` (HEAD -> main)`, after an optional ANSI color sequence (`color.ui=always`).
 * Only a hint to run the gitlink check: a regular file may match it too, and
 * only a confirmed gitlink changes what is shown.
 */
export function startsLikeCommitHeader(bytes: Buffer): boolean {
  let line = bytes.subarray(0, 300).toString("latin1").split("\n", 1)[0] ?? "";
  // Drop one leading ANSI color sequence: ESC, "[", digits and semicolons, "m".
  if (line.codePointAt(0) === ESC_CODE) {
    const end = line.indexOf("m");
    if (end < 0 || !/^[0-9;]*$/.test(line.slice(2, end)) || line[1] !== "[") return false;
    line = line.slice(end + 1);
  }
  if (!line.startsWith(COMMIT_HEADER_PREFIX)) return false;
  // Scanned rather than matched with a regular expression, so the cost stays
  // linear in the line's length.
  let hashEnd = COMMIT_HEADER_PREFIX.length;
  while (hashEnd < line.length && LOWER_HEX_DIGITS.includes(line.charAt(hashEnd))) hashEnd++;
  const hashLength = hashEnd - COMMIT_HEADER_PREFIX.length;
  if (hashLength !== 40 && hashLength !== 64) return false;
  // Nothing may follow the hash but a decoration (` (HEAD -> main)`) or a color reset.
  const rest = line.slice(hashEnd);
  return rest === "" || rest.startsWith(" ") || rest.codePointAt(0) === ESC_CODE;
}

/** Run Git with `args` in `repo`, returning raw stdout; rejects on a non-zero exit. */
export function execGitBytes(gitPath: string, repo: string, args: string[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    execFile(
      gitPath,
      args,
      { cwd: repo, encoding: "buffer", maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error instanceof Error) reject(error);
        else resolve(stdout);
      }
    );
  });
}

/** `git show` failed on `object`: the gitlink text when `filePath` is one in `repo`'s index, else null. */
export async function readIndexGitlink(
  repo: string,
  filePath: string,
  gitPath: string
): Promise<string | null> {
  const args = ["--literal-pathspecs", "ls-files", "--stage", "-z", "--", filePath];
  try {
    const bytes = await runGitCommand(() => execGitBytes(gitPath, repo, args), {
      label: "stagedFile.lsFiles",
      repo,
      args
    });
    const hash = parseGitlinkEntry(bytes.toString("utf8"), filePath, "stage");
    return hash === null ? null : gitlinkText(hash);
  } catch {
    return null;
  }
}

/**
 * `git show <ref>:<filePath>` failed: the gitlink text when that path is a
 * gitlink in `ref`'s tree, else null. Asked of Git itself (`git ls-tree`), so
 * it follows any revision syntax Git accepts. A ref that looks like an option
 * is refused, since ls-tree takes it as a bare argument.
 */
export async function readRevisionGitlink(
  repo: string,
  ref: string,
  filePath: string,
  gitPath: string
): Promise<string | null> {
  if (ref.startsWith("-")) return null;
  const args = ["ls-tree", "-z", ref, "--", filePath];
  try {
    const bytes = await runGitCommand(() => execGitBytes(gitPath, repo, args), {
      label: "diffTab.lsTree",
      repo,
      args
    });
    const hash = parseGitlinkEntry(bytes.toString("utf8"), filePath, "tree");
    return hash === null ? null : gitlinkText(hash);
  } catch {
    return null;
  }
}
