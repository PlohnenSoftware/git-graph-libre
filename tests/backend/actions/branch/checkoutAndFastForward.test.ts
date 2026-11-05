import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutAndFastForward } from "@/backend/actions/branch";

// `@/l10n` needs the `vscode` module, so the backend project gets the English
// bundle in its place, as the webview project's `vscode` mock does.
vi.mock("@/l10n", async () => {
  const bundlePath = path.resolve(__dirname, "../../../../l10n/bundle.l10n.json");
  const bundle: Record<string, string> = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  return {
    t: (key: string, ...args: string[]) =>
      (bundle[key] ?? key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] ?? "")
  };
});

const temporaryDirs: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function currentBranch(cwd: string): string {
  return cp.execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim();
}

function rev(cwd: string, ref: string): string {
  return cp.execFileSync("git", ["rev-parse", ref], { cwd, encoding: "utf8" }).trim();
}

function commitFile(repo: string, name: string, message: string) {
  fs.writeFileSync(path.join(repo, name), message);
  git(["add", "."], repo);
  git(["commit", "-m", message], repo);
}

/**
 * A repository whose local branch `feature` sits one commit behind the
 * remote-tracking ref `origin/feature`, as a webview checkout of that remote
 * branch would find it. `main` carries the newer commit.
 */
function makeFixture() {
  const repo = makeRepo();
  temporaryDirs.push(repo);
  git(["branch", "feature"], repo);
  commitFile(repo, "ahead.txt", "ahead");
  git(["update-ref", "refs/remotes/origin/feature", "main"], repo);
  return repo;
}

describe("checkoutAndFastForward", () => {
  it("switches to the branch and fast-forwards it to the clicked remote-tracking ref", async () => {
    const repo = makeFixture();
    const target = rev(repo, "origin/feature");

    await checkoutAndFastForward(simpleGit(repo), {
      branchName: "feature",
      target: "origin/feature"
    });

    expect(currentBranch(repo)).toBe("feature");
    expect(rev(repo, "feature")).toBe(target);
    expect(fs.existsSync(path.join(repo, "ahead.txt"))).toBe(true);
  });

  it("refuses a diverged branch, says the fast-forward failed, and leaves the user on the branch", async () => {
    const repo = makeFixture();
    git(["checkout", "feature"], repo);
    commitFile(repo, "local.txt", "local only");
    const diverged = rev(repo, "feature");
    git(["checkout", "main"], repo);

    await expect(
      checkoutAndFastForward(simpleGit(repo), { branchName: "feature", target: "origin/feature" })
    ).rejects.toThrow(/could not be fast-forwarded to origin\/feature/);

    expect(currentBranch(repo)).toBe("feature");
    expect(rev(repo, "feature")).toBe(diverged);
  });

  it("reports the checkout step when the branch does not exist, and stays put", async () => {
    const repo = makeFixture();

    await expect(
      checkoutAndFastForward(simpleGit(repo), { branchName: "missing", target: "origin/feature" })
    ).rejects.toThrow(/Could not switch to the branch missing/);

    expect(currentBranch(repo)).toBe("main");
  });

  it("reports the checkout step when another worktree has the branch checked out", async () => {
    const repo = makeFixture();
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-w24-wt-"));
    temporaryDirs.push(parent);
    const worktree = path.join(parent, "wt feature é");
    git(["worktree", "add", worktree, "feature"], repo);

    await expect(
      checkoutAndFastForward(simpleGit(repo), { branchName: "feature", target: "origin/feature" })
    ).rejects.toThrow(/Could not switch to the branch feature/);

    expect(currentBranch(repo)).toBe("main");
  });
});
