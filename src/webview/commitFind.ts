import type { GitCommitNode } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";

function normalizeFindText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function commitSearchFields(commit: GitCommitNode, shortHashLength: number): string[] {
  return [
    commit.message,
    commit.author,
    commit.email,
    commit.hash,
    abbrevCommit(commit.hash, shortHashLength),
    ...commit.refs.map((ref) => ref.name)
  ];
}

export function findCommitIndexes(
  commits: GitCommitNode[],
  query: string,
  shortHashLength: number
): number[] {
  const normalizedQuery = normalizeFindText(query);
  if (normalizedQuery === "") return [];

  const matches: number[] = [];
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    if (commit.hash === "*") continue;
    const matched = commitSearchFields(commit, shortHashLength).some((field) =>
      normalizeFindText(field).includes(normalizedQuery)
    );
    if (matched) matches.push(i);
  }
  return matches;
}

export function formatFindMatchCount(template: string, activeIndex: number, total: number): string {
  return template.replace("{0}", String(activeIndex + 1)).replace("{1}", String(total));
}
