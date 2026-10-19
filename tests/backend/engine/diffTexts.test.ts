import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { _DefaultLinesDiffComputer } from "@vscode/diff";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  buildDiffOptions,
  type DiffAddon,
  type DiffDeps,
  diffFileAtRevisions,
  diffTexts,
  type LinesDiff,
  parseLinesDiff
} from "@/backend/engine/diffTexts";
import { setOperationLog } from "@/backend/utils/operationLog";

/**
 * The 22j seam (`diffTexts.ts`): routing with a fake addon, strict payload
 * parsing, and the seam parity test — the real addon against `@vscode/diff`'s
 * TypeScript backend and against VS Code's expected JSON, on all 58 vendored
 * fixtures (Phase 17 slice 17.7). The parity half runs only when an addon is
 * built (`pnpm run engine:build`); otherwise it skips with a message.
 */

const VALID_DIFF = JSON.stringify({
  changes: [
    {
      original: { startLineNumber: 2, endLineNumberExclusive: 3 },
      modified: { startLineNumber: 2, endLineNumberExclusive: 3 },
      innerChanges: [
        {
          originalRange: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 2 },
          modifiedRange: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 2 }
        }
      ]
    }
  ],
  moves: [],
  hitTimeout: false
});

function fakeAddon(result: string | Error) {
  const diffTextsFn = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  );
  const diffFileFn = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  );
  return {
    provider: (): DiffAddon => ({ diffTexts: diffTextsFn, diffFileAtRevisions: diffFileFn }),
    diffTextsFn,
    diffFileFn
  };
}

const engineDeps = (provider: () => DiffAddon | null): DiffDeps => ({
  backend: () => "auto",
  addonProvider: provider,
  isVerified: () => true
});

async function withLog<T>(run: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  try {
    return { result: await run(), lines };
  } finally {
    log.dispose();
  }
}

describe("buildDiffOptions", () => {
  it("defaults every option off, with no time limit", () => {
    expect(JSON.parse(buildDiffOptions({}))).toEqual({
      ignoreTrimWhitespace: false,
      maxComputationTimeMs: 0,
      computeMoves: false,
      extendToSubwords: false
    });
  });

  it("carries the options through and floors the time limit", () => {
    expect(
      JSON.parse(
        buildDiffOptions({
          ignoreTrimWhitespace: true,
          maxComputationTimeMs: 500.9,
          computeMoves: true,
          extendToSubwords: true
        })
      )
    ).toEqual({
      ignoreTrimWhitespace: true,
      maxComputationTimeMs: 500,
      computeMoves: true,
      extendToSubwords: true
    });
    expect(JSON.parse(buildDiffOptions({ maxComputationTimeMs: -5 })).maxComputationTimeMs).toBe(0);
  });
});

describe("parseLinesDiff", () => {
  it("maps a valid payload onto the project types", () => {
    expect(parseLinesDiff(VALID_DIFF)).toEqual({
      changes: [
        {
          original: { startLineNumber: 2, endLineNumberExclusive: 3 },
          modified: { startLineNumber: 2, endLineNumberExclusive: 3 },
          innerChanges: [
            {
              original: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 2 },
              modified: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 2 }
            }
          ]
        }
      ],
      moves: [],
      hitTimeout: false
    });
  });

  it("accepts null inner changes and flattens a move's line mapping", () => {
    const payload = JSON.stringify({
      changes: [
        {
          original: { startLineNumber: 1, endLineNumberExclusive: 1 },
          modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
          innerChanges: null
        }
      ],
      moves: [
        {
          lineRangeMapping: {
            original: { startLineNumber: 3, endLineNumberExclusive: 5 },
            modified: { startLineNumber: 8, endLineNumberExclusive: 10 }
          },
          changes: []
        }
      ],
      hitTimeout: true
    });
    expect(parseLinesDiff(payload)).toEqual({
      changes: [
        {
          original: { startLineNumber: 1, endLineNumberExclusive: 1 },
          modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
          innerChanges: null
        }
      ],
      moves: [
        {
          original: { startLineNumber: 3, endLineNumberExclusive: 5 },
          modified: { startLineNumber: 8, endLineNumberExclusive: 10 },
          changes: []
        }
      ],
      hitTimeout: true
    });
  });

  it.each([
    ["not JSON", "["],
    ["the binary marker", JSON.stringify({ contents: null, binary: true })],
    ["no hitTimeout", JSON.stringify({ changes: [], moves: [] })],
    ["no moves", JSON.stringify({ changes: [], hitTimeout: false })],
    [
      "a fractional line number",
      JSON.stringify({
        changes: [
          {
            original: { startLineNumber: 1.5, endLineNumberExclusive: 2 },
            modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
            innerChanges: null
          }
        ],
        moves: [],
        hitTimeout: false
      })
    ],
    [
      "a negative column",
      JSON.stringify({
        changes: [
          {
            original: { startLineNumber: 1, endLineNumberExclusive: 2 },
            modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
            innerChanges: [
              {
                originalRange: {
                  startLineNumber: 1,
                  startColumn: -1,
                  endLineNumber: 1,
                  endColumn: 2
                },
                modifiedRange: {
                  startLineNumber: 1,
                  startColumn: 1,
                  endLineNumber: 1,
                  endColumn: 2
                }
              }
            ]
          }
        ],
        moves: [],
        hitTimeout: false
      })
    ]
  ])("refuses %s", (_name, payload) => {
    expect(parseLinesDiff(payload)).toBeNull();
  });
});

describe("diffTexts routing", () => {
  it("serves the engine diff and logs the engine route", async () => {
    const addon = fakeAddon(VALID_DIFF);
    const { result, lines } = await withLog(() =>
      diffTexts("a\nb\n", "a\nc\n", { computeMoves: true }, engineDeps(addon.provider))
    );
    expect(result?.changes).toHaveLength(1);
    expect(addon.diffTextsFn).toHaveBeenCalledWith(
      "a\nb\n",
      "a\nc\n",
      buildDiffOptions({ computeMoves: true })
    );
    expect(lines).toContainEqual(expect.stringContaining("operation=diffTexts backend=engine"));
  });

  it("answers null when the addon has no diffTexts", async () => {
    const { result, lines } = await withLog(() =>
      diffTexts(
        "a",
        "b",
        {},
        engineDeps(() => ({}))
      )
    );
    expect(result).toBeNull();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffTexts backend=cli reason=noDiffTexts")
    );
  });

  it("answers null on the git-cli backend without loading the addon", async () => {
    const addon = fakeAddon(VALID_DIFF);
    const load = vi.fn(addon.provider);
    const { result, lines } = await withLog(() =>
      diffTexts("a", "b", {}, { backend: () => "git-cli", addonProvider: load })
    );
    expect(result).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffTexts backend=cli reason=setting")
    );
  });

  it("answers null when no addon loads", async () => {
    const { result, lines } = await withLog(() =>
      diffTexts(
        "a",
        "b",
        {},
        engineDeps(() => null)
      )
    );
    expect(result).toBeNull();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffTexts backend=cli reason=engineUnavailable")
    );
  });

  it("maps an addon rejection — the port's Unsupported included — to null, never a throw", async () => {
    const addon = fakeAddon(new Error("Unsupported: index out of bounds"));
    const { result, lines } = await withLog(() =>
      diffTexts("a", "b", {}, engineDeps(addon.provider))
    );
    expect(result).toBeNull();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffTexts backend=cli reason=engineThrew")
    );
  });

  it("answers null on a malformed payload", async () => {
    const addon = fakeAddon("{}");
    const { result, lines } = await withLog(() =>
      diffTexts("a", "b", {}, engineDeps(addon.provider))
    );
    expect(result).toBeNull();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffTexts backend=cli reason=malformedPayload")
    );
  });
});

describe("diffFileAtRevisions routing", () => {
  const call = (deps: DiffDeps) =>
    diffFileAtRevisions("/repo", "HEAD~1", "HEAD", "old.ts", "new.ts", {}, deps);

  it("serves the engine diff across a rename's two paths", async () => {
    const addon = fakeAddon(VALID_DIFF);
    const { result, lines } = await withLog(() => call(engineDeps(addon.provider)));
    expect(result && "changes" in result ? result.changes : null).toHaveLength(1);
    expect(addon.diffFileFn).toHaveBeenCalledWith(
      "/repo",
      "HEAD~1",
      "HEAD",
      "old.ts",
      "new.ts",
      buildDiffOptions({})
    );
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffFileAtRevisions backend=engine")
    );
  });

  it("serves the binary marker as binary", async () => {
    const addon = fakeAddon(JSON.stringify({ contents: null, binary: true }));
    const { result } = await withLog(() => call(engineDeps(addon.provider)));
    expect(result).toEqual({ binary: true });
  });

  it("answers null for an unverified repository without loading the addon", async () => {
    const addon = fakeAddon(VALID_DIFF);
    const load = vi.fn(addon.provider);
    const { result, lines } = await withLog(() =>
      call({ backend: () => "auto", addonProvider: load, isVerified: () => false })
    );
    expect(result).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffFileAtRevisions backend=cli reason=unverified")
    );
  });

  it("answers null when the addon has no diffFileAtRevisions", async () => {
    const { result, lines } = await withLog(() => call(engineDeps(() => ({}))));
    expect(result).toBeNull();
    expect(lines).toContainEqual(
      expect.stringContaining(
        "operation=diffFileAtRevisions backend=cli reason=noDiffFileAtRevisions"
      )
    );
  });

  it("maps a rejection to null, never a throw", async () => {
    const addon = fakeAddon(new Error("Unsupported: boom"));
    const { result, lines } = await withLog(() => call(engineDeps(addon.provider)));
    expect(result).toBeNull();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=diffFileAtRevisions backend=cli reason=engineThrew")
    );
  });
});

/* ---------- Seam parity: the real addon against the TypeScript backend ---------- */

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures/vscode-diff");

type RangePair = { originalRange: string; modifiedRange: string };
type FixtureDiff = RangePair & { innerChanges: RangePair[] | null };

/** Reads a fixture file with VS Code's fixture-runner EOL normalization (as D21 does). */
function readFixtureFile(dir: string, file: string): string {
  return fs
    .readFileSync(path.join(dir, file), "utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
}

function fixtureSides(name: string): {
  original: string;
  modified: string;
  expected: FixtureDiff[];
} {
  const dir = path.join(FIXTURES_DIR, name);
  const files = fs.readdirSync(dir).sort();
  const first = files.find((file) => file.startsWith("1."));
  const second = files.find((file) => file.startsWith("2."));
  if (!first || !second) throw new Error(`fixture ${name} is missing a side`);
  const expected = JSON.parse(
    fs.readFileSync(path.join(dir, "advanced.expected.diff.json"), "utf8")
  ) as { diffs: FixtureDiff[] };
  return {
    original: readFixtureFile(dir, first),
    modified: readFixtureFile(dir, second),
    expected: expected.diffs
  };
}

const fixtureNames = fs
  .readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/** Same `EOL` rule as VS Code's fixture runner: the range ends past the last character. */
function formatRange(
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number },
  lines: string[]
): string {
  const toLastChar = range.endColumn === lines[range.endLineNumber - 1].length + 1;
  return `[${range.startLineNumber},${range.startColumn} -> ${range.endLineNumber},${range.endColumn}${toLastChar ? " EOL" : ""}]`;
}

/** A seam diff in VS Code's fixture format, so it can meet the other oracles. */
function canonical(
  diff: LinesDiff,
  originalLines: string[],
  modifiedLines: string[]
): FixtureDiff[] {
  return diff.changes.map((change) => ({
    originalRange: `[${change.original.startLineNumber},${change.original.endLineNumberExclusive})`,
    modifiedRange: `[${change.modified.startLineNumber},${change.modified.endLineNumberExclusive})`,
    innerChanges:
      change.innerChanges === null
        ? null
        : change.innerChanges.map((inner) => ({
            originalRange: formatRange(inner.original, originalLines),
            modifiedRange: formatRange(inner.modified, modifiedLines)
          }))
  }));
}

const tsComputer = new _DefaultLinesDiffComputer();

/** `@vscode/diff`'s TypeScript backend in the same fixture format. */
function tsCanonical(
  originalLines: string[],
  modifiedLines: string[],
  ignoreTrimWhitespace: boolean
): FixtureDiff[] {
  const result = tsComputer.computeDiff(originalLines, modifiedLines, {
    ignoreTrimWhitespace,
    maxComputationTimeMs: 0,
    computeMoves: false,
    extendToSubwords: false
  });
  return result.changes.map((change) => ({
    originalRange: `[${change.original.startLineNumber},${change.original.endLineNumberExclusive})`,
    modifiedRange: `[${change.modified.startLineNumber},${change.modified.endLineNumberExclusive})`,
    innerChanges: change.innerChanges
      ? change.innerChanges.map((inner) => ({
          originalRange: formatRange(inner.originalRange, originalLines),
          modifiedRange: formatRange(inner.modifiedRange, modifiedLines)
        }))
      : null
  }));
}

describe("seam parity against @vscode/diff's TypeScript backend", () => {
  for (const name of fixtureNames) {
    it(`${name}: seam, TypeScript backend and expected JSON agree`, async (context) => {
      const addon = loadEngineAddon();
      if (typeof addon?.diffTexts !== "function") {
        context.skip("Engine addon with diffTexts not built — run pnpm run engine:build.");
        return;
      }
      const { original, modified, expected } = fixtureSides(name);
      const originalLines = original.split("\n");
      const modifiedLines = modified.split("\n");
      const ignoreTrimWhitespace = name.includes("trimws");
      const seam = await diffTexts(
        original,
        modified,
        { ignoreTrimWhitespace },
        {
          backend: () => "auto",
          addonProvider: () => addon
        }
      );
      expect(seam).not.toBeNull();
      expect(seam?.hitTimeout).toBe(false);
      expect(seam?.moves).toEqual([]);
      const seamDiffs = canonical(seam as LinesDiff, originalLines, modifiedLines);
      expect(seamDiffs).toEqual(tsCanonical(originalLines, modifiedLines, ignoreTrimWhitespace));
      expect(seamDiffs).toEqual(expected);
    });
  }
});

describe("diffFileAtRevisions against a real repository", () => {
  const dirs: string[] = [];
  afterEach(() => {
    loadEngineAddon()?.closeAllRepositories();
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function show(repo: string, object: string): string {
    return cp.execFileSync("git", ["show", object], { cwd: repo, encoding: "utf8" });
  }

  it("agrees with diffTexts over git show, across modify, rename, add and binary", async (context) => {
    const addon = loadEngineAddon();
    if (typeof addon?.diffFileAtRevisions !== "function" || typeof addon.diffTexts !== "function") {
      context.skip("Engine addon with the diff exports not built — run pnpm run engine:build.");
      return;
    }
    const repo = makeRepo();
    dirs.push(repo);
    fs.writeFileSync(path.join(repo, "f.txt"), "one\ntwo\nthree\n");
    fs.writeFileSync(path.join(repo, "bin.dat"), Buffer.from([0x00, 0x01, 0x02]));
    git(["add", "."], repo);
    git(["commit", "-m", "first"], repo);
    fs.renameSync(path.join(repo, "f.txt"), path.join(repo, "g.txt"));
    fs.writeFileSync(path.join(repo, "g.txt"), "one\nTWO\nthree\nfour\n");
    fs.writeFileSync(path.join(repo, "bin.dat"), Buffer.from([0x00, 0x03]));
    fs.writeFileSync(path.join(repo, "new.txt"), "fresh\n");
    git(["add", "-A"], repo);
    git(["commit", "-m", "second"], repo);

    const deps: DiffDeps = {
      backend: () => "auto",
      addonProvider: () => addon,
      isVerified: () => true
    };
    const renamed = await diffFileAtRevisions(repo, "HEAD~1", "HEAD", "f.txt", "g.txt", {}, deps);
    const viaTexts = await diffTexts(
      show(repo, "HEAD~1:f.txt"),
      show(repo, "HEAD:g.txt"),
      {},
      deps
    );
    expect(renamed).toEqual(viaTexts);
    expect(renamed && "changes" in renamed ? renamed.changes.length : 0).toBeGreaterThan(0);

    const added = await diffFileAtRevisions(repo, "HEAD~1", "HEAD", "new.txt", "new.txt", {}, deps);
    expect(added).toEqual(await diffTexts("", show(repo, "HEAD:new.txt"), {}, deps));

    const binary = await diffFileAtRevisions(
      repo,
      "HEAD~1",
      "HEAD",
      "bin.dat",
      "bin.dat",
      {},
      deps
    );
    expect(binary).toEqual({ binary: true });
  });
});

/* ---------- A seeded generated set, and a throwing input ---------- */

/** A linear congruential generator, so the generated set is the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const LINE_POOL = [
  "function total(x, y) {",
  "\treturn count + delta;",
  "}",
  "",
  "  value += alpha[i] * 2;",
  "let égamma = 'items\u{1F600}';",
  "// result handling",
  "const camelCaseName = snake_case_name;"
];

function generatedPair(random: () => number): { original: string; modified: string } {
  const pick = () => LINE_POOL[Math.floor(random() * LINE_POOL.length)] as string;
  const original = Array.from({ length: 3 + Math.floor(random() * 25) }, pick);
  const modified = original.flatMap((line) => {
    const roll = random();
    if (roll < 0.15) return [];
    if (roll < 0.3) return [line, pick()];
    if (roll < 0.45) return [`${line}  `];
    return [line];
  });
  return { original: original.join("\n"), modified: modified.join("\n") };
}

describe("seam parity on a seeded generated set", () => {
  it("matches @vscode/diff's TypeScript backend on 60 generated pairs", async (context) => {
    const addon = loadEngineAddon();
    if (typeof addon?.diffTexts !== "function") {
      context.skip("Engine addon with diffTexts not built — run pnpm run engine:build.");
      return;
    }
    const random = seededRandom(22);
    for (let index = 0; index < 60; index++) {
      const { original, modified } = generatedPair(random);
      const ignoreTrimWhitespace = index % 2 === 0;
      const seam = await diffTexts(
        original,
        modified,
        { ignoreTrimWhitespace },
        { backend: () => "auto", addonProvider: () => addon }
      );
      const originalLines = original.split("\n");
      const modifiedLines = modified.split("\n");
      expect(seam, `case ${index}`).not.toBeNull();
      expect(canonical(seam as LinesDiff, originalLines, modifiedLines), `case ${index}`).toEqual(
        tsCanonical(originalLines, modifiedLines, ignoreTrimWhitespace)
      );
    }
  });
});

describe("a throwing input", () => {
  // One of 22g's cases on which VS Code's computeMovedLines throws; the Rust test
  // `a_throwing_input_becomes_an_error_not_a_panic` uses the same texts.
  const original = [
    "}",
    "",
    "  value += alpha[i] * 2;",
    "\treturn count + result;",
    "",
    "function totalgamma(x, y) {",
    "\treturn count + delta;",
    "}",
    "let égamma = 'items\u{1F600}';",
    "// result handling",
    "",
    "  "
  ].join("\n");
  const modified = [
    "// result handling",
    "",
    "  ",
    "",
    "for (let i = 0; i < index.length; i++) {",
    "}",
    "",
    "  value += alpha[i] * 2;",
    "\treturn count + result;",
    "// value handling",
    "function totalgamma(x, y) {   ",
    "\treturn count + delta;",
    "}"
  ].join("\n");

  it("rejects from the addon as an Unsupported error and the seam answers null", async (context) => {
    const addon = loadEngineAddon();
    if (typeof addon?.diffTexts !== "function") {
      context.skip("Engine addon with diffTexts not built — run pnpm run engine:build.");
      return;
    }
    await expect(
      addon.diffTexts(original, modified, JSON.stringify({ computeMoves: true }))
    ).rejects.toThrow(/^Unsupported: /);
    const seam = await diffTexts(
      original,
      modified,
      { computeMoves: true },
      { backend: () => "auto", addonProvider: () => addon }
    );
    expect(seam).toBeNull();
    // Without moves the same texts diff normally, as in VS Code.
    const plain = await diffTexts(
      original,
      modified,
      {},
      {
        backend: () => "auto",
        addonProvider: () => addon
      }
    );
    expect(plain?.changes.length).toBeGreaterThan(0);
  });
});
