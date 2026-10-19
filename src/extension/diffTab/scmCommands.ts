/**
 * "Open in GGL Diff" from VS Code's Source Control view (release 1.9.0,
 * slice D46). The Git extension's resource groups are `workingTree`,
 * `index` and `untracked`, but a command invoked from
 * `scm/resourceState/context` is only told the clicked resource state —
 * never its group — so there is one hidden command per group, each building
 * the same-shaped request with that group's two sides. The manifest shows
 * them only while `git-graph-libre.diffTabAvailable` is true (D45).
 */

import { getPathFromStr } from "@/backend/utils/path";
import type { DiffTabRequest, DiffTabSide } from "@/diffTabTypes";
import * as l10n from "@/l10n";

/** The Git resource groups this slice opens; `merge` has no pair of sides. */
export type ScmDiffGroup = "workingTree" | "index" | "untracked";

/** The public part of the clicked `SourceControlResourceState`. */
export type ScmResourceState = { resourceUri?: { fsPath?: unknown } };

export type ScmDiffTabDeps = {
  /** The repositories Git Graph Libre knows, keyed by root path. */
  getRepos(): Record<string, unknown>;
  /** Open the tab for a built request (D44's panel fed by D45's source). */
  openDiff(request: DiffTabRequest): void;
  showWarning(message: string): unknown;
};

export type ScmDiffTabHandler = {
  id: string;
  handler: (...args: unknown[]) => Promise<void>;
};

type GroupSides = {
  left: (filePath: string) => DiffTabSide;
  right: (filePath: string) => DiffTabSide;
  leftLabel: () => string;
  rightLabel: () => string;
};

const GROUP_SIDES: Record<ScmDiffGroup, GroupSides> = {
  workingTree: {
    left: (filePath) => ({ kind: "index", path: filePath }),
    right: (filePath) => ({ kind: "workingTree", path: filePath }),
    leftLabel: () => l10n.t("diff.index"),
    rightLabel: () => l10n.t("diff.workingTree")
  },
  index: {
    left: (filePath) => ({ kind: "revision", ref: "HEAD", path: filePath }),
    right: (filePath) => ({ kind: "index", path: filePath }),
    leftLabel: () => "HEAD",
    rightLabel: () => l10n.t("diff.index")
  },
  untracked: {
    left: () => ({ kind: "empty" }),
    right: (filePath) => ({ kind: "workingTree", path: filePath }),
    leftLabel: () => l10n.t("diff.empty"),
    rightLabel: () => l10n.t("diff.workingTree")
  }
};

const SCM_DIFF_GROUPS: readonly ScmDiffGroup[] = ["workingTree", "index", "untracked"];

/** The request one group's click builds for a repository-relative path. */
export function buildScmDiffRequest(
  group: ScmDiffGroup,
  repo: string,
  relativePath: string
): DiffTabRequest {
  const sides = GROUP_SIDES[group];
  const fileName = relativePath.split("/").at(-1) ?? relativePath;
  return {
    repo,
    left: sides.left(relativePath),
    right: sides.right(relativePath),
    title: `${fileName} (${sides.leftLabel()} ↔ ${sides.rightLabel()})`
  };
}

/** The three hidden commands, for registration through `commandManager.register`. */
export function createScmDiffTabHandlers(deps: ScmDiffTabDeps): ScmDiffTabHandler[] {
  return SCM_DIFF_GROUPS.map((group) => ({
    id: `git-graph-libre.openDiffTab.${group}`,
    handler: (...args: unknown[]) => openFromSourceControl(group, args[0], deps)
  }));
}

async function openFromSourceControl(
  group: ScmDiffGroup,
  resource: unknown,
  deps: ScmDiffTabDeps
): Promise<void> {
  // The second argument is the whole selection; only the clicked file opens.
  const fsPath = resourceFsPath(resource);
  if (fsPath === null) return;
  const repo = findKnownRepo(deps.getRepos(), fsPath);
  if (repo === null) {
    await deps.showWarning(l10n.t("command.openDiffTab.noRepo"));
    return;
  }
  const relativePath = fsPath.slice(repo.length + 1);
  if (relativePath === "") return;
  deps.openDiff(buildScmDiffRequest(group, repo, relativePath));
}

function resourceFsPath(resource: unknown): string | null {
  if (typeof resource !== "object" || resource === null) return null;
  const fsPath = (resource as ScmResourceState).resourceUri?.fsPath;
  return typeof fsPath === "string" && fsPath !== "" ? getPathFromStr(fsPath) : null;
}

/** Same rule as `findKnownRepoForPath` in `commandManager.ts`: longest holder wins. */
function findKnownRepo(repos: Record<string, unknown>, filePath: string): string | null {
  const repoPaths = Object.keys(repos).toSorted((a, b) => b.length - a.length);
  for (const repoPath of repoPaths) {
    if (filePath === repoPath || filePath.startsWith(`${repoPath}/`)) return repoPath;
  }
  return null;
}
