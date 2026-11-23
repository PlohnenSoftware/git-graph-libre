import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";

import type {
  GitBlameCommit,
  GitBlameHunk,
  GitBlameLine,
  GitBlameRequest,
  GitBlameResult,
  GitBlameState,
  GitQueryError
} from "@/backend/types";
import { type GitCommandRecorder, runGitRaw, runGitWithInput } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

/** The largest file one blame read accepts: 2 MiB of text. */
export const MAX_BLAME_FILE_BYTES = 2 * 1024 * 1024;
/** The most lines one blame read accepts. */
export const MAX_BLAME_LINES = 25_000;
/**
 * How far into a file the binary check looks for a NUL byte — the same reach
 * as the diff readers (`stagedFile.ts`, `diffTab/engineSource.ts`).
 */
export const BINARY_SNIFF_BYTES = 8_000;

const objectName = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const zeroObjectName = /^0+$/;
const headerLine = /^([0-9a-f]{40}(?:[0-9a-f]{24})?) (\d+) (\d+)(?: \d+)?$/;
const metadataLine = /^[a-z][a-z-]*($| )/;

/** Thrown when the porcelain output does not have the shape `git blame` documents. */
export class BlameFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlameFormatError";
    Object.setPrototypeOf(this, BlameFormatError.prototype);
  }
}

function queryError(message: string): GitQueryError {
  return { message, stderr: null, exitCode: null, task: null };
}

function failure(error: GitQueryError): GitBlameResult {
  return {
    state: null,
    commits: {},
    hunks: [],
    resolvedRev: null,
    totalLines: 0,
    ignoreRevsFileUsed: null,
    error
  };
}

function stateResult(
  state: GitBlameState,
  resolvedRev: string | null,
  totalLines: number,
  ignoreRevsFileUsed: string | null = null
): GitBlameResult {
  return {
    state,
    commits: {},
    hunks: [],
    resolvedRev,
    totalLines,
    ignoreRevsFileUsed,
    error: null
  };
}

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Why a revision must not reach Git, or null when it may. */
function revisionProblem(rev: string, subject: string): string | null {
  if (rev === "") return `${subject} cannot be empty.`;
  if (rev.startsWith("-")) return `${subject} cannot start with a dash.`;
  if (hasControlCharacter(rev)) return `${subject} cannot contain control characters.`;
  return null;
}

/** Why the request's revisions must not reach Git, or null when they may. */
function requestRevisionProblem(request: GitBlameRequest): string | null {
  if (typeof request.rev === "string") {
    const problem = revisionProblem(request.rev, "A revision");
    if (problem !== null) return problem;
  }
  for (const rev of request.ignoreRevs ?? []) {
    const problem = revisionProblem(rev, "An ignored revision");
    if (problem !== null) return problem;
  }
  if (typeof request.ignoreRevsFile === "string") {
    if (request.ignoreRevsFile === "") return "The ignore revisions file path cannot be empty.";
    if (request.ignoreRevsFile.includes("\0")) {
      return "The ignore revisions file path cannot contain a NUL byte.";
    }
  }
  return null;
}

/**
 * The repository-relative path blame may use, or why not. `.` and empty
 * segments drop out, `..` must stay inside the repository, and absolute
 * paths never reach Git: blame separates the path with `--`, but the
 * working-tree pre-check reads it from disk, so it must be safe there too.
 */
function normalizeBlameFilePath(filePath: string): { path: string } | { problem: string } {
  if (filePath === "") return { problem: "A file path is required." };
  if (filePath.includes("\0")) return { problem: "The file path cannot contain a NUL byte." };
  if (filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath)) {
    return { problem: "The file path must be relative to the repository root." };
  }
  const segments: string[] = [];
  for (const segment of filePath.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        return { problem: "The file path must stay inside the repository." };
      }
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  if (segments.length === 0) {
    return { problem: "The file path must name a file inside the repository." };
  }
  return { path: segments.join("/") };
}

/* ---------- Porcelain parser ---------- */

/** What {@link parseBlamePorcelain} makes of one blame output. */
export type ParsedBlame = {
  commits: Record<string, GitBlameCommit>;
  hunks: GitBlameHunk[];
  totalLines: number;
};

type Previous = { hash: string; path: string };

type PendingLine = {
  hash: string;
  origLine: number;
  finalLine: number;
  meta: Map<string, string>;
  boundary: boolean;
};

type Origin = { filename: string; previous: Previous | null };

type BlamedLine = {
  commitHash: string;
  filename: string;
  previous: Previous | null;
  line: GitBlameLine;
};

/** Porcelain wraps mails in angle brackets (`<a@b>`); the types keep the bare address. */
function unwrapMail(mail: string): string {
  return mail.startsWith("<") && mail.endsWith(">") && mail.length >= 2 ? mail.slice(1, -1) : mail;
}

function toTime(value: string | undefined, what: string): number {
  if (value === undefined) return 0;
  const time = Number(value);
  if (!Number.isSafeInteger(time) || time < 0) {
    throw new BlameFormatError(`Blame record has an invalid ${what} time.`);
  }
  return time;
}

function toPrevious(value: string): Previous {
  const space = value.indexOf(" ");
  const hash = space === -1 ? value : value.slice(0, space);
  const previousPath = space === -1 ? "" : value.slice(space + 1);
  if (!objectName.test(hash) || previousPath === "") {
    throw new BlameFormatError("Blame record has an unexpected previous entry.");
  }
  return { hash, path: previousPath };
}

/** The commit one block introduces; later blocks of it never rewrite this record. */
function toCommit(pending: PendingLine, origin: Origin): GitBlameCommit {
  const meta = pending.meta;
  return {
    hash: pending.hash,
    author: meta.get("author") ?? "",
    authorMail: unwrapMail(meta.get("author-mail") ?? ""),
    authorTime: toTime(meta.get("author-time"), "author"),
    authorTz: meta.get("author-tz") ?? "",
    committer: meta.get("committer") ?? "",
    committerMail: unwrapMail(meta.get("committer-mail") ?? ""),
    committerTime: toTime(meta.get("committer-time"), "committer"),
    committerTz: meta.get("committer-tz") ?? "",
    summary: meta.get("summary") ?? "",
    boundary: pending.boundary,
    uncommitted: zeroObjectName.test(pending.hash),
    previous: origin.previous,
    filename: origin.filename
  };
}

/**
 * Applies one block's `filename`/`previous` to what the commit last carried.
 * With `--porcelain` Git emits commit metadata once per commit, but emits
 * `filename` (and `previous`) again whenever a later group of the same
 * commit comes from another origin file — verified with a `-C` copy on
 * Git 2.56.1 — so a block's own values win and absent ones inherit. The
 * same reading covers `--line-porcelain`, where every block carries them.
 */
function applyOrigin(pending: PendingLine, origins: Map<string, Origin>): Origin {
  let origin = origins.get(pending.hash);
  if (origin === undefined) {
    origin = { filename: "", previous: null };
    origins.set(pending.hash, origin);
  }
  const filename = pending.meta.get("filename");
  if (filename !== undefined) origin.filename = filename;
  const previous = pending.meta.get("previous");
  if (previous !== undefined) origin.previous = toPrevious(previous);
  return origin;
}

function samePrevious(a: Previous | null, b: Previous | null): boolean {
  if (a === null || b === null) return a === b;
  return a.hash === b.hash && a.path === b.path;
}

/** Groups blamed lines into hunks: one commit, one origin, no line gaps. */
function groupHunks(lines: BlamedLine[]): GitBlameHunk[] {
  const groups: BlamedLine[][] = [];
  for (const blamed of lines) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    if (
      group !== undefined &&
      last?.commitHash === blamed.commitHash &&
      last.filename === blamed.filename &&
      samePrevious(last.previous, blamed.previous) &&
      last.line.finalLine + 1 === blamed.line.finalLine &&
      last.line.origLine + 1 === blamed.line.origLine
    ) {
      group.push(blamed);
    } else {
      groups.push([blamed]);
    }
  }
  return groups.map((group) => {
    const first = group[0];
    return {
      commitHash: first.commitHash,
      startLine: first.line.finalLine,
      lineCount: group.length,
      origStartLine: first.line.origLine,
      filename: first.filename,
      previous: first.previous,
      lines: group.map((blamed) => blamed.line)
    };
  });
}

function stripTrailingCr(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function finishPendingLine(
  pending: PendingLine | null,
  rawContentLine: string,
  commits: Map<string, GitBlameCommit>,
  origins: Map<string, Origin>
): BlamedLine {
  if (pending === null) {
    throw new BlameFormatError("Blame content line has no header before it.");
  }
  const content = stripTrailingCr(rawContentLine.slice(1));
  const origin = applyOrigin(pending, origins);
  if (!commits.has(pending.hash)) commits.set(pending.hash, toCommit(pending, origin));
  return {
    commitHash: pending.hash,
    filename: origin.filename,
    previous: origin.previous,
    line: { finalLine: pending.finalLine, origLine: pending.origLine, content }
  };
}

function applyMetadataLine(pending: PendingLine | null, line: string): PendingLine {
  if (!metadataLine.test(line)) {
    throw new BlameFormatError("Blame output has an unexpected line.");
  }
  if (pending === null) {
    throw new BlameFormatError("Blame metadata line has no header before it.");
  }
  const space = line.indexOf(" ");
  if (space === -1) {
    if (line === "boundary") pending.boundary = true;
  } else {
    pending.meta.set(line.slice(0, space), line.slice(space + 1));
  }
  return pending;
}

function parseRecordLine(pending: PendingLine | null, rawLine: string): PendingLine {
  const line = stripTrailingCr(rawLine);
  const header = headerLine.exec(line);
  if (header !== null) {
    if (pending !== null) {
      throw new BlameFormatError("Blame record is missing its content line.");
    }
    const [, hash, orig, final] = header as unknown as [string, string, string, string];
    return {
      hash,
      origLine: Number(orig),
      finalLine: Number(final),
      meta: new Map(),
      boundary: false
    };
  }
  return applyMetadataLine(pending, line);
}

/**
 * Parses `git blame --porcelain` output into commits and hunks. Pure.
 *
 * The stream is one block per line: a `<hash> <orig> <final>` header, the
 * metadata lines Git chose to emit, then a tab and the line's text. The
 * text keeps everything after that first tab, tabs and UTF-8 included, and
 * one trailing carriage return counts as part of the line ending, so LF
 * and CRLF files (and CRLF streams) read the same. Unknown metadata keys
 * are ignored, so a newer Git cannot break the parse; a block out of order
 * or cut short throws {@link BlameFormatError} rather than guessing.
 */
export function parseBlamePorcelain(stdout: string): ParsedBlame {
  if (stdout === "") return { commits: {}, hunks: [], totalLines: 0 };
  const rawLines = stdout.split("\n");
  if (rawLines.at(-1) === "") rawLines.pop();

  const commits = new Map<string, GitBlameCommit>();
  const origins = new Map<string, Origin>();
  const blamed: BlamedLine[] = [];
  let pending: PendingLine | null = null;

  for (const rawLine of rawLines) {
    if (rawLine.startsWith("\t")) {
      blamed.push(finishPendingLine(pending, rawLine, commits, origins));
      pending = null;
    } else {
      pending = parseRecordLine(pending, rawLine);
    }
  }
  if (pending !== null) {
    throw new BlameFormatError("Blame record is missing its content line.");
  }

  return {
    commits: Object.fromEntries(commits),
    hunks: groupHunks(blamed),
    totalLines: blamed.length
  };
}

/* ---------- Pre-checks: never blame a binary or oversized blob ---------- */

type Precheck = { kind: "ok" } | { kind: "binary" | "tooLarge"; totalLines: number };

/** The lines blame would emit for these bytes: each newline ends one, a tail without one still counts. */
function countLines(bytes: Buffer): number {
  if (bytes.length === 0) return 0;
  let lines = 0;
  for (const byte of bytes) {
    if (byte === 0x0a) lines += 1;
  }
  return bytes.at(-1) === 0x0a ? lines : lines + 1;
}

/**
 * Judges content the read already holds. `byteCount` is the content's true
 * size, which for a revision blob comes from `ls-tree`: the text Git was
 * decoded to a string on the way here, so its re-encoded length can differ.
 * Order matters: size first (no big read was wasted getting here for a
 * revision — `ls-tree` already refused it), then binary, then lines.
 */
function judgeContent(bytes: Buffer, byteCount: number): Precheck {
  const totalLines = countLines(bytes);
  if (byteCount > MAX_BLAME_FILE_BYTES) return { kind: "tooLarge", totalLines };
  if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return { kind: "binary", totalLines };
  if (totalLines > MAX_BLAME_LINES) return { kind: "tooLarge", totalLines };
  return { kind: "ok" };
}

/** A file's bytes, or null when it holds more than `limit`; the read stops at `limit + 1`. */
async function readBoundedBuffer(absolutePath: string, limit: number): Promise<Buffer | null> {
  const handle = await fs.open(absolutePath, "r");
  try {
    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= limit) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      chunks.push(chunk.subarray(0, bytesRead));
      total += bytesRead;
    }
    return total > limit ? null : Buffer.concat(chunks, total);
  } finally {
    await handle.close();
  }
}

/**
 * The working-tree pre-check, from disk. Anything unreadable — a deleted
 * file, a directory — answers `ok` so `git blame` itself words the failure;
 * the check only ever refuses what it could actually inspect.
 */
async function diskPrecheck(repo: string, filePath: string): Promise<Precheck> {
  try {
    const absolutePath = path.resolve(repo, ...filePath.split("/"));
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) return { kind: "ok" };
    if (stats.size > MAX_BLAME_FILE_BYTES) return { kind: "tooLarge", totalLines: 0 };
    const bytes = await readBoundedBuffer(absolutePath, MAX_BLAME_FILE_BYTES);
    if (bytes === null) return { kind: "tooLarge", totalLines: 0 };
    return judgeContent(bytes, bytes.length);
  } catch {
    return { kind: "ok" };
  }
}

type Reader = (args: string[], label: string) => Promise<string>;

/**
 * The revision pre-check: one `ls-tree -l` for existence, kind and size,
 * then the blob itself (already known within the size limit) for the
 * binary and line checks. A path Git does not list as a blob answers `ok`,
 * so the blame run produces the canonical error for it.
 */
async function revisionPrecheck(read: Reader, oid: string, filePath: string): Promise<Precheck> {
  try {
    const listing = await read(["ls-tree", "-l", oid, "--", filePath], "blame.precheck.list");
    const firstLine = listing.split("\n", 1)[0] ?? "";
    const head = firstLine.split("\t", 1)[0] ?? "";
    const [, type, blobOid, sizeText] = head.trim().split(/\s+/);
    if (type !== "blob" || blobOid === undefined || !objectName.test(blobOid)) {
      return { kind: "ok" };
    }
    const size = Number(sizeText);
    if (!Number.isSafeInteger(size) || size < 0) return { kind: "ok" };
    if (size > MAX_BLAME_FILE_BYTES) return { kind: "tooLarge", totalLines: 0 };
    const text = await read(["cat-file", "blob", blobOid], "blame.precheck.blob");
    return judgeContent(Buffer.from(text, "utf8"), size);
  } catch {
    return { kind: "ok" };
  }
}

/* ---------- The query ---------- */

/**
 * Resolves a requested revision to the commit OID blame will receive.
 * `git blame` rejects `--end-of-options` (verified on Git 2.56.1), so no
 * unvalidated text ever reaches it as a revision: callers' values are first
 * refused when empty, dash-led or control-bearing, then resolved here
 * through `rev-parse`, and only the resulting 40/64-hex OID is passed on.
 * A `HEAD` that resolves to nothing is an unborn repository, not an error.
 */
async function resolveRevision(
  read: Reader,
  rev: string
): Promise<{ oid: string } | { result: GitBlameResult }> {
  let stdout: string;
  try {
    stdout = await read(
      ["rev-parse", "--verify", "--end-of-options", `${rev}^{commit}`],
      "blame.resolve"
    );
  } catch (error: unknown) {
    if (rev === "HEAD") return { result: stateResult("unborn", null, 0) };
    const info = toGitQueryError(error, `"${rev}" is not a commit.`);
    return { result: failure({ ...info, message: `"${rev}" is not a commit.` }) };
  }
  const oid = stdout.trim();
  if (!objectName.test(oid)) {
    if (rev === "HEAD") return { result: stateResult("unborn", null, 0) };
    return { result: failure(queryError(`"${rev}" is not a commit.`)) };
  }
  return { oid };
}

async function isBareRepository(read: Reader): Promise<boolean> {
  const stdout = await read(["rev-parse", "--is-bare-repository"], "blame.bare");
  return stdout.trim() === "true";
}

/** True when `HEAD` names a commit; a refused read counts as no commit yet. */
async function headCommitExists(read: Reader): Promise<boolean> {
  try {
    const stdout = await read(["rev-parse", "--verify", "--quiet", "HEAD"], "blame.probe.head");
    return stdout.trim() !== "";
  } catch {
    return false;
  }
}

/** True when `HEAD`'s tree holds the path at all (file, tree or gitlink). */
async function pathInHeadTree(read: Reader, filePath: string): Promise<boolean> {
  try {
    const stdout = await read(["ls-tree", "HEAD", "--", filePath], "blame.probe.path");
    return stdout.trim() !== "";
  } catch {
    return false;
  }
}

function blameArgs(
  request: GitBlameRequest,
  filePath: string,
  resolvedRev: string | null
): string[] {
  const args = ["-c", "core.quotePath=false", "blame", "--porcelain"];
  if (request.ignoreWhitespace === true) args.push("-w");
  if (request.detectMoves === true) args.push("-M");
  if (request.detectCopies === true) args.push("-C");
  for (const rev of request.ignoreRevs ?? []) args.push(`--ignore-rev=${rev}`);
  if (typeof request.ignoreRevsFile === "string") {
    args.push(`--ignore-revs-file=${request.ignoreRevsFile}`);
  }
  if (request.contents !== undefined) args.push("--contents", "-");
  if (resolvedRev !== null) args.push(resolvedRev);
  args.push("--", filePath);
  return args;
}

/**
 * Turns a failed blame run into its result. The two friendly states are
 * decided structurally — whether `HEAD` is a commit, whether its tree
 * holds the path — never from Git's message text, which a localized Git
 * words differently. A file first staged but not yet committed blames
 * fine and never lands here; only one `HEAD` does not know at all does.
 */
async function mapBlameFailure(
  error: unknown,
  read: Reader,
  filePath: string,
  effectiveRev: string | null,
  resolvedRev: string | null
): Promise<GitBlameResult> {
  if (effectiveRev === null) {
    if (!(await headCommitExists(read))) return stateResult("unborn", null, 0);
    if (!(await pathInHeadTree(read, filePath))) return stateResult("untracked", null, 0);
  } else if (effectiveRev === "HEAD") {
    if (!(await pathInHeadTree(read, filePath))) {
      return stateResult("untracked", resolvedRev, 0);
    }
  }
  return failure(toGitQueryError(error, "Unable to blame the file"));
}

type PreparedBlameRequest = {
  filePath: string;
  binary: string;
  effectiveRev: string | null;
  ignoreRevsFileUsed: string | null;
};

function prepareBlameRequest(request: GitBlameRequest): PreparedBlameRequest | { problem: string } {
  const normalized = normalizeBlameFilePath(request.filePath);
  if ("problem" in normalized) return normalized;

  const problem = requestRevisionProblem(request);
  if (problem !== null) return { problem };

  const withContents = request.contents !== undefined;
  const binary = request.binary ?? "";
  if (withContents && binary === "") {
    return { problem: "A Git binary path is required to blame unsaved contents." };
  }
  // An unsaved buffer needs a revision to blame against; HEAD is its home.
  const effectiveRev = withContents ? (request.rev ?? "HEAD") : (request.rev ?? null);
  const ignoreRevsFileUsed =
    typeof request.ignoreRevsFile === "string" ? request.ignoreRevsFile : null;
  return {
    filePath: normalized.path,
    binary,
    effectiveRev,
    ignoreRevsFileUsed
  };
}

async function resolveBlameTarget(
  read: Reader,
  effectiveRev: string | null
): Promise<{ resolvedRev: string | null } | { result: GitBlameResult }> {
  if (effectiveRev === null) {
    if (await isBareRepository(read)) {
      return {
        result: failure(
          queryError("A bare repository has no working tree to blame; choose a revision.")
        )
      };
    }
    return { resolvedRev: null };
  }
  const resolved = await resolveRevision(read, effectiveRev);
  if ("result" in resolved) return resolved;
  return { resolvedRev: resolved.oid };
}

async function runBlamePrecheck(
  read: Reader,
  repo: string,
  filePath: string,
  resolvedRev: string | null,
  contents: string | undefined
): Promise<Precheck> {
  if (contents !== undefined) {
    const bytes = Buffer.from(contents, "utf8");
    return judgeContent(bytes, bytes.length);
  }
  if (resolvedRev !== null) {
    return revisionPrecheck(read, resolvedRev, filePath);
  }
  return diskPrecheck(repo, filePath);
}

async function executeBlameCommand(
  git: SimpleGit,
  repo: string,
  request: GitBlameRequest,
  args: string[],
  binary: string,
  record?: GitCommandRecorder
): Promise<string> {
  if (request.contents === undefined) {
    return runGitRaw(git, { label: "blame.read", kind: "query", args, repo, record });
  }
  return runGitWithInput(git, {
    label: "blame.read",
    kind: "query",
    args,
    input: request.contents,
    binary,
    repo,
    record
  });
}

/**
 * Blames one file, read-only: at a revision, in the working tree, or from
 * an unsaved buffer (`contents`, blamed against `rev` or `HEAD`). Lines
 * come back grouped into hunks of one commit and one origin file, with
 * every commit's identity, dates, subject, `boundary` and `previous`
 * (the parent-blame target) alongside.
 *
 * Binary and oversized inputs are refused before Git blames anything
 * (`binary`, `tooLarge`); an empty file is its own `empty` state, never an
 * error. A bare repository blames happily at a revision and refuses the
 * working tree it does not have — Git itself would silently blame `HEAD`
 * there, which is why this query asks first. A broken
 * `blame.ignoreRevsFile` configuration fails the read with Git's own
 * message: on Git 2.56.1 neither an empty `-c` override nor an empty
 * `--ignore-revs-file=` talks Git out of it, so the error is surfaced,
 * never swallowed as an empty blame.
 */
export async function loadBlame(
  git: SimpleGit,
  repo: string,
  request: GitBlameRequest,
  record?: GitCommandRecorder
): Promise<GitBlameResult> {
  const prepared = prepareBlameRequest(request);
  if ("problem" in prepared) return failure(queryError(prepared.problem));
  const { filePath, binary, effectiveRev, ignoreRevsFileUsed } = prepared;

  const read: Reader = (args, label) =>
    runGitRaw(git, { label, kind: "query", args, repo, record });

  try {
    const target = await resolveBlameTarget(read, effectiveRev);
    if ("result" in target) return target.result;
    const { resolvedRev } = target;

    const precheck = await runBlamePrecheck(read, repo, filePath, resolvedRev, request.contents);
    if (precheck.kind !== "ok") {
      return stateResult(precheck.kind, resolvedRev, precheck.totalLines);
    }

    const args = blameArgs(request, filePath, resolvedRev);
    let stdout: string;
    try {
      stdout = await executeBlameCommand(git, repo, request, args, binary, record);
    } catch (error: unknown) {
      return await mapBlameFailure(error, read, filePath, effectiveRev, resolvedRev);
    }

    const parsed = parseBlamePorcelain(stdout);
    if (parsed.totalLines === 0) {
      return stateResult("empty", resolvedRev, 0, ignoreRevsFileUsed);
    }
    return {
      state: "lines",
      commits: parsed.commits,
      hunks: parsed.hunks,
      resolvedRev,
      totalLines: parsed.totalLines,
      ignoreRevsFileUsed,
      error: null
    };
  } catch (error: unknown) {
    if (error instanceof BlameFormatError) return failure(queryError(error.message));
    return failure(toGitQueryError(error, "Unable to blame the file"));
  }
}
