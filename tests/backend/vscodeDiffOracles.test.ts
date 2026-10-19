import * as fs from "node:fs";
import * as path from "node:path";

import { _DefaultLinesDiffComputer, _initWasm } from "@vscode/diff";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Phase 17 oracle suite (D21): both `@vscode/diff` backends against VS Code's 58
 * vendored `advanced` fixtures. The public computer returns offset edits adapted
 * from a lines diff, so this uses the line-level backends it wraps.
 */
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/vscode-diff");

type RangePair = { originalRange: string; modifiedRange: string };
type FixtureDiff = RangePair & { innerChanges: RangePair[] | null };
type FixtureFile = { content: string; fileName: string };
type ExpectedDiff = { original: FixtureFile; modified: FixtureFile; diffs: FixtureDiff[] };
type Fixture = {
  name: string;
  firstFile: string;
  secondFile: string;
  firstContent: string;
  secondContent: string;
  firstLines: string[];
  secondLines: string[];
  expected: ExpectedDiff;
};
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
type ComputedDiffs = { diffs: FixtureDiff[]; hitTimeout: boolean };

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
  const firstFile = requiredFile(files, "1.", name);
  const secondFile = requiredFile(files, "2.", name);
  const firstContent = readFixtureFile(dir, firstFile);
  const secondContent = readFixtureFile(dir, secondFile);
  const expectedText = fs.readFileSync(path.join(dir, "advanced.expected.diff.json"), "utf8");
  return {
    name,
    firstFile,
    secondFile,
    firstContent,
    secondContent,
    firstLines: firstContent.split("\n"),
    secondLines: secondContent.split("\n"),
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

/** Converts backend changes to the fixture format: `[2,3)` lines, `[2,1 -> 2,5]` chars. */
function toComputed(f: Fixture, changes: ChangeLike[], hitTimeout: boolean): ComputedDiffs {
  const diffs = changes.map((change) => ({
    originalRange: `[${change.original.startLineNumber},${change.original.endLineNumberExclusive})`,
    modifiedRange: `[${change.modified.startLineNumber},${change.modified.endLineNumberExclusive})`,
    innerChanges: change.innerChanges
      ? change.innerChanges.map((inner) => ({
          originalRange: formatCharRange(inner.original, f.firstLines),
          modifiedRange: formatCharRange(inner.modified, f.secondLines)
        }))
      : null
  }));
  return { diffs, hitTimeout };
}

/**
 * Moves are always a known difference: this runs with `computeMoves: false` and
 * never reads the expected `moves` field, because neither backend computes
 * moves. The WebAssembly backend of pinned `@vscode/diff` 0.0.2-87 also differs
 * on the fixtures below, each pinned exactly at the end of this file.
 */
const KNOWN_WASM_DIFFERENCES: Readonly<Record<string, string>> = {
  "noisy-move1": "change 4 of 13 coarser: [42,45)/[91,176) at col 1, not [42,44)/[91,175) at col 9",
  "ts-example1": "2 expected changes merged into 1: [9,15)/[9,80) at col 1"
};

const tsComputer = new _DefaultLinesDiffComputer();
let wasm: Awaited<ReturnType<typeof _initWasm>>;

beforeAll(async () => {
  wasm = await _initWasm();
});

function diffOptions(f: Fixture) {
  // In `@vscode/diff`, maxComputationTimeMs 0 means no timeout.
  return {
    ignoreTrimWhitespace: f.name.includes("trimws"),
    maxComputationTimeMs: 0,
    computeMoves: false,
    extendToSubwords: false
  };
}

function tsDiffs(f: Fixture): ComputedDiffs {
  const result = tsComputer.computeDiff(f.firstLines, f.secondLines, diffOptions(f));
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
  return toComputed(f, changes, result.hitTimeout);
}

function wasmDiffs(f: Fixture): ComputedDiffs {
  const result = wasm.computeDiffLines(f.firstLines, f.secondLines, diffOptions(f));
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
  return toComputed(f, changes, result.hitTimeout);
}

function fixtureByName(name: string): Fixture {
  const fixture = fixtures.find((candidate) => candidate.name === name);
  if (!fixture) throw new Error(`fixture ${name} is missing`);
  return fixture;
}

describe("@vscode/diff oracles against the VS Code fixtures", () => {
  it("vendors all 58 fixtures, with the expected inputs matching the vendored files", () => {
    expect(fixtureNames).toHaveLength(58);
    for (const fixture of fixtures) {
      const sides = [
        [fixture.expected.original, fixture.firstContent, fixture.firstFile],
        [fixture.expected.modified, fixture.secondContent, fixture.secondFile]
      ] as const;
      for (const [file, content, fileName] of sides) {
        expect(file).toEqual({ content, fileName: `./${fileName}` });
      }
    }
  });

  for (const fixture of fixtures) {
    it(`${fixture.name}: both backends match the expected diff (ignoring moves) and agree`, () => {
      const ts = tsDiffs(fixture);
      const wasmResult = wasmDiffs(fixture);
      expect(ts.hitTimeout).toBe(false);
      expect(wasmResult.hitTimeout).toBe(false);
      expect(ts.diffs).toEqual(fixture.expected.diffs);
      if (Object.hasOwn(KNOWN_WASM_DIFFERENCES, fixture.name)) {
        expect(wasmResult.diffs).not.toEqual(fixture.expected.diffs);
        expect(wasmResult.diffs).not.toEqual(ts.diffs);
      } else {
        expect(wasmResult.diffs).toEqual(fixture.expected.diffs);
        expect(wasmResult.diffs).toEqual(ts.diffs);
      }
    });
  }

  it("pins the known WebAssembly difference in noisy-move1", () => {
    const fixture = fixtureByName("noisy-move1");
    const { diffs } = wasmDiffs(fixture);
    expect(diffs).toHaveLength(13);
    expect(diffs[3]).toEqual({
      originalRange: "[42,45)",
      modifiedRange: "[91,176)",
      innerChanges: [{ originalRange: "[42,1 -> 45,1 EOL]", modifiedRange: "[91,1 -> 176,1 EOL]" }]
    });
    const withoutFourth = (list: FixtureDiff[]) => list.filter((_, index) => index !== 3);
    expect(withoutFourth(diffs)).toEqual(withoutFourth(fixture.expected.diffs));
  });

  it("pins the known WebAssembly difference in ts-example1", () => {
    const { diffs } = wasmDiffs(fixtureByName("ts-example1"));
    expect(diffs).toEqual([
      {
        originalRange: "[9,15)",
        modifiedRange: "[9,80)",
        innerChanges: [{ originalRange: "[9,1 -> 15,1]", modifiedRange: "[9,1 -> 80,1]" }]
      }
    ]);
  });
});
