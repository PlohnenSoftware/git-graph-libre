import { readActivityHeatmap, readAuthorStats, type StatsDeps } from "@/backend/engine/stats";
import type { StatsLoadResult, StatsSource } from "@/statsTabTypes";

/**
 * The Statistics tab's data source (F3-02): F3-01's two engine reads,
 * run together (TQ6: no cap on either). The tab needs both halves, so
 * the first unavailable reason — authors first — is the load's answer,
 * and nothing falls back to the CLI (TQ2). The reads never throw, so
 * neither does this.
 *
 * Deps are F3-01's `StatsDeps`, read live per load: the `backend`
 * setting (absent means the engine is never consulted) and whether Git
 * confirmed the repository (`isVerified`, absent means never).
 */
export function createStatsSource(deps: StatsDeps = {}): StatsSource {
  return {
    async load(repo: string): Promise<StatsLoadResult> {
      const [authors, cells] = await Promise.all([
        readAuthorStats(repo, deps),
        readActivityHeatmap(repo, deps)
      ]);
      if (authors.state === "unavailable") return authors;
      if (cells.state === "unavailable") return cells;
      return { state: "ok", authors: authors.value, cells: cells.value };
    }
  };
}
