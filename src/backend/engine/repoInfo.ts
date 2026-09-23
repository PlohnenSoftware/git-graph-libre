/**
 * `loadRepoInfo` through the engine (Phase 16, slice 16.4).
 *
 * One engine call (`load_repo_info`) replaces the ref-shape CLI invocations —
 * HEAD branch, tags, stashes — while the fills the engine has no equivalent
 * for (HEAD commit, authors, remotes with push URLs) keep using the exact
 * CLI pieces from `src/backend/queries/loadRepoInfo.ts`. User config reads
 * from `config_list` first (local plus global), falling back to the CLI
 * fill whenever the shapes could differ. Nothing here reimplements a CLI
 * parse: the seam maps engine shapes into the project's shapes and reuses
 * the CLI parsers where they exist.
 *
 * Ordering contracts (probed against real repositories, pinned by the parity
 * table): engine tags arrive in CLI order; engine stashes arrive newest
 * first with `refs/`-prefixed selectors; the one normalization the seam
 * applies is the CLI's own `uniqueSortedLines` on tags, so behavior under
 * every locale is the CLI's by construction rather than by observation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";

import type { GitRepoConfig, GitRepoInfo, GitStash, QueryResult } from "@/backend/types";
import {
  loadAuthors,
  loadConfig,
  loadHead,
  loadRemotes,
  uniqueSortedLines
} from "@/backend/queries/loadRepoInfo";
import { parseStashIndex } from "@/backend/queries/stashes";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";

import type { EngineAddon } from "./addon";

/** One stash entry as the engine encodes it. */
export type EngineStash = {
  hash: string;
  baseHash: string;
  untrackedFilesHash: string | null;
  selector: string;
  author: string;
  email: string;
  date: number;
  message: string;
};

/** `load_repo_info` decoded. `branches` is carried but never consumed: branch display stays on `loadBranches` (CLI), unchanged by this slice. */
export type EngineRepoInfo = {
  branches: string[];
  head: string | null;
  remotes: string[];
  stashes: EngineStash[];
  tags: string[];
  error: string | null;
};

/**
 * The `load_repo_info` options JSON. Only `showStashes` is threaded from the
 * route: the ref options take the engine defaults because the consumed fields
 * are proven invariant under them (a hide list, remote-branch and remote-head
 * toggles only reshape the dropped `branches` list), and remote/branch
 * filtering stays where the messages carry it — `loadBranches`, on the CLI.
 */
export function buildRepoInfoOptions(showStashes: boolean): string {
  return JSON.stringify({
    showRemoteBranches: true,
    showRemoteHeads: false,
    hideRemotes: [],
    showStashes
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEngineStash(value: unknown): value is EngineStash {
  if (!isRecord(value)) return false;
  return (
    typeof value.hash === "string" &&
    typeof value.baseHash === "string" &&
    (typeof value.untrackedFilesHash === "string" || value.untrackedFilesHash === null) &&
    typeof value.selector === "string" &&
    typeof value.author === "string" &&
    typeof value.email === "string" &&
    typeof value.date === "number" &&
    typeof value.message === "string"
  );
}

/**
 * Decode and validate an engine payload. Anything malformed is null — never
 * a partial read the caller would have to second-guess.
 */
export function parseEngineRepoInfo(text: string): EngineRepoInfo | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const { branches, head, remotes, stashes, tags, error } = parsed;
  if (!Array.isArray(branches) || !Array.isArray(remotes)) return null;
  if (!Array.isArray(stashes) || !stashes.every(isEngineStash)) return null;
  if (!Array.isArray(tags) || !tags.every((tag): tag is string => typeof tag === "string")) {
    return null;
  }
  if (head !== null && typeof head !== "string") return null;
  if (error !== null && typeof error !== "string") return null;
  return { branches, head, remotes, stashes, tags, error };
}

/**
 * Map one engine stash onto the project shape. The engine names the whole
 * ref (`refs/stash@{0}`); the CLI contract is the short ref, parsed by the
 * CLI's own parser. Null means unmappable — the caller falls back to the
 * whole CLI read rather than shipping a partial list.
 */
export function mapEngineStash(stash: EngineStash): GitStash | null {
  const shortRef = stash.selector.startsWith("refs/")
    ? stash.selector.slice("refs/".length)
    : stash.selector;
  const index = parseStashIndex(shortRef);
  if (index === null) return null;
  return {
    index,
    ref: shortRef,
    hash: stash.hash,
    message: stash.message,
    date: Number.isNaN(stash.date) ? null : stash.date,
    sourceHash: stash.baseHash === "" ? null : stash.baseHash
  };
}

export type EngineRepoInfoFills = {
  git: SimpleGit;
  repo: string;
  recordGitCommand?: GitCommandRecorder;
  /** The loaded addon: with it the config fill reads from the engine first. */
  addon?: Pick<EngineAddon, "configList"> | null;
};

/** One `config_list` location decoded: last value per lower-cased key. */
export function parseEngineConfigList(text: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") return null;
    map[key] = value;
  }
  return map;
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * The global config file the engine's `config_list` reads, mirroring its
 * resolution order (`GIT_CONFIG_GLOBAL`, then `~/.gitconfig`, then XDG).
 * Null when no home is configured at all.
 */
export function resolveGlobalGitConfigPath(): string | null {
  const explicit = process.env.GIT_CONFIG_GLOBAL;
  if (explicit !== undefined && explicit !== "") return explicit;
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (home === undefined || home === "") return null;
  const dotted = path.join(home, ".gitconfig");
  if (isFile(dotted)) return dotted;
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg !== undefined && xdg !== "" ? xdg : path.join(home, ".config");
  return path.join(base, "git", "config");
}

/**
 * The local config file `git config --list --local` reads (`<gitdir>/config`;
 * a `.git` file, as in worktrees and submodules, names the real git dir on
 * its `gitdir:` line). Null when it cannot be resolved.
 */
export function resolveLocalGitConfigPath(repo: string): string | null {
  const dotGit = path.join(repo, ".git");
  let gitDir: string;
  try {
    if (fs.statSync(dotGit).isDirectory()) {
      gitDir = dotGit;
    } else {
      const firstLine = fs.readFileSync(dotGit, "utf8").split("\n")[0] ?? "";
      const match = /^gitdir:\s*(.+?)\s*$/.exec(firstLine);
      if (match?.[1] === undefined) return null;
      gitDir = path.resolve(repo, match[1]);
    }
  } catch {
    return null;
  }
  return path.join(gitDir, "config");
}

/**
 * User identity from the engine's `config_list` (local plus global), or null
 * when the CLI fill must run instead: an unresolvable scope path, a
 * resolvable-but-absent file on either scope (the CLI errors there where
 * the engine answers empty), any throw including the include-directive
 * decline, or a malformed payload. Null rolls up to the whole CLI read,
 * which reproduces the exact CLI shape — errors included.
 */
export async function loadEngineConfig(
  addon: Pick<EngineAddon, "configList">,
  repo: string
): Promise<GitRepoConfig | null> {
  const globalPath = resolveGlobalGitConfigPath();
  const localPath = resolveLocalGitConfigPath(repo);
  if (globalPath === null || localPath === null) return null;
  let localText: string;
  let globalText: string;
  try {
    if (!isFile(globalPath) || !isFile(localPath)) return null;
    [localText, globalText] = await Promise.all([
      addon.configList(repo, true),
      addon.configList(repo, false)
    ]);
  } catch {
    return null;
  }
  const local = parseEngineConfigList(localText);
  const global = parseEngineConfigList(globalText);
  if (local === null || global === null) return null;
  return {
    userName: { local: local["user.name"] ?? null, global: global["user.name"] ?? null },
    userEmail: { local: local["user.email"] ?? null, global: global["user.email"] ?? null }
  };
}

/**
 * The config piece of the composition: the engine fill when an addon is
 * present, the CLI fill otherwise. Null rolls up to the whole CLI read —
 * a CLI fill mixed into an engine composition would misattribute the
 * served flag and could ship a half-engine shape the parity table never
 * approved.
 */
async function loadFillConfig(
  fills: EngineRepoInfoFills
): Promise<Awaited<ReturnType<typeof loadConfig>> | null> {
  if (fills.addon !== undefined && fills.addon !== null) {
    const value = await loadEngineConfig(fills.addon, fills.repo);
    if (value === null) return null;
    return { value, error: null };
  }
  return loadConfig(fills.git, { repo: fills.repo, record: fills.recordGitCommand });
}

/**
 * Compose the project shape from one engine payload plus the CLI fills.
 * Piece order and error precedence mirror the CLI implementation. Null
 * signals an unmappable stash or an engine config the CLI must serve:
 * fall back, do not ship partial.
 */
export async function composeEngineRepoInfo(
  fills: EngineRepoInfoFills,
  info: EngineRepoInfo
): Promise<QueryResult<"loadRepoInfo"> | null> {
  const context = { repo: fills.repo, record: fills.recordGitCommand };
  const [headResult, remotesResult, configResult, authorsResult] = await Promise.all([
    loadHead(fills.git, context),
    loadRemotes(fills.git, context),
    loadFillConfig(fills),
    loadAuthors(fills.git, context)
  ]);
  if (configResult === null) return null;

  const stashes: GitStash[] = [];
  for (const stash of info.stashes) {
    const mapped = mapEngineStash(stash);
    if (mapped === null) return null;
    stashes.push(mapped);
  }

  const repoInfo: GitRepoInfo = {
    isRepo: true,
    head: info.head,
    headCommit: headResult.value.headCommit,
    authors: authorsResult.value,
    tags: uniqueSortedLines(info.tags.join("\n")),
    remotes: remotesResult.value,
    stashes,
    stashCount: stashes.length,
    config: configResult.value
  };
  return {
    repoInfo,
    error: headResult.error ?? remotesResult.error ?? configResult.error ?? authorsResult.error
  };
}
