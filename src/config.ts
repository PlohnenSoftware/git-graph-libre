import * as vscode from "vscode";
import type { DateType } from "./backend/types";
import {
  clampShortHashLength,
  DEFAULT_SHORT_HASH_LENGTH,
  MAX_SHORT_HASH_LENGTH,
  MIN_SHORT_HASH_LENGTH
} from "./backend/utils/string";
import { normalizeContextMenuActionsVisibility } from "./contextMenuVisibility";
import type {
  CommitDetailsFileViewMode,
  ContextMenuActionsVisibility,
  CustomBranchGlobPattern,
  DateFormat,
  GraphStyle,
  TelemetryConsent
} from "./types";

type TabIconColorTheme = "color" | "grey";
const commitDetailsFileViewModes = ["tree", "list"] as const;
const hexGraphColorRegex = /^\s*#[\da-fA-F]{6}([\da-fA-F]{2})?\s*$/;
const rgbGraphColorRegex = /^\s*rgba?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)\s*$/;
const oklchGraphColorRegex = /^\s*oklch\(\s*[\d.]+%\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+)?\s*\)\s*$/;

const DEFAULT_GRAPH_COLORS = [
  "oklch(59% 0.21 245)",
  "oklch(59% 0.21 350)",
  "oklch(59% 0.21 145)",
  "oklch(59% 0.21 70)",
  "oklch(59% 0.21 305)",
  "oklch(59% 0.21 27)",
  "oklch(59% 0.21 190)",
  "oklch(59% 0.21 325)",
  "oklch(59% 0.21 130)",
  "oklch(59% 0.21 45)",
  "oklch(59% 0.21 295)",
  "oklch(59% 0.21 95)"
];
const DEFAULT_REVEAL_HIGHLIGHT_COLOR = "oklch(90% 0.25 150 / 0.42)";

/**
 * Maps whatever is stored for `telemetry.enabled` onto the three states.
 *
 * Anything unrecognized becomes `unset`, never `enabled`: an unreadable
 * setting must leave the question open rather than answer it for the user.
 *
 * The boolean cases read a settings file written against the pre-consent
 * build of this branch, where the key was a plain `true`/`false`. They are
 * honored rather than ignored because someone who wrote `false` has already
 * refused, and treating that as "not asked yet" would resume sending.
 * Removable at any time: the boolean shape never reached a release.
 */
function normalizeTelemetryConsent(raw: unknown): TelemetryConsent {
  if (raw === true) return "enabled";
  if (raw === false) return "disabled";
  if (raw === "enabled" || raw === "disabled" || raw === "unset") return raw;
  return "unset";
}

function getConfig<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration("git-graph-libre").get(key, defaultValue);
}

function getExplicitConfig<T>(key: string): T | undefined {
  const info = vscode.workspace.getConfiguration("git-graph-libre").inspect<T>(key);
  if (info === undefined) return undefined;
  return info.workspaceFolderValue ?? info.workspaceValue ?? info.globalValue;
}

/**
 * Reads a renamed setting while honoring values users still have stored under
 * the legacy British-spelled key. Remove once the legacy keys have been
 * migrated for a few releases.
 */
function getConfigWithLegacy<T>(key: string, legacyKey: string, defaultValue: T): T {
  const value = getExplicitConfig<T>(key);
  if (value !== undefined) return value;
  return getExplicitConfig<T>(legacyKey) ?? defaultValue;
}

function getNumberConfig(key: string, defaultValue: number, min: number, max: number): number {
  const value = getConfig(key, defaultValue);
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultValue;
  return Math.min(max, Math.max(min, value));
}

function getStringUnionConfig<T extends string>(
  key: string,
  defaultValue: T,
  allowedValues: readonly T[]
): T {
  const value = getConfig<string>(key, defaultValue);
  return allowedValues.includes(value as T) ? (value as T) : defaultValue;
}

function isGraphColor(value: string): boolean {
  return (
    hexGraphColorRegex.exec(value) !== null ||
    rgbGraphColorRegex.exec(value) !== null ||
    oklchGraphColorRegex.exec(value) !== null
  );
}

function getColorConfig(key: string, defaultValue: string): string {
  const value = getConfig<unknown>(key, defaultValue);
  return typeof value === "string" && isGraphColor(value) ? value : defaultValue;
}

function customBranchGlobPatterns(): CustomBranchGlobPattern[] {
  const patterns = getConfig<unknown[]>("customBranchGlobPatterns", []);
  if (!Array.isArray(patterns)) return [];

  const validPatterns: CustomBranchGlobPattern[] = [];
  for (const pattern of patterns) {
    if (typeof pattern !== "object" || pattern === null) continue;
    const { name, glob } = pattern as Record<string, unknown>;
    if (typeof name !== "string" || typeof glob !== "string") continue;
    const trimmedName = name.trim();
    const trimmedGlob = glob.trim();
    if (trimmedName === "" || trimmedGlob === "") continue;
    validPatterns.push({ name: trimmedName, glob: `--glob=${trimmedGlob}` });
  }
  return validPatterns;
}

export const config = {
  autoCenterCommitDetailsView: (): boolean => getConfig("autoCenterCommitDetailsView", true),
  commitDetailsCompactFolders: (): boolean => getConfig("commitDetails.compactFolders", false),
  commitDetailsFileViewMode: (): CommitDetailsFileViewMode =>
    getStringUnionConfig("commitDetails.fileViewMode", "tree", commitDetailsFileViewModes),
  contextMenuActionsVisibility: (): ContextMenuActionsVisibility =>
    normalizeContextMenuActionsVisibility(getConfig("contextMenuActionsVisibility", {})),
  dateFormat: (): DateFormat => getConfig("dateFormat", "Date & Time"),
  dateType: (): DateType => getConfig("dateType", "Author Date"),
  showSignatureColumn: (): boolean => getConfig("columns.signature", false),
  fetchAvatars: (): boolean => getConfig("fetchAvatars", false),
  graphColors: (): string[] =>
    getConfigWithLegacy("graphColors", "graphColours", DEFAULT_GRAPH_COLORS).filter(isGraphColor),
  customBranchGlobPatterns,
  graphStyle: (): GraphStyle => getConfig("graphStyle", "rounded"),
  graphFontSize: (): number => getNumberConfig("graph.fontSize", 13, 8, 24),
  graphRowHeight: (): number => getNumberConfig("graph.rowHeight", 24, 18, 48),
  revealHighlightColor: (): string =>
    getColorConfig("revealHighlightColor", DEFAULT_REVEAL_HIGHLIGHT_COLOR),
  shortHashLength: (): number =>
    clampShortHashLength(
      getNumberConfig(
        "shortHashLength",
        DEFAULT_SHORT_HASH_LENGTH,
        MIN_SHORT_HASH_LENGTH,
        MAX_SHORT_HASH_LENGTH
      )
    ),
  initialLoadCommits: (): number => getConfig("initialLoadCommits", 300),
  includeReflog: (): boolean => getConfig("repository.includeReflog", false),
  includeUnreachableCommits: (): boolean =>
    getConfig("repository.includeUnreachableCommits", false),
  loadMoreCommits: (): number => getConfig("loadMoreCommits", 75),
  maxDepthOfRepoSearch: (): number => getConfig("maxDepthOfRepoSearch", 0),
  muteCommitsNotAncestorsOfHead: (): boolean =>
    getConfig("repository.muteCommitsNotAncestorsOfHead", false),
  muteMergeCommits: (): boolean => getConfig("repository.muteMergeCommits", false),
  boldCheckedOutCommit: (): boolean => getConfig("repository.boldCheckedOutCommit", false),
  fetchTagsByDefault: (): boolean => getConfig("repository.fetchTagsByDefault", true),
  mergeNoFastForward: (): boolean => getConfig("dialog.merge.noFastForward", true),
  pullBranchNoFastForward: (): boolean => getConfig("dialog.pullBranch.noFastForward", false),
  onlyFollowFirstParent: (): boolean => getConfig("repository.onlyFollowFirstParent", false),
  showCurrentBranchByDefault: (): boolean => getConfig("showCurrentBranchByDefault", false),
  showRemoteBranches: (): boolean => getConfig("repository.showRemoteBranches", true),
  showStatusBarItem: (): boolean => getConfig("showStatusBarItem", true),
  showStashes: (): boolean => getConfig("repository.showStashes", true),
  showTags: (): boolean => getConfig("repository.showTags", true),
  showUncommittedChanges: (): boolean => getConfig("showUncommittedChanges", true),
  telemetryConsent: (): TelemetryConsent =>
    normalizeTelemetryConsent(getConfig<unknown>("telemetry.enabled", "unset")),
  tabIconColorTheme: (): TabIconColorTheme => {
    const value = getConfigWithLegacy<string>("tabIconColorTheme", "tabIconColourTheme", "color");
    return value === "grey" ? "grey" : "color";
  },
  gitPath: (): string => vscode.workspace.getConfiguration("git").get("path", null) ?? "git"
};

export type Config = typeof config;
