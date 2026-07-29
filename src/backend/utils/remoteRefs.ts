import { GitCommandError } from "@/backend/utils/gitRunner";

/**
 * `git push <remote> --delete <ref>` fails when the ref is already absent on the
 * remote. Deleting something that is already gone is the requested end state, so
 * callers treat this specific failure as success.
 */
export function isMissingRemoteRefError(error: unknown): boolean {
  if (!(error instanceof GitCommandError)) return false;
  const text = [error.record.error?.message, error.record.error?.stderr].filter(Boolean).join("\n");
  return /remote ref does not exist/i.test(text);
}

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
