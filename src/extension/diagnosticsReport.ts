/**
 * The diagnostics report: the facts a bug report needs, as Markdown shaped
 * like `.github/ISSUE_TEMPLATE/bug_report.md`.
 *
 * Deliberately free of `vscode`, like `componentStatus.ts`: the caller reads
 * the host facts and passes them in, so the backend test project can drive
 * every branch. The report is English on purpose, because it is pasted into
 * a GitHub issue.
 *
 * Privacy, in the same spirit as telemetry: setting *names* only, never
 * values; config files by existence only; environment variables by name
 * only; URL credentials redacted with the Git runner's own `redactText`; and
 * a folder-names-only mode that also strips repository and home paths from
 * the log tail. Nothing here sends anything anywhere.
 */

import * as os from "node:os";
import { simpleGit } from "simple-git";
import { isFile, resolveGlobalGitConfigPath } from "@/backend/utils/gitConfigPaths";
import { redactText, runGitRaw } from "@/backend/utils/gitRunner";
import { reducePlatformVersion } from "@/telemetry/commonProperties";
import type {
  EngineBackend,
  EngineComponentStatus,
  GitComponentStatus,
  GraphLoadRoute
} from "@/types";

export const UNKNOWN = "(unknown)";

/** Log lines the report carries, as the issue asks. */
export const REPORT_LOG_LINES = 200;
/** Repositories listed before the rest are only counted. */
const MAX_LISTED_REPOS = 25;

export type RemoteFact = { name: string; url: string };

export type RepoFact = {
  path: string;
  /** Null when `git remote -v` could not be read. */
  remotes: RemoteFact[] | null;
};

/** Every field optional: a fact that is missing reads `(unknown)`. */
export type DiagnosticsFacts = {
  extensionVersion?: string;
  hostVersion?: string;
  appName?: string;
  platform?: string;
  arch?: string;
  osRelease?: string;
  homeDir?: string;
  backend?: EngineBackend;
  git?: GitComponentStatus | null;
  engine?: EngineComponentStatus | null;
  graphLoad?: GraphLoadRoute | null;
  /** Names of `git-graph-libre.*` settings the user changed; never their values. */
  changedSettings?: string[];
  repos?: RepoFact[];
  globalConfigPresent?: boolean | null;
  gitConfigGlobalSet?: boolean;
  gitConfigNosystemSet?: boolean;
  workspaceTrusted?: boolean;
  logLines?: string[];
};

export type PathMode = "full" | "folderNames";

export type ReportOptions = {
  pathMode: PathMode;
  /** Prepend the bug template's headings, for a prefilled GitHub issue. */
  issueSkeleton?: boolean;
  /** Default true. False replaces the log tail with one line saying why it is missing. */
  includeLogTail?: boolean;
};

function text(value: string | undefined): string {
  return value === undefined || value === "" ? UNKNOWN : value;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === undefined || value === null) return UNKNOWN;
  return value ? "yes" : "no";
}

function baseName(repoPath: string): string {
  const parts = repoPath.split(/[\\/]/).filter((part) => part !== "");
  return parts.at(-1) ?? repoPath;
}

/** Credentials out of a remote URL, and a query string, where tokens also travel. */
export function redactRemoteUrl(url: string): string {
  const redacted = redactText(url);
  const queryStart = redacted.indexOf("?");
  return queryStart === -1 ? redacted : `${redacted.slice(0, queryStart)}?<redacted>`;
}

function describeEngine(engine: EngineComponentStatus | null | undefined): string[] {
  if (engine === undefined || engine === null) return [`- State: ${UNKNOWN}`];
  switch (engine.state) {
    case "active":
      return [`- State: active`, `- Version: ${engine.version}`, `- Platform: ${engine.platform}`];
    case "off":
      return ["- State: off (the backend setting is git-cli)"];
    case "unavailable":
      return [
        "- State: unavailable",
        `- Reason: ${engine.reason}`,
        `- Platform: ${engine.platform}`,
        `- Detail: ${text(engine.detail ?? undefined)}`
      ];
  }
}

function describeGit(git: GitComponentStatus | null | undefined): string[] {
  if (git === undefined || git === null) return [`- Path: ${UNKNOWN}`, `- Version: ${UNKNOWN}`];
  if (git.state === "ok") return [`- Path: ${git.path}`, `- Version: ${git.version}`];
  return [`- Path: ${git.path}`, `- Version: unavailable (${git.detail})`];
}

function environmentSection(facts: DiagnosticsFacts): string[] {
  const osVersion = reducePlatformVersion(facts.osRelease ?? "");
  const system = [facts.platform, facts.arch, osVersion].filter(Boolean).join(" ");
  return [
    "## Environment",
    "",
    `- VS Code version: ${text(facts.hostVersion)} (${text(facts.appName)})`,
    `- Extension version: ${text(facts.extensionVersion)}`,
    `- OS: ${text(system)}`
  ];
}

function backendSection(facts: DiagnosticsFacts): string[] {
  return [
    "## Backend",
    "",
    `- Backend setting: ${text(facts.backend)}`,
    `- Last graph load: ${text(facts.graphLoad ?? undefined)}`,
    "",
    "### Rust engine",
    "",
    ...describeEngine(facts.engine)
  ];
}

function changedSettingLines(facts: DiagnosticsFacts): string[] {
  const names = facts.changedSettings;
  if (names === undefined) return [UNKNOWN];
  if (names.length === 0) return ["(none: every setting is at its default)"];
  return names.toSorted((a, b) => a.localeCompare(b)).map((name) => `- ${name}`);
}

function settingsSection(facts: DiagnosticsFacts): string[] {
  return ["## Changed settings (names only, never values)", "", ...changedSettingLines(facts)];
}

function describeRepo(repo: RepoFact, options: ReportOptions): string[] {
  const label = options.pathMode === "full" ? repo.path : baseName(repo.path);
  const lines = [`- ${label}`];
  if (repo.remotes === null) return [...lines, `  - Remotes: ${UNKNOWN}`];
  if (repo.remotes.length === 0) return [...lines, "  - Remotes: none"];
  for (const remote of repo.remotes) {
    lines.push(`  - Remote \`${remote.name}\`: ${redactRemoteUrl(remote.url)}`);
  }
  return lines;
}

function repositoriesSection(facts: DiagnosticsFacts, options: ReportOptions): string[] {
  const repos = facts.repos;
  if (repos === undefined) return ["## Repositories", "", UNKNOWN];
  const lines = ["## Repositories", "", `Count: ${repos.length}`];
  if (options.pathMode === "full") {
    lines.push("", "Repository paths are included. Edit them out before sharing if needed.");
  } else {
    lines.push("", "Repository paths are reduced to folder names.");
  }
  lines.push("");
  for (const repo of repos.slice(0, MAX_LISTED_REPOS)) lines.push(...describeRepo(repo, options));
  if (repos.length > MAX_LISTED_REPOS) {
    lines.push(`- ... and ${repos.length - MAX_LISTED_REPOS} more`);
  }
  return lines;
}

function gitEnvironmentSection(facts: DiagnosticsFacts): string[] {
  return [
    "## Git environment (existence only, never contents)",
    "",
    `- Global Git config file present: ${yesNo(facts.globalConfigPresent)}`,
    `- GIT_CONFIG_GLOBAL set: ${yesNo(facts.gitConfigGlobalSet)}`,
    `- GIT_CONFIG_NOSYSTEM set: ${yesNo(facts.gitConfigNosystemSet)}`,
    `- Workspace trusted: ${yesNo(facts.workspaceTrusted)}`
  ];
}

const RESULT_COMMAND = /\[result\] .*?command=(\w+)/;

/** The newest `[result]` line per command, oldest command first. */
export function lastResultLines(logLines: readonly string[]): string[] {
  const latest = new Map<string, string>();
  for (const line of logLines) {
    const command = RESULT_COMMAND.exec(line)?.[1];
    if (command === undefined) continue;
    latest.delete(command);
    latest.set(command, line);
  }
  return [...latest.values()];
}

/**
 * Folder-names-only mode for free text: each repository path becomes its
 * folder name (longest path first, so a nested repository wins), then the
 * home directory becomes `~`.
 */
export function anonymizePaths(
  value: string,
  repoPaths: readonly string[],
  homeDir: string | undefined
): string {
  let output = value;
  for (const repoPath of repoPaths.toSorted((a, b) => b.length - a.length)) {
    if (repoPath !== "") output = output.replaceAll(repoPath, baseName(repoPath));
  }
  return homeDir === undefined || homeDir === "" ? output : output.replaceAll(homeDir, "~");
}

function prepareLines(
  lines: readonly string[],
  facts: DiagnosticsFacts,
  options: ReportOptions
): string[] {
  const repoPaths = (facts.repos ?? []).map((repo) => repo.path);
  return lines.map((line) => {
    const redacted = redactText(line);
    return options.pathMode === "full"
      ? redacted
      : anonymizePaths(redacted, repoPaths, facts.homeDir);
  });
}

function resultsSection(facts: DiagnosticsFacts, options: ReportOptions): string[] {
  const results = lastResultLines(facts.logLines ?? []);
  const body = results.length === 0 ? [UNKNOWN] : prepareLines(results, facts, options);
  return ["## Last read results", "", "```", ...body, "```"];
}

function logSection(facts: DiagnosticsFacts, options: ReportOptions): string[] {
  if (options.includeLogTail === false) {
    return [
      "_The recent log was left out to fit the link. Add it with the Copy Recent Log command._"
    ];
  }
  const tail = (facts.logLines ?? []).slice(-REPORT_LOG_LINES);
  const body = tail.length === 0 ? [UNKNOWN] : prepareLines(tail, facts, options);
  return [
    "<details>",
    `<summary>Recent log (last ${REPORT_LOG_LINES} lines)</summary>`,
    "",
    "```",
    ...body,
    "```",
    "",
    "</details>"
  ];
}

const ISSUE_SKELETON = [
  "**Describe the bug**",
  "",
  "<!-- A clear and concise description of what the bug is -->",
  "",
  "**Steps to reproduce**",
  "",
  "1.",
  "2.",
  "3.",
  "",
  "**Expected behavior**",
  "",
  "**Actual behavior**",
  "",
  "**Diagnostics report**",
  ""
];

function describeSection(title: string, lines: string[]): string[] {
  return [`## ${title}`, "", ...lines];
}

export function buildDiagnosticsReport(facts: DiagnosticsFacts, options: ReportOptions): string {
  const sections = [
    environmentSection(facts),
    describeSection("Git", describeGit(facts.git)),
    backendSection(facts),
    settingsSection(facts),
    repositoriesSection(facts, options),
    gitEnvironmentSection(facts),
    resultsSection(facts, options),
    logSection(facts, options)
  ];
  const body = sections.map((section) => section.join("\n")).join("\n\n");
  const head = options.issueSkeleton === true ? `${ISSUE_SKELETON.join("\n")}\n` : "";
  return `${head}${body}\n`;
}

/** The repository's new-issue page; the body is the only thing the report adds. */
export const NEW_ISSUE_URL = "https://github.com/PlohnenSoftware/git-graph-libre/issues/new";

/**
 * Browsers and GitHub reject very long URLs; above this the report goes to
 * the clipboard instead.
 */
export const MAX_ISSUE_URL_LENGTH = 6000;

/** The prefilled new-issue URL, or null when it would be too long to open safely. */
export function buildNewIssueUrl(
  body: string,
  maxLength: number = MAX_ISSUE_URL_LENGTH
): string | null {
  const url = `${NEW_ISSUE_URL}?labels=bug&body=${encodeURIComponent(body)}`;
  return url.length > maxLength ? null : url;
}

const REMOTE_LINE = /^(\S+)\t(.+?) \((?:fetch|push)\)$/;

/** `name<TAB>url (fetch|push)` lines of `git remote -v`, one entry per name and URL. */
export function parseRemoteList(output: string): RemoteFact[] {
  const seen = new Set<string>();
  const remotes: RemoteFact[] = [];
  for (const line of output.split("\n")) {
    const match = REMOTE_LINE.exec(line);
    if (match === null) continue;
    const key = `${match[1]}\t${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    remotes.push({ name: match[1], url: match[2] });
  }
  return remotes;
}

/** `git remote -v` for one repository; null when Git cannot answer. */
export async function readRepoRemotes(repo: string, gitPath: string): Promise<RemoteFact[] | null> {
  try {
    const output = await runGitRaw(
      simpleGit({ baseDir: repo, binary: gitPath, maxConcurrentProcesses: 1, trimmed: false }),
      { label: "diagnostics-remotes", repo, args: ["remote", "-v"] }
    );
    return parseRemoteList(output);
  } catch {
    return null;
  }
}

export type ProcessFacts = Pick<
  DiagnosticsFacts,
  | "platform"
  | "arch"
  | "osRelease"
  | "homeDir"
  | "globalConfigPresent"
  | "gitConfigGlobalSet"
  | "gitConfigNosystemSet"
>;

/**
 * What the process itself can answer: OS, home directory, whether the global
 * Git config exists (never read), and which Git variables are set, by name.
 */
export function readProcessFacts(): ProcessFacts {
  const globalConfigPath = resolveGlobalGitConfigPath();
  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    homeDir: os.homedir(),
    globalConfigPresent: globalConfigPath === null ? null : isFile(globalConfigPath),
    gitConfigGlobalSet: process.env.GIT_CONFIG_GLOBAL !== undefined,
    gitConfigNosystemSet: process.env.GIT_CONFIG_NOSYSTEM !== undefined
  };
}
