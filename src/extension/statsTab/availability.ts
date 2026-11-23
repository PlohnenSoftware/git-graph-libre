/**
 * Whether the Statistics tab can be offered at all (history and statistics
 * slice F3-03). The tab is engine-only (register TQ2, KB 170): it is hidden
 * when the engine cannot serve its two reads, and never falls back to a
 * CLI-computed view. The `git-graph-libre.statsTabAvailable` context key
 * mirrors the GGL Diff tab's `diffTabAvailable` key (D45).
 */

import * as vscode from "vscode";

import { type EngineAddon, loadEngineAddon } from "@/backend/engine/addon";
import type { EngineBackend } from "@/types";

/** The context key the Statistics command and its menu entries show on. */
export const STATS_TAB_AVAILABLE_CONTEXT = "git-graph-libre.statsTabAvailable";

export type StatsTabAvailabilityDeps = {
  /** Read live, so flipping the backend setting needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => Pick<EngineAddon, "authorStats" | "activityHeatmap"> | null;
};

/**
 * Whether the backend setting allows the engine and the loaded addon exports
 * both statistics reads (F3-01's shape). The addon is not loaded on the
 * `git-cli` backend.
 */
export function isStatsTabAvailable(deps: StatsTabAvailabilityDeps = {}): boolean {
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return false;
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  return typeof addon?.authorStats === "function" && typeof addon?.activityHeatmap === "function";
}

/** Publish `isStatsTabAvailable` as the context key and return it. */
export function setStatsTabAvailableContext(deps: StatsTabAvailabilityDeps = {}): boolean {
  const available = isStatsTabAvailable(deps);
  void vscode.commands.executeCommand("setContext", STATS_TAB_AVAILABLE_CONTEXT, available);
  return available;
}
