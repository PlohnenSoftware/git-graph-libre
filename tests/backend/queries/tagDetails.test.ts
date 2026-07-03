import * as cp from "node:child_process";
import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { type SimpleGit, simpleGit } from "simple-git";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSignatureOutput, tagDetails } from "@/backend/queries/tagDetails";

const repos: string[] = [];

function trackedRepo() {
  const repo = makeRepo();
  repos.push(repo);
  return repo;
}

function head(repo: string) {
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
}

afterEach(() => {
  while (repos.length > 0) {
    const repo = repos.pop();
    if (repo !== undefined) fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe("tagDetails", () => {
  it("returns annotated tag metadata", async () => {
    const repo = trackedRepo();
    const commitHash = head(repo);
    git(["tag", "-a", "v1.0", "-m", "Release v1.0", "-m", "Body line"], repo);

    const result = await tagDetails(simpleGit(repo), { repo, tagName: "v1.0" });

    expect(result.error).toBeNull();
    expect(result.tagDetails).toMatchObject({
      tagName: "v1.0",
      type: "annotated",
      targetHash: commitHash,
      targetType: "commit",
      taggerName: "T",
      taggerEmail: "t@t.com",
      subject: "Release v1.0",
      body: "Body line",
      signature: null
    });
    expect(result.tagDetails?.objectHash).not.toBe(commitHash);
    expect(result.tagDetails?.taggerDate).toEqual(expect.any(Number));
  });

  it("returns lightweight tag metadata", async () => {
    const repo = trackedRepo();
    const commitHash = head(repo);
    git(["tag", "v-light"], repo);

    const result = await tagDetails(simpleGit(repo), { repo, tagName: "v-light" });

    expect(result.error).toBeNull();
    expect(result.tagDetails).toMatchObject({
      tagName: "v-light",
      type: "lightweight",
      objectHash: commitHash,
      targetHash: commitHash,
      targetType: "commit",
      taggerName: null,
      taggerEmail: null,
      taggerDate: null,
      subject: "init",
      signature: null
    });
  });

  it("returns a typed error when the tag does not exist", async () => {
    const repo = trackedRepo();

    const result = await tagDetails(simpleGit(repo), { repo, tagName: "missing" });

    expect(result.tagDetails).toBeNull();
    expect(result.error?.message).toContain("missing");
  });

  it("rejects blank tag names before running git", async () => {
    const raw = vi.fn();

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: " "
    });

    expect(raw).not.toHaveBeenCalled();
    expect(result.tagDetails).toBeNull();
    expect(result.error?.message).toContain("Tag name is required");
  });

  it("parses raw GPG status when an annotated tag has a signature block", async () => {
    const raw = vi.fn(async (args: string[]) => {
      if (args[0] === "for-each-ref") {
        return [
          "v-signed",
          "tag",
          "tag-object",
          "commit",
          "target-commit",
          "Tagger",
          "<tagger@example.test>",
          "1700000000",
          "Signed release",
          "",
          "-----BEGIN PGP SIGNATURE-----"
        ].join("\0");
      }
      return "[GNUPG:] GOODSIG ABCDEF Test Signer <signer@example.test>\n";
    });

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: "v-signed"
    });

    expect(result.error).toBeNull();
    expect(result.tagDetails?.signature).toEqual({
      status: "valid",
      key: "ABCDEF",
      signer: "Test Signer <signer@example.test>"
    });
  });

  it("keeps tagger emails that are already unwrapped", async () => {
    const raw = vi.fn(async () =>
      [
        "v-plain-email",
        "tag",
        "tag-object",
        "commit",
        "target-commit",
        "Tagger",
        "tagger@example.test",
        "1700000000",
        "Plain email",
        "",
        ""
      ].join("\0")
    );

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: "v-plain-email"
    });

    expect(result.error).toBeNull();
    expect(result.tagDetails?.taggerEmail).toBe("tagger@example.test");
  });

  it("falls back to unknown target type when git omits it", async () => {
    const raw = vi.fn(async () =>
      [
        "v-no-target-type",
        "tag",
        "tag-object",
        "",
        "target-commit",
        "Tagger",
        "<tagger@example.test>",
        "1700000000",
        "No target type",
        "",
        ""
      ].join("\0")
    );

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: "v-no-target-type"
    });

    expect(result.error).toBeNull();
    expect(result.tagDetails?.targetType).toBe("unknown");
  });

  it("returns an error for malformed tag objects", async () => {
    const raw = vi.fn(async () =>
      [
        "v-broken",
        "tag",
        "",
        "commit",
        "target-commit",
        "Tagger",
        "<tagger@example.test>",
        "1700000000",
        "Broken tag",
        "",
        ""
      ].join("\0")
    );

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: "v-broken"
    });

    expect(result.tagDetails).toBeNull();
    expect(result.error?.message).toContain("unexpected object format");
  });

  it("parses bad, failed, and unknown signature status records", () => {
    expect(parseSignatureOutput("[GNUPG:] BADSIG BADKEY Bad Signer\n")).toEqual({
      status: "bad",
      key: "BADKEY",
      signer: "Bad Signer"
    });
    expect(parseSignatureOutput("[GNUPG:] ERRSIG FAILEDKEY 1 8 00 0 0 0\n")).toEqual({
      status: "failed",
      key: "FAILEDKEY",
      signer: null
    });
    expect(parseSignatureOutput("no machine-readable status")).toEqual({
      status: "unknown",
      key: null,
      signer: null
    });
    expect(parseSignatureOutput("[GNUPG:] VALIDSIG VALIDKEY\n")).toEqual({
      status: "valid",
      key: "VALIDKEY",
      signer: null
    });
    expect(
      parseSignatureOutput(
        [
          "[GNUPG:] GOODSIG",
          "[GNUPG:] BADSIG BADKEY Bad Signer",
          "[GNUPG:] ERRSIG",
          "[GNUPG:] GOODSIG",
          "[GNUPG:] VALIDSIG"
        ].join("\n")
      )
    ).toEqual({
      status: "bad",
      key: "BADKEY",
      signer: "Bad Signer"
    });
  });

  it("uses stderr from failed raw signature verification", async () => {
    const raw = vi.fn(async (args: string[]) => {
      if (args[0] === "for-each-ref") {
        return [
          "v-bad",
          "tag",
          "tag-object",
          "commit",
          "target-commit",
          "Tagger",
          "<tagger@example.test>",
          "1700000000",
          "Bad signature",
          "",
          "-----BEGIN PGP SIGNATURE-----"
        ].join("\0");
      }
      throw Object.assign(new Error("bad signature"), {
        stderr: "[GNUPG:] BADSIG BADKEY Bad Signer\n"
      });
    });

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: "v-bad"
    });

    expect(result.error).toBeNull();
    expect(result.tagDetails?.signature).toEqual({
      status: "bad",
      key: "BADKEY",
      signer: "Bad Signer"
    });
  });

  it("marks signed tag verification with no raw status as unknown", async () => {
    const raw = vi.fn(async (args: string[]) => {
      if (args[0] === "for-each-ref") {
        return [
          "v-unknown",
          "tag",
          "tag-object",
          "commit",
          "target-commit",
          "Tagger",
          "<tagger@example.test>",
          "1700000000",
          "Unknown signature",
          "",
          "-----BEGIN PGP SIGNATURE-----"
        ].join("\0");
      }
      throw new Error("verify failed");
    });

    const result = await tagDetails({ raw } as unknown as SimpleGit, {
      repo: "/repo",
      tagName: "v-unknown"
    });

    expect(result.error).toBeNull();
    expect(result.tagDetails?.signature).toEqual({
      status: "unknown",
      key: null,
      signer: null
    });
  });
});
