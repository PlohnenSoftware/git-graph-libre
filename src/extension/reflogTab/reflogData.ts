import type { SimpleGit } from "simple-git";

import { createBranch as createGitBranch } from "@/backend/actions/branch";
import { checkoutCommit, resetToCommit } from "@/backend/actions/commit";
import { addTag } from "@/backend/actions/tag";
import { closeEngineRepository } from "@/backend/engine/index";
import { readReflog } from "@/backend/engine/reflog";
import { readWorktrees } from "@/backend/engine/worktrees";
import { loadLostCommits } from "@/backend/queries/lostCommits";
import {
  classifyReflogMessage,
  DEFAULT_REFLOG_PAGE_SIZE,
  loadReflogEntryStates,
  loadReflogRefs,
  MAX_REFLOG_PAGE_SIZE
} from "@/backend/queries/reflog";
import type { GitReflogEntry, GitReflogEntryState, GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import {
  defaultReflogQuery,
  isReflogFiltered,
  normalizeReflogRecoveryAction,
  REFLOG_SEARCH_CAP,
  type ReflogLostCommitsResult,
  type ReflogPage,
  type ReflogQuery,
  type ReflogRecoveryAction,
  type ReflogRecoveryResult,
  type ReflogRefs,
  type ReflogRow,
  type ReflogSource,
  repoRefOption
} from "@/reflogTabTypes";
import type { EngineBackend } from "@/types";

const commitHashPattern = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

/** True when `value` is a full 40- or 64-character hex Git object hash. */
export function isValidCommitHash(value: string): boolean {
  return commitHashPattern.test(value);
}

/**
 * Basic safety check on a branch name before handing it to `git branch`:
 * non-empty, never dash-led (so it cannot turn into an option), and free of
 * whitespace or control characters. Git itself checks the full ref-format rules.
 */
export function isValidRecoveryBranchName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.startsWith("-")) return false;
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) return false;
  }
  return true;
}

export type ReflogSourceDeps = {
  /** A Git instance rooted at the repository being read. */
  createGit: (repo: string) => SimpleGit;
  /**
   * The resolved Git binary (`config.gitPath()`), read live per page. The
   * F1-02 state read feeds hashes on stdin through it, as the
   * `commitSignatures` handler does; without it every state comes back
   * unknown and no badge is drawn.
   */
  gitPath: () => string;
  record?: GitCommandRecorder;
  /**
   * The live `backend` preference for the engine-first reflog read (F1-09),
   * read per page like every engine read. Absent means the CLI serves every
   * page, exactly as before F1-09.
   */
  backend?: () => EngineBackend;
  /**
   * Whether Git confirmed it accepts the repository (`RepoSearch.isVerified`):
   * the engine is offered only a verified repository. Absent means never
   * verified, so the CLI serves every page.
   */
  isVerified?: (repo: string) => boolean;
  /**
   * How many entries one filtered read fetches before it stops; the
   * {@link REFLOG_SEARCH_CAP} constant unless a test sets it small. Not a
   * user setting (RQ7).
   */
  searchCap?: number;
  /**
   * Closes one repository's engine handle; defaults to
   * `closeEngineRepository`. Tests record it instead of loading the addon.
   */
  closeRepo?: (repo: string) => void;
  /** Optional wall-clock timeout override for the lost-commit scan (F1-07). */
  lostCommitsTimeoutMs?: number;
};

/** A worktree's folder name, as `worktreeFolderName` in the graph webview trims it. */
function folderName(worktreePath: string): string {
  let end = worktreePath.length;
  while (end > 0 && (worktreePath[end - 1] === "/" || worktreePath[end - 1] === "\\")) {
    end -= 1;
  }
  const segments = worktreePath.slice(0, end).split(/[/\\]/);
  return segments.at(-1) || worktreePath;
}

/**
 * The picker's options out of the repository's refs and worktrees (F1-08):
 * the refs in F1-05's order (`HEAD`, branches, the stash), then every
 * other worktree's `HEAD` in Git's order (RQ8). A bare worktree has no
 * `HEAD` reflog to pick, and the current worktree's `HEAD` is the first
 * option already. `bare` says the tab's repository itself is bare.
 */
export function buildReflogRefs(refs: string[], worktrees: GitWorktree[]): ReflogRefs {
  const options = refs.map(repoRefOption);
  for (const worktree of worktrees) {
    if (worktree.isCurrent || worktree.bare) continue;
    options.push({
      ref: "HEAD",
      worktreePath: worktree.path,
      worktreeName: folderName(worktree.path),
      locked: worktree.locked,
      prunable: worktree.prunable
    });
  }
  return { options, bare: worktrees.some((worktree) => worktree.isCurrent && worktree.bare) };
}

type States = Record<string, GitReflogEntryState>;

/** One fetched entry with the kind its message classifies as. */
type Classified = { entry: GitReflogEntry; kind: string; sub: string | null };

function errorPage(message: string): ReflogPage {
  return { rows: [], state: null, hasMore: false, ref: null, error: message, searchCapped: false };
}

function toRow({ entry, kind, sub }: Classified, states: States): ReflogRow {
  return {
    hash: entry.hash,
    index: entry.index,
    time: entry.time,
    kind,
    sub,
    message: entry.message,
    // An absent hash is unknown (the state read failed, or the object
    // is not a commit): no badge for it, exactly as `reachable`.
    state: states[entry.hash] ?? null
  };
}

/**
 * The Reflog tab's data source (F1-05): one page of the picked reflog per
 * call through the engine-first reader (F1-09; the CLI query whenever the
 * engine may not or cannot serve it, and always for a search grep),
 * classified for its action columns and joined with the F1-02 entry
 * states for its badges. A failed state read never errors the page —
 * its rows simply carry no state, as F1-02 designed.
 *
 * An unfiltered page is one read. A filtered one (search text, an action
 * filter, or "only in the reflog") instead fetches up to the search cap
 * of entries in bounded reads — Git's own `--grep-reflog` matches when a
 * search text is set — then applies the action and state filters here
 * and cuts the asked page out of the matches, so no filter ever sees
 * only the loaded page. `searchCapped` says the fetch stopped at the
 * cap with more fetched entries behind it.
 *
 * Another worktree's `HEAD` (F1-08) is read in that worktree, the way
 * `git -C <path> log -g HEAD` reads it, because each worktree keeps its
 * own `HEAD` reflog. The asked path is re-checked against the tab
 * repository's worktree list on every such page: a path Git does not
 * list is an error page, never a read, and a prunable (missing) one
 * says so instead of failing inside Git. Branch and stash reflogs are
 * shared, so they always read in the tab's repository.
 */
export function createReflogSource(deps: ReflogSourceDeps): ReflogSource {
  const cap =
    deps.searchCap !== undefined && Number.isInteger(deps.searchCap) && deps.searchCap >= 1
      ? deps.searchCap
      : REFLOG_SEARCH_CAP;
  /** Other worktrees read so far, by the exact path Git was rooted at. */
  const openedWorktrees = new Set<string>();

  async function worktreesOf(repo: string): Promise<GitWorktree[] | string> {
    const result = await readWorktrees(
      deps.createGit(repo),
      repo,
      { backend: deps.backend, isVerified: deps.isVerified },
      deps.record
    );
    return result.error === null ? result.value : result.error.message;
  }

  /** The folder a page or action targets, or the error that stops it (F1-08, F1-06). */
  async function resolveWorktreeRepo(
    repo: string,
    worktreePath: string | null,
    trackEngineHandle: boolean
  ): Promise<{ path: string; error: null } | { path: null; error: string }> {
    if (worktreePath === null) return { path: repo, error: null };
    const listed = await worktreesOf(repo);
    if (typeof listed === "string") return { path: null, error: listed };
    const askedPath = await canonicalizePath(worktreePath);
    const canonical = await Promise.all(listed.map((worktree) => canonicalizePath(worktree.path)));
    const found = listed[canonical.indexOf(askedPath)];
    if (found === undefined) {
      return { path: null, error: `"${worktreePath}" is not a worktree of this repository.` };
    }
    if (found.prunable !== null) {
      return {
        path: null,
        error: `The worktree at "${worktreePath}" is missing, so its HEAD reflog cannot be read.`
      };
    }
    if (trackEngineHandle) openedWorktrees.add(worktreePath);
    return { path: worktreePath, error: null };
  }

  /** The folder a page reads in, or the error that stops it (F1-08). */
  async function effectiveRepo(repo: string, query: ReflogQuery): Promise<string | ReflogPage> {
    const resolved = await resolveWorktreeRepo(repo, query.worktreePath, true);
    return resolved.error === null ? resolved.path : errorPage(resolved.error);
  }

  async function executeRecoveryWrite(
    git: SimpleGit,
    targetRepo: string,
    action: ReflogRecoveryAction
  ): Promise<void> {
    if (action.kind === "createBranch") {
      await createGitBranch(
        git,
        {
          repo: targetRepo,
          branchName: action.branchName,
          commitHash: action.commitHash,
          checkout: false
        },
        deps.record
      );
      return;
    }
    if (action.kind === "addTag") {
      if (action.lightweight) {
        await addTag(
          git,
          {
            repo: targetRepo,
            tagName: action.tagName,
            commitHash: action.commitHash,
            lightweight: true
          },
          deps.record
        );
      } else {
        await addTag(
          git,
          {
            repo: targetRepo,
            tagName: action.tagName,
            commitHash: action.commitHash,
            lightweight: false,
            message: action.message ?? ""
          },
          deps.record
        );
      }
      return;
    }
    if (action.kind === "checkoutCommit") {
      await checkoutCommit(git, { repo: targetRepo, commitHash: action.commitHash }, deps.record);
      return;
    }
    await resetToCommit(
      git,
      { repo: targetRepo, commitHash: action.commitHash, resetMode: action.resetMode },
      deps.record
    );
  }

  async function statesFor(git: SimpleGit, repo: string, items: Classified[]): Promise<States> {
    const result = await loadReflogEntryStates(
      git,
      repo,
      items.map((item) => item.entry.hash),
      deps.gitPath(),
      deps.record
    );
    return result.states;
  }

  async function unfilteredPage(
    git: SimpleGit,
    repo: string,
    offset: number,
    limit: number,
    query: ReflogQuery
  ): Promise<ReflogPage> {
    const result = await readReflog(
      git,
      repo,
      { ref: query.ref, limit, offset },
      { backend: deps.backend, isVerified: deps.isVerified },
      deps.record
    );
    if (result.error !== null) return errorPage(result.error.message);
    const classified = result.entries.map((entry) => {
      const { kind, sub } = classifyReflogMessage(entry.message);
      return { entry, kind, sub };
    });
    const states = await statesFor(git, repo, classified);
    return {
      rows: classified.map((item) => toRow(item, states)),
      state: result.state,
      hasMore: result.hasMore,
      ref: result.ref,
      error: null,
      searchCapped: false
    };
  }

  async function filteredPage(
    git: SimpleGit,
    repo: string,
    offset: number,
    limit: number,
    query: ReflogQuery
  ): Promise<ReflogPage> {
    const fetched: GitReflogEntry[] = [];
    let state: ReflogPage["state"] = null;
    let fullRef: string | null = null;
    let moreFetched = false;
    while (fetched.length < cap) {
      const chunk = Math.min(MAX_REFLOG_PAGE_SIZE, cap - fetched.length);
      const result = await readReflog(
        git,
        repo,
        { ref: query.ref, limit: chunk, offset: fetched.length, grep: query.search },
        { backend: deps.backend, isVerified: deps.isVerified },
        deps.record
      );
      if (result.error !== null) return errorPage(result.error.message);
      if (fetched.length === 0) {
        state = result.state;
        fullRef = result.ref;
      }
      fetched.push(...result.entries);
      moreFetched = result.hasMore;
      if (!result.hasMore || result.entries.length === 0) break;
    }
    const searchCapped = fetched.length >= cap && moreFetched;

    const candidates = fetched
      .map((entry) => {
        const { kind, sub } = classifyReflogMessage(entry.message);
        return { entry, kind, sub };
      })
      .filter((item) => query.actions.length === 0 || query.actions.includes(item.kind));

    // The toggle needs every candidate's state; a page's badges need
    // only the shown slice's, so the state read stays that small.
    let matching = candidates;
    let states: States;
    if (query.onlyInReflog) {
      states = await statesFor(git, repo, candidates);
      matching = candidates.filter((item) => states[item.entry.hash] === "reflogOnly");
      const onlyReflogShown = matching.slice(offset, offset + limit);
      return {
        rows: onlyReflogShown.map((item) => toRow(item, states)),
        state,
        hasMore: matching.length > offset + onlyReflogShown.length,
        ref: fullRef,
        error: null,
        searchCapped
      };
    }
    const shown = matching.slice(offset, offset + limit);
    states = await statesFor(git, repo, shown);
    return {
      rows: shown.map((item) => toRow(item, states)),
      state,
      hasMore: matching.length > offset + shown.length,
      ref: fullRef,
      error: null,
      searchCapped
    };
  }

  return {
    async loadPage(
      repo: string,
      offset: number,
      limit: number = DEFAULT_REFLOG_PAGE_SIZE,
      query: ReflogQuery = defaultReflogQuery()
    ): Promise<ReflogPage> {
      const effective = await effectiveRepo(repo, query);
      if (typeof effective !== "string") return effective;
      const git = deps.createGit(effective);
      return isReflogFiltered(query)
        ? filteredPage(git, effective, offset, limit, query)
        : unfilteredPage(git, effective, offset, limit, query);
    },

    async loadRefs(repo: string): Promise<ReflogRefs> {
      const git = deps.createGit(repo);
      const [refsResult, worktrees] = await Promise.all([
        loadReflogRefs(git, repo, deps.record),
        worktreesOf(repo)
      ]);
      // A failed worktree listing costs only the other HEADs and the
      // bare note; the repository's own refs still pick and read.
      return buildReflogRefs(refsResult.refs, typeof worktrees === "string" ? [] : worktrees);
    },

    async runAction(repo: string, rawAction: ReflogRecoveryAction): Promise<ReflogRecoveryResult> {
      const action = normalizeReflogRecoveryAction(rawAction);
      if (action === null) return { error: "Invalid recovery action." };
      const resolved = await resolveWorktreeRepo(repo, action.worktreePath, false);
      if (resolved.error !== null) return { error: resolved.error };
      const targetRepo = resolved.path;
      const git = deps.createGit(targetRepo);
      const gitBinary = deps.gitPath();
      if (gitBinary !== "") {
        const stateResult = await loadReflogEntryStates(
          git,
          targetRepo,
          [action.commitHash],
          gitBinary,
          deps.record
        );
        if (stateResult.states[action.commitHash] === "missing") {
          return {
            error: "This commit object no longer exists in Git, so it cannot be recovered."
          };
        }
      }
      try {
        await executeRecoveryWrite(git, targetRepo, action);
        return { error: null };
      } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },

    releaseWorktrees(): void {
      const close = deps.closeRepo ?? closeEngineRepository;
      for (const worktree of openedWorktrees) close(worktree);
      openedWorktrees.clear();
    },

    async scanLostCommits(repo: string, signal?: AbortSignal): Promise<ReflogLostCommitsResult> {
      const result = await loadLostCommits({
        repo,
        gitPath: deps.gitPath(),
        record: deps.record,
        signal,
        timeoutMs: deps.lostCommitsTimeoutMs
      });
      return {
        commits: result.commits,
        canceled: result.canceled,
        timedOut: result.timedOut,
        error: result.error?.message ?? null
      };
    },

    async createBranch(
      repo: string,
      commitHash: string,
      branchName: string
    ): Promise<string | null> {
      const trimmed = branchName.trim();
      if (!isValidCommitHash(commitHash)) return "Invalid commit hash.";
      if (!isValidRecoveryBranchName(trimmed)) return "Invalid branch name.";
      try {
        await createGitBranch(
          deps.createGit(repo),
          { repo, commitHash, branchName: trimmed, checkout: false },
          deps.record
        );
        return null;
      } catch (error: unknown) {
        return error instanceof Error ? error.message : String(error);
      }
    }
  };
}
