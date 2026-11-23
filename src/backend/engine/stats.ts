/**
 * The Statistics view's two engine reads (history and statistics slice
 * F3-01): the author commit counts and the commit activity grid.
 *
 * Unlike the reflog reader, these have no CLI twin: the Statistics view is
 * engine-only (register decision TQ2, and the exception to design rule 2 in
 * the engine surface notes). So a read answers either its validated value or
 * a typed unavailable reason, and never throws. The addon exports are
 * optional; a binary built before them loads without them and lands on
 * "noAddon".
 */

import type {
  StatsActivityCell,
  StatsAuthor,
  StatsReadResult,
  StatsUnavailableReason
} from "@/backend/types";
import { logBackendRoute } from "@/backend/utils/operationLog";
import type { EngineBackend } from "@/types";
import { type EngineAddon, loadEngineAddon } from "./addon";

/** The slice of the engine addon the Statistics reads need. */
export type StatsAddon = Pick<EngineAddon, "authorStats" | "activityHeatmap">;

export type StatsDeps = {
  /** Read live on every call, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => StatsAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

type StatsMember = keyof StatsAddon;

/** Author commit counts across every ref, from the engine's `authorStats`. */
export function readAuthorStats(
  repo: string,
  deps: StatsDeps = {}
): Promise<StatsReadResult<StatsAuthor[]>> {
  return readStat("authorStats", repo, deps, parseAuthorStats);
}

/** The commit activity grid, from the engine's `activityHeatmap`. */
export function readActivityHeatmap(
  repo: string,
  deps: StatsDeps = {}
): Promise<StatsReadResult<StatsActivityCell[]>> {
  return readStat("activityHeatmap", repo, deps, parseActivityHeatmap);
}

/**
 * One read through the engine: the value, or the reason there is none. The
 * gates run in the order a user can act on them: the backend setting, then
 * verification, then the addon and its export. The engine is called only
 * after every gate passes.
 */
async function readStat<T>(
  member: StatsMember,
  repo: string,
  deps: StatsDeps,
  parse: (payload: string) => T | null
): Promise<StatsReadResult<T>> {
  const unavailable = (reason: StatsUnavailableReason): StatsReadResult<T> => {
    logBackendRoute(member, `backend=unavailable reason=${reason}`);
    return { state: "unavailable", reason };
  };
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return unavailable("backendCli");
  const isVerified = deps.isVerified ?? (() => false);
  if (!isVerified(repo)) return unavailable("notVerified");
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  if (addon === null) return unavailable("noAddon");
  const read = addon[member];
  if (typeof read !== "function") return unavailable("noAddon");
  let payload: string;
  try {
    payload = await read.call(addon, repo);
  } catch {
    return unavailable("failed");
  }
  const value = parse(payload);
  if (value === null) return unavailable("failed");
  logBackendRoute(member, "backend=engine");
  return { state: "ok", value };
}

/** Parse the engine's JSON, or null when it is not valid JSON. */
function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * The payload as an array of mapped rows, or null when it is not an array or
 * any row fails `toRow`. A partly valid payload is never partly returned.
 */
function mapRows<T>(payload: string, toRow: (value: unknown) => T | null): T[] | null {
  const parsed = parseJson(payload);
  if (!Array.isArray(parsed)) return null;
  const rows: T[] = [];
  for (const item of parsed) {
    const row = toRow(item);
    if (row === null) return null;
    rows.push(row);
  }
  return rows;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function toAuthor(value: unknown): StatsAuthor | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, email, commits } = value as Record<string, unknown>;
  if (typeof name !== "string" || typeof email !== "string") return null;
  if (!isCount(commits)) return null;
  return { name, email, commits };
}

function toActivityCell(value: unknown): StatsActivityCell | null {
  if (typeof value !== "object" || value === null) return null;
  const { weekday, hour, count } = value as Record<string, unknown>;
  if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return null;
  }
  if (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1) return null;
  return { weekday, hour, count };
}

/** The engine's author rows, mapped; null on any malformed payload. */
export function parseAuthorStats(payload: string): StatsAuthor[] | null {
  return mapRows(payload, toAuthor);
}

/** The engine's activity cells, mapped; null on any malformed payload. */
export function parseActivityHeatmap(payload: string): StatsActivityCell[] | null {
  return mapRows(payload, toActivityCell);
}
