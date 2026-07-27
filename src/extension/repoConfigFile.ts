import * as fs from "node:fs/promises";
import * as path from "node:path";

import type {
  GitRepoState,
  IssueLinkingConfig,
  PullRequestCreationConfig,
  RepoBooleanOverride
} from "@/types";

export const REPO_CONFIG_RELATIVE_PATH = ".vscode/git-graph-libre.json";

type ExportedRepoConfig = {
  version: 1;
  exportedAt: string;
  repoState: Partial<GitRepoState>;
};

const repoBooleanOverrides = new Set<RepoBooleanOverride>(["default", "enabled", "disabled"]);
const exportableKeys = [
  "columnWidths",
  "commitOrdering",
  "displayName",
  "hiddenRemotes",
  "includeReflog",
  "includeUnreachableCommits",
  "issueLinking",
  "onlyFollowFirstParent",
  "pullRequest",
  "showRemoteBranches",
  "showStashes",
  "showTags"
] as const satisfies readonly (keyof GitRepoState)[];

export function getRepoConfigFilePath(repo: string) {
  const repoRoot = path.resolve(repo);
  const configPath = path.resolve(repoRoot, REPO_CONFIG_RELATIVE_PATH);
  const relativePath = path.relative(repoRoot, configPath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Repository configuration path resolved outside the repository.");
  }
  return configPath;
}

export async function exportRepoConfigFile(repo: string, state: GitRepoState) {
  const configPath = getRepoConfigFilePath(repo);
  const payload: ExportedRepoConfig = {
    version: 1,
    exportedAt: new Date().toISOString(),
    repoState: exportedRepoState(state)
  };

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(payload, null, 4)}\n`, "utf8");
  return configPath;
}

export async function importRepoConfigFile(repo: string, currentState: GitRepoState) {
  const configPath = getRepoConfigFilePath(repo);
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const imported = parseExportedRepoConfig(parsed);
  return {
    ...currentState,
    ...imported,
    lastConfigImportAt: Date.now()
  } satisfies GitRepoState;
}

export function parseExportedRepoConfig(value: unknown): Partial<GitRepoState> {
  if (!isRecord(value)) return {};
  if (value.version !== 1) return {};
  const repoState = isRecord(value.repoState) ? value.repoState : value;
  return sanitizeRepoState(repoState);
}

function exportedRepoState(state: GitRepoState): Partial<GitRepoState> {
  const exported: Partial<GitRepoState> = {};
  for (const key of exportableKeys) {
    const value = state[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    exported[key] = value as never;
  }
  return exported;
}

function sanitizeRepoState(value: Record<string, unknown>): Partial<GitRepoState> {
  const state: Partial<GitRepoState> = {};
  if (isColumnWidths(value.columnWidths)) state.columnWidths = value.columnWidths;
  if (isCommitOrdering(value.commitOrdering)) state.commitOrdering = value.commitOrdering;
  if (typeof value.displayName === "string" || value.displayName === null) {
    state.displayName = normalizeNullableString(value.displayName);
  }
  if (isStringArray(value.hiddenRemotes)) state.hiddenRemotes = uniqueNonEmpty(value.hiddenRemotes);
  if (isRepoBooleanOverride(value.includeReflog)) state.includeReflog = value.includeReflog;
  if (isRepoBooleanOverride(value.includeUnreachableCommits)) {
    state.includeUnreachableCommits = value.includeUnreachableCommits;
  }
  if (isIssueLinkingConfig(value.issueLinking) || value.issueLinking === null) {
    state.issueLinking = value.issueLinking;
  }
  if (isRepoBooleanOverride(value.onlyFollowFirstParent)) {
    state.onlyFollowFirstParent = value.onlyFollowFirstParent;
  }
  if (isPullRequestCreationConfig(value.pullRequest) || value.pullRequest === null) {
    state.pullRequest = value.pullRequest;
  }
  if (isRepoBooleanOverride(value.showRemoteBranches)) {
    state.showRemoteBranches = value.showRemoteBranches;
  }
  if (isRepoBooleanOverride(value.showStashes)) state.showStashes = value.showStashes;
  if (isRepoBooleanOverride(value.showTags)) state.showTags = value.showTags;
  return state;
}

function normalizeNullableString(value: string | null) {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value !== ""))];
}

function isColumnWidths(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item) && item > 0)
  );
}

function isCommitOrdering(value: unknown): value is GitRepoState["commitOrdering"] {
  return value === "date" || value === "author-date" || value === "topo";
}

function isRepoBooleanOverride(value: unknown): value is RepoBooleanOverride {
  return repoBooleanOverrides.has(value as RepoBooleanOverride);
}

function isIssueLinkingConfig(value: unknown): value is IssueLinkingConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.pattern === "string" &&
    value.pattern.trim() !== "" &&
    typeof value.urlTemplate === "string" &&
    value.urlTemplate.trim() !== ""
  );
}

function isPullRequestCreationConfig(value: unknown): value is PullRequestCreationConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.remoteName === "string" &&
    value.remoteName.trim() !== "" &&
    typeof value.baseBranch === "string" &&
    value.baseBranch.trim() !== "" &&
    typeof value.urlTemplate === "string" &&
    value.urlTemplate.trim() !== "" &&
    typeof value.pushBeforeCreate === "boolean"
  );
}
