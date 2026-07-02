import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { archiveFormatFromPath, createArchive } from "@/backend/actions/archive";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("archive actions", () => {
  it("detects supported archive formats from output paths", () => {
    expect(archiveFormatFromPath("/tmp/release.tar")).toBe("tar");
    expect(archiveFormatFromPath("/tmp/release.ZIP")).toBe("zip");
    expect(archiveFormatFromPath("/tmp/release.tar.gz")).toBeNull();
    expect(archiveFormatFromPath("/tmp/release")).toBeNull();
  });

  it("creates a tar archive with command metadata", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => "");

    await createArchive(
      git,
      {
        repo: "/repo",
        ref: "main",
        outputFilePath: "/tmp/release.tar",
        format: "tar"
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenCalledWith([
      "archive",
      "--format=tar",
      "-o",
      "/tmp/release.tar",
      "main"
    ]);
    expect(records[0]).toMatchObject({
      label: "archive.create",
      kind: "action",
      repo: "/repo",
      args: ["archive", "--format=tar", "-o", "/tmp/release.tar", "main"],
      success: true
    });
  });

  it("creates a zip archive for tags", async () => {
    const git = gitWithRaw(async () => "");

    await createArchive(git, {
      repo: "/repo",
      ref: "v1.0.0",
      outputFilePath: "/tmp/release.zip",
      format: "zip"
    });

    expect(git.raw).toHaveBeenCalledWith([
      "archive",
      "--format=zip",
      "-o",
      "/tmp/release.zip",
      "v1.0.0"
    ]);
  });

  it("rejects empty refs, empty paths, and unsupported formats before running git", async () => {
    const git = gitWithRaw(async () => "");

    await expect(
      createArchive(git, {
        repo: "/repo",
        ref: " ",
        outputFilePath: "/tmp/release.zip",
        format: "zip"
      })
    ).rejects.toThrow("Git reference is required");
    await expect(
      createArchive(git, {
        repo: "/repo",
        ref: "main",
        outputFilePath: " ",
        format: "zip"
      })
    ).rejects.toThrow("Archive path is required");
    await expect(
      createArchive(git, {
        repo: "/repo",
        ref: "main",
        outputFilePath: "/tmp/release.gz",
        format: "gz" as "zip"
      })
    ).rejects.toThrow("Archive format must be tar or zip");
    expect(git.raw).not.toHaveBeenCalled();
  });
});
