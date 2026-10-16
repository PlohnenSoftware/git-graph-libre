import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { git, makeRepo } from "@tests/backend/helpers";
import { type SimpleGit, simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { commitSignatures, parseCommitSignature } from "@/backend/queries/commitSignatures";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const HASH_A = "a".repeat(40);
const HASH_B = "b".repeat(40);

/** A stand-in git that answers `log` with the given `-z` output and records every call. */
function fakeGit(logOutput: (args: string[]) => string, calls: string[][] = []): SimpleGit {
  return {
    raw: async (args: string[]) => {
      calls.push(args);
      if (args[0] === "log") return logOutput(args);
      throw new Error(`unexpected git command: ${args[0]}`);
    }
  } as unknown as SimpleGit;
}

describe("parseCommitSignature", () => {
  it("maps git's status letters and keeps unsigned commits distinct", () => {
    expect(parseCommitSignature("N", "", "")).toBeNull();
    expect(parseCommitSignature("", "", "")).toBeNull();
    expect(parseCommitSignature("G", "Alice", "ABC123")).toEqual({
      status: "valid",
      signer: "Alice",
      key: "ABC123"
    });
    expect(parseCommitSignature("U", "Alice", "ABC123")?.status).toBe("valid-untrusted");
    expect(parseCommitSignature("B", "", "")?.status).toBe("bad");
    expect(parseCommitSignature("X", "", "")?.status).toBe("expired");
    expect(parseCommitSignature("Y", "", "")?.status).toBe("expired-key");
    expect(parseCommitSignature("R", "", "")?.status).toBe("revoked-key");
    expect(parseCommitSignature("E", "", "")?.status).toBe("unverifiable");
    expect(parseCommitSignature("?", "", "")?.status).toBe("unknown");
  });
});

describe("commitSignatures", () => {
  it("reads signer and key metadata for each requested commit", async () => {
    const calls: string[][] = [];
    const output = [HASH_A, "G", "Alice Signer", "ABC123", HASH_B, "N", "", ""].join("\0");
    const result = await commitSignatures(
      fakeGit(() => `${output}\0`, calls),
      { hashes: [HASH_A, HASH_B] }
    );

    expect(result).toEqual({
      signatures: {
        [HASH_A]: { status: "valid", signer: "Alice Signer", key: "ABC123" },
        [HASH_B]: null
      },
      error: null
    });
    // Exactly the requested commits, never their ancestors.
    expect(calls[0]).toEqual(
      expect.arrayContaining(["log", "--no-walk=unsorted", "-z", HASH_A, HASH_B, "--"])
    );
  });

  it("passes nothing but full object names to git", async () => {
    const calls: string[][] = [];
    const result = await commitSignatures(
      fakeGit(() => "", calls),
      { hashes: ["--output=/tmp/x", "HEAD~1", "abc123", `${HASH_A}\n`] }
    );

    // The hashes come from the webview: an option or a revision expression must
    // never reach the command line, so nothing valid means no call at all.
    expect(result).toEqual({ signatures: {}, error: null });
    expect(calls).toEqual([]);
  });

  it("splits a large page into several runs, one per command-line-sized chunk", async () => {
    const calls: string[][] = [];
    const hashes = Array.from({ length: 450 }, (_, i) => i.toString(16).padStart(40, "0"));
    const result = await commitSignatures(
      fakeGit(
        (args) =>
          args
            .filter((arg) => /^[0-9a-f]{40}$/.test(arg))
            .map((hash) => `${hash}\0N\0\0\0`)
            .join(""),
        calls
      ),
      { hashes: [...hashes, hashes[0]] }
    );

    expect(calls).toHaveLength(3);
    expect(Object.keys(result.signatures)).toHaveLength(450);
  });

  it("reports a failed read as the query error, with no partial answer", async () => {
    const result = await commitSignatures(
      fakeGit(() => {
        throw new Error("fatal: bad object");
      }),
      { hashes: [HASH_A] }
    );

    expect(result.signatures).toEqual({});
    expect(result.error?.message).toContain("bad object");
  });
});

describe("commitSignatures against real repositories: SSH-signed commits", () => {
  let repo: string;
  let keyDir: string;
  let emptyHome: string;
  let craftedSigned: string;
  let unsigned: string;

  /**
   * git with no global or system configuration, so an `allowedSignersFile` on
   * the machine running the tests cannot verify these commits. Leaving the key
   * unset is what matters: pointing it at a missing file is not the same
   * thing — git then reports `B` or `U` rather than `N`.
   */
  function isolatedGit(): SimpleGit {
    // A minimal environment rather than a copy of process.env: simple-git
    // refuses variables such as GIT_EDITOR (which an editor's terminal sets)
    // and GIT_CONFIG_GLOBAL, so the global configuration is emptied by giving
    // git a home with nothing in it instead.
    const env: Record<string, string> = {
      HOME: emptyHome,
      XDG_CONFIG_HOME: emptyHome,
      GIT_CONFIG_NOSYSTEM: "1"
    };
    for (const name of ["PATH", "SystemRoot"]) {
      const value = process.env[name];
      if (value !== undefined) env[name] = value;
    }
    return simpleGit(repo).env(env);
  }

  /**
   * Writes a commit object whose header carries a `gpgsig` block, without
   * needing a key: `%G?` reports `N` for it, while `git cat-file --batch` still
   * shows the header — the situation of an SSH-signed commit with no
   * `gpg.ssh.allowedSignersFile`.
   */
  function commitWithGpgsig(tree: string, parent: string, message: string): string {
    const raw = `${[
      `tree ${tree}`,
      `parent ${parent}`,
      "author T <t@t.com> 1700000000 +0000",
      "committer T <t@t.com> 1700000000 +0000",
      "gpgsig -----BEGIN SSH SIGNATURE-----",
      " U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAg",
      " -----END SSH SIGNATURE-----",
      "",
      message
    ].join("\n")}\n`;
    return cp
      .execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
        cwd: repo,
        input: raw
      })
      .toString()
      .trim();
  }

  beforeAll(() => {
    repo = makeRepo();
    keyDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-ssh-key-"));
    emptyHome = path.join(keyDir, "home");
    fs.mkdirSync(emptyHome);
    const head = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
    const tree = cp
      .execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repo })
      .toString()
      .trim();
    craftedSigned = commitWithGpgsig(tree, head, "ssh-signed commit");
    unsigned = cp
      .execFileSync("git", ["commit-tree", tree, "-p", craftedSigned, "-m", "unsigned"], {
        cwd: repo
      })
      .toString()
      .trim();
    git(["update-ref", "refs/heads/main", unsigned], repo);
  });

  afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(keyDir, { recursive: true, force: true });
  });

  it("reads a gpgsig-bearing commit git reports as N as unverifiable, not unsigned", async () => {
    const result = await commitSignatures(isolatedGit(), {
      hashes: [craftedSigned, unsigned],
      repo,
      gitPath: "git"
    });

    expect(result.error).toBeNull();
    expect(result.signatures[craftedSigned]).toEqual({
      status: "unverifiable",
      signer: null,
      key: null
    });
    expect(result.signatures[unsigned]).toBeNull();
  });

  it("probes only the commits git reported as N", async () => {
    const records: GitCommandRecord[] = [];
    await commitSignatures(isolatedGit(), {
      hashes: [craftedSigned, unsigned],
      repo,
      gitPath: "git",
      recordGitCommand: (record) => records.push(record)
    });

    expect(records.map((record) => record.label)).toEqual([
      "commitSignatures.log",
      "commitSignatures.signaturePresence"
    ]);
  });

  const hasSshKeygen = (() => {
    try {
      cp.execFileSync("ssh-keygen", ["-?"], { stdio: "ignore" });
      return true;
    } catch (error: unknown) {
      // `ssh-keygen -?` prints usage and exits non-zero; only a missing binary is fatal.
      return (error as { code?: string }).code !== "ENOENT";
    }
  })();

  it.skipIf(!hasSshKeygen)(
    "recognizes a real SSH-signed commit: unverifiable without allowed signers, valid with",
    async () => {
      const key = path.join(keyDir, "id_ed25519");
      cp.execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "test", "-f", key]);
      git(["config", "gpg.format", "ssh"], repo);
      git(["config", "user.signingkey", `${key}.pub`], repo);
      fs.writeFileSync(path.join(repo, "signed.txt"), "signed");
      git(["add", "signed.txt"], repo);
      git(["commit", "-q", "-S", "-m", "really ssh-signed"], repo);
      const signed = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();

      // No allowed-signers file: git cannot verify and says N, the probe finds
      // the gpgsig header, and the commit reads as signed-but-unverifiable.
      const unverified = await commitSignatures(isolatedGit(), {
        hashes: [signed],
        repo,
        gitPath: "git"
      });
      expect(unverified.signatures[signed]).toEqual({
        status: "unverifiable",
        signer: null,
        key: null
      });

      // With the key trusted for the committer's address, git verifies it.
      const allowed = path.join(keyDir, "allowed_signers");
      const publicKey = fs.readFileSync(`${key}.pub`, "utf8").trim();
      fs.writeFileSync(allowed, `t@t.com namespaces="git" ${publicKey}\n`);
      git(["config", "gpg.ssh.allowedSignersFile", allowed], repo);
      const verified = await commitSignatures(isolatedGit(), {
        hashes: [signed],
        repo,
        gitPath: "git"
      });
      expect(verified.signatures[signed]).toEqual({
        status: "valid",
        signer: "t@t.com",
        key: expect.stringMatching(/^SHA256:/)
      });
    },
    30000
  );
});
