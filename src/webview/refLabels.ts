import type { GitRef } from "@/backend/types";

export type ParsedRemoteBranch = {
  remote: string;
  branchName: string;
};

export type CommitRefDisplayItem =
  | { kind: "ref"; ref: GitRef }
  | {
      kind: "branch-group";
      local: GitRef;
      remotes: Array<{ ref: GitRef; remote: string }>;
    };

export function parseRemoteBranchName(
  refName: string,
  remoteNames: readonly string[]
): ParsedRemoteBranch | null {
  const orderedRemoteNames = [...remoteNames]
    .map((remote) => remote.trim())
    .filter((remote) => remote !== "")
    .sort((a, b) => b.length - a.length);
  for (const remote of orderedRemoteNames) {
    const prefix = `${remote}/`;
    if (refName.startsWith(prefix) && refName.length > prefix.length) {
      return { remote, branchName: refName.slice(prefix.length) };
    }
  }

  const separator = refName.indexOf("/");
  if (separator <= 0 || separator === refName.length - 1) return null;
  return { remote: refName.slice(0, separator), branchName: refName.slice(separator + 1) };
}

export function groupCommitRefs(
  refs: readonly GitRef[],
  remoteNames: readonly string[] = []
): CommitRefDisplayItem[] {
  const localNames = new Set(refs.filter((ref) => ref.type === "head").map((ref) => ref.name));
  const matchingRemotes = new Map<string, Array<{ ref: GitRef; remote: string }>>();
  const groupedRemoteNames = new Set<string>();

  for (const ref of refs) {
    if (ref.type !== "remote") continue;
    const parsed = parseRemoteBranchName(ref.name, remoteNames);
    if (parsed === null || !localNames.has(parsed.branchName)) continue;
    const { branchName, remote } = parsed;
    const remotes = matchingRemotes.get(branchName) ?? [];
    remotes.push({ ref, remote });
    matchingRemotes.set(branchName, remotes);
    groupedRemoteNames.add(ref.name);
  }

  const items: CommitRefDisplayItem[] = [];
  for (const ref of refs) {
    if (ref.type === "remote" && groupedRemoteNames.has(ref.name)) continue;
    if (ref.type === "head") {
      const remotes = matchingRemotes.get(ref.name) ?? [];
      if (remotes.length > 0) {
        items.push({ kind: "branch-group", local: ref, remotes });
        continue;
      }
    }
    items.push({ kind: "ref", ref });
  }
  return items;
}
