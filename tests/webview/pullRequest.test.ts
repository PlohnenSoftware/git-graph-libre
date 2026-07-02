import { describe, expect, it } from "vitest";

import { buildPullRequestUrl, parseRemoteUrl } from "@/extension/pullRequest";

describe("pull request URL helpers", () => {
  it("parses common HTTPS and SSH remote URLs", () => {
    expect(parseRemoteUrl("https://github.com/owner/repo.git")).toEqual({
      host: "github.com",
      owner: "owner",
      repo: "repo"
    });
    expect(parseRemoteUrl("git@github.com:owner/repo.git")).toEqual({
      host: "github.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("returns null for empty, incomplete, or malformed remote URLs", () => {
    expect(parseRemoteUrl("")).toBeNull();
    expect(parseRemoteUrl("https://github.com/owner")).toBeNull();
    expect(parseRemoteUrl("not a url")).toBeNull();
  });

  it("builds encoded pull request URLs from templates", () => {
    expect(
      buildPullRequestUrl({
        branchName: "feature/a b",
        remoteName: "origin",
        remoteUrl: "https://github.com/owner/repo.git",
        baseBranch: "main",
        urlTemplate: "https://{host}/{owner}/{repo}/compare/{baseBranch}...{sourceBranch}"
      })
    ).toBe("https://github.com/owner/repo/compare/main...feature%2Fa%20b");
  });

  it("rejects non-http generated URLs", () => {
    expect(() =>
      buildPullRequestUrl({
        branchName: "feature",
        remoteName: "origin",
        remoteUrl: "https://github.com/owner/repo.git",
        baseBranch: "main",
        urlTemplate: "javascript:alert({sourceBranch})"
      })
    ).toThrow("http or https");
  });

  it("rejects templates that do not produce URLs", () => {
    expect(() =>
      buildPullRequestUrl({
        branchName: "feature",
        remoteName: "origin",
        remoteUrl: "https://github.com/owner/repo.git",
        baseBranch: "main",
        urlTemplate: "not a url"
      })
    ).toThrow("valid URL");
  });
});
