/**
 * One reflog page through the engine or the CLI (Reflog tab, slice F1-09).
 *
 * The CLI query (`loadReflog`) spawns `git log -g` twice per page, plus a
 * `rev-parse`; the engine reads the reflog file in process through gix. The
 * addon export is optional: a binary built before it loads without
 * `loadReflog` and lands on exactly the CLI behavior, which is why the
 * engine version is not bumped. The engine declines (`Unsupported`)
 * wherever Git's answer could differ — a malformed reflog line, an entry
 * pointing at a missing or non-commit object, a symbolic ref, a missing or
 * empty `HEAD` log (where Git falls back to the branch's log) — and the CLI
 * is the authority there. Entry states (F1-02) stay on the CLI: this reader
 * replaces only the entry read.
 */

import type { SimpleGit } from "simple-git";
import {
  DEFAULT_REFLOG_PAGE_SIZE,
  loadReflog,
  MAX_REFLOG_PAGE_SIZE,
  type ReflogRequest
} from "@/backend/queries/reflog";
import type { GitReflogEntry, GitReflogResult, GitReflogState } from "@/backend/types";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { logBackendRoute } from "@/backend/utils/operationLog";
import type { EngineBackend } from "@/types";
import { type EngineAddon, loadEngineAddon } from "./addon";
import { isEngineFallbackError } from "./index";

/** The slice of the engine addon the reflog read needs. */
export type ReflogAddon = Pick<EngineAddon, "loadReflog">;

export type ReflogDeps = {
  /** Read live on every call, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => ReflogAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

const OPERATION = "loadReflog";

/**
 * One page of a ref's reflog, newest first: the engine when it may serve it,
 * the CLI query (`loadReflog`) otherwise. The result is the CLI query's
 * `GitReflogResult` either way, errors included.
 */
export async function readReflog(
  git: SimpleGit,
  repo: string,
  request: ReflogRequest = {},
  deps: ReflogDeps = {},
  record?: GitCommandRecorder
): Promise<GitReflogResult> {
  const fromEngine = await readFromEngine(repo, request, deps);
  if (fromEngine !== null) return fromEngine;
  return loadReflog(git, repo, request, record);
}

/**
 * The page from the engine, or null when the CLI must serve it: the git-cli
 * preference, an unverified repository, a request only the CLI validates,
 * no loadable addon, an addon without `loadReflog`, a decline, any other
 * engine throw, or a malformed payload.
 */
async function readFromEngine(
  repo: string,
  request: ReflogRequest,
  deps: ReflogDeps
): Promise<GitReflogResult | null> {
  const viaCli = (reason: string) => {
    logBackendRoute(OPERATION, `backend=cli reason=${reason}`);
    return null;
  };
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return viaCli("setting");
  const isVerified = deps.isVerified ?? (() => false);
  if (!isVerified(repo)) return viaCli("unverified");
  const normalized = normalizeRequest(request);
  if (normalized === null) return viaCli("invalidRequest");
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  if (addon === null) return viaCli("engineUnavailable");
  if (typeof addon.loadReflog !== "function") return viaCli("noLoadReflog");
  let payload: string;
  try {
    payload = await addon.loadReflog(repo, normalized.ref, normalized.limit, normalized.offset);
  } catch (error: unknown) {
    return viaCli(isEngineFallbackError(error) ? "declined" : "engineThrew");
  }
  const page = parseEngineReflogPage(payload, normalized.limit);
  if (page === null) return viaCli("malformedPayload");
  logBackendRoute(OPERATION, "backend=engine");
  return page;
}

type NormalizedRequest = { ref: string; limit: number; offset: number };

// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to reject control characters in a ref name, as the CLI query does.
const controlCharacter = /[\u0000-\u001f\u007f]/;

/**
 * The request in the shape the engine takes, or null when the CLI query
 * would refuse it — the engine never sees a ref or a count the CLI rejects,
 * so the refusal (and its wording) stays the CLI's. Mirrors `loadReflog`'s
 * validation: the ref defaults to `HEAD`, the limit clamps to the largest
 * page one read returns.
 */
function normalizeRequest(request: ReflogRequest): NormalizedRequest | null {
  const ref = request.ref ?? "HEAD";
  if (ref === "" || ref.startsWith("-") || controlCharacter.test(ref)) return null;
  const limit = request.limit ?? DEFAULT_REFLOG_PAGE_SIZE;
  const offset = request.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) return null;
  if (!Number.isInteger(offset) || offset < 0) return null;
  return { ref, limit: Math.min(limit, MAX_REFLOG_PAGE_SIZE), offset };
}

const objectName = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const reflogStates: ReadonlySet<unknown> = new Set(["entries", "empty", "none"]);

function toEngineEntry(value: unknown): GitReflogEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { hash, index, time, name, email, message } = value as Record<string, unknown>;
  if (typeof hash !== "string" || !objectName.test(hash)) return null;
  if (!Number.isSafeInteger(index) || (index as number) < 0) return null;
  if (!Number.isSafeInteger(time)) return null;
  if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
    return null;
  }
  return {
    hash,
    index: index as number,
    time: time as number,
    name,
    email,
    message
  };
}

/**
 * Strictly the engine's page shape, mapped into `GitReflogResult`: at most
 * `limit` entries with strictly rising selector indexes, a state the CLI
 * query could give for them, and the full ref name. Anything else is null,
 * so the CLI answers.
 */
export function parseEngineReflogPage(payload: string, limit: number): GitReflogResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { entries, state, hasMore, ref } = parsed as Record<string, unknown>;
  if (!Array.isArray(entries) || entries.length > limit) return null;
  if (!reflogStates.has(state) || typeof hasMore !== "boolean") return null;
  if (typeof ref !== "string" || ref === "") return null;
  const mapped: GitReflogEntry[] = [];
  for (const item of entries) {
    const entry = toEngineEntry(item);
    if (entry === null) return null;
    mapped.push(entry);
  }
  // Newest first means selector indexes strictly rise down the page
  // (`@{0}` is the newest entry), with gaps where Git counted an entry it
  // does not show.
  for (let i = 1; i < mapped.length; i++) {
    const previous = mapped[i - 1];
    const current = mapped[i];
    if (previous === undefined || current === undefined || current.index <= previous.index) {
      return null;
    }
  }
  if (mapped.length > 0 && state !== "entries") return null;
  if (hasMore && mapped.length !== limit) return null;
  return { entries: mapped, state: state as GitReflogState, hasMore, ref, error: null };
}
