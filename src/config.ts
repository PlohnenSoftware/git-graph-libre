import * as vscode from "vscode";
import type { DateType } from "./backend/types";
import {
  clampShortHashLength,
  DEFAULT_SHORT_HASH_LENGTH,
  MAX_SHORT_HASH_LENGTH,
  MIN_SHORT_HASH_LENGTH
} from "./backend/utils/string";
import type {
  CommitDetailsFileViewMode,
  CustomBranchGlobPattern,
  DateFormat,
  GraphStyle
} from "./types";

type TabIconColorTheme = "color" | "grey";
const commitDetailsFileViewModes = ["tree", "list"] as const;
const hexGraphColorRegex = /^\s*#[\da-fA-F]{6}([\da-fA-F]{2})?\s*$/;
const rgbGraphColorRegex = /^\s*rgba?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)\s*$/;
const oklchGraphColorRegex = /^\s*oklch\(\s*[\d.]+%\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+)?\s*\)\s*$/;

const DEFAULT_GRAPH_COLORS = [
  "oklch(63% 0.2 245)",
  "oklch(63% 0.2 350)",
  "oklch(63% 0.2 145)",
  "oklch(63% 0.2 70)",
  "oklch(63% 0.2 305)",
  "oklch(63% 0.2 27)",
  "oklch(63% 0.2 190)",
  "oklch(63% 0.2 325)",
  "oklch(63% 0.2 130)",
  "oklch(63% 0.2 45)",
  "oklch(63% 0.2 295)",
  "oklch(63% 0.2 95)"
];

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
  dateFormat: (): DateFormat => getConfig("dateFormat", "Date & Time"),
  dateType: (): DateType => getConfig("dateType", "Author Date"),
  fetchAvatars: (): boolean => getConfig("fetchAvatars", false),
  graphColors: (): string[] =>
    getConfigWithLegacy("graphColors", "graphColours", DEFAULT_GRAPH_COLORS).filter(isGraphColor),
  customBranchGlobPatterns,
  graphStyle: (): GraphStyle => getConfig("graphStyle", "rounded"),
  graphFontSize: (): number => getNumberConfig("graph.fontSize", 13, 8, 24),
  graphRowHeight: (): number => getNumberConfig("graph.rowHeight", 24, 18, 48),
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
  loadMoreCommits: (): number => getConfig("loadMoreCommits", 75),
  maxDepthOfRepoSearch: (): number => getConfig("maxDepthOfRepoSearch", 0),
  onlyFollowFirstParent: (): boolean => getConfig("repository.onlyFollowFirstParent", false),
  showCurrentBranchByDefault: (): boolean => getConfig("showCurrentBranchByDefault", false),
  showRemoteBranches: (): boolean => getConfig("repository.showRemoteBranches", true),
  showStatusBarItem: (): boolean => getConfig("showStatusBarItem", true),
  showStashes: (): boolean => getConfig("repository.showStashes", true),
  showTags: (): boolean => getConfig("repository.showTags", true),
  showUncommittedChanges: (): boolean => getConfig("showUncommittedChanges", true),
  tabIconColorTheme: (): TabIconColorTheme => {
    const value = getConfigWithLegacy<string>("tabIconColorTheme", "tabIconColourTheme", "color");
    return value === "grey" ? "grey" : "color";
  },
  gitPath: (): string => vscode.workspace.getConfiguration("git").get("path", null) ?? "git"
};

export type Config = typeof config;
