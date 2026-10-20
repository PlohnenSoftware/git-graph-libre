import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  anonymizePaths,
  buildDiagnosticsReport,
  buildNewIssueUrl,
  type DiagnosticsFacts,
  lastResultLines,
  MAX_ISSUE_URL_LENGTH,
  parseRemoteList,
  REPORT_LOG_LINES,
  readProcessFacts,
  readRepoRemotes,
  redactRemoteUrl,
  UNKNOWN
} from "@/extension/diagnosticsReport";
import { git, makeRepo } from "../helpers";

const TOKEN = "ghp_SECRETTOKEN0123456789";

const FULL: DiagnosticsFacts = {
  extensionVersion: "1.9.0",
  hostVersion: "1.98.0",
  appName: "VSCodium",
  platform: "linux",
  arch: "x64",
  osRelease: "6.8.0-45-generic",
  homeDir: "/home/alice",
  backend: "auto",
  git: { state: "ok", path: "/usr/bin/git", version: "git version 2.51.0" },
  engine: { state: "active", version: "1.0.25", platform: "linux-x64" },
  graphLoad: "engine",
  changedSettings: ["git-graph-libre.backend", "git-graph-libre.graphColors"],
  repos: [
    {
      path: "/home/alice/work/secret-project",
      remotes: [
        { name: "origin", url: `https://alice:${TOKEN}@github.com/acme/repo.git` },
        { name: "mirror", url: `https://${TOKEN}@example.com/acme/repo.git?access_token=${TOKEN}` }
      ]
    }
  ],
  globalConfigPresent: false,
  gitConfigGlobalSet: true,
  gitConfigNosystemSet: false,
  workspaceTrusted: true,
  logLines: [
    "[2026-10-20 10:00:00.000] [result] request=2 command=loadRepoInfo remotes=0 error=null servedBy=cli",
    "[2026-10-20 10:00:01.000] [git:query] cwd=/home/alice/work/secret-project url=https://bob:hunter2@host/x.git",
    "[2026-10-20 10:00:02.000] [result] request=3 command=loadCommits commits=12 error=null servedBy=engine"
  ]
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildDiagnosticsReport", () => {
  it("has every section, and fills the bug template's Environment fields", () => {
    const report = buildDiagnosticsReport(FULL, { pathMode: "full" });

    for (const heading of [
      "## Environment",
      "## Git",
      "## Backend",
      "### Rust engine",
      "## Changed settings (names only, never values)",
      "## Repositories",
      "## Git environment (existence only, never contents)",
      "## Last read results",
      "<summary>Recent log (last 200 lines)</summary>"
    ]) {
      expect(report).toContain(heading);
    }
    expect(report).toContain("- VS Code version: 1.98.0 (VSCodium)");
    expect(report).toContain("- Extension version: 1.9.0");
    expect(report).toContain("- OS: linux x64 6.8.0");
    expect(report).toContain("- Version: git version 2.51.0");
    expect(report).toContain("- Platform: linux-x64");
    expect(report).toContain("- Last graph load: engine");
    expect(report).toContain("- git-graph-libre.graphColors");
    expect(report).toContain("- Global Git config file present: no");
    expect(report).toContain("- GIT_CONFIG_GLOBAL set: yes");
    expect(report).toContain("- GIT_CONFIG_NOSYSTEM set: no");
    expect(report).toContain("- Workspace trusted: yes");
  });

  it("never prints URL credentials or tokens, in remotes or in the log", () => {
    const report = buildDiagnosticsReport(FULL, { pathMode: "full" });

    expect(report).not.toContain(TOKEN);
    expect(report).not.toContain("alice:");
    expect(report).not.toContain("hunter2");
    expect(report).toContain("https://<redacted>@github.com/acme/repo.git");
    expect(report).toContain("https://<redacted>@example.com/acme/repo.git?<redacted>");
    expect(report).toContain("https://<redacted>@host/x.git");
  });

  it("shows a short excerpt of the redacted remotes (fixture evidence)", () => {
    const report = buildDiagnosticsReport(FULL, { pathMode: "full" });
    const excerpt = report.split("\n").filter((line) => line.includes("Remote `"));
    expect(excerpt).toEqual([
      "  - Remote `origin`: https://<redacted>@github.com/acme/repo.git",
      "  - Remote `mirror`: https://<redacted>@example.com/acme/repo.git?<redacted>"
    ]);
  });

  it("lists names of changed settings only", () => {
    const report = buildDiagnosticsReport(
      { ...FULL, changedSettings: ["git-graph-libre.customBranchGlobPatterns"] },
      { pathMode: "full" }
    );

    expect(report).toContain("- git-graph-libre.customBranchGlobPatterns");
    expect(report).not.toMatch(/customBranchGlobPatterns\s*[=:]/);
  });

  it("reads absent facts as (unknown)", () => {
    const report = buildDiagnosticsReport({}, { pathMode: "full" });

    expect(report).toContain(`- VS Code version: ${UNKNOWN} (${UNKNOWN})`);
    expect(report).toContain(`- Extension version: ${UNKNOWN}`);
    expect(report).toContain(`- OS: ${UNKNOWN}`);
    expect(report).toContain(`- Backend setting: ${UNKNOWN}`);
    expect(report).toContain(`- Last graph load: ${UNKNOWN}`);
    expect(report).toContain(`- Global Git config file present: ${UNKNOWN}`);
    expect(report).toContain(`- Workspace trusted: ${UNKNOWN}`);
    expect(report).toMatch(/## Repositories\n\n\(unknown\)/);
    expect(report).toMatch(/## Changed settings[^\n]*\n\n\(unknown\)/);
  });

  it("says when a repository's remotes could not be read, or there are none", () => {
    const report = buildDiagnosticsReport(
      {
        repos: [
          { path: "/r/a", remotes: null },
          { path: "/r/b", remotes: [] }
        ]
      },
      { pathMode: "full" }
    );

    expect(report).toContain("- /r/a\n  - Remotes: (unknown)");
    expect(report).toContain("- /r/b\n  - Remotes: none");
  });

  it("describes an off and an unavailable engine, and a failed Git probe", () => {
    const unavailable = buildDiagnosticsReport(
      {
        engine: {
          state: "unavailable",
          reason: "loadFailed",
          platform: "linux-x64",
          detail: "libc.so.6: not found"
        },
        git: { state: "failed", path: "/nope/git", detail: "ENOENT" }
      },
      { pathMode: "full" }
    );
    expect(unavailable).toContain("- Reason: loadFailed");
    expect(unavailable).toContain("- Detail: libc.so.6: not found");
    expect(unavailable).toContain("- Version: unavailable (ENOENT)");

    const off = buildDiagnosticsReport({ engine: { state: "off" } }, { pathMode: "full" });
    expect(off).toContain("- State: off (the backend setting is git-cli)");
  });

  it("in folder-names-only mode drops parent paths from repositories and the log", () => {
    const report = buildDiagnosticsReport(FULL, { pathMode: "folderNames" });

    expect(report).not.toContain("/home/alice");
    expect(report).toContain("- secret-project");
    expect(report).toContain("cwd=secret-project");
    expect(report).toContain("Repository paths are reduced to folder names.");
  });

  it("in full mode notes that paths are included", () => {
    const report = buildDiagnosticsReport(FULL, { pathMode: "full" });

    expect(report).toContain("- /home/alice/work/secret-project");
    expect(report).toContain("Repository paths are included.");
  });

  it("carries the last 200 log lines only, and the newest result line per command", () => {
    const lines = Array.from({ length: 300 }, (_, index) => `line ${index}`);
    const report = buildDiagnosticsReport({ logLines: lines }, { pathMode: "full" });

    expect(report).toContain("line 299");
    expect(report).toContain(`line ${300 - REPORT_LOG_LINES}`);
    expect(report).not.toContain("line 99\n");

    const results = lastResultLines([
      "[t] [result] request=1 command=loadRepoInfo remotes=1 servedBy=cli",
      "[t] [result] request=2 command=loadRepoInfo remotes=2 servedBy=cli",
      "[t] [result] request=3 command=loadCommits commits=5 servedBy=engine"
    ]);
    expect(results).toEqual([
      "[t] [result] request=2 command=loadRepoInfo remotes=2 servedBy=cli",
      "[t] [result] request=3 command=loadCommits commits=5 servedBy=engine"
    ]);
  });

  it("prepends the bug template's headings for an issue", () => {
    const report = buildDiagnosticsReport(FULL, { pathMode: "folderNames", issueSkeleton: true });

    expect(report.startsWith("**Describe the bug**")).toBe(true);
    expect(report).toContain("**Steps to reproduce**");
    expect(report).toContain("## Environment");
  });
});

describe("redaction helpers", () => {
  it("redacts userinfo and query strings of remote URLs", () => {
    expect(redactRemoteUrl(`https://user:${TOKEN}@host/o/r.git`)).toBe(
      "https://<redacted>@host/o/r.git"
    );
    expect(redactRemoteUrl("https://host/o/r.git?token=abc")).toBe(
      "https://host/o/r.git?<redacted>"
    );
    expect(redactRemoteUrl("git@github.com:o/r.git")).toBe("git@github.com:o/r.git");
  });

  it("anonymizes nested repository paths longest first, then the home directory", () => {
    const text = "/h/u/work/mono /h/u/work/mono/pkg /h/u/other";
    expect(anonymizePaths(text, ["/h/u/work/mono", "/h/u/work/mono/pkg"], "/h/u")).toBe(
      "mono pkg ~/other"
    );
  });
});

describe("buildNewIssueUrl", () => {
  it("encodes the report as the body of the new-issue page", () => {
    const url = buildNewIssueUrl("a b&c");
    expect(url).toBe(
      "https://github.com/PlohnenSoftware/git-graph-libre/issues/new?labels=bug&body=a%20b%26c"
    );
  });

  it("returns null above the safe length", () => {
    expect(buildNewIssueUrl("x".repeat(MAX_ISSUE_URL_LENGTH))).toBeNull();
    expect(buildNewIssueUrl("x".repeat(100), 50)).toBeNull();
  });
});

describe("parseRemoteList", () => {
  it("keeps one entry per name and URL, whatever the direction", () => {
    const output = [
      "origin\thttps://h/o/r.git (fetch)",
      "origin\thttps://h/o/r.git (push)",
      "fork\tgit@h:me/r.git (fetch)",
      "fork\tgit@h:me/other.git (push)",
      "garbage"
    ].join("\n");

    expect(parseRemoteList(output)).toEqual([
      { name: "origin", url: "https://h/o/r.git" },
      { name: "fork", url: "git@h:me/r.git" },
      { name: "fork", url: "git@h:me/other.git" }
    ]);
  });
});

describe("readRepoRemotes", () => {
  it("reads the remotes of a real repository, and is null for a missing one", async () => {
    const repo = makeRepo();
    try {
      git(["remote", "add", "origin", `https://u:${TOKEN}@example.com/o/r.git`], repo);

      const remotes = await readRepoRemotes(repo, "git");
      expect(remotes).toEqual([{ name: "origin", url: `https://u:${TOKEN}@example.com/o/r.git` }]);

      // The raw URL is parsed as is; redaction happens when the report is built.
      const report = buildDiagnosticsReport(
        { repos: [{ path: repo, remotes }] },
        { pathMode: "full" }
      );
      expect(report).not.toContain(TOKEN);

      await expect(readRepoRemotes(path.join(repo, "missing"), "git")).resolves.toBeNull();
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("readProcessFacts", () => {
  it("reports file existence and variable names, never config contents", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-diag-"));
    const config = path.join(dir, "gitconfig");
    fs.writeFileSync(config, "[user]\n\tname = Secret Name\n\temail = secret@example.com\n");
    try {
      vi.stubEnv("GIT_CONFIG_GLOBAL", config);
      vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
      const present = readProcessFacts();
      expect(present.globalConfigPresent).toBe(true);
      expect(present.gitConfigGlobalSet).toBe(true);
      expect(present.gitConfigNosystemSet).toBe(true);

      vi.stubEnv("GIT_CONFIG_GLOBAL", path.join(dir, "absent"));
      expect(readProcessFacts().globalConfigPresent).toBe(false);

      const report = buildDiagnosticsReport(present, { pathMode: "full" });
      expect(report).not.toContain("Secret Name");
      expect(report).not.toContain("secret@example.com");
      expect(report).not.toContain(config);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
