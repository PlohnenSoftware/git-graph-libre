// Generates engine/native/diff/tests/data/myers-oracle.txt, the oracle corpus for
// myers_diff_algorithm.rs: one case per line, `a;b;diffs|hit_timeout`, with the
// expected output produced by VS Code's own MyersDiffAlgorithm.
//
// Run from the repository root (needs Node 18+ with `fetch`, network access and `pnpm install`):
//   node engine/native/diff/tests/oracle/gen-myers.mjs > engine/native/diff/tests/data/myers-oracle.txt
// A rerun reproduces the committed file byte for byte (the seed is fixed).
//
// At run time it fetches diffAlgorithm.ts, myersDiffAlgorithm.ts and offsetRange.ts
// from raw.githubusercontent.com (microsoft/vscode) at the pinned commit
// 28a562309973a386b2bdefae78127788a4742fe8 into a temp directory, bundles them
// with the repository's esbuild, and runs them under Node. Nothing of VS Code is
// vendored. The code it fetches is MIT, Copyright (c) Microsoft Corporation. This
// script is AGPL-3.0-or-later like the rest of Git Graph Libre. It also writes two
// tiny stand-ins for BugIndicatingError and forEachAdjacent, and counts V reads
// past the allocation (VS Code's undefined/NaN case) with a counter patched into
// the fetched source, reported on stderr.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const COMMIT = "28a562309973a386b2bdefae78127788a4742fe8";
const RAW = `https://raw.githubusercontent.com/microsoft/vscode/${COMMIT}/`;
const ALGORITHMS = "src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms";
const FILES = [
  `${ALGORITHMS}/diffAlgorithm.ts`,
  `${ALGORITHMS}/myersDiffAlgorithm.ts`,
  "src/vs/editor/common/core/ranges/offsetRange.ts",
];
const HEADER = `# Oracle corpus for myers_diff_algorithm.rs, one case per line: \`a;b;diffs|hit_timeout\`.
# a and b are comma-separated element numbers; diffs are \`s1,e1,s2,e2\` groups separated by spaces.
# Expected values were produced by running microsoft/vscode's MyersDiffAlgorithm.compute
# (src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/myersDiffAlgorithm.ts at commit
# ${COMMIT}, MIT, Copyright (c) Microsoft Corporation) over a seeded
# linear congruential corpus; 179 reads of V past its allocation (VS Code's undefined/NaN case) occur in it.
`;

const dir = mkdtempSync(join(tmpdir(), "gen-myers-"));
try {
  const put = (path, text) => {
    const target = join(dir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  };
  for (const file of FILES) {
    const response = await fetch(`${RAW}${file}`);
    if (!response.ok) {
      throw new Error(`${response.status} fetching ${file}`);
    }
    put(`vscode/${file}`, await response.text());
  }
  put(
    "vscode/src/vs/base/common/errors.ts",
    "export class BugIndicatingError extends Error {}\n",
  );
  put(
    "vscode/src/vs/base/common/arrays.ts",
    `export function forEachAdjacent<T>(arr: T[], f: (item1: T | undefined, item2: T | undefined) => void): void {
	for (let i = 0; i <= arr.length; i++) {
		f(i === 0 ? undefined : arr[i - 1], i === arr.length ? undefined : arr[i]);
	}
}
`,
  );
  // Count reads past the allocation; this changes no behavior.
  const myers = join(dir, `vscode/${ALGORITHMS}/myersDiffAlgorithm.ts`);
  const source = readFileSync(myers, "utf8");
  const counted = source
    .replace("return this.negativeArr[idx];", "if (idx >= this.negativeArr.length) { globalThis.OOB++; }\n\t\t\treturn this.negativeArr[idx];")
    .replace("return this.positiveArr[idx];", "if (idx >= this.positiveArr.length) { globalThis.OOB++; }\n\t\t\treturn this.positiveArr[idx];");
  if (counted === source) {
    throw new Error("could not patch the read counter into myersDiffAlgorithm.ts");
  }
  writeFileSync(myers, counted);

  const bundle = join(dir, "bundle.cjs");
  await build({
    stdin: {
      contents: `export { MyersDiffAlgorithm } from "./vscode/${ALGORITHMS}/myersDiffAlgorithm.ts";`,
      resolveDir: dir,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundle,
    logLevel: "warning",
  });
  globalThis.OOB = 0;
  const { MyersDiffAlgorithm } = createRequire(import.meta.url)(bundle);

  class Sequence {
    constructor(elements) {
      this.elements = elements;
    }
    getElement(offset) {
      return this.elements[offset];
    }
    get length() {
      return this.elements.length;
    }
    isStronglyEqual(a, b) {
      return this.elements[a] === this.elements[b];
    }
  }
  const run = (a, b) => {
    const result = new MyersDiffAlgorithm().compute(new Sequence(a), new Sequence(b));
    const diffs = result.diffs.map(
      (d) => `${d.seq1Range.start},${d.seq1Range.endExclusive},${d.seq2Range.start},${d.seq2Range.endExclusive}`,
    );
    return `${diffs.join(" ")}|${result.hitTimeout}`;
  };
  const codes = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));

  // A seeded linear congruential generator, as the Phase 17 plan prescribes.
  let seed = 987654321;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed >>> 8;
  };
  const generate = (maxLen, alphabet) =>
    Array.from({ length: rnd() % maxLen }, () => rnd() % alphabet);
  const lines = [];
  const add = (a, b) => lines.push(`${a.join(",")};${b.join(",")};${run(a, b)}`);
  for (const [count, maxLen, alphabet] of [
    [150, 12, 3],
    [120, 40, 2],
    [100, 40, 6],
    [40, 130, 2],
    [20, 100, 4],
  ]) {
    for (let i = 0; i < count; i++) {
      add(generate(maxLen, alphabet), generate(maxLen, alphabet));
    }
  }
  for (const [a, b] of [
    ["hello world", "hallo welt"],
    ["abcabba", "cbabac"],
    ["xaxbxcx", "abc"],
    ["abcdefg", "xabcdefgy"],
    ["aaaa", "aa"],
    ["a", "b"],
    ["abc", "abc"],
  ]) {
    add(codes(a), codes(b));
  }
  console.error(`reads past the allocation: ${globalThis.OOB}`);
  process.stdout.write(`${HEADER}${lines.join("\n")}\n`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
