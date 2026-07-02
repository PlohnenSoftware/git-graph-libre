import * as vscode from "vscode";

import {
  DEFAULT_SHORT_HASH_LENGTH,
  MAX_SHORT_HASH_LENGTH,
  MIN_SHORT_HASH_LENGTH,
  clampShortHashLength
} from "./backend/utils/string";
import type { DateType } from "./backend/types";
import type { CommitDetailsFileViewMode, DateFormat, GraphStyle } from "./types";

type TabIconColourTheme = "colour" | "grey";
const commitDetailsFileViewModes = ["tree", "list"] as const;
const hexGraphColourRegex = /^\s*#[\da-fA-F]{6}([\da-fA-F]{2})?\s*$/;
const rgbGraphColourRegex = /^\s*rgba?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)\s*$/;

function getConfig<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration("git-graph-libre").get(key, defaultValue);
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

function isGraphColour(value: string): boolean {
  return hexGraphColourRegex.exec(value) !== null || rgbGraphColourRegex.exec(value) !== null;
}

export const config = {
  autoCenterCommitDetailsView: (): boolean => getConfig("autoCenterCommitDetailsView", true),
  commitDetailsCompactFolders: (): boolean => getConfig("commitDetails.compactFolders", false),
  commitDetailsFileViewMode: (): CommitDetailsFileViewMode =>
    getStringUnionConfig("commitDetails.fileViewMode", "tree", commitDetailsFileViewModes),
  dateFormat: (): DateFormat => getConfig("dateFormat", "Date & Time"),
  dateType: (): DateType => getConfig("dateType", "Author Date"),
  fetchAvatars: (): boolean => getConfig("fetchAvatars", false),
  graphColours: (): string[] =>
    getConfig("graphColours", [
      "#0085d9",
      "#d9008f",
      "#00d90a",
      "#d98500",
      "#a300d9",
      "#ff0000"
    ]).filter(isGraphColour),
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
  loadMoreCommits: (): number => getConfig("loadMoreCommits", 75),
  maxDepthOfRepoSearch: (): number => getConfig("maxDepthOfRepoSearch", 0),
  showCurrentBranchByDefault: (): boolean => getConfig("showCurrentBranchByDefault", false),
  showStatusBarItem: (): boolean => getConfig("showStatusBarItem", true),
  showUncommittedChanges: (): boolean => getConfig("showUncommittedChanges", true),
  tabIconColourTheme: (): TabIconColourTheme => getConfig("tabIconColourTheme", "colour"),
  gitPath: (): string => vscode.workspace.getConfiguration("git").get("path", null) ?? "git"
};

export type Config = typeof config;
