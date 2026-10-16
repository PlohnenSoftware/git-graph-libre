import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { ENGINE_BINARY_NAME, ENGINE_PLATFORM_DIRECTORIES } from "@/backend/engine/addon";
import { pruneUnusedEngineBinaries } from "@/backend/engine/prune";

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

/** A fabricated `engine/native` tree: one directory per name, binary of `size` bytes. */
function makeNativeRoot(directories: readonly string[], size = 100): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-prune-"));
  roots.push(root);
  for (const dir of directories) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, ENGINE_BINARY_NAME), Buffer.alloc(size));
  }
  return root;
}

function remaining(root: string): string[] {
  return fs.readdirSync(root).sort();
}

describe("pruneUnusedEngineBinaries", () => {
  it("keeps the host's Linux build and removes the other five", async () => {
    const root = makeNativeRoot(ENGINE_PLATFORM_DIRECTORIES);

    const result = await pruneUnusedEngineBinaries(root, ["linux-x64"]);

    expect(result.removed.sort()).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "win32-arm64-msvc",
      "win32-x64-msvc"
    ]);
    expect(result.freedBytes).toBe(500);
    expect(remaining(root)).toEqual(["linux-x64"]);
  });

  it("keeps the single fixed directory of a Windows host", async () => {
    const root = makeNativeRoot(ENGINE_PLATFORM_DIRECTORIES);

    const result = await pruneUnusedEngineBinaries(root, ["win32-x64-msvc"]);

    expect(result.removed).toHaveLength(5);
    expect(remaining(root)).toEqual(["win32-x64-msvc"]);
  });

  it("removes nothing when the host has no candidate directory", async () => {
    const root = makeNativeRoot(ENGINE_PLATFORM_DIRECTORIES);

    const result = await pruneUnusedEngineBinaries(root, []);

    expect(result).toEqual({ removed: [], freedBytes: 0 });
    expect(remaining(root)).toEqual([...ENGINE_PLATFORM_DIRECTORIES].sort());
  });

  it("removes nothing when no kept directory holds the binary", async () => {
    const root = makeNativeRoot(ENGINE_PLATFORM_DIRECTORIES);
    fs.rmSync(path.join(root, "linux-x64", ENGINE_BINARY_NAME));

    const result = await pruneUnusedEngineBinaries(root, ["linux-x64"]);

    expect(result).toEqual({ removed: [], freedBytes: 0 });
    expect(remaining(root)).toEqual([...ENGINE_PLATFORM_DIRECTORIES].sort());
  });

  it("leaves anything it does not own alone", async () => {
    const root = makeNativeRoot(ENGINE_PLATFORM_DIRECTORIES);
    fs.mkdirSync(path.join(root, "notes"));
    fs.writeFileSync(path.join(root, "notes", ENGINE_BINARY_NAME), "keep me");
    fs.writeFileSync(path.join(root, "README.md"), "keep me too");

    await pruneUnusedEngineBinaries(root, ["darwin-arm64"]);

    expect(remaining(root)).toEqual(["README.md", "darwin-arm64", "notes"]);
    expect(fs.readFileSync(path.join(root, "notes", ENGINE_BINARY_NAME), "utf8")).toBe("keep me");
  });

  it("is idempotent and tolerates a missing tree", async () => {
    const root = makeNativeRoot(ENGINE_PLATFORM_DIRECTORIES);
    await pruneUnusedEngineBinaries(root, ["darwin-x64"]);

    await expect(pruneUnusedEngineBinaries(root, ["darwin-x64"])).resolves.toEqual({
      removed: [],
      freedBytes: 0
    });
    await expect(
      pruneUnusedEngineBinaries(path.join(root, "nope"), ["darwin-x64"])
    ).resolves.toEqual({ removed: [], freedBytes: 0 });
  });
});

describe("ENGINE_PLATFORM_DIRECTORIES", () => {
  it("names exactly the six shipped platform directories", () => {
    expect([...ENGINE_PLATFORM_DIRECTORIES].sort()).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-arm64-msvc",
      "win32-x64-msvc"
    ]);
  });
});
