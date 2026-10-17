import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  nativeContents,
  PLATFORM_DIRECTORIES,
  platformDirectoryFor,
  REQUIRED_EXPORTS,
  readZipEntries,
  readZipEntry,
  runningGlibc,
  runningLibc,
  writeFixtureRepository
} from "../../../engine/scripts/verify-vsix.mjs";
import {
  ENGINE_PLATFORM_DIRECTORIES,
  EXPECTED_ENGINE_VERSION,
  loadEngineAddon,
  platformDirectoriesFor,
  validateLoadedAddon
} from "@/backend/engine/addon";

/**
 * The release check that loads the engine out of the packaged VSIX on every
 * platform before publishing (`.github/workflows/verify-vsix.yml`). It runs on
 * a bare Node, so it mirrors the loader's tables instead of importing them;
 * these cases are what keep the mirror honest, and prove its zip reader and
 * hand-written repository against real bytes and the real engine.
 */

type Entry = { name: string; data: Buffer; deflate: boolean };

/** A minimal zip writer: local headers, data, central directory, end record. */
function zip(entries: Entry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const body = entry.deflate ? zlib.deflateRawSync(entry.data) : entry.data;
    const crc = zlib.crc32(entry.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    parts.push(local, name, body);
    central.push(header, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("verify-vsix mirrors the loader", () => {
  it("maps every platform to the directory the loader reads", () => {
    for (const platform of ["win32", "darwin", "linux", "freebsd"]) {
      for (const arch of ["x64", "arm64", "arm", "ia32"]) {
        expect(platformDirectoryFor(platform, arch)).toBe(
          platformDirectoriesFor(platform, arch)[0]
        );
      }
    }
    expect(Object.values(PLATFORM_DIRECTORIES).toSorted()).toEqual(
      [...ENGINE_PLATFORM_DIRECTORIES].toSorted()
    );
  });

  it("requires exactly the exports the loader requires", () => {
    const complete = Object.fromEntries(
      REQUIRED_EXPORTS.map((name) => [
        name,
        name === "engineVersion" ? () => EXPECTED_ENGINE_VERSION : () => {}
      ])
    );
    expect(validateLoadedAddon(complete)).not.toBeNull();
    for (const name of REQUIRED_EXPORTS) {
      const { [name]: _dropped, ...rest } = complete;
      expect(validateLoadedAddon(rest), name).toBeNull();
    }
  });
});

describe("verify-vsix reads the package", () => {
  const binary = Buffer.from("not really a binary, but bytes all the same\n".repeat(50));
  const shipped = Object.values(PLATFORM_DIRECTORIES).map((dir) => ({
    name: `extension/engine/native/${dir}/git-graph.node`,
    data: binary,
    deflate: true
  }));

  it("reads stored and deflated entries back byte for byte", () => {
    const archive = zip([
      { name: "extension/package.json", data: Buffer.from('{"name":"x"}'), deflate: false },
      ...shipped
    ]);
    const entries = readZipEntries(archive);
    expect(readZipEntry(archive, entries.get("extension/package.json") as never).toString()).toBe(
      '{"name":"x"}'
    );
    expect(readZipEntry(archive, entries.get(shipped[0].name) as never)).toEqual(binary);
  });

  it("refuses an entry whose bytes do not match their CRC", () => {
    const archive = zip([{ name: "a", data: Buffer.from("abc"), deflate: false }]);
    const entries = readZipEntries(archive);
    archive[archive.indexOf("abc")] = "x".charCodeAt(0);
    expect(() => readZipEntry(archive, entries.get("a") as never)).toThrow(/CRC/);
  });

  it("lists the shipped binaries, and anything else under engine/native", () => {
    const entries = readZipEntries(
      zip([
        ...shipped,
        {
          name: "extension/engine/native/linux-x64/src/lib.rs",
          data: Buffer.from(""),
          deflate: false
        }
      ])
    );
    const contents = nativeContents(entries);
    expect(contents.binaries).toEqual(Object.values(PLATFORM_DIRECTORIES).toSorted());
    expect(contents.strays).toEqual(["extension/engine/native/linux-x64/src/lib.rs"]);
  });

  it("knows which C library this Node runs on", () => {
    const libc = runningLibc();
    const glibc = runningGlibc();
    if (process.platform === "linux") expect(["gnu", "musl"]).toContain(libc);
    else expect(libc).toBeNull();
    // A version only on glibc, which is what lets a legacy leg pin its floor.
    if (libc === "gnu") expect(glibc).toMatch(/^2\.\d+$/);
    else expect(glibc).toBeNull();
  });
});

describe("verify-vsix's fixture repository", () => {
  function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-verify-test-"));
    scratch.push(dir);
    return { dir, ...writeFixtureRepository(dir) };
  }

  // Git itself reads the hand-written objects, so the bytes are a real
  // repository and not merely something the engine happens to accept.
  it("is a valid repository Git can read", () => {
    const repo = fixture();
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd: repo.dir,
        encoding: "utf8",
        env: { ...process.env, LC_ALL: "C" }
      });
    expect(git(["fsck", "--strict"])).toBe("");
    expect(git(["rev-parse", "HEAD"]).trim()).toBe(repo.commit);
    expect(git(["show", `HEAD:${repo.file}`])).toBe(repo.contents);
  });

  it.skipIf(loadEngineAddon() === null)("is read back by the real engine", async () => {
    const repo = fixture();
    const addon = loadEngineAddon() as NonNullable<ReturnType<typeof loadEngineAddon>>;
    expect(fs.realpathSync(await (addon.repoRoot?.(repo.dir) ?? ""))).toBe(
      fs.realpathSync(repo.dir)
    );
    expect(JSON.parse(await addon.loadCommitFile(repo.dir, repo.commit, repo.file))).toEqual({
      contents: repo.contents,
      binary: false
    });
    addon.closeRepository(repo.dir);
  });
});
