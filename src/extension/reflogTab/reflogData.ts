import type { SimpleGit } from "simple-git";

import { readReflog } from "@/backend/engine/reflog";
import {
  classifyReflogMessage,
  DEFAULT_REFLOG_PAGE_SIZE,
  loadReflogEntryStates,
  loadReflogRefs,
  MAX_REFLOG_PAGE_SIZE
} from "@/backend/queries/reflog";
import type { GitReflogEntry, GitReflogEntryState } from "@/backend/types";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import {
  defaultReflogQuery,
  isReflogFiltered,
  REFLOG_SEARCH_CAP,
  type ReflogPage,
  type ReflogQuery,
  type ReflogRow,
  type ReflogSource
} from "@/reflogTabTypes";
import type { EngineBackend } from "@/types";

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
};

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
 */
export function createReflogSource(deps: ReflogSourceDeps): ReflogSource {
  const cap =
    deps.searchCap !== undefined && Number.isInteger(deps.searchCap) && deps.searchCap >= 1
      ? deps.searchCap
      : REFLOG_SEARCH_CAP;

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
      const shown = matching.slice(offset, offset + limit);
      return {
        rows: shown.map((item) => toRow(item, states)),
        state,
        hasMore: matching.length > offset + shown.length,
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
      const git = deps.createGit(repo);
      return isReflogFiltered(query)
        ? filteredPage(git, repo, offset, limit, query)
        : unfilteredPage(git, repo, offset, limit, query);
    },

    async loadRefs(repo: string): Promise<string[]> {
      const result = await loadReflogRefs(deps.createGit(repo), repo, deps.record);
      return result.refs;
    }
  };
}
