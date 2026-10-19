import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import { _DefaultLinesDiffComputer, _initWasm } from "@vscode/diff";
import { beforeAll, describe, expect, it } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import { diffTexts } from "@/backend/engine/diffTexts";

/**
 * Phase 17 differential suite (22h, made five-way by 22i): five arms over
 * VS Code's 58 vendored fixtures — the fixtures' expected JSON,
 * `@vscode/diff`'s TypeScript and WebAssembly backends, and this port's
 * WebAssembly build and native engine build (through 22j's `diffTexts`
 * seam) — plus a seeded generated corpus for the computing arms that must
 * agree everywhere (ours and TypeScript).
 *
 * Our arms need their builds first — `pnpm run diff:wasm` and
 * `pnpm run engine:build` (decision D5: a local dev test for now); without
 * either build the five-way tests skip, like the engine-addon tests.
 * Moves exist only in the expected JSON and our builds (the package
 * computes none), so they are compared only between those arms. The
 * package's WebAssembly backend differs on `noisy-move1` and
 * `ts-example1` (measured and pinned in `vscodeDiffOracles.test.ts`);
 * every pair that involves it is asserted unequal there and equal
 * everywhere else — nothing is loosened.
 */
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/vscode-diff");
const OUR_WASM_PATH = path.resolve(__dirname, "../../engine/target/diff-wasm/git_graph_diff.js");

type RangePair = { originalRange: string; modifiedRange: string };
type FixtureDiff = RangePair & { innerChanges: RangePair[] | null };
type FixtureMove = RangePair & { changes: FixtureDiff[] };
type FixtureFile = { content: string; fileName: string };
type ExpectedDiff = {
  original: FixtureFile;
  modified: FixtureFile;
  diffs: FixtureDiff[];
  moves?: FixtureMove[];
};
type DiffCase = {
  firstContent: string;
  secondContent: string;
  firstLines: string[];
  secondLines: string[];
  ignoreTrimWhitespace: boolean;
  extendToSubwords: boolean;
  computeMoves: boolean;
};
type Fixture = DiffCase & { name: string; expected: ExpectedDiff };
type LineRangeLike = { startLineNumber: number; endLineNumberExclusive: number };
type CharRangeLike = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};
type ChangeLike = {
  original: LineRangeLike;
  modified: LineRangeLike;
  innerChanges: { original: CharRangeLike; modified: CharRangeLike }[] | null;
};
type MoveLike = { original: LineRangeLike; modified: LineRangeLike; changes: ChangeLike[] };
/** One arm's answer in fixture format; `moves` is null where an arm computes none. */
type ArmResult = { diffs: FixtureDiff[]; moves: FixtureMove[] | null; hitTimeout: boolean };

/** Reads a fixture file with VS Code's fixture-runner EOL normalization. */
function readFixtureFile(dir: string, file: string): string {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function requiredFile(files: string[], prefix: string, fixture: string): string {
  const file = files.find((name) => name.startsWith(prefix));
  if (!file) throw new Error(`fixture ${fixture} has no file starting with ${prefix}`);
  return file;
}

function loadFixture(name: string): Fixture {
  const dir = path.join(FIXTURES_DIR, name);
  const files = fs.readdirSync(dir).sort();
  const firstContent = readFixtureFile(dir, requiredFile(files, "1.", name));
  const secondContent = readFixtureFile(dir, requiredFile(files, "2.", name));
  const expectedText = fs.readFileSync(path.join(dir, "advanced.expected.diff.json"), "utf8");
  return {
    name,
    firstContent,
    secondContent,
    firstLines: firstContent.split("\n"),
    secondLines: secondContent.split("\n"),
    ignoreTrimWhitespace: name.includes("trimws"),
    extendToSubwords: false,
    computeMoves: true,
    expected: JSON.parse(expectedText) as ExpectedDiff
  };
}

const fixtureNames = fs
  .readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const fixtures = fixtureNames.map(loadFixture);

/** Same `EOL` rule as VS Code's fixture runner: the range ends past the last character. */
function formatCharRange(range: CharRangeLike, lines: string[]): string {
  const toLastChar = range.endColumn === lines[range.endLineNumber - 1].length + 1;
  const end = `${range.endLineNumber},${range.endColumn}${toLastChar ? " EOL" : ""}`;
  return `[${range.startLineNumber},${range.startColumn} -> ${end}]`;
}

function formatLineRange(range: LineRangeLike): string {
  return `[${range.startLineNumber},${range.endLineNumberExclusive})`;
}

/** Converts one change to the fixture format: `[2,3)` lines, `[2,1 -> 2,5]` chars. */
function toFixtureDiff(c: DiffCase, change: ChangeLike): FixtureDiff {
  return {
    originalRange: formatLineRange(change.original),
    modifiedRange: formatLineRange(change.modified),
    innerChanges: change.innerChanges
      ? change.innerChanges.map((inner) => ({
          originalRange: formatCharRange(inner.original, c.firstLines),
          modifiedRange: formatCharRange(inner.modified, c.secondLines)
        }))
      : null
  };
}

function toArmResult(
  c: DiffCase,
  changes: ChangeLike[],
  moves: MoveLike[] | null,
  hitTimeout: boolean
): ArmResult {
  return {
    diffs: changes.map((change) => toFixtureDiff(c, change)),
    moves:
      moves === null
        ? null
        : moves.map((move) => ({
            originalRange: formatLineRange(move.original),
            modifiedRange: formatLineRange(move.modified),
            changes: move.changes.map((change) => toFixtureDiff(c, change))
          })),
    hitTimeout
  };
}

// The package arms never compute moves and always run with `computeMoves:
// false` (as in D21's oracle suite); ours follows the case, so fixtures can
// compare moves against the expected JSON. `maxComputationTimeMs` 0 is the
// package's no-timeout value.
function packageOptions(c: DiffCase) {
  return {
    ignoreTrimWhitespace: c.ignoreTrimWhitespace,
    maxComputationTimeMs: 0,
    computeMoves: false,
    extendToSubwords: c.extendToSubwords
  };
}

const tsComputer = new _DefaultLinesDiffComputer();
let packageWasm: Awaited<ReturnType<typeof _initWasm>>;

beforeAll(async () => {
  packageWasm = await _initWasm();
});

function tsDiffs(c: DiffCase): ArmResult {
  const result = tsComputer.computeDiff(c.firstLines, c.secondLines, packageOptions(c));
  const changes: ChangeLike[] = result.changes.map((change) => ({
    original: change.original,
    modified: change.modified,
    innerChanges: change.innerChanges
      ? change.innerChanges.map((inner) => ({
          original: inner.originalRange,
          modified: inner.modifiedRange
        }))
      : null
  }));
  return toArmResult(c, changes, null, result.hitTimeout);
}

function packageWasmDiffs(c: DiffCase): ArmResult {
  const result = packageWasm.computeDiffLines(c.firstLines, c.secondLines, packageOptions(c));
  const range = (
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ): CharRangeLike => ({ startLineNumber, startColumn, endLineNumber, endColumn });
  const changes: ChangeLike[] = result.changes.map((change) => ({
    original: change.original,
    modified: change.modified,
    innerChanges: change.innerChanges
      ? change.innerChanges.map((inner) => ({
          original: range(
            inner.originalStartLine,
            inner.originalStartColumn,
            inner.originalEndLine,
            inner.originalEndColumn
          ),
          modified: range(
            inner.modifiedStartLine,
            inner.modifiedStartColumn,
            inner.modifiedEndLine,
            inner.modifiedEndColumn
          )
        }))
      : null
  }));
  return toArmResult(c, changes, null, result.hitTimeout);
}

type OurWasm = {
  computeDiff: (
    original: string,
    modified: string,
    ignoreTrimWhitespace: boolean,
    computeMoves: boolean,
    extendToSubwords: boolean,
    maxComputationTimeMs: number
  ) => string;
};
type OurDetailed = {
  original: LineRangeLike;
  modified: LineRangeLike;
  innerChanges: { originalRange: CharRangeLike; modifiedRange: CharRangeLike }[] | null;
};
type OurResponse =
  | {
      changes: OurDetailed[];
      moves: { original: LineRangeLike; modified: LineRangeLike; changes: OurDetailed[] }[];
      hitTimeout: boolean;
    }
  | { error: string };

const ourWasm: OurWasm | null = fs.existsSync(OUR_WASM_PATH)
  ? (createRequire(__filename)(OUR_WASM_PATH) as OurWasm)
  : null;

function ourDetailed(change: OurDetailed): ChangeLike {
  return {
    original: change.original,
    modified: change.modified,
    innerChanges: change.innerChanges
      ? change.innerChanges.map((inner) => ({
          original: inner.originalRange,
          modified: inner.modifiedRange
        }))
      : null
  };
}

function ourDiffs(c: DiffCase): ArmResult {
  if (!ourWasm) throw new Error("our wasm build is missing: run pnpm run diff:wasm first");
  const text = ourWasm.computeDiff(
    c.firstContent,
    c.secondContent,
    c.ignoreTrimWhitespace,
    c.computeMoves,
    c.extendToSubwords,
    0
  );
  const parsed = JSON.parse(text) as OurResponse;
  if ("error" in parsed) throw new Error(`our wasm build failed: ${parsed.error}`);
  const moves: MoveLike[] = parsed.moves.map((move) => ({
    original: move.original,
    modified: move.modified,
    changes: move.changes.map(ourDetailed)
  }));
  return toArmResult(c, parsed.changes.map(ourDetailed), moves, parsed.hitTimeout);
}

const nativeCandidate = loadEngineAddon();
const nativeAddon = typeof nativeCandidate?.diffTexts === "function" ? nativeCandidate : null;

/** The native arm: the same crate through 22j's seam; a null answer is a failure here. */
async function ourNativeDiffs(c: DiffCase): Promise<ArmResult> {
  if (!nativeAddon) {
    throw new Error("engine addon with diffTexts is missing: run pnpm run engine:build first");
  }
  const diff = await diffTexts(
    c.firstContent,
    c.secondContent,
    {
      ignoreTrimWhitespace: c.ignoreTrimWhitespace,
      maxComputationTimeMs: 0,
      computeMoves: c.computeMoves,
      extendToSubwords: c.extendToSubwords
    },
    { backend: () => "auto", addonProvider: () => nativeAddon }
  );
  if (diff === null) throw new Error("native arm failed: the seam answered null");
  return toArmResult(c, diff.changes, diff.moves, diff.hitTimeout);
}

type ArmId = "expected" | "ts" | "packageWasm" | "ourWasm" | "ourNative";
type Arm = { id: ArmId; label: string; run: (c: DiffCase) => ArmResult | Promise<ArmResult> };
type NamedResult = { id: ArmId; label: string; result: ArmResult };

/** The four computing arms; with the expected JSON they make the five-way suite. */
const computedArms: Arm[] = [
  { id: "ts", label: "@vscode/diff TypeScript", run: tsDiffs },
  { id: "packageWasm", label: "@vscode/diff WebAssembly", run: packageWasmDiffs },
  { id: "ourWasm", label: "our WebAssembly", run: ourDiffs },
  { id: "ourNative", label: "our native", run: ourNativeDiffs }
];

function expectedResult(fixture: Fixture): NamedResult {
  return {
    id: "expected",
    label: "expected JSON",
    result: {
      diffs: fixture.expected.diffs,
      moves: fixture.expected.moves ?? [],
      hitTimeout: false
    }
  };
}

const KNOWN_WASM_DIFFERENCES: Readonly<Record<string, string>> = {
  "noisy-move1": "change 4 of 13 coarser: [42,45)/[91,176) at col 1, not [42,44)/[91,175) at col 9",
  "ts-example1": "2 expected changes merged into 1: [9,15)/[9,80) at col 1"
};

function expectPair(fixtureName: string, a: NamedResult, b: NamedResult): void {
  const packageKnown =
    (a.id === "packageWasm" || b.id === "packageWasm") &&
    Object.hasOwn(KNOWN_WASM_DIFFERENCES, fixtureName);
  if (packageKnown) {
    expect(a.result.diffs, `${a.label} vs ${b.label}`).not.toEqual(b.result.diffs);
  } else {
    expect(a.result.diffs, `${a.label} vs ${b.label}`).toEqual(b.result.diffs);
  }
  if (a.result.moves !== null && b.result.moves !== null) {
    expect(a.result.moves, `${a.label} vs ${b.label} moves`).toEqual(b.result.moves);
  }
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
}

const LINE_POOL = [
  "const value = alpha + beta;",
  "\treturn count + result;",
  "function totalgamma(x, y) {",
  "}",
  "",
  "  ",
  "  value += alpha[i] * 2;",
  "// result handling",
  "for (let i = 0; i < index.length; i++) {",
  "let égamma = 'items😀';",
  "const text = '日本語のテキスト';",
  "if (ready && count > 0) {",
  "export class GrowingArray<T> {",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "x",
  "\t\tthis._store[index] = value;"
];

function randomLines(rng: () => number, count: number): string[] {
  return Array.from({ length: count }, () => LINE_POOL[Math.floor(rng() * LINE_POOL.length)]);
}

function pickIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length);
}

function mutateOnce(rng: () => number, lines: string[]): void {
  const at = pickIndex(rng, lines.length);
  const size = 1 + pickIndex(rng, 4);
  switch (pickIndex(rng, 6)) {
    case 0:
      lines[at] = LINE_POOL[pickIndex(rng, LINE_POOL.length)];
      break;
    case 1:
      lines.splice(at, size);
      break;
    case 2:
      lines.splice(at, 0, ...randomLines(rng, size));
      break;
    case 3: {
      const block = lines.splice(at, size);
      lines.splice(pickIndex(rng, lines.length + 1), 0, ...block);
      break;
    }
    case 4:
      lines[at] = ` ${lines[at].trim()} `;
      break;
    default:
      lines.splice(at, 0, ...lines.slice(at, at + size));
  }
}

function generatedCase(rng: () => number): DiffCase {
  const firstLines = randomLines(rng, 4 + pickIndex(rng, 56));
  const secondLines = [...firstLines];
  for (let edits = 1 + pickIndex(rng, 4); edits > 0 && secondLines.length > 0; edits--) {
    mutateOnce(rng, secondLines);
  }
  return {
    firstContent: firstLines.join("\n"),
    secondContent: secondLines.join("\n"),
    firstLines,
    secondLines,
    ignoreTrimWhitespace: rng() < 0.5,
    extendToSubwords: rng() < 0.5,
    // Moves off here: the corpus compares changes only, and VS Code throws
    // on some moved-line inputs. Fixtures cover moves against the expected.
    computeMoves: false
  };
}

const ourBuildsMissing = ourWasm === null || nativeAddon === null;

describe("five-arm differential over the VS Code fixtures", () => {
  it("vendors all 58 fixtures", () => {
    expect(fixtureNames).toHaveLength(58);
  });

  for (const fixture of fixtures) {
    it.skipIf(ourBuildsMissing)(`${fixture.name}: every arm pair agrees`, async () => {
      const results: NamedResult[] = [expectedResult(fixture)];
      for (const arm of computedArms) {
        results.push({ id: arm.id, label: arm.label, result: await arm.run(fixture) });
      }
      for (const named of results) {
        expect(named.result.hitTimeout, `${named.label} hitTimeout`).toBe(false);
      }
      for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
          expectPair(fixture.name, results[i], results[j]);
        }
      }
    });
  }

  it.skipIf(ourBuildsMissing)(
    "matches the TypeScript backend on 300 seeded generated cases",
    async () => {
      const rng = makeRng(20261019);
      for (let index = 0; index < 300; index++) {
        const c = generatedCase(rng);
        const ours = ourDiffs(c);
        const native = await ourNativeDiffs(c);
        const ts = tsDiffs(c);
        expect(ours.hitTimeout, `case ${index} hitTimeout`).toBe(false);
        expect(native.hitTimeout, `case ${index} hitTimeout`).toBe(false);
        expect(ts.hitTimeout, `case ${index} hitTimeout`).toBe(false);
        expect(ours.diffs, `case ${index}`).toEqual(ts.diffs);
        expect(native.diffs, `case ${index}`).toEqual(ts.diffs);
      }
    }
  );

  it.skipIf(ourWasm === null)(
    "throws where VS Code throws (the wasm panic cannot be caught), then keeps working",
    () => {
      if (!ourWasm) throw new Error("our wasm build is missing: run pnpm run diff:wasm first");
      // The 22f throwing input: VS Code's computeMovedLines throws on it.
      const original = [
        "}",
        "",
        "  value += alpha[i] * 2;",
        "\treturn count + result;",
        "",
        "function totalgamma(x, y) {",
        "\treturn count + delta;",
        "}",
        "let égamma = 'items😀';",
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
      expect(() => ourWasm.computeDiff(original, modified, false, true, false, 0)).toThrowError(
        WebAssembly.RuntimeError
      );
      const withoutMoves = JSON.parse(
        ourWasm.computeDiff(original, modified, false, false, false, 0)
      ) as OurResponse;
      if ("error" in withoutMoves) throw new Error(`unexpected error: ${withoutMoves.error}`);
      expect(withoutMoves.changes.length).toBeGreaterThan(0);
    }
  );
});
