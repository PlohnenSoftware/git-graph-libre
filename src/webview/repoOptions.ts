/**
 * The repository dropdown's rows (release 1.10.0, W32).
 *
 * Worktrees of one Git repository sit together whatever their folder layout:
 * the main worktree first and its linked worktrees indented beneath it, found
 * by the shared common git directory the host reports, never by path prefix.
 * Anything the layout does not group (a submodule, a plain repository, a host
 * that sent no layout) nests by path prefix, as it always did. Linked
 * worktrees outside the workspace follow their group, marked "outside
 * workspace"; selecting one adds it on demand.
 */

import type { GitRepoSet, OutsideWorktree, RepoLayout } from "@/types";

import type { DropdownOption } from "./dropdown";
import { getRepoBasename, getRepoDisplayName } from "./settingsWidget";

export type RepoOptionLabels = {
  detached: string;
  outsideWorkspace: string;
  bareRepository: string;
};

type RepoNode = {
  path: string;
  name: string;
  outside: boolean;
  linked: boolean;
  commonDir: string | null;
  branch: string | null;
  detached: boolean;
  /** A bare repository's header row: not a repository, so it is never selected. */
  header: boolean;
};

function normalize(file: string) {
  return file.replaceAll("\\", "/");
}

function toNodes(repos: GitRepoSet, layout: RepoLayout | undefined): RepoNode[] {
  const nodes: RepoNode[] = Object.keys(repos).map((path) => {
    const info = layout?.worktrees[path];
    return {
      path,
      name: getRepoDisplayName(path, repos[path]),
      outside: false,
      linked: info?.linked ?? false,
      commonDir: info?.commonDir ?? null,
      branch: info?.branch ?? null,
      detached: info?.detached ?? false,
      header: false
    };
  });
  const outside: OutsideWorktree[] = layout?.outside ?? [];
  for (const entry of outside) {
    if (Object.hasOwn(repos, entry.path)) continue;
    nodes.push({
      path: entry.path,
      name: getRepoBasename(entry.path),
      outside: true,
      linked: entry.linked,
      commonDir: entry.commonDir,
      branch: entry.branch,
      detached: entry.detached,
      header: false
    });
  }
  return nodes;
}

function headerOf(commonDir: string): RepoNode {
  return {
    path: commonDir,
    name: getRepoBasename(commonDir),
    outside: false,
    linked: false,
    commonDir,
    branch: null,
    detached: false,
    header: true
  };
}

/**
 * A bare group with no main worktree listed gets a header row before its first
 * member. A group that has a main worktree already reads as that repository.
 */
function withBareHeaders(nodes: readonly RepoNode[], bareGroups: readonly string[]): RepoNode[] {
  const result = [...nodes];
  for (const commonDir of bareGroups) {
    const members = result.filter((node) => node.commonDir === commonDir);
    if (members.length === 0 || members.some((node) => !node.linked)) continue;
    const first = result.findIndex((node) => node.commonDir === commonDir);
    result.splice(first, 0, headerOf(commonDir));
  }
  return result;
}

/** The main worktree of each group, keyed by common dir. */
function mainsByGroup(nodes: readonly RepoNode[]): Map<string, RepoNode> {
  const mains = new Map<string, RepoNode>();
  for (const node of nodes) {
    if (node.commonDir !== null && !node.linked && !mains.has(node.commonDir)) {
      mains.set(node.commonDir, node);
    }
  }
  return mains;
}

/** The deepest listed repository whose folder contains `node`'s, or null. */
function enclosingRepo(node: RepoNode, nodes: readonly RepoNode[]): RepoNode | null {
  const own = normalize(node.path);
  let best: RepoNode | null = null;
  for (const candidate of nodes) {
    if (candidate.outside || candidate.header || candidate === node) continue;
    const prefix = normalize(candidate.path);
    if (!own.startsWith(`${prefix}/`)) continue;
    if (best === null || prefix.length > best.path.length) best = candidate;
  }
  return best;
}

function parentOf(
  node: RepoNode,
  nodes: readonly RepoNode[],
  mains: ReadonlyMap<string, RepoNode>
): RepoNode | null {
  if (node.header) return null;
  if (node.linked && node.commonDir !== null) {
    const main = mains.get(node.commonDir);
    if (main !== undefined && main !== node) return main;
  }
  return node.outside ? null : enclosingRepo(node, nodes);
}

function groupSizes(nodes: readonly RepoNode[]): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const node of nodes) {
    if (node.commonDir === null) continue;
    sizes.set(node.commonDir, (sizes.get(node.commonDir) ?? 0) + 1);
  }
  return sizes;
}

function treeBranchOf(last: boolean | null): DropdownOption["treeBranch"] {
  if (last === null) return undefined;
  return last ? "last" : "middle";
}

/** A grouped worktree, and any outside one, says which branch it has checked out. */
function labelOf(node: RepoNode, grouped: boolean, labels: RepoOptionLabels): string {
  if (node.header) return `${node.name} · ${labels.bareRepository}`;
  const parts = [node.name];
  const branch = node.branch ?? (node.detached ? labels.detached : null);
  if ((grouped || node.outside) && branch !== null) parts.push(` (${branch})`);
  if (node.outside) parts.push(` · ${labels.outsideWorkspace}`);
  return parts.join("");
}

/** Children of each node (null for the roots), repositories before outside entries. */
function childrenByParent(
  nodes: readonly RepoNode[],
  mains: ReadonlyMap<string, RepoNode>
): Map<RepoNode | null, RepoNode[]> {
  const children = new Map<RepoNode | null, RepoNode[]>();
  const ordered = [...nodes.filter((node) => !node.outside), ...nodes.filter((n) => n.outside)];
  for (const node of ordered) {
    const parent = parentOf(node, nodes, mains);
    children.set(parent, [...(children.get(parent) ?? []), node]);
  }
  return children;
}

export function buildRepoOptions(
  repos: GitRepoSet,
  layout: RepoLayout | undefined,
  labels: RepoOptionLabels
): DropdownOption[] {
  const nodes = withBareHeaders(toNodes(repos, layout), layout?.bareGroups ?? []);
  const mains = mainsByGroup(nodes);
  const sizes = groupSizes(nodes);
  const children = childrenByParent(nodes, mains);
  const options: DropdownOption[] = [];
  const visited = new Set<RepoNode>();

  const visit = (node: RepoNode, depth: number, last: boolean | null) => {
    if (visited.has(node)) return;
    visited.add(node);
    const grouped = node.commonDir !== null && (sizes.get(node.commonDir) ?? 0) > 1;
    options.push({
      name: labelOf(node, grouped, labels),
      value: node.path,
      indentLevel: depth,
      treeBranch: treeBranchOf(last),
      ...(node.header ? { header: true } : {})
    });
    const kids = children.get(node) ?? [];
    for (const [index, kid] of kids.entries()) {
      visit(kid, depth + 1, index === kids.length - 1);
    }
  };
  for (const root of children.get(null) ?? []) visit(root, 0, null);
  // A parent loop (worktree folders nested inside each other's group) leaves
  // its members unreachable from any root; none may vanish from the list.
  for (const node of nodes) if (!visited.has(node)) visit(node, 0, null);
  return options;
}
