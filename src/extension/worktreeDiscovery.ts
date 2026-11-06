/**
 * Worktree discovery after a scan (release 1.10.0, W32).
 *
 * The scan stops at a repository boundary, so a worktree nested inside the
 * main one (`.worktrees/x`) and one outside every workspace folder are never
 * walked to. This asks Git instead: for each group of listed repositories that
 * share a common git directory, `git worktree list` names every worktree of
 * that repository. Then, per Y9 and Y10:
 *
 * - a listed worktree inside a workspace folder that the scan missed is added;
 * - a listed worktree outside the workspace is offered as an "outside
 *   workspace" entry, only while `worktreesOutsideWorkspace` is on, and joins
 *   the repository list when the user selects it (W31's switch);
 * - a linked worktree outside the workspace that Git no longer lists is
 *   dropped, so an entry never outlives its worktree.
 *
 * Decisions come from the worktree list, never from Git's message text.
 */

import { simpleGit } from "simple-git";

import { readWorktrees } from "@/backend/engine/worktrees";
import type { GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import { inspectRepository } from "@/backend/utils/repositoryProbe";
import { mapSequential } from "@/backend/utils/sequential";
import type { Config } from "@/config";
import type { OutsideWorktree } from "@/types";

import { type WorktreeDetails, worktreeGroupOf } from "./repoLayout";
import type { RepoManager } from "./repoManager";

/** The worktrees of the repository `repo` belongs to, or null when Git could not list them. */
export type WorktreeLister = (
  repo: string,
  isVerified: (repo: string) => boolean
) => Promise<GitWorktree[] | null>;

export type WorktreeDiscoveryDeps = {
  repoManager: Pick<RepoManager, "getRepos" | "addRepo" | "removeRepo" | "setWorktreeDetails">;
  config: Pick<Config, "gitPath" | "backend" | "worktreesOutsideWorkspace">;
  /** The workspace folders, as forward-slash paths. */
  roots: () => string[];
  /** Test seam: replaces `git worktree list`. */
  list?: WorktreeLister;
  /** Test seam: whether Git accepts a directory as a repository root. */
  isReady?: (directory: string) => Promise<boolean>;
};

type ListedWorktree = { worktree: GitWorktree; path: string; canonical: string };

type Pass = {
  details: Map<string, WorktreeDetails>;
  outside: OutsideWorktree[];
  changed: boolean;
};

/** Forward slashes, like every repository path the extension keeps (`getPathFromStr`, which needs `vscode`). */
function toSlashes(file: string) {
  return file.replaceAll("\\", "/");
}

function isInsideRoots(candidate: string, roots: readonly string[]) {
  return roots.some((root) => candidate === root || candidate.startsWith(`${root}/`));
}

function groupByCommonDir(repoPaths: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const repo of repoPaths) {
    const { commonDir } = worktreeGroupOf(repo);
    groups.set(commonDir, [...(groups.get(commonDir) ?? []), repo]);
  }
  return groups;
}

/** The listed worktrees that are not bare, with the forward-slash and canonical path of each. */
async function describe(listing: readonly GitWorktree[]): Promise<ListedWorktree[]> {
  return Promise.all(
    listing
      .filter((worktree) => !worktree.bare)
      .map(async (worktree) => ({
        worktree,
        path: toSlashes(worktree.path),
        canonical: await canonicalizePath(worktree.path)
      }))
  );
}

export function createWorktreeDiscovery(deps: WorktreeDiscoveryDeps) {
  const { repoManager, config } = deps;

  async function listFromGit(
    repo: string,
    isVerified: (repo: string) => boolean
  ): Promise<GitWorktree[] | null> {
    try {
      const git = simpleGit({
        baseDir: repo,
        binary: config.gitPath(),
        maxConcurrentProcesses: 1,
        trimmed: false
      });
      const result = await readWorktrees(git, repo, {
        backend: () => config.backend(),
        isVerified
      });
      return result.error === null ? result.value : null;
    } catch {
      return null;
    }
  }

  const list = deps.list ?? listFromGit;

  const isReady =
    deps.isReady ??
    (async (directory: string) =>
      (
        await inspectRepository(directory, {
          gitPath: config.gitPath(),
          useEngine: config.backend() === "auto"
        })
      ).state === "ready");

  /** The first member Git can list from; an untrusted or vanished one is skipped. */
  async function listGroup(members: readonly string[], isVerified: (repo: string) => boolean) {
    for (const member of members) {
      const listing = await list(member, isVerified);
      if (listing !== null) return listing;
    }
    return null;
  }

  /** A listed worktree no member has yet: add it inside the workspace, offer it outside. */
  async function place(pass: Pass, entry: ListedWorktree, commonDir: string, repo: string) {
    const roots = deps.roots();
    const inside =
      isInsideRoots(entry.path, roots) ||
      isInsideRoots(entry.canonical, await Promise.all(roots.map(canonicalizePath)));
    if (inside) {
      if (!(await isReady(entry.path))) return;
      repoManager.addRepo(entry.path);
      pass.changed = true;
      return;
    }
    if (!config.worktreesOutsideWorkspace()) return;
    pass.outside.push({
      path: entry.path,
      commonDir,
      linked: !entry.worktree.isMain,
      branch: entry.worktree.branch,
      detached: entry.worktree.detached,
      repo
    });
  }

  /** Drops a linked worktree outside the workspace that Git does not list as present. */
  async function dropUnlisted(
    pass: Pass,
    members: readonly string[],
    present: ReadonlySet<string>
  ) {
    if (!config.worktreesOutsideWorkspace()) return;
    const roots = deps.roots();
    const canonicalRoots = await Promise.all(roots.map(canonicalizePath));
    const canonicals = await Promise.all(members.map((member) => canonicalizePath(member)));
    for (const [index, member] of members.entries()) {
      const canonical = canonicals[index];
      if (present.has(canonical) || !worktreeGroupOf(member).linked) continue;
      if (isInsideRoots(member, roots) || isInsideRoots(canonical, canonicalRoots)) continue;
      repoManager.removeRepo(member);
      pass.changed = true;
    }
  }

  async function applyListing(
    pass: Pass,
    commonDir: string,
    members: readonly string[],
    listing: readonly GitWorktree[]
  ) {
    const entries = await describe(listing);
    const memberCanonical = new Set(await Promise.all(members.map(canonicalizePath)));
    const present = new Set<string>();
    const fresh: ListedWorktree[] = [];
    for (const entry of entries) {
      pass.details.set(entry.path, {
        branch: entry.worktree.branch,
        detached: entry.worktree.detached
      });
      if (entry.worktree.prunable !== null) continue;
      present.add(entry.canonical);
      if (!memberCanonical.has(entry.canonical)) fresh.push(entry);
    }
    // Placed one at a time: each may add a repository or an outside entry, in listing order.
    await mapSequential(fresh, (entry) => place(pass, entry, commonDir, members[0]));
    await dropUnlisted(pass, members, present);
  }

  return {
    /**
     * Lists the worktrees of every repository the manager knows, adds the ones
     * inside the workspace that were missed, and publishes the branch labels
     * and outside-workspace entries to the manager. Answers whether the
     * repository list changed, so the caller republishes it.
     */
    async reconcile(isVerified: (repo: string) => boolean = () => false): Promise<boolean> {
      const pass: Pass = { details: new Map(), outside: [], changed: false };
      const groups = groupByCommonDir(Object.keys(repoManager.getRepos()));
      await mapSequential([...groups], async ([commonDir, members]) => {
        const listing = await listGroup(members, isVerified);
        if (listing !== null) await applyListing(pass, commonDir, members, listing);
      });
      repoManager.setWorktreeDetails(pass.details, pass.outside);
      return pass.changed;
    }
  };
}

export type WorktreeDiscovery = ReturnType<typeof createWorktreeDiscovery>;
