import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addTag } from "@/backend/actions/tag";
import type { GitCommandRecord, GitCommandRecorder } from "@/backend/utils/gitRunner";

let repo: string;
let commitHash: string;

beforeAll(() => {
  repo = makeRepo();
  commitHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("addTag", () => {
  it("creates a lightweight tag at the given commit", async () => {
    await addTag(simpleGit(repo), {
      tagName: "v1.0-lw",
      commitHash,
      lightweight: true
    });

    const tagName = cp
      .execFileSync("git", ["tag", "-l", "v1.0-lw"], { cwd: repo })
      .toString()
      .trim();
    expect(tagName).toBe("v1.0-lw");
  });

  it("creates an annotated tag at the given commit", async () => {
    await addTag(simpleGit(repo), {
      tagName: "v1.0",
      commitHash,
      lightweight: false,
      message: "Release v1.0"
    });

    const tagType = cp
      .execFileSync("git", ["cat-file", "-t", "v1.0"], { cwd: repo })
      .toString()
      .trim();
    expect(tagType).toBe("tag");
  });

  it("creates an annotated tag without a message", async () => {
    const records: GitCommandRecord[] = [];
    await addTag(
      simpleGit(repo),
      {
        tagName: "v1.0-empty",
        commitHash,
        lightweight: false
      },
      (entry) => records.push(entry)
    );

    const tagType = cp
      .execFileSync("git", ["cat-file", "-t", "v1.0-empty"], { cwd: repo })
      .toString()
      .trim();
    expect(tagType).toBe("tag");
    expect(records.at(-1)?.args).toEqual(["tag", "-a", "v1.0-empty", "-m", "", commitHash]);
  });

  it("rejects a message for a lightweight tag", async () => {
    await expect(
      addTag(simpleGit(repo), {
        tagName: "v1.0-invalid-lightweight",
        commitHash,
        lightweight: true,
        message: "Not allowed"
      })
    ).rejects.toThrow("Lightweight tags cannot have a message.");

    const tagName = cp
      .execFileSync("git", ["tag", "-l", "v1.0-invalid-lightweight"], { cwd: repo })
      .toString();
    expect(tagName).toBe("");
  });

  it("throws when the tag already exists", async () => {
    await expect(
      addTag(simpleGit(repo), {
        tagName: "v1.0-lw",
        commitHash,
        lightweight: true
      })
    ).rejects.toThrow();
  });

  it("throws when the commit hash is invalid", async () => {
    await expect(
      addTag(simpleGit(repo), {
        tagName: "v2.0",
        commitHash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        lightweight: true
      })
    ).rejects.toThrow();
  });
});

describe("addTag under tag.gpgsign=true", () => {
  let gpgRepo: string;
  let gpgCommitHash: string;
  let stubDir: string;
  let gpgMarker: string;
  let editorMarker: string;
  const records: GitCommandRecord[] = [];
  const recordCommand: GitCommandRecorder = (entry) => {
    records.push(entry);
  };

  beforeAll(() => {
    gpgRepo = makeRepo();
    gpgCommitHash = cp
      .execFileSync("git", ["rev-parse", "HEAD"], { cwd: gpgRepo })
      .toString()
      .trim();

    // The stub "gpg" records that git invoked it, claims success through the
    // `[GNUPG:] SIG_CREATED` status line git requires, and passes the payload
    // through untouched. That lets a config-following annotated tag produce a
    // real `tag` object without generating any GPG key.
    stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-gpg-"));
    gpgMarker = path.join(stubDir, "gpg-invoked");
    editorMarker = path.join(stubDir, "editor-invoked");
    const stubGpg = path.join(stubDir, "stub-gpg");
    const stubEditor = path.join(stubDir, "stub-editor");
    fs.writeFileSync(
      stubGpg,
      `#!/bin/sh\necho invoked >> "${gpgMarker}"\necho "[GNUPG:] SIG_CREATED " >&2\ncat\n`
    );
    fs.writeFileSync(stubEditor, `#!/bin/sh\necho invoked >> "${editorMarker}"\n`);
    fs.chmodSync(stubGpg, 0o755);
    fs.chmodSync(stubEditor, 0o755);

    git(["config", "tag.gpgsign", "true"], gpgRepo);
    git(["config", "gpg.program", stubGpg], gpgRepo);
    git(["config", "core.editor", stubEditor], gpgRepo);
  });

  afterAll(() => {
    fs.rmSync(gpgRepo, { recursive: true, force: true });
    fs.rmSync(stubDir, { recursive: true, force: true });
  });

  it("keeps a lightweight tag a plain, unsigned ref", async () => {
    await addTag(
      simpleGit(gpgRepo),
      {
        repo: gpgRepo,
        tagName: "lw-gpgsign",
        commitHash: gpgCommitHash,
        lightweight: true
      },
      recordCommand
    );

    const tagType = cp
      .execFileSync("git", ["cat-file", "-t", "lw-gpgsign"], { cwd: gpgRepo })
      .toString()
      .trim();
    expect(tagType).toBe("commit");
    // `--no-sign` held: git never asked the configured gpg program to sign,
    // and it never opened an editor to collect a tag message.
    expect(fs.existsSync(gpgMarker)).toBe(false);
    expect(fs.existsSync(editorMarker)).toBe(false);

    const lastRecord = records[records.length - 1];
    expect(lastRecord?.label).toBe("tag.addTag");
    expect(lastRecord?.kind).toBe("action");
    expect(lastRecord?.repo).toBe(gpgRepo);
    expect(lastRecord?.args).toEqual(["tag", "--no-sign", "lw-gpgsign", gpgCommitHash]);
  });

  it("lets an annotated tag follow the signing configuration", async () => {
    await addTag(
      simpleGit(gpgRepo),
      {
        tagName: "ann-gpgsign",
        commitHash: gpgCommitHash,
        lightweight: false,
        message: "Signed release"
      },
      recordCommand
    );

    const tagType = cp
      .execFileSync("git", ["cat-file", "-t", "ann-gpgsign"], { cwd: gpgRepo })
      .toString()
      .trim();
    expect(tagType).toBe("tag");
    // The config was honored, not overridden: git itself invoked the
    // configured gpg program. `-m` kept the editor closed.
    expect(fs.existsSync(gpgMarker)).toBe(true);
    expect(fs.existsSync(editorMarker)).toBe(false);

    const lastRecord = records[records.length - 1];
    expect(lastRecord?.args).toEqual([
      "tag",
      "-a",
      "ann-gpgsign",
      "-m",
      "Signed release",
      gpgCommitHash
    ]);
    expect(lastRecord?.args).not.toContain("--no-sign");
    expect(lastRecord?.args).not.toContain("--sign");
  });
});
