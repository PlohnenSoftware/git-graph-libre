import type { SimpleGit } from "simple-git";

import {
  classifyReflogMessage,
  DEFAULT_REFLOG_PAGE_SIZE,
  loadReflog,
  loadReflogEntryStates
} from "@/backend/queries/reflog";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import type { ReflogPage, ReflogRow, ReflogSource } from "@/reflogTabTypes";

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
};

/**
 * The Reflog tab's data source: one page of the `HEAD` reflog per call
 * (F1-05 adds the ref picker), classified for its action columns and joined
 * with the F1-02 entry states for its badges. A failed state read never
 * errors the page — its rows simply carry no state, as F1-02 designed.
 */
export function createReflogSource(deps: ReflogSourceDeps): ReflogSource {
  return {
    async loadPage(
      repo: string,
      offset: number,
      limit: number = DEFAULT_REFLOG_PAGE_SIZE
    ): Promise<ReflogPage> {
      const git = deps.createGit(repo);
      const result = await loadReflog(git, repo, { ref: "HEAD", limit, offset }, deps.record);
      if (result.error !== null) {
        return {
          rows: [],
          state: null,
          hasMore: false,
          ref: null,
          error: result.error.message
        };
      }
      const states = await loadReflogEntryStates(
        git,
        repo,
        result.entries.map((entry) => entry.hash),
        deps.gitPath(),
        deps.record
      );
      const rows: ReflogRow[] = result.entries.map((entry) => {
        const classified = classifyReflogMessage(entry.message);
        return {
          hash: entry.hash,
          index: entry.index,
          time: entry.time,
          kind: classified.kind,
          sub: classified.sub,
          message: entry.message,
          // An absent hash is unknown (the state read failed, or the object
          // is not a commit): no badge for it, exactly as `reachable`.
          state: states.states[entry.hash] ?? null
        };
      });
      return { rows, state: result.state, hasMore: result.hasMore, ref: result.ref, error: null };
    }
  };
}
