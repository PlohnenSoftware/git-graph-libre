import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  exportRepoConfigFile,
  importRepoConfigFile,
  parseExportedRepoConfig,
  REPO_CONFIG_RELATIVE_PATH
} from "@/extension/repoConfigFile";
import type { GitRepoState } from "@/types";

describe("repo configuration file helpers", () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "git-graph-libre-config-"));
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("exports explicit repo state to the Neo config path", async () => {
    await exportRepoConfigFile(repo, {
      columnWidths: null,
      displayName: "Main Repo",
      hiddenRemotes: ["origin"],
      issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://issues.test/$1" }
    });

    const configPath = path.join(repo, REPO_CONFIG_RELATIVE_PATH);
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(parsed).toMatchObject({
      version: 1,
      repoState: {
        displayName: "Main Repo",
        hiddenRemotes: ["origin"],
        issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://issues.test/$1" }
      }
    });
    expect(parsed.repoState.columnWidths).toBeUndefined();
  });

  it("imports valid fields and ignores malformed fields", async () => {
    const currentState: GitRepoState = { columnWidths: null, displayName: "Current" };
    fs.mkdirSync(path.join(repo, ".vscode"));
    fs.writeFileSync(
      path.join(repo, REPO_CONFIG_RELATIVE_PATH),
      JSON.stringify({
        version: 1,
        repoState: {
          columnWidths: [100, 200],
          commitOrdering: "topo",
          displayName: "Imported",
          hiddenRemotes: ["origin", "", "origin"],
          includeReflog: "enabled",
          includeUnreachableCommits: "enabled",
          issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://issues.test/$1" },
          onlyFollowFirstParent: "disabled",
          pullRequest: {
            remoteName: "origin",
            baseBranch: "main",
            urlTemplate: "https://example.test/{sourceBranch}",
            pushBeforeCreate: true
          },
          showRemoteBranches: "enabled",
          showStashes: "default",
          showTags: "bad"
        }
      })
    );

    const state = await importRepoConfigFile(repo, currentState);
    expect(state).toMatchObject({
      columnWidths: [100, 200],
      commitOrdering: "topo",
      displayName: "Imported",
      hiddenRemotes: ["origin"],
      includeReflog: "enabled",
      includeUnreachableCommits: "enabled",
      issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://issues.test/$1" },
      onlyFollowFirstParent: "disabled",
      pullRequest: {
        remoteName: "origin",
        baseBranch: "main",
        pushBeforeCreate: true
      },
      showRemoteBranches: "enabled",
      showStashes: "default"
    });
    expect(state.showTags).toBeUndefined();
    expect(typeof state.lastConfigImportAt).toBe("number");
  });

  it("returns an empty state for unsupported versions", () => {
    expect(parseExportedRepoConfig({ version: 2, repoState: { displayName: "Old" } })).toEqual({});
  });

  it("sanitizes empty and invalid imported config values", () => {
    expect(parseExportedRepoConfig("invalid")).toEqual({});
    expect(
      parseExportedRepoConfig({
        version: 1,
        repoState: {
          columnWidths: [100, 0],
          displayName: "   ",
          issueLinking: null,
          pullRequest: null,
          showRemoteBranches: "bad"
        }
      })
    ).toEqual({
      displayName: null,
      issueLinking: null,
      pullRequest: null
    });
  });
});
