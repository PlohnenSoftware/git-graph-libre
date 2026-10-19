import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { DiffTabRequest } from "@/diffTabTypes";
import {
  buildScmDiffRequest,
  createScmDiffTabHandlers,
  type ScmDiffGroup
} from "@/extension/diffTab/scmCommands";

/**
 * Opening the GGL Diff tab from Source Control (D46): the manifest's three
 * hidden per-group commands and their `when` clauses, and the request each
 * group's handler builds from the clicked resource state.
 */

const GROUPS: ScmDiffGroup[] = ["workingTree", "index", "untracked"];

type Manifest = {
  contributes: {
    commands: Array<{ command: string; title?: string; icon?: string; category?: string }>;
    menus: Record<string, Array<{ command: string; group?: string; when?: string }>>;
  };
};

function readManifest(): Manifest {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8")
  ) as Manifest;
}

function makeDeps(repos: Record<string, unknown>) {
  const opened: DiffTabRequest[] = [];
  const warnings: string[] = [];
  const handlers = createScmDiffTabHandlers({
    getRepos: () => repos,
    openDiff: (request) => opened.push(request),
    showWarning: vi.fn((message: string) => warnings.push(message))
  });
  const byGroup = new Map(handlers.map((entry) => [entry.id, entry.handler]));
  return { byGroup, opened, warnings };
}

function resource(fsPath: string) {
  return { resourceUri: { fsPath } };
}

describe("SCM manifest contributions", () => {
  it("contributes one hidden command per resource group", () => {
    const manifest = readManifest();
    for (const group of GROUPS) {
      const command = manifest.contributes.commands.find(
        (entry) => entry.command === `git-graph-libre.openDiffTab.${group}`
      );
      expect(command).toMatchObject({
        category: "Git Graph Libre",
        title: "%command.openDiffTab%",
        icon: "$(diff)"
      });
    }
  });

  it("puts each command inline and in the context menu, gated on the context key", () => {
    const entries = readManifest().contributes.menus["scm/resourceState/context"] ?? [];
    for (const group of GROUPS) {
      const when =
        `scmProvider == git && scmResourceGroup == ${group} && ` +
        "git-graph-libre.diffTabAvailable";
      const mine = entries.filter(
        (entry) => entry.command === `git-graph-libre.openDiffTab.${group}`
      );
      expect(mine).toEqual([
        { command: `git-graph-libre.openDiffTab.${group}`, group: "inline", when },
        { command: `git-graph-libre.openDiffTab.${group}`, group: "navigation", when }
      ]);
    }
    expect(entries).toHaveLength(6);
  });

  it("hides each command from the command palette", () => {
    const palette = readManifest().contributes.menus.commandPalette ?? [];
    for (const group of GROUPS) {
      expect(palette).toContainEqual({
        command: `git-graph-libre.openDiffTab.${group}`,
        when: "false"
      });
    }
  });

  it("localizes the shared title in the English nls bundle", () => {
    const nls = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../../package.nls.json"), "utf8")
    ) as Record<string, string>;
    expect(nls["command.openDiffTab"]).toBe("Open in GGL Diff");
  });
});

describe("buildScmDiffRequest", () => {
  it("workingTree: index on the left, working tree on the right", () => {
    expect(buildScmDiffRequest("workingTree", "/repo", "src/file.ts")).toEqual({
      repo: "/repo",
      left: { kind: "index", path: "src/file.ts" },
      right: { kind: "workingTree", path: "src/file.ts" },
      title: "file.ts (Index ↔ Working Tree)"
    });
  });

  it("index: HEAD on the left, index on the right", () => {
    expect(buildScmDiffRequest("index", "/repo", "src/file.ts")).toEqual({
      repo: "/repo",
      left: { kind: "revision", ref: "HEAD", path: "src/file.ts" },
      right: { kind: "index", path: "src/file.ts" },
      title: "file.ts (HEAD ↔ Index)"
    });
  });

  it("untracked: empty on the left, working tree on the right", () => {
    expect(buildScmDiffRequest("untracked", "/repo", "new.ts")).toEqual({
      repo: "/repo",
      left: { kind: "empty" },
      right: { kind: "workingTree", path: "new.ts" },
      title: "new.ts (Empty ↔ Working Tree)"
    });
  });
});

describe("SCM diff tab handlers", () => {
  it("opens the clicked file from the longest known repository holding it", async () => {
    const { byGroup, opened } = makeDeps({ "/repo": {}, "/repo/nested": {} });
    await byGroup.get("git-graph-libre.openDiffTab.index")?.(resource("/repo/nested/src/file.ts"), [
      resource("/repo/nested/src/file.ts"),
      resource("/repo/other.ts")
    ]);
    // The selection travels as the second argument; only the click opens.
    expect(opened).toEqual([
      {
        repo: "/repo/nested",
        left: { kind: "revision", ref: "HEAD", path: "src/file.ts" },
        right: { kind: "index", path: "src/file.ts" },
        title: "file.ts (HEAD ↔ Index)"
      }
    ]);
  });

  it("each group builds its own sides", async () => {
    const { byGroup, opened } = makeDeps({ "/repo": {} });
    for (const group of GROUPS) {
      await byGroup.get(`git-graph-libre.openDiffTab.${group}`)?.(resource("/repo/a.ts"));
    }
    expect(opened.map((request) => [request.left.kind, request.right.kind])).toEqual([
      ["index", "workingTree"],
      ["revision", "index"],
      ["empty", "workingTree"]
    ]);
  });

  it("warns and opens nothing when no known repository holds the file", async () => {
    const { byGroup, opened, warnings } = makeDeps({ "/repo": {} });
    await byGroup.get("git-graph-libre.openDiffTab.workingTree")?.(resource("/elsewhere/a.ts"));
    expect(opened).toEqual([]);
    expect(warnings).toEqual(["Git Graph Libre does not know a repository containing this file."]);
  });

  it("does nothing without a resource path", async () => {
    const { byGroup, opened, warnings } = makeDeps({ "/repo": {} });
    await byGroup.get("git-graph-libre.openDiffTab.untracked")?.();
    await byGroup.get("git-graph-libre.openDiffTab.untracked")?.({ resourceUri: {} });
    expect(opened).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
