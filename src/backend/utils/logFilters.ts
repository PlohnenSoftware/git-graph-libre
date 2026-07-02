export function uniqueNonEmpty(values: readonly string[] | null | undefined): string[] | null {
  if (values === null || values === undefined) return null;

  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed !== "" && !unique.includes(trimmed)) unique.push(trimmed);
  }
  return unique.length === 0 ? null : unique;
}

export function selectedBranchRefs(
  branches: readonly string[] | null | undefined,
  legacyBranchName = ""
): string[] | null {
  const selected = uniqueNonEmpty(branches);
  if (selected !== null) return selected;

  const legacy = legacyBranchName.trim();
  return legacy === "" ? null : [legacy];
}

export function selectedTagRefs(tags: readonly string[] | null | undefined): string[] | null {
  const selected = uniqueNonEmpty(tags);
  if (selected === null) return null;
  return selected.map((tag) => (tag.startsWith("refs/tags/") ? tag : `refs/tags/${tag}`));
}

export function selectedLogRefs(opts: {
  branches?: readonly string[] | null;
  legacyBranchName?: string;
  tags?: readonly string[] | null;
}): string[] | null {
  const refs = [
    ...(selectedBranchRefs(opts.branches, opts.legacyBranchName ?? "") ?? []),
    ...(selectedTagRefs(opts.tags) ?? [])
  ];
  return refs.length === 0 ? null : refs;
}

export function authorArgs(authors: readonly string[] | null | undefined): string[] {
  return (uniqueNonEmpty(authors) ?? []).map((author) => `--author=${author}`);
}
