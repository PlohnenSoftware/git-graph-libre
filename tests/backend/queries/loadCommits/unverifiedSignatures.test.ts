import * as cp from "node:child_process";

import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadCommits } from "@/backend/queries/loadCommits";

let repo: string;
let signedCommitHash: string;
let unsignedCommitHash: string;

/**
 * Writes a commit object whose header carries a `gpgsig` block, without needing
 * a GPG/SSH key in the test environment. `git log %G?` reports `N` for such a
 * commit (verification cannot run on an armorless signature block), while
 * `git cat-file --batch` still shows the `gpgsig` header — exactly the situation
 * this fix targets (SSH-signed commits with no `allowedSignersFile`).
 */
function createCommitWithGpgsig(
  dir: string,
  tree: string,
  parent: string | null,
  message: string
): string {
  const lines = [
    `tree ${tree}`,
    ...(parent === null ? [] : [`parent ${parent}`]),
    "author T <t@t.com> 1700000000 +0000",
    "committer T <t@t.com> 1700000000 +0000",
    "gpgsig -----BEGIN SSH SIGNATURE-----",
    " U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAg",
    " -----END SSH SIGNATURE-----",
    "",
    message
  ];
  const raw = `${lines.join("\n")}\n`;
  return cp
    .execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
      cwd: dir,
      input: raw
    })
    .toString()
    .trim();
}

beforeAll(() => {
  repo = makeRepo();
  // makeRepo leaves HEAD at one initial commit; capture its tree + hash.
  const head = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
  const tree = cp
    .execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repo })
    .toString()
    .trim();

  // A commit that carries a gpgsig header but cannot be verified.
  signedCommitHash = createCommitWithGpgsig(repo, tree, head, "ssh-signed commit");
  git(["update-ref", "refs/heads/signed-branch", signedCommitHash], repo);

  // A plain unsigned commit on top of the signed one.
  unsignedCommitHash = cp
    .execFileSync("git", ["commit-tree", tree, "-p", signedCommitHash, "-m", "unsigned commit"], {
      cwd: repo
    })
    .toString()
    .trim();
  git(["update-ref", "refs/heads/main", unsignedCommitHash], repo);
  git(["checkout", "main"], repo);
});

afterAll(() => {
  // repos under the temp dir are cleaned up by the test harness; nothing to do.
});

describe("loadCommits signature reclassification", () => {
  it("treats a gpgsig-bearing commit reported as N as unverifiable, not unsigned", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 50,
      showRemoteBranches: false,
      showTags: false,
      showSignature: true,
      hard: true,
      dateType: "Author Date",
      showUncommittedChanges: false,
      repo,
      gitPath: "git"
    });

    const signed = result.commits.find((commit) => commit.hash === signedCommitHash);
    const unsigned = result.commits.find((commit) => commit.hash === unsignedCommitHash);

    // The SSH-signed-but-unverifiable commit must read as signed, not unsigned.
    expect(signed?.signature).toEqual({ status: "unverifiable", signer: null, key: null });
    // The genuinely unsigned commit stays null.
    expect(unsigned?.signature).toBeNull();
  });

  it("skips the probe entirely when the signature column is hidden", async () => {
    // showSignature false => no %G? queried, no probe, every signature undefined.
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 50,
      showRemoteBranches: false,
      showTags: false,
      showSignature: false,
      hard: true,
      dateType: "Author Date",
      showUncommittedChanges: false,
      repo,
      gitPath: "git"
    });

    for (const commit of result.commits) {
      expect(commit.signature).toBeUndefined();
    }
  });
});
