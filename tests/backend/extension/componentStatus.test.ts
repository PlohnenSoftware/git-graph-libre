import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { buildComponentStatus, describeEngineStatus, probeGit } from "@/extension/componentStatus";
import type { GitComponentStatus } from "@/types";

describe("probeGit", () => {
  it("answers with git's own version line through the configured binary", async () => {
    const expected = cp.execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
    await expect(probeGit("git")).resolves.toEqual({
      state: "ok",
      path: "git",
      version: expected
    });
  });

  it("resolves a binary that does not exist to a failure, never a rejection", async () => {
    const missing = path.join(os.tmpdir(), "ngg-no-such-git", "git");
    const status = await probeGit(missing);

    expect(status.state).toBe("failed");
    expect(status.path).toBe(missing);
    expect(status.state === "failed" && status.detail).toContain("ENOENT");
  });

  it.skipIf(process.platform === "win32")(
    "keeps only the first line of a failing binary's stderr",
    async () => {
      // A stand-in git that exits non-zero with a multi-line complaint.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-fake-git-"));
      const fake = path.join(dir, "git");
      fs.writeFileSync(fake, "#!/bin/sh\necho 'first line' >&2\necho 'second line' >&2\nexit 3\n");
      fs.chmodSync(fake, 0o755);
      try {
        await expect(probeGit(fake)).resolves.toEqual({
          state: "failed",
          path: fake,
          detail: "first line"
        });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});

describe("buildComponentStatus", () => {
  it("joins the git probe, the engine state and the last graph load", async () => {
    const probe = vi.fn(
      async (gitPath: string): Promise<GitComponentStatus> => ({
        state: "ok",
        path: gitPath,
        version: "git version 2.99.0"
      })
    );
    const engine = vi.fn(() => ({ state: "off" as const }));

    await expect(
      buildComponentStatus({
        preference: "git-cli",
        gitPath: "/opt/git",
        probe,
        engine,
        graphLoad: () => "setting"
      })
    ).resolves.toEqual({
      git: { state: "ok", path: "/opt/git", version: "git version 2.99.0" },
      engine: { state: "off" },
      graphLoad: "setting"
    });
    expect(probe).toHaveBeenCalledWith("/opt/git");
    expect(engine).toHaveBeenCalledWith("git-cli");
  });

  it("reads the real engine and route by default", async () => {
    const status = await buildComponentStatus({
      preference: "git-cli",
      gitPath: "git",
      probe: async (gitPath) => ({ state: "failed", path: gitPath, detail: "not probed" })
    });

    // `git-cli` never loads the addon, so this is deterministic on any machine.
    expect(status.engine).toEqual({ state: "off" });
  });
});

describe("describeEngineStatus", () => {
  it("names the version and build target of an active engine", () => {
    expect(
      describeEngineStatus({ state: "active", version: "1.0.25", platform: "linux-x64" })
    ).toBe("Rust engine 1.0.25 active (linux-x64)");
  });

  it("says why the engine is off", () => {
    expect(describeEngineStatus({ state: "off" })).toContain("backend setting is git-cli");
  });

  it("carries the reason, the target and the loader's detail when unavailable", () => {
    expect(
      describeEngineStatus({
        state: "unavailable",
        reason: "versionMismatch",
        platform: "linux-x64",
        detail: "found 1.0.24, expected 1.0.25"
      })
    ).toBe(
      "Rust engine unavailable (versionMismatch, linux-x64: found 1.0.24, expected 1.0.25); every read uses the git CLI"
    );
    expect(
      describeEngineStatus({
        state: "unavailable",
        reason: "unsupportedPlatform",
        platform: "linux-arm",
        detail: null
      })
    ).toBe("Rust engine unavailable (unsupportedPlatform, linux-arm); every read uses the git CLI");
  });
});
