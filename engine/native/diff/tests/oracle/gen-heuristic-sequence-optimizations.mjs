// Oracle generator for `src/heuristic_sequence_optimizations.rs` (Phase 17, slice 22e).
//
// Run from the repository root (needs Node 18+ with `fetch`, network access,
// and the repository's own `esbuild`, so `pnpm install` first):
//
//   node engine/native/diff/tests/oracle/gen-heuristic-sequence-optimizations.mjs \
//     > engine/native/diff/tests/data/heuristic-sequence-optimizations-oracle.txt
//
// It fetches microsoft/vscode's own TypeScript at the pinned commit below
// (`heuristicSequenceOptimizations.ts`, `lineSequence.ts`,
// `linesSliceCharSequence.ts`, the Myers algorithm and what they import),
// bundles it with esbuild, runs every exported optimization over a seeded
// corpus and prints it to stdout. A rerun reproduces the committed data byte
// for byte (the seed is fixed). The fetched VS Code code is MIT, Copyright (c)
// Microsoft Corporation; it is fetched at run time and never vendored. This
// script is part of Git Graph Libre, AGPL-3.0-or-later.
//
// Format (after the `#` header): `S` lines open a scenario (two sequences),
// `T` lines are cases on the latest scenario, one `W` line pins the floating
// point weight tables. Fields are `;`-separated:
//   S;C;<lines1>;<range1>;<lines2>;<range2>;<ws>   two LinesSliceCharSequence
//   S;L;<lines1>;<hashes1>;<lines2>;<hashes2>      two LineSequence
//   S;P;<elements1>;<elements2>                    two plain sequences (no boundary scores)
//   T;<operation>;<diffs in>;<diffs out>
//   W;<count>;<hash of Math.pow(x,1.5) table>;<hash of the weight table>;<threshold bits>
// `lines` are UTF-16 units in hex joined by `,`, lines joined by `|`; `range`
// is `sl,sc,el,ec`; `ws` is considerWhitespaceChanges; hashes and elements are
// decimal numbers joined by `,`; diffs are `s1-e1:s2-e2` joined by spaces, `.`
// when empty. Operations: optimize, short, extend-word, extend-word-force,
// extend-sub, extend-sub-force, very-short-lines, very-short-text.
import { build } from 'esbuild';
import path from 'node:path';

const COMMIT = '28a562309973a386b2bdefae78127788a4742fe8';
const BASE = `https://raw.githubusercontent.com/microsoft/vscode/${COMMIT}/`;
const DIFF = 'src/vs/editor/common/diff/defaultLinesDiffComputer';

const cache = new Map();
async function fetchSource(file) {
  if (!cache.has(file)) {
    const res = await fetch(BASE + file);
    if (!res.ok) throw new Error(`${res.status} fetching ${file}`);
    cache.set(file, await res.text());
  }
  return cache.get(file);
}

const vscodeSources = {
  name: 'vscode-sources',
  setup(b) {
    b.onResolve({ filter: /^vscode-src:/ }, (a) => ({
      path: a.path.slice('vscode-src:'.length),
      namespace: 'gh',
    }));
    b.onResolve({ filter: /^\./, namespace: 'gh' }, (a) => ({
      path: path.posix.join(path.posix.dirname(a.importer), a.path.replace(/\.js$/, '.ts')),
      namespace: 'gh',
    }));
    b.onLoad({ filter: /.*/, namespace: 'gh' }, async (a) => ({
      contents: await fetchSource(a.path),
      loader: 'ts',
    }));
  },
};

const bundle = await build({
  stdin: {
    contents: `
      export * from 'vscode-src:${DIFF}/heuristicSequenceOptimizations.ts';
      export { LineSequence } from 'vscode-src:${DIFF}/lineSequence.ts';
      export { LinesSliceCharSequence } from 'vscode-src:${DIFF}/linesSliceCharSequence.ts';
      export { MyersDiffAlgorithm } from 'vscode-src:${DIFF}/algorithms/myersDiffAlgorithm.ts';
      export { SequenceDiff } from 'vscode-src:${DIFF}/algorithms/diffAlgorithm.ts';
      export { Range } from 'vscode-src:src/vs/editor/common/core/range.ts';
      export { OffsetRange } from 'vscode-src:src/vs/editor/common/core/ranges/offsetRange.ts';`,
    resolveDir: '/',
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [vscodeSources],
  logLevel: 'error',
});
const code = bundle.outputFiles[0].text;
const vs = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const { LineSequence, LinesSliceCharSequence, MyersDiffAlgorithm, SequenceDiff, Range, OffsetRange } = vs;

// ---- seeded random --------------------------------------------------------
let state = 0x1badc0de;
const rand = (n) => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return Math.floor((state / 4294967296) * n);
};
const pick = (list) => list[rand(list.length)];
const chance = (n) => rand(n) === 0;

// ---- text -----------------------------------------------------------------
// Tokens are whole code points (never a lone surrogate): code-like words,
// camelCase, digits, separators, JavaScript whitespace beyond space and tab,
// combining marks, astral characters, CJK.
const WORDS = [
  'foo', 'Bar', 'bazQux', 'x1', '42', 'if', 'else', 'return', 'levelPerBracket', 'collectBrackets',
  'IBar', 'ITransaction', 'observableValue', 'import', 'from', 'Foo', 'a', 'b', 'XML', 'ZeroX',
];
const PUNCT = ['(', ')', '{', '}', ',', ';', '=', '+', '.', '"', "'", '_', '-', '[', ']', ' + 1'];
const SPACES = [' ', ' ', ' ', '  ', '\t', ' ', ' ', '　'];
const ODD = ['é', '\u{1F600}', '中文', '\u{10000}', '﻿', '\u0085', '​'];
const token = () => {
  const r = rand(20);
  if (r < 9) return pick(WORDS);
  if (r < 15) return pick(PUNCT);
  if (r < 19) return pick(SPACES);
  return pick(ODD);
};
const randomLine = (size) => {
  let line = chance(4) ? pick(SPACES).repeat(1 + rand(3)) : '';
  for (let n = rand(size); n > 0; n--) line += token() + (chance(3) ? pick(SPACES) : '');
  return line;
};
const randomText = () => {
  const size = pick([4, 8, 8, 16, 30]);
  return Array.from({ length: 1 + rand(chance(4) ? 6 : 3) }, () => randomLine(size));
};
// A modified copy: a few token-level and character-level edits.
const mutateLine = (line) => {
  const parts = line.split(/(?<=[ (){},;=+.])/u);
  const edited = [];
  for (const part of parts) {
    const r = rand(12);
    if (r === 0) continue;
    if (r === 1) edited.push(token());
    else if (r === 2) edited.push(part + token());
    else if (r === 3 && part.length > 1) edited.push(part.slice(0, 1) + 'e' + part.slice(2));
    else edited.push(part);
  }
  return edited.join('');
};
const mutateText = (lines) => {
  const edited = [];
  for (const line of lines) {
    const r = rand(10);
    if (r === 0) continue;
    edited.push(r < 6 ? mutateLine(line) : line);
    if (r === 9) edited.push(randomLine(8));
  }
  return edited.length ? edited : [randomLine(6)];
};

// ---- serialization --------------------------------------------------------
const unitsOf = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16)).join(',');
const linesOf = (lines) => lines.map(unitsOf).join('|');
const diffsOf = (diffs) =>
  diffs.length ? diffs.map((d) => `${d.seq1Range.start}-${d.seq1Range.endExclusive}:${d.seq2Range.start}-${d.seq2Range.endExclusive}`).join(' ') : '.';
const rangeOf = (r) => `${r.startLineNumber},${r.startColumn},${r.endLineNumber},${r.endColumn}`;
const copy = (diffs) => diffs.map((d) => new SequenceDiff(new OffsetRange(d.seq1Range.start, d.seq1Range.endExclusive), new OffsetRange(d.seq2Range.start, d.seq2Range.endExclusive)));

// A diff list is valid when it is sorted, its diffs do not touch, and the
// equal stretches around them have equal lengths in both sequences.
function validDiffs(diffs, len1, len2) {
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i];
    if (d.seq1Range.start - p1 !== d.seq2Range.start - p2) return false;
    if (i > 0 && d.seq1Range.start - p1 < 1) return false;
    p1 = d.seq1Range.endExclusive;
    p2 = d.seq2Range.endExclusive;
  }
  return len1 - p1 === len2 - p2 && p1 <= len1 && p2 <= len2;
}
// Random valid diffs that need not be an actual diff of the elements.
function syntheticDiffs(len1, len2) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const diffs = [];
    let p1 = 0;
    let p2 = 0;
    const count = rand(5);
    for (let i = 0; i < count; i++) {
      const gap = i === 0 ? rand(6) : 1 + rand(6);
      const d1 = rand(5);
      const d2 = i === count - 1 ? d1 + (len2 - len1) - (p2 - p1) : rand(5);
      const s1 = p1 + gap;
      const s2 = p2 + gap;
      if (d2 < 0 || (d1 === 0 && d2 === 0) || s1 + d1 > len1 || s2 + d2 > len2) break;
      diffs.push(new SequenceDiff(new OffsetRange(s1, s1 + d1), new OffsetRange(s2, s2 + d2)));
      p1 = s1 + d1;
      p2 = s2 + d2;
    }
    if (diffs.length === count && validDiffs(diffs, len1, len2)) return diffs;
  }
  return [];
}

const out = [];
let skipped = 0;
function emit(op, input, fn) {
  let result;
  try {
    result = fn(copy(input));
  } catch {
    skipped++;
    return input;
  }
  out.push(`T;${op};${diffsOf(input)};${diffsOf(result)}`);
  return result;
}

const plainBoundary = { getBoundaryScore: undefined };

function charScenario(lines1, range1, lines2, range2, ws) {
  const s1 = new LinesSliceCharSequence(lines1, range1, ws);
  const s2 = new LinesSliceCharSequence(lines2, range2, ws);
  out.push(`S;C;${linesOf(lines1)};${rangeOf(range1)};${linesOf(lines2)};${rangeOf(range2)};${ws ? 1 : 0}`);
  const myers = new MyersDiffAlgorithm().compute(s1, s2).diffs;
  const sets = [myers, myers, syntheticDiffs(s1.length, s2.length), syntheticDiffs(s1.length, s2.length)];
  const ops = [
    ['optimize', (d) => vs.optimizeSequenceDiffs(s1, s2, d)],
    ['short', (d) => vs.removeShortMatches(s1, s2, d)],
    ['extend-word', (d) => vs.extendDiffsToEntireWordIfAppropriate(s1, s2, d, (s, i) => s.findWordContaining(i))],
    ['extend-word-force', (d) => vs.extendDiffsToEntireWordIfAppropriate(s1, s2, d, (s, i) => s.findWordContaining(i), true)],
    ['extend-sub', (d) => vs.extendDiffsToEntireWordIfAppropriate(s1, s2, d, (s, i) => s.findSubWordContaining(i))],
    ['extend-sub-force', (d) => vs.extendDiffsToEntireWordIfAppropriate(s1, s2, d, (s, i) => s.findSubWordContaining(i), true)],
    ['very-short-text', (d) => vs.removeVeryShortMatchingTextBetweenLongDiffs(s1, s2, d)],
  ];
  sets.forEach((set, n) => {
    if (n === 1) {
      // The flow of `refineDiff`, each stage fed with the previous one's result.
      let d = set;
      for (const name of ['optimize', 'extend-word', 'extend-sub-force', 'short', 'very-short-text']) {
        d = emit(name, d, ops.find(([op]) => op === name)[1]);
      }
      return;
    }
    for (const [name, fn] of ops) emit(name, set, fn);
  });
}

function lineScenario(lines1, lines2) {
  const hashes = new Map();
  const hash = (l) => {
    const t = l.trim();
    if (!hashes.has(t)) hashes.set(t, hashes.size);
    return hashes.get(t);
  };
  const h1 = lines1.map(hash);
  const h2 = lines2.map(hash);
  const s1 = new LineSequence(h1, lines1);
  const s2 = new LineSequence(h2, lines2);
  out.push(`S;L;${linesOf(lines1)};${h1.join(',')};${linesOf(lines2)};${h2.join(',')}`);
  const myers = new MyersDiffAlgorithm().compute(s1, s2).diffs;
  const ops = [
    ['optimize', (d) => vs.optimizeSequenceDiffs(s1, s2, d)],
    ['short', (d) => vs.removeShortMatches(s1, s2, d)],
    ['very-short-lines', (d) => vs.removeVeryShortMatchingLinesBetweenDiffs(s1, s2, d)],
  ];
  let d = myers;
  for (const [name, fn] of ops) d = emit(name, d, fn); // the flow, staged
  for (const set of [myers, syntheticDiffs(s1.length, s2.length), syntheticDiffs(s1.length, s2.length)]) {
    for (const [name, fn] of ops) emit(name, set, fn);
  }
}

class PlainSequence {
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

function plainScenario(e1, e2) {
  const s1 = new PlainSequence(e1);
  const s2 = new PlainSequence(e2);
  out.push(`S;P;${e1.join(',')};${e2.join(',')}`);
  const myers = new MyersDiffAlgorithm().compute(s1, s2).diffs;
  for (const set of [myers, syntheticDiffs(e1.length, e2.length), syntheticDiffs(e1.length, e2.length)]) {
    emit('optimize', set, (d) => vs.optimizeSequenceDiffs(s1, s2, d));
    emit('short', set, (d) => vs.removeShortMatches(s1, s2, d));
  }
}

// ---- hand-picked scenarios ------------------------------------------------
const fullRange = (lines) => new Range(1, 1, lines.length, lines[lines.length - 1].length + 1);
const hand = (a, b, ws = true) => charScenario(a, fullRange(a), b, fullRange(b), ws);
hand(['import { Baz, Bar } from "foo";'], ['import { Baz, Bar, Foo } from "foo";']);
hand(['import { IBar } from "foo";'], ['import { IArr, IBar } from "foo";']);
hand(["import { ITransaction, observableValue, transaction } from 'vs/base/common/observable';"],
  ["import { ITransaction, observableFromEvent, observableValue, transaction } from 'vs/base/common/observable';"]);
hand(['collectBrackets(level + 1, levelPerBracketType);'], ['collectBrackets(level + 1, levelPerBracket + 1, levelPerBracketType);']);
hand(['hello world'], ['hallo welt']);
hand(['  indented words here', '\tsecond  ', ''], ['  indented word here', '\tsecond line  ', ''], false);
hand(['a\u{1F600}b c'], ['a\u{1F601}b d']);
hand(['fooBarBaz quxQuux'], ['fooBazBar quxQuuz']);
hand([''], ['x']);
hand(['x'], ['']);
hand(['same'], ['same']);
hand([
  'const result = computeSomething(firstArgument, secondArgument, thirdArgument) + offsetValue;',
  'return result;',
], [
  'const output = computeSomethingElse(firstArgument, secondArgument, fourthArgument) + offsetValue;',
  'return output;',
]);
lineScenario(['{', '  if (x) {', '    y();', '  }', '}'], ['{', '  if (x) {', '    y();', '    z();', '  }', '}']);
lineScenario(['a', '', 'b', '', 'c'], ['a', '', 'b', '', 'x', '', 'c']);
lineScenario(['a', 'b', 'c', 'd', 'e', 'f'], ['a', 'x', 'c', 'y', 'e', 'f']);
lineScenario(['  a', '\tb'], ['a  ', ' b']);
plainScenario([1, 2, 3, 2, 3, 4], [1, 2, 3, 4]);
plainScenario([1, 2, 1, 2, 1, 2], [1, 2]);

// ---- seeded scenarios -----------------------------------------------------
for (let n = 0; n < 100; n++) {
  const a = randomText();
  const b = chance(6) ? randomText() : mutateText(a);
  const sub = (lines) => {
    if (chance(4)) {
      const l1 = 1 + rand(lines.length);
      const l2 = l1 + rand(lines.length - l1 + 1);
      const col = (l) => (chance(3) ? 1 : 1 + rand(lines[l - 1].length + 3));
      return new Range(l1, col(l1), l2, col(l2));
    }
    return fullRange(lines);
  };
  charScenario(a, sub(a), b, sub(b), !chance(3));
}
const LINE_WORDS = ['{', '}', 'if (x) {', 'y();', 'return;', '', 'a', 'b', 'c', 'else {', '// note', 'foo(bar)', 'x = 1;'];
const randomLines = () =>
  Array.from({ length: rand(chance(4) ? 30 : 10) + 1 }, () => pick(['', '  ', '    ', '\t', '\t\t', ' ']) + pick(LINE_WORDS));
for (let n = 0; n < 120; n++) {
  const a = randomLines();
  const b = a.map((l) => (chance(5) ? pick(LINE_WORDS) : l));
  for (let k = rand(4); k > 0; k--) b.splice(rand(b.length + 1), chance(2) ? 1 : 0, ...(chance(2) ? [] : [pick(LINE_WORDS)]));
  lineScenario(a, b);
}
for (let n = 0; n < 60; n++) {
  const alphabet = 2 + rand(4);
  const e1 = Array.from({ length: rand(30) }, () => rand(alphabet));
  const e2 = chance(3) ? Array.from({ length: rand(30) }, () => rand(alphabet)) : e1.filter(() => !chance(6));
  plainScenario(e1, e2);
}

// Chunky scenarios reach the size thresholds: long changed spans split by a
// short unchanged text (removeVeryShortMatchingTextBetweenLongDiffs), a few
// characters before a long diff (its prefix rule), and blocks of changed lines
// split by `}` or an empty line (removeVeryShortMatchingLinesBetweenDiffs).
const span = (n) => Array.from({ length: n }, () => token()).join('');
for (let n = 0; n < 80; n++) {
  const keep = () => pick(['', ' ', 'x', 'ab', ' ); ', 'end;', 'a b c d e f g h i j k l m n o', 'abcdefghijklmnopqrstuvwxyz']);
  const piece = () => span(10 + rand(30));
  const head = pick(['', 'a', ' b', 'if(', '\t\t']);
  const a = [head + piece() + keep() + piece() + (chance(2) ? keep() + piece() : '')];
  const b = [head + piece() + keep() + piece() + (chance(2) ? keep() + piece() : '')];
  if (chance(3)) {
    a.push(keep());
    b.push(keep());
  }
  charScenario(a, fullRange(a), b, fullRange(b), !chance(3));
}
for (let n = 0; n < 80; n++) {
  const block = () => Array.from({ length: 2 + rand(8) }, () => pick(LINE_WORDS) + rand(100));
  const sep = () => pick([['}'], [''], ['}', ''], ['  }'], ['a'], ['x = 1;', 'y = 2;', 'z = 3;']]);
  const a = [...block(), ...sep(), ...block(), ...(chance(2) ? [...sep(), ...block()] : [])];
  const b = [...block(), ...sep(), ...block(), ...(chance(2) ? [...sep(), ...block()] : [])];
  lineScenario(a, b);
}
// Repeats let diffs shift: the same line or token over and over.
for (let n = 0; n < 60; n++) {
  const unit = pick(['a b ', 'x, ', '{ }', 'ab']);
  const a = [unit.repeat(1 + rand(6)) + 'tail'];
  const b = [unit.repeat(1 + rand(6)) + 'tail'];
  charScenario(a, fullRange(a), b, fullRange(b), true);
  const l = pick(['{', '', '  }', 'a']);
  lineScenario([l, 'x', ...Array(rand(5)).fill(l), 'y'], [l, 'x', ...Array(rand(5)).fill(l), 'z', ...Array(rand(3)).fill(l), 'y']);
}
// Runs longer than the shift limit of 100.
for (let n = 0; n < 6; n++) {
  const l = pick(['{', 'a', '  }']);
  const run = (k) => Array(k).fill(l);
  lineScenario([...run(130 + rand(40)), 'x', 'y'], [...run(100 + rand(40)), 'x', 'y']);
  lineScenario(['x', ...run(120 + rand(40)), 'y'], ['x', ...run(105 + rand(70)), 'y']);
  const unit = pick(['ab', 'a ', 'xyz ']);
  const a = [unit.repeat(60 + rand(40)) + 'q'];
  const b = [unit.repeat(40 + rand(40)) + 'q'];
  charScenario(a, fullRange(a), b, fullRange(b), true);
}

// ---- the floating point weight formula ------------------------------------
// removeVeryShortMatchingTextBetweenLongDiffs sums Math.pow terms of integers
// 0..=130; Rust's powf must agree with V8 on every one, so pin both tables.
const fnv = (values) => {
  let h = 0xcbf29ce484222325n;
  const view = new DataView(new ArrayBuffer(8));
  for (const v of values) {
    view.setFloat64(0, v, true);
    for (let i = 0; i < 8; i++) h = ((h ^ BigInt(view.getUint8(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16);
};
const powers = [];
const weights = [];
for (let x = 0; x <= 130; x++) powers.push(Math.pow(x, 1.5));
for (let x = 0; x <= 130; x++) for (let y = x; y <= 130; y++) weights.push(Math.pow(Math.pow(x, 1.5) + Math.pow(y, 1.5), 1.5));
const max = 2 * 40 + 50;
const thresholdBits = (() => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, ((max ** 1.5) ** 1.5) * 1.3, true);
  return view.getBigUint64(0, true).toString(16);
})();
out.push(`W;${weights.length};${fnv(powers)};${fnv(weights)};${thresholdBits}`);

process.stderr.write(`skipped ${skipped} cases that threw in VS Code\n`);
const header = [
  '# Oracle corpus for heuristic_sequence_optimizations.rs; the format is described in',
  '# engine/native/diff/tests/oracle/gen-heuristic-sequence-optimizations.mjs. Expected values were',
  "# produced by running microsoft/vscode's heuristicSequenceOptimizations.ts",
  `# (${DIFF}/heuristicSequenceOptimizations.ts`,
  `# at commit ${COMMIT}, MIT, Copyright (c) Microsoft Corporation)`,
  '# over hand-picked and seeded scenarios. Regenerate with the script named above.',
];
process.stdout.write(header.concat(out).join('\n') + '\n');
