import type { SimpleGit } from "simple-git";

import { loadBlame } from "@/backend/queries/blame";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { type BlameHotspotMode, scoreBlameHunks } from "@/blameHotspot";
import type { BlameLoadOptions, BlamePayload, BlameSource } from "@/blameTabTypes";
import { isBareCommonDir } from "../repoLayout";

export type BlameSourceDeps = {
  /** A Git instance rooted at the repository being read. */
  createGit: (repo: string) => SimpleGit;
  /**
   * The resolved Git binary (`config.gitPath()`), read live per load. The
   * blame query needs it only for an unsaved buffer, which F4-03 never
   * sends, but the request carries it the way F4-01 names it (`binary`).
   */
  gitPath: () => string;
  record?: GitCommandRecorder;
  /**
   * The heat mode every load is scored with; `age` (file-relative
   * rank-quantile recency) unless a test says otherwise. F4-04 draws the
   * levels; F4-03 only carries them as `data-heat` hooks.
   */
  mode?: BlameHotspotMode;
  /** The clock the calendar mode ages against; the current time unless a test pins it. */
  nowSeconds?: () => number;
};

/**
 * The Blame tab's data source: one CLI blame read (F4-01) per call, its
 * hunks scored for heat (F4-02) before they cross to the webview. Every
 * F4-01 state passes through unchanged — `binary`, `tooLarge`,
 * `untracked` and `unborn` stay distinct from an error — and a failure
 * keeps Git's own message, never an empty blame.
 */
export function createBlameSource(deps: BlameSourceDeps): BlameSource {
  const mode: BlameHotspotMode = deps.mode ?? "age";
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  return {
    async load(
      repo: string,
      filePath: string,
      rev: string | null,
      options?: BlameLoadOptions
    ): Promise<BlamePayload> {
      // A bare repository has no working tree; show a localized notice instead
      // of a raw Git error, while revision blames (Commit Details) run normally.
      if (rev === null && options?.contents === undefined && isBareCommonDir(repo)) {
        return {
          state: "bareWorkingTree",
          commits: {},
          hunks: [],
          resolvedRev: null,
          totalLines: 0,
          error: null
        };
      }
      const result = await loadBlame(
        deps.createGit(repo),
        repo,
        {
          filePath,
          rev,
          ...(options?.contents !== undefined ? { contents: options.contents } : {}),
          binary: deps.gitPath()
        },
        deps.record
      );
      if (result.error !== null) {
        return {
          state: null,
          commits: {},
          hunks: [],
          resolvedRev: null,
          totalLines: 0,
          error: result.error.message
        };
      }
      const heats = scoreBlameHunks(result.hunks, result.commits, mode, nowSeconds());
      return {
        state: result.state,
        commits: result.commits,
        hunks: result.hunks.map((hunk, index) => ({
          ...hunk,
          heat: heats[index] ?? {
            level: null,
            uncommitted: true,
            commitHunkCount: 0,
            commitLineCount: 0
          }
        })),
        resolvedRev: result.resolvedRev,
        totalLines: result.totalLines,
        error: null
      };
    }
  };
}
