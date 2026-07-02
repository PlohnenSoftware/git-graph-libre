export function normalizeHiddenRemotes(hiddenRemotes: readonly string[] | undefined): string[] {
  const normalized: string[] = [];
  for (const remote of hiddenRemotes ?? []) {
    const value = remote.trim();
    if (value !== "" && !normalized.includes(value)) normalized.push(value);
  }
  return normalized;
}

export function remoteExcludeArgs(hiddenRemotes: readonly string[] | undefined): string[] {
  return normalizeHiddenRemotes(hiddenRemotes).map((remote) => {
    return `--exclude=refs/remotes/${remote}/*`;
  });
}

function remoteNameFromRefName(refName: string): string | null {
  let normalized = refName;
  if (refName.startsWith("refs/remotes/")) {
    normalized = refName.slice("refs/remotes/".length);
  } else if (refName.startsWith("remotes/")) {
    normalized = refName.slice("remotes/".length);
  }
  const separator = normalized.indexOf("/");
  if (separator <= 0) return null;
  return normalized.slice(0, separator);
}

export function isHiddenRemoteRef(
  refName: string,
  hiddenRemotes: readonly string[] | undefined
): boolean {
  const remote = remoteNameFromRefName(refName);
  return remote !== null && normalizeHiddenRemotes(hiddenRemotes).includes(remote);
}
