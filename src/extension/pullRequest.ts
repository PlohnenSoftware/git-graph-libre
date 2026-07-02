export type RemoteUrlParts = {
  host: string;
  owner: string;
  repo: string;
};

export type PullRequestUrlInput = {
  branchName: string;
  remoteName: string;
  remoteUrl: string;
  baseBranch: string;
  urlTemplate: string;
};

export function buildPullRequestUrl(input: PullRequestUrlInput): string {
  const remote = parseRemoteUrl(input.remoteUrl);
  const replacements: Record<string, string> = {
    base: input.baseBranch,
    baseBranch: input.baseBranch,
    branch: input.branchName,
    host: remote?.host ?? "",
    owner: remote?.owner ?? "",
    remoteName: input.remoteName,
    remoteUrl: input.remoteUrl,
    repo: remote?.repo ?? "",
    repository: remote?.repo ?? "",
    sourceBranch: input.branchName
  };
  const url = input.urlTemplate.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) =>
    encodeURIComponent(replacements[key] ?? match)
  );
  assertHttpUrl(url);
  return url;
}

export function parseRemoteUrl(remoteUrl: string): RemoteUrlParts | null {
  const trimmed = remoteUrl.trim();
  if (trimmed === "") return null;

  const scpLike = /^(?:[^@/:]+@)?([^:/]+):([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(trimmed);
  if (scpLike !== null) {
    return {
      host: scpLike[1],
      owner: scpLike[2],
      repo: stripGitSuffix(scpLike[3])
    };
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter((part) => part !== "");
    if (parts.length < 2 || url.hostname === "") return null;
    return {
      host: url.hostname,
      owner: parts.at(-2) ?? "",
      repo: stripGitSuffix(parts.at(-1) ?? "")
    };
  } catch {
    return null;
  }
}

export function assertHttpUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Pull request URL template did not produce a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Pull request URLs must use http or https.");
  }
}

function stripGitSuffix(value: string) {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}
