import * as cp from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import { loadEngineAddon } from "@/backend/engine/addon";
import { diffTexts } from "@/backend/engine/diffTexts";

/**
 * Five-way diff parity over real history (Phase 17 slice 17.6, sub-slice
 * 22i), run by `pnpm run diff:parity` through `scripts/diff-parity.mjs`,
 * outside the default test run like `bench:backends`.
 *
 * The five arms of Phase 17's test strategy are the fixtures' expected
 * JSON, `@vscode/diff`'s TypeScript and WebAssembly backends, and this
 * port's native and WebAssembly builds. Real history has no expected
 * JSON, so this script runs the four computing arms over file pairs from
 * real commits and reports per-pair mismatches and timings; the expected
 * arm is covered on the fixtures by `vscodeDiffDifferential.test.ts`,
 * which is the gate. This script measures and reports; it exits nonzero
 * only when it cannot run at all (a missing build, a bad repository), so
 * a mismatch is data to record, never something tuned away here.
 *
 * Selection, stated in full: the newest `GGL_PARITY_COMMITS` non-merge
 * commits of `GGL_PARITY_REPO` in `git log` order, each diffed against
 * its first parent (the empty tree at a root), every file the commit
 * changed (`git diff --name-status -z --find-renames`). A pair is
 * skipped, and counted, when either side is binary, is not valid UTF-8,
 * or has more than `GGL_PARITY_MAX_LINES` lines. No other cap applies.
 * Repositories are read with `git log`/`git diff`/`git show` only.
 *
 * Both passes use `ignoreTrimWhitespace: false`,
 * `extendToSubwords: false` and VS Code's editor-default computation
 * cap, `maxComputationTimeMs` 5000 (`diffEditor.maxComputationTime`),
 * on every arm; `hitTimeout` is counted per arm and reported with the
 * timings. The cap is what keeps a sweep finite: the first, unbounded
 * run over this repository burned about 83 minutes of CPU on
 * generated-file pairs with multi-megabyte lines (few lines, so the
 * line bound above never caught them) and was killed with nothing
 * flushed. The changes pass runs all
 * four arms with `computeMoves: false` (the package computes no moves);
 * the moves pass runs our two arms with `computeMoves: true` and
 * compares the full result, moves included.
 */

/** VS Code's `diffEditor.maxComputationTime` default, applied to every arm. */
const MAX_TIME_MS = 5000;
const COMMITS = positiveInt("GGL_PARITY_COMMITS", 100);
const MAX_LINES = positiveInt("GGL_PARITY_MAX_LINES", 50000);
const EXAMPLES_PER_PAIR = positiveInt("GGL_PARITY_EXAMPLES", 5);
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const OUR_WASM_PATH = path.resolve(__dirname, "../../../engine/target/diff-wasm/git_graph_diff.js");

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

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
type RawDiff = { changes: ChangeLike[]; moves: MoveLike[] | null; hitTimeout: boolean };

type PairCase = {
  commit: string;
  status: string;
  oldPath: string;
  newPath: string;
  firstContent: string;
  secondContent: string;
  firstLines: string[];
  secondLines: string[];
};

/* ---------- Canonical form: numbers only, order fixed ---------- */

function canonicalChange(change: ChangeLike): unknown[] {
  return [
    change.original.startLineNumber,
    change.original.endLineNumberExclusive,
    change.modified.startLineNumber,
    change.modified.endLineNumberExclusive,
    change.innerChanges === null
      ? null
      : change.innerChanges.map((inner) => [
          inner.original.startLineNumber,
          inner.original.startColumn,
          inner.original.endLineNumber,
          inner.original.endColumn,
          inner.modified.startLineNumber,
          inner.modified.startColumn,
          inner.modified.endLineNumber,
          inner.modified.endColumn
        ])
  ];
}

/** The one string two arms must produce identically to agree. */
export function canonicalDiff(diff: RawDiff, withMoves: boolean): string {
  return JSON.stringify({
    changes: diff.changes.map(canonicalChange),
    moves: withMoves
      ? (diff.moves ?? []).map((move) => [
          move.original.startLineNumber,
          move.original.endLineNumberExclusive,
          move.modified.startLineNumber,
          move.modified.endLineNumberExclusive,
          move.changes.map(canonicalChange)
        ])
      : null,
    hitTimeout: diff.hitTimeout
  });
}

type Outcome = { ok: true; canonical: string } | { ok: false; error: string };

/** Both arms refusing an input agrees; one refusing is a mismatch. */
export function outcomesAgree(a: Outcome, b: Outcome): boolean {
  if (!a.ok || !b.ok) return a.ok === b.ok;
  return a.canonical === b.canonical;
}

type PairStat = { pair: string; compared: number; mismatches: number; examples: string[] };

export function newPairStat(a: string, b: string): PairStat {
  return { pair: `${a} vs ${b}`, compared: 0, mismatches: 0, examples: [] };
}

export function recordPair(stat: PairStat, agree: boolean, example: string, cap: number): void {
  stat.compared += 1;
  if (agree) return;
  stat.mismatches += 1;
  if (stat.examples.length < cap) stat.examples.push(example);
}

/** A compact first difference for a mismatch example. */
function firstDifference(a: Outcome, b: Outcome, labelA: string, labelB: string): string {
  if (!a.ok) return `${labelA} error (${a.error}), ${labelB} produced a diff`;
  if (!b.ok) return `${labelB} error (${b.error}), ${labelA} produced a diff`;
  const parsedA = JSON.parse(a.canonical) as { changes: unknown[] };
  const parsedB = JSON.parse(b.canonical) as { changes: unknown[] };
  const counts = `${labelA} ${parsedA.changes.length} changes, ${labelB} ${parsedB.changes.length}`;
  for (let i = 0; i < Math.min(parsedA.changes.length, parsedB.changes.length); i++) {
    const oneA = JSON.stringify(parsedA.changes[i]);
    const oneB = JSON.stringify(parsedB.changes[i]);
    if (oneA !== oneB) return `${counts}; first differing change ${i}: ${oneA} vs ${oneB}`;
  }
  return `${counts}; changes agree, the difference is in moves or hitTimeout`;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n", 1)[0] ?? message;
}

/* ---------- The arms ---------- */

type ArmId = "ts" | "packageWasm" | "ourWasm" | "ourNative";
type Arm = { id: ArmId; label: string; run: (c: PairCase, moves: boolean) => Promise<RawDiff> };

// `@vscode/diff` is ESM-only, while this bundle is CommonJS (the engine
// loader resolves the addon from `__dirname`), so the package is loaded
// with a dynamic `import()` in `main` rather than a static one.
type DiffPackage = typeof import("@vscode/diff");
let tsComputer: InstanceType<DiffPackage["_DefaultLinesDiffComputer"]>;
let packageWasm: Awaited<ReturnType<DiffPackage["_initWasm"]>>;

function packageOptions() {
  return {
    ignoreTrimWhitespace: false,
    maxComputationTimeMs: MAX_TIME_MS,
    computeMoves: false,
    extendToSubwords: false
  };
}

function tsDiffs(c: PairCase): RawDiff {
  const result = tsComputer.computeDiff(c.firstLines, c.secondLines, packageOptions());
  return {
    changes: result.changes.map((change) => ({
      original: change.original,
      modified: change.modified,
      innerChanges: change.innerChanges
        ? change.innerChanges.map((inner) => ({
            original: inner.originalRange,
            modified: inner.modifiedRange
          }))
        : null
    })),
    moves: null,
    hitTimeout: result.hitTimeout
  };
}

function charRange(one: number, two: number, three: number, four: number): CharRangeLike {
  return { startLineNumber: one, startColumn: two, endLineNumber: three, endColumn: four };
}

function packageWasmDiffs(c: PairCase): RawDiff {
  const result = packageWasm.computeDiffLines(c.firstLines, c.secondLines, packageOptions());
  return {
    changes: result.changes.map((change) => ({
      original: change.original,
      modified: change.modified,
      innerChanges: change.innerChanges
        ? change.innerChanges.map((inner) => ({
            original: charRange(
              inner.originalStartLine,
              inner.originalStartColumn,
              inner.originalEndLine,
              inner.originalEndColumn
            ),
            modified: charRange(
              inner.modifiedStartLine,
              inner.modifiedStartColumn,
              inner.modifiedEndLine,
              inner.modifiedEndColumn
            )
          }))
        : null
    })),
    moves: null,
    hitTimeout: result.hitTimeout
  };
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

let ourWasm: OurWasm | null = null;
const nativeCandidate = loadEngineAddon();
const nativeAddon = typeof nativeCandidate?.diffTexts === "function" ? nativeCandidate : null;

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

function ourWasmDiffs(c: PairCase, moves: boolean): RawDiff {
  if (!ourWasm) throw new Error("our wasm build was not loaded");
  const parsed = JSON.parse(
    ourWasm.computeDiff(c.firstContent, c.secondContent, false, moves, false, MAX_TIME_MS)
  ) as OurResponse;
  if ("error" in parsed) throw new Error(parsed.error);
  return {
    changes: parsed.changes.map(ourDetailed),
    moves: parsed.moves.map((move) => ({
      original: move.original,
      modified: move.modified,
      changes: move.changes.map(ourDetailed)
    })),
    hitTimeout: parsed.hitTimeout
  };
}

async function ourNativeDiffs(c: PairCase, moves: boolean): Promise<RawDiff> {
  if (!nativeAddon) throw new Error("the engine addon with diffTexts was not loaded");
  const diff = await diffTexts(
    c.firstContent,
    c.secondContent,
    {
      ignoreTrimWhitespace: false,
      maxComputationTimeMs: MAX_TIME_MS,
      computeMoves: moves,
      extendToSubwords: false
    },
    { backend: () => "auto", addonProvider: () => nativeAddon }
  );
  if (diff === null) throw new Error("the seam answered null (the port refused this input)");
  return diff;
}

const ARM_DEFS: Arm[] = [
  { id: "ts", label: "@vscode/diff TypeScript", run: async (c) => tsDiffs(c) },
  { id: "packageWasm", label: "@vscode/diff WebAssembly", run: async (c) => packageWasmDiffs(c) },
  { id: "ourWasm", label: "our WebAssembly", run: async (c, moves) => ourWasmDiffs(c, moves) },
  { id: "ourNative", label: "our native", run: ourNativeDiffs }
];

/* ---------- Reading real history (read-only) ---------- */

function gitText(repo: string, args: string[]): string {
  return cp.execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
}

function gitBuffer(repo: string, args: string[]): Buffer {
  return cp.execFileSync("git", args, { cwd: repo, maxBuffer: 512 * 1024 * 1024 });
}

type CommitRef = { hash: string; parent: string | null };

function listCommits(repo: string, count: number): CommitRef[] {
  const text = gitText(repo, ["log", "--no-merges", "-n", String(count), "--format=%H %P"]).trim();
  if (text === "") return [];
  return text.split("\n").map((line) => {
    const [hash, ...parents] = line.split(" ");
    return { hash: hash ?? "", parent: parents[0] ?? null };
  });
}

export type FileEntry = { status: string; oldPath: string; newPath: string };

/** Parses `git diff --name-status -z` output, renames carrying both paths. */
export function parseNameStatus(text: string): FileEntry[] {
  const fields = text.split("\0").filter((field) => field !== "");
  const entries: FileEntry[] = [];
  for (let i = 0; i < fields.length; i++) {
    const status = fields[i] ?? "";
    if (status.startsWith("R") || status.startsWith("C")) {
      entries.push({ status, oldPath: fields[i + 1] ?? "", newPath: fields[i + 2] ?? "" });
      i += 2;
    } else {
      const file = fields[i + 1] ?? "";
      entries.push({ status, oldPath: file, newPath: file });
      i += 1;
    }
  }
  return entries;
}

function entriesFor(repo: string, commit: CommitRef): FileEntry[] {
  const text = gitText(repo, [
    "diff",
    "--name-status",
    "-z",
    "--find-renames",
    commit.parent ?? EMPTY_TREE,
    commit.hash
  ]);
  return parseNameStatus(text);
}

function blob(repo: string, revision: string | null, file: string): Buffer {
  if (revision === null) return Buffer.alloc(0);
  return gitBuffer(repo, ["show", `${revision}:${file}`]);
}

type Skip = { reason: "binary" | "non-UTF-8" | "over the line bound"; detail: string };
type LoadedPair = { pair: PairCase } | { skip: Skip };

function decodeSide(bytes: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function normalize(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function loadPair(repo: string, commit: CommitRef, entry: FileEntry): LoadedPair {
  const firstBytes =
    entry.status === "A" ? Buffer.alloc(0) : blob(repo, commit.parent, entry.oldPath);
  const secondBytes =
    entry.status === "D" ? Buffer.alloc(0) : blob(repo, commit.hash, entry.newPath);
  const name = `${commit.hash.slice(0, 8)} ${entry.newPath}`;
  if (firstBytes.includes(0) || secondBytes.includes(0)) {
    return { skip: { reason: "binary", detail: name } };
  }
  const first = decodeSide(firstBytes);
  const second = decodeSide(secondBytes);
  if (first === null || second === null) return { skip: { reason: "non-UTF-8", detail: name } };
  const firstContent = normalize(first);
  const secondContent = normalize(second);
  const firstLines = firstContent.split("\n");
  const secondLines = secondContent.split("\n");
  const lines = Math.max(firstLines.length, secondLines.length);
  if (lines > MAX_LINES) {
    return { skip: { reason: "over the line bound", detail: `${name} (${lines} lines)` } };
  }
  return {
    pair: {
      commit: commit.hash,
      status: entry.status,
      oldPath: entry.oldPath,
      newPath: entry.newPath,
      firstContent,
      secondContent,
      firstLines,
      secondLines
    }
  };
}

/* ---------- Running and comparing ---------- */

type ArmRun = { outcome: Outcome; hitTimeout: boolean; moveCount: number; ms: number };

async function runArm(arm: Arm, c: PairCase, moves: boolean): Promise<ArmRun> {
  const started = performance.now();
  try {
    const raw = await arm.run(c, moves);
    return {
      outcome: { ok: true, canonical: canonicalDiff(raw, moves) },
      hitTimeout: raw.hitTimeout,
      moveCount: raw.moves === null ? 0 : raw.moves.length,
      ms: performance.now() - started
    };
  } catch (error) {
    return {
      outcome: { ok: false, error: errorText(error) },
      hitTimeout: false,
      moveCount: 0,
      ms: performance.now() - started
    };
  }
}

function describe(c: PairCase): string {
  const paths = c.oldPath === c.newPath ? c.newPath : `${c.oldPath} -> ${c.newPath}`;
  return `${c.commit.slice(0, 8)} ${c.status} ${paths}`;
}

function compareRuns(
  stats: PairStat[],
  arms: Arm[],
  runs: ArmRun[],
  indexes: number[],
  c: PairCase
): void {
  let stat = 0;
  for (let x = 0; x < indexes.length; x++) {
    for (let y = x + 1; y < indexes.length; y++) {
      const a = indexes[x] ?? 0;
      const b = indexes[y] ?? 0;
      const runA = runs[a] as ArmRun;
      const runB = runs[b] as ArmRun;
      const agree = outcomesAgree(runA.outcome, runB.outcome);
      const example = agree
        ? ""
        : `${describe(c)}: ${firstDifference(runA.outcome, runB.outcome, arms[a]?.label ?? "", arms[b]?.label ?? "")}`;
      recordPair(stats[stat] as PairStat, agree, example, EXAMPLES_PER_PAIR);
      stat += 1;
    }
  }
}

function pairStatsFor(arms: Arm[], indexes: number[]): PairStat[] {
  const stats: PairStat[] = [];
  for (let x = 0; x < indexes.length; x++) {
    for (let y = x + 1; y < indexes.length; y++) {
      stats.push(
        newPairStat(arms[indexes[x] ?? 0]?.label ?? "", arms[indexes[y] ?? 0]?.label ?? "")
      );
    }
  }
  return stats;
}

type Totals = { ms: Map<ArmId, number>; errors: Map<ArmId, number>; timeouts: Map<ArmId, number> };

function newTotals(): Totals {
  return { ms: new Map(), errors: new Map(), timeouts: new Map() };
}

function accumulate(totals: Totals, arm: Arm, run: ArmRun): void {
  totals.ms.set(arm.id, (totals.ms.get(arm.id) ?? 0) + run.ms);
  if (!run.outcome.ok) totals.errors.set(arm.id, (totals.errors.get(arm.id) ?? 0) + 1);
  if (run.hitTimeout) totals.timeouts.set(arm.id, (totals.timeouts.get(arm.id) ?? 0) + 1);
}

function pad(text: string, width: number, right = false): string {
  return right ? text.padStart(width) : text.padEnd(width);
}

function printPairStats(title: string, stats: PairStat[]): void {
  console.log(title);
  for (const stat of stats) {
    console.log(`  ${pad(stat.pair, 52)}${pad(`${stat.mismatches}/${stat.compared}`, 14, true)}`);
    for (const example of stat.examples) console.log(`    example: ${example}`);
  }
}

function printTimings(
  title: string,
  totals: Totals,
  arms: Arm[],
  indexes: number[],
  pairs: number
): void {
  console.log(title);
  for (const index of indexes) {
    const arm = arms[index] as Arm;
    const ms = totals.ms.get(arm.id) ?? 0;
    const perPair = pairs === 0 ? 0 : ms / pairs;
    console.log(
      `  ${pad(arm.label, 28)}${pad(`${ms.toFixed(0)} ms total`, 16, true)}${pad(`${perPair.toFixed(2)} ms/pair`, 16, true)}` +
        `  errors ${totals.errors.get(arm.id) ?? 0}, hitTimeout ${totals.timeouts.get(arm.id) ?? 0}`
    );
  }
}

/* ---------- Main ---------- */

function resolveRepo(): string {
  const provided = process.env.GGL_PARITY_REPO;
  if (provided !== undefined && provided !== "") return fs.realpathSync(provided);
  return gitText(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
}

function preflight(): string {
  if (!fs.existsSync(OUR_WASM_PATH)) {
    throw new Error(`no WebAssembly build at ${OUR_WASM_PATH}: run pnpm run diff:wasm first`);
  }
  if (nativeAddon === null) {
    throw new Error("no engine addon with diffTexts: run pnpm run engine:build first");
  }
  ourWasm = createRequire(__filename)(OUR_WASM_PATH) as OurWasm;
  return nativeAddon.engineVersion();
}

type Skips = { counts: Map<string, number>; examples: Map<string, string[]> };

function recordSkip(skips: Skips, skip: Skip): void {
  skips.counts.set(skip.reason, (skips.counts.get(skip.reason) ?? 0) + 1);
  const examples = skips.examples.get(skip.reason) ?? [];
  if (examples.length < EXAMPLES_PER_PAIR) examples.push(skip.detail);
  skips.examples.set(skip.reason, examples);
}

async function main(): Promise<void> {
  const started = performance.now();
  const engineVersion = preflight();
  const diffPackage = await import("@vscode/diff");
  tsComputer = new diffPackage._DefaultLinesDiffComputer();
  packageWasm = await diffPackage._initWasm();
  const repo = resolveRepo();
  const head = gitText(repo, ["rev-parse", "--short", "HEAD"]).trim();
  const commits = listCommits(repo, COMMITS);
  const all = [0, 1, 2, 3];
  const ours = [2, 3];
  const changesStats = pairStatsFor(ARM_DEFS, all);
  const movesStats = pairStatsFor(ARM_DEFS, ours);
  const changesTotals = newTotals();
  const movesTotals = newTotals();
  const skips: Skips = { counts: new Map(), examples: new Map() };
  let filesListed = 0;
  let compared = 0;
  let pairsWithMoves = 0;

  console.log(`diff parity — ${repo}`);
  console.log(`head ${head}; node ${process.version}; engine ${engineVersion}`);
  console.log(
    `commits: newest ${commits.length} non-merge (asked ${COMMITS}), git log order, each vs its first parent`
  );
  console.log(`files: every changed file of those commits (git diff --find-renames), no cap`);
  console.log(
    `skips: binary, non-UTF-8, or over ${MAX_LINES} lines on either side (counted below)`
  );
  console.log(
    `options: ignoreTrimWhitespace false, extendToSubwords false, maxComputationTimeMs ${MAX_TIME_MS} on every arm (hitTimeout counted per arm)`
  );
  console.log("arms: the four computing arms (real history has no expected JSON)");
  console.log("");

  for (const commit of commits) {
    for (const entry of entriesFor(repo, commit)) {
      filesListed += 1;
      const loaded = loadPair(repo, commit, entry);
      if ("skip" in loaded) {
        recordSkip(skips, loaded.skip);
        continue;
      }
      const c = loaded.pair;
      const changesRuns: ArmRun[] = [];
      for (const arm of ARM_DEFS) {
        const run = await runArm(arm, c, false);
        changesRuns.push(run);
        accumulate(changesTotals, arm, run);
      }
      compareRuns(changesStats, ARM_DEFS, changesRuns, all, c);
      const movesRuns: ArmRun[] = [...changesRuns];
      let sawMove = false;
      for (const index of ours) {
        const arm = ARM_DEFS[index] as Arm;
        const run = await runArm(arm, c, true);
        movesRuns[index] = run;
        accumulate(movesTotals, arm, run);
        if (run.moveCount > 0) sawMove = true;
      }
      compareRuns(movesStats, ARM_DEFS, movesRuns, ours, c);
      if (sawMove) pairsWithMoves += 1;
      compared += 1;
      if (compared % 500 === 0) console.log(`  ... ${compared} pairs compared`);
    }
  }

  console.log(
    `files listed ${filesListed}; pairs compared ${compared}; pairs with a move ${pairsWithMoves}`
  );
  for (const reason of ["binary", "non-UTF-8", "over the line bound"] as const) {
    console.log(`skipped ${reason}: ${skips.counts.get(reason) ?? 0}`);
    for (const example of skips.examples.get(reason) ?? []) console.log(`  example: ${example}`);
  }
  console.log("");
  printPairStats("changes pass mismatches (computeMoves false, all four arms):", changesStats);
  printTimings(
    "changes pass timings (arm compute, git reads excluded):",
    changesTotals,
    ARM_DEFS,
    all,
    compared
  );
  console.log("");
  printPairStats(
    "moves pass mismatches (computeMoves true, our two arms, full result):",
    movesStats
  );
  printTimings("moves pass timings:", movesTotals, ARM_DEFS, ours, compared);
  console.log("");
  const mismatchTotal = [...changesStats, ...movesStats].reduce((sum, s) => sum + s.mismatches, 0);
  console.log(
    `verdict: ${mismatchTotal} pair mismatches over ${compared} pairs; ` +
      `wall time ${((performance.now() - started) / 1000).toFixed(1)}s (git reads included)`
  );
}

if (process.env.GGL_DIFF_PARITY === "1") {
  main().catch((error: unknown) => {
    console.error(errorText(error));
    process.exitCode = 1;
  });
}
