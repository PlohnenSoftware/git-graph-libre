import * as fs from "node:fs";
import * as path from "node:path";

import { git, makeRepo } from "@tests/backend/helpers";
import {
  executedCommands,
  resetVscodeMock,
  setConfigurationValue
} from "@tests/webview/__mocks__/vscode";
import { _DefaultLinesDiffComputer } from "@vscode/diff";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadEngineAddon } from "@/backend/engine/addon";
import type { LinesDiff } from "@/backend/engine/diffTexts";
import { setOperationLog } from "@/backend/utils/operationLog";
import type { DiffTabRequest, DiffTabSide } from "@/diffTabTypes";
import {
  createEngineDiffTabSource,
  type EngineDiffTabAddon,
  type EngineDiffTabSourceDeps,
  isDiffTabAvailable,
  mapDiffTabChanges,
  setDiffTabAvailableContext
} from "@/extension/diffTab/engineSource";

/**
 * The engine-backed `DiffTabSource` (D45): each side kind against a fake
 * addon and real temporary repositories, binary/tooLarge/error payloads
 * instead of throws, the mapping, the route line, the context key, and —
 * with a built addon — three VS Code fixtures against `@vscode/diff`.
 */

const EMPTY_DIFF = JSON.stringify({ changes: [], moves: [], hitTimeout: false });
const dirs: string[] = [];

function newRepo(): string {
  const dir = makeRepo();
  dirs.push(dir);
  return dir;
}

function commitFile(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content);
  git(["add", name], dir);
  git(["commit", "-m", `add ${name}`], dir);
}

function fakeAddon(
  handlers: {
    loadCommitFile?: () => Promise<string>;
    loadIndexFile?: () => Promise<string>;
    diffTexts?: (original: string, modified: string, optionsJson: string) => Promise<string>;
  } = {}
) {
  const loadCommitFile = vi.fn(
    handlers.loadCommitFile ??
      (async () => JSON.stringify({ contents: "engine rev", binary: false }))
  );
  const loadIndexFile = vi.fn(
    handlers.loadIndexFile ??
      (async () => JSON.stringify({ contents: "engine index", binary: false }))
  );
  const diffTextsFn = vi.fn(handlers.diffTexts ?? (async () => EMPTY_DIFF));
  const addon: EngineDiffTabAddon = {
    loadCommitFile,
    loadIndexFile,
    diffTexts: diffTextsFn
  };
  return { addon, loadCommitFile, loadIndexFile, diffTextsFn };
}

function engineDeps(addon: EngineDiffTabAddon | null): EngineDiffTabSourceDeps {
  return {
    gitPath: () => "git",
    backend: () => "auto",
    addonProvider: () => addon,
    isVerified: () => true
  };
}

function request(repo: string, left: DiffTabSide, right: DiffTabSide): DiffTabRequest {
  return { repo, left, right, title: "f" };
}

async function loadWithLog(
  deps: EngineDiffTabSourceDeps,
  req: DiffTabRequest
): Promise<{
  payload: Awaited<ReturnType<ReturnType<typeof createEngineDiffTabSource>["load"]>>;
  lines: string[];
}> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  try {
    return { payload: await createEngineDiffTabSource(deps).load(req), lines };
  } finally {
    log.dispose();
  }
}

function diffTabLines(lines: string[]): string[] {
  return lines.filter((line) => line.includes("operation=diffTab"));
}

afterEach(() => {
  resetVscodeMock();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("mapDiffTabChanges", () => {
  it("renames the VS Code shape into line and character spans, inner null to []", () => {
    const diff: LinesDiff = {
      changes: [
        {
          original: { startLineNumber: 2, endLineNumberExclusive: 4 },
          modified: { startLineNumber: 3, endLineNumberExclusive: 4 },
          innerChanges: [
            {
              original: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 3 },
              modified: { startLineNumber: 3, startColumn: 2, endLineNumber: 3, endColumn: 5 }
            }
          ]
        },
        {
          original: { startLineNumber: 6, endLineNumberExclusive: 6 },
          modified: { startLineNumber: 6, endLineNumberExclusive: 7 },
          innerChanges: null
        }
      ],
      moves: [],
      hitTimeout: false
    };

    expect(mapDiffTabChanges(diff)).toEqual([
      {
        original: { start: 2, endExclusive: 4 },
        modified: { start: 3, endExclusive: 4 },
        inner: [
          {
            original: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 3 },
            modified: { startLine: 3, startColumn: 2, endLine: 3, endColumn: 5 }
          }
        ]
      },
      {
        original: { start: 6, endExclusive: 6 },
        modified: { start: 6, endExclusive: 7 },
        inner: []
      }
    ]);
  });
});

describe("createEngineDiffTabSource sides", () => {
  it("reads a revision through the engine and the working tree from disk, one route line", async () => {
    const dir = newRepo();
    fs.writeFileSync(path.join(dir, "work.txt"), "disk one\ndisk two");
    const fake = fakeAddon();

    const { payload, lines } = await loadWithLog(
      engineDeps(fake.addon),
      request(
        dir,
        { kind: "revision", ref: "HEAD", path: "rev.txt" },
        { kind: "workingTree", path: "work.txt" }
      )
    );

    expect(fake.loadCommitFile).toHaveBeenCalledWith(dir, "HEAD", "rev.txt");
    expect(fake.diffTextsFn).toHaveBeenCalledWith(
      "engine rev",
      "disk one\ndisk two",
      expect.any(String)
    );
    expect(payload).toEqual({
      kind: "diff",
      originalLines: ["engine rev"],
      modifiedLines: ["disk one", "disk two"],
      changes: []
    });
    expect(diffTabLines(lines)).toHaveLength(1);
    expect(diffTabLines(lines)[0]).toMatch(
      /operation=diffTab backend=engine read=\d+ diff=\d+ lines=3$/
    );
  });

  it("reads the staged copy through readStagedFile and the empty side as empty", async () => {
    const dir = newRepo();
    const fake = fakeAddon();

    const { payload } = await loadWithLog(
      engineDeps(fake.addon),
      request(dir, { kind: "index", path: "staged.txt" }, { kind: "empty" })
    );

    expect(fake.loadIndexFile).toHaveBeenCalledWith(dir, "staged.txt");
    expect(fake.diffTextsFn).toHaveBeenCalledWith("engine index", "", expect.any(String));
    expect(payload).toEqual({
      kind: "diff",
      originalLines: ["engine index"],
      modifiedLines: [""],
      changes: []
    });
  });

  it("falls back to git show for a revision when the engine read throws", async () => {
    const dir = newRepo();
    commitFile(dir, "rev.txt", "alpha\nbeta");
    const fake = fakeAddon({
      loadCommitFile: async () => {
        throw new Error("NotFound");
      }
    });

    const { payload, lines } = await loadWithLog(
      engineDeps(fake.addon),
      request(dir, { kind: "revision", ref: "HEAD", path: "rev.txt" }, { kind: "empty" })
    );

    expect(payload).toEqual({
      kind: "diff",
      originalLines: ["alpha", "beta"],
      modifiedLines: [""],
      changes: []
    });
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadCommitFile backend=cli reason=engineThrew")
    );
  });

  it("reads a missing revision, index and working-tree path as empty", async () => {
    const dir = newRepo();
    const fake = fakeAddon({
      loadCommitFile: async () => {
        throw new Error("NotFound");
      },
      loadIndexFile: async () => {
        throw new Error("NotFound");
      }
    });
    const source = createEngineDiffTabSource(engineDeps(fake.addon));

    const revisionVsDisk = await source.load(
      request(
        dir,
        { kind: "revision", ref: "HEAD", path: "no-such.txt" },
        { kind: "workingTree", path: "also-missing.txt" }
      )
    );
    expect(revisionVsDisk).toEqual({
      kind: "diff",
      originalLines: [""],
      modifiedLines: [""],
      changes: []
    });

    const indexVsEmpty = await source.load(
      request(dir, { kind: "index", path: "no-such.txt" }, { kind: "empty" })
    );
    expect(indexVsEmpty).toEqual({
      kind: "diff",
      originalLines: [""],
      modifiedLines: [""],
      changes: []
    });
  });

  it("refuses a working-tree path outside the repository instead of throwing", async () => {
    const dir = newRepo();
    const fake = fakeAddon();

    const payload = await createEngineDiffTabSource(engineDeps(fake.addon)).load(
      request(dir, { kind: "workingTree", path: "../outside.txt" }, { kind: "empty" })
    );

    expect(payload.kind).toBe("error");
    expect(payload).toEqual({
      kind: "error",
      message: expect.stringContaining("path outside the repository")
    });
    expect(fake.diffTextsFn).not.toHaveBeenCalled();
  });
});

describe("createEngineDiffTabSource limits and failures", () => {
  it("answers binary for an engine binary revision, without diffing", async () => {
    const dir = newRepo();
    const fake = fakeAddon({
      loadCommitFile: async () => JSON.stringify({ contents: null, binary: true })
    });

    const payload = await createEngineDiffTabSource(engineDeps(fake.addon)).load(
      request(dir, { kind: "revision", ref: "HEAD", path: "bin.dat" }, { kind: "empty" })
    );

    expect(payload).toEqual({ kind: "binary" });
    expect(fake.diffTextsFn).not.toHaveBeenCalled();
  });

  it("answers binary for a staged binary marker and for binary bytes on disk", async () => {
    const dir = newRepo();
    fs.writeFileSync(path.join(dir, "blob.bin"), Buffer.from([0, 1, 2, 65]));
    const fake = fakeAddon({
      loadIndexFile: async () => JSON.stringify({ contents: null, binary: true })
    });
    const source = createEngineDiffTabSource(engineDeps(fake.addon));

    expect(
      await source.load(request(dir, { kind: "index", path: "blob.bin" }, { kind: "empty" }))
    ).toEqual({ kind: "binary" });
    expect(
      await source.load(request(dir, { kind: "empty" }, { kind: "workingTree", path: "blob.bin" }))
    ).toEqual({ kind: "binary" });
    expect(fake.diffTextsFn).not.toHaveBeenCalled();
  });

  it("answers tooLarge past diffEditor.maxFileSize, and no limit at 0", async () => {
    const dir = newRepo();
    fs.writeFileSync(path.join(dir, "work.txt"), "a text well over ten bytes long");
    const fake = fakeAddon();
    const source = createEngineDiffTabSource(engineDeps(fake.addon));
    const req = request(dir, { kind: "empty" }, { kind: "workingTree", path: "work.txt" });

    setConfigurationValue("diffEditor", "maxFileSize", 0.00001);
    expect(await source.load(req)).toEqual({ kind: "tooLarge" });
    expect(fake.diffTextsFn).not.toHaveBeenCalled();

    setConfigurationValue("diffEditor", "maxFileSize", 0);
    expect((await source.load(req)).kind).toBe("diff");
    expect(fake.diffTextsFn).toHaveBeenCalledTimes(1);
  });

  it("passes the user's diff settings to the seam, with moves off", async () => {
    const dir = newRepo();
    const fake = fakeAddon();
    setConfigurationValue("diffEditor", "ignoreTrimWhitespace", false);
    setConfigurationValue("diffEditor", "maxComputationTime", 1234);

    await createEngineDiffTabSource(engineDeps(fake.addon)).load(
      request(dir, { kind: "empty" }, { kind: "empty" })
    );

    const optionsJson = fake.diffTextsFn.mock.calls[0]?.[2] as string;
    expect(JSON.parse(optionsJson)).toEqual({
      ignoreTrimWhitespace: false,
      maxComputationTimeMs: 1234,
      computeMoves: false,
      extendToSubwords: false
    });
  });

  it("answers error instead of throwing when the addon has no diffTexts", async () => {
    const dir = newRepo();
    const fake = fakeAddon();
    const withoutDiff: EngineDiffTabAddon = {
      loadCommitFile: fake.loadCommitFile,
      loadIndexFile: fake.loadIndexFile
    };

    const payload = await createEngineDiffTabSource(engineDeps(withoutDiff)).load(
      request(dir, { kind: "empty" }, { kind: "empty" })
    );

    expect(payload).toEqual({ kind: "error", message: "diff engine unavailable" });
  });

  it("answers error when the diff computation rejects", async () => {
    const dir = newRepo();
    const fake = fakeAddon({
      diffTexts: async () => {
        throw new Error("Unsupported");
      }
    });

    const payload = await createEngineDiffTabSource(engineDeps(fake.addon)).load(
      request(dir, { kind: "empty" }, { kind: "empty" })
    );

    expect(payload).toEqual({ kind: "error", message: "diff engine unavailable" });
  });

  it("marks hitTimeout=1 on the route line when the time limit was reached", async () => {
    const dir = newRepo();
    const fake = fakeAddon({
      diffTexts: async () => JSON.stringify({ changes: [], moves: [], hitTimeout: true })
    });

    const { lines } = await loadWithLog(
      engineDeps(fake.addon),
      request(dir, { kind: "empty" }, { kind: "empty" })
    );

    expect(diffTabLines(lines)[0]).toContain("hitTimeout=1");
  });
});

describe("diffTabAvailable context key", () => {
  it("is true on auto with diffTexts, and the context carries it", () => {
    const fake = fakeAddon();

    expect(isDiffTabAvailable({ backend: () => "auto", addonProvider: () => fake.addon })).toBe(
      true
    );
    expect(
      setDiffTabAvailableContext({ backend: () => "auto", addonProvider: () => fake.addon })
    ).toBe(true);
    expect(executedCommands).toContainEqual([
      "setContext",
      "git-graph-libre.diffTabAvailable",
      true
    ]);
  });

  it("is false without diffTexts and with no addon at all", () => {
    const fake = fakeAddon();
    const withoutDiff: EngineDiffTabAddon = {
      loadCommitFile: fake.loadCommitFile,
      loadIndexFile: fake.loadIndexFile
    };

    expect(isDiffTabAvailable({ backend: () => "auto", addonProvider: () => withoutDiff })).toBe(
      false
    );
    expect(isDiffTabAvailable({ backend: () => "auto", addonProvider: () => null })).toBe(false);
    expect(
      setDiffTabAvailableContext({ backend: () => "auto", addonProvider: () => withoutDiff })
    ).toBe(false);
    expect(executedCommands).toContainEqual([
      "setContext",
      "git-graph-libre.diffTabAvailable",
      false
    ]);
  });

  it("is false on the git-cli backend without loading the addon", () => {
    const fake = fakeAddon();
    const addonProvider = vi.fn(() => fake.addon);

    expect(isDiffTabAvailable({ backend: () => "git-cli", addonProvider })).toBe(false);
    expect(addonProvider).not.toHaveBeenCalled();
    expect(setDiffTabAvailableContext({ backend: () => "git-cli", addonProvider })).toBe(false);
    expect(executedCommands).toContainEqual([
      "setContext",
      "git-graph-libre.diffTabAvailable",
      false
    ]);
  });
});

/* ---------- Acceptance: three fixtures through the real engine ---------- */

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures/vscode-diff");

/** A fixture side with VS Code's fixture-runner EOL normalization (D21). */
function fixtureSide(name: string, prefix: string): string {
  const dir = path.join(FIXTURES_DIR, name);
  const file = fs.readdirSync(dir).find((candidate) => candidate.startsWith(prefix));
  if (file === undefined) throw new Error(`fixture ${name} has no file starting with ${prefix}`);
  return fs
    .readFileSync(path.join(dir, file), "utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
}

const tsComputer = new _DefaultLinesDiffComputer();

/** `@vscode/diff`'s TypeScript backend, mapped the same way as the source. */
function tsMappedChanges(originalLines: string[], modifiedLines: string[]) {
  const result = tsComputer.computeDiff(originalLines, modifiedLines, {
    ignoreTrimWhitespace: false,
    maxComputationTimeMs: 0,
    computeMoves: false,
    extendToSubwords: false
  });
  const charRange = (range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  }) => ({
    startLineNumber: range.startLineNumber,
    startColumn: range.startColumn,
    endLineNumber: range.endLineNumber,
    endColumn: range.endColumn
  });
  const diff: LinesDiff = {
    changes: result.changes.map((change) => ({
      original: change.original,
      modified: change.modified,
      innerChanges: change.innerChanges
        ? change.innerChanges.map((inner) => ({
            original: charRange(inner.originalRange),
            modified: charRange(inner.modifiedRange)
          }))
        : null
    })),
    moves: [],
    hitTimeout: result.hitTimeout
  };
  return mapDiffTabChanges(diff);
}

describe("fixture acceptance through the real engine", () => {
  for (const name of ["minimal-diff-character", "deletion", "indentation"]) {
    it(`${name}: the source matches @vscode/diff's TypeScript backend, mapped the same way`, async (context) => {
      const addon = loadEngineAddon();
      if (typeof addon?.diffTexts !== "function") {
        context.skip("Engine addon with diffTexts not built — run pnpm run engine:build.");
        return;
      }
      const dir = newRepo();
      const original = fixtureSide(name, "1.");
      const modified = fixtureSide(name, "2.");
      fs.writeFileSync(path.join(dir, "original.txt"), original);
      fs.writeFileSync(path.join(dir, "modified.txt"), modified);
      setConfigurationValue("diffEditor", "ignoreTrimWhitespace", false);
      setConfigurationValue("diffEditor", "maxComputationTime", 0);

      const payload = await createEngineDiffTabSource(engineDeps(addon)).load(
        request(
          dir,
          { kind: "workingTree", path: "original.txt" },
          { kind: "workingTree", path: "modified.txt" }
        )
      );

      expect(payload.kind).toBe("diff");
      if (payload.kind !== "diff") return;
      expect(payload.originalLines).toEqual(original.split("\n"));
      expect(payload.modifiedLines).toEqual(modified.split("\n"));
      expect(payload.changes).toEqual(tsMappedChanges(original.split("\n"), modified.split("\n")));
    });
  }
});
