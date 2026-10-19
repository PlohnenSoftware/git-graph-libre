// Oracle generator for `src/lines_slice_char_sequence.rs` (Phase 17, slice 22d).
//
// Run from the repository root (needs Node 18+ with `fetch`, network access,
// and the repository's own `esbuild`):
//
//   node engine/native/diff/tests/oracle/gen-lines_slice_char_sequence.mjs \
//     > engine/native/diff/tests/data/lines-slice-char-sequence-oracle.txt
//
// It fetches microsoft/vscode's own TypeScript at the pinned commit below
// (`LinesSliceCharSequence` and what it imports), bundles it with esbuild,
// runs it over a seeded corpus, and prints one case per line. A rerun
// reproduces the committed data byte for byte. The fetched VS Code code is
// MIT, Copyright (c) Microsoft Corporation; it is fetched at run time and never
// vendored. This script is part of Git Graph Libre, AGPL-3.0-or-later.
import { build } from 'esbuild';
import path from 'node:path';

const COMMIT = '28a562309973a386b2bdefae78127788a4742fe8';
const BASE = `https://raw.githubusercontent.com/microsoft/vscode/${COMMIT}/`;
const SLICE = 'src/vs/editor/common/diff/defaultLinesDiffComputer/linesSliceCharSequence.ts';

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
      export { LinesSliceCharSequence } from 'vscode-src:${SLICE}';
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
const { LinesSliceCharSequence, Range, OffsetRange } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

// ---- seeded corpus --------------------------------------------------------
let state = 0x2545f491;
const rand = (n) => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return Math.floor((state / 4294967296) * n);
};
const pick = (list) => list[rand(list.length)];

// Pieces that are whole code points (never a lone surrogate): ASCII, words
// with camelCase and digits, separators, JavaScript whitespace beyond the
// space and the tab, combining marks, astral characters, a ZWJ sequence, CJK.
const PIECES = [
  'a', 'b', 'z', 'foo', 'Bar', 'XML', 'x1', '42', '0', ' ', ' ', '  ', '\t', ',', ';', '.', '(', ')', '_', '-',
  'é', 'é', ' ', '　', ' ', '﻿', '\u0085', '​', '\r',
  '\u{1F600}', '\u{1F468}‍\u{1F469}', '\u{10000}', '中文', 'ZeroX',
];
const randomLine = () => {
  let line = '';
  for (let n = rand(9); n > 0; n--) line += pick(PIECES);
  return line;
};

const HAND = [
  [['hello world'], null, true],
  [['  indented', '\tsecond  ', ''], null, false],
  [['fooBar baz1', 'x'], null, true],
  [['a\u{1F600}b', 'c'], [1, 2, 2, 2], true],
  [['\u{1F600}\u{1F600}', '  \u{1F600}  '], null, false],
  [['éé', '　 x﻿'], null, false],
  [['a\r', 'b'], null, true],
  [[''], null, true],
  [['', '', ''], null, false],
  [['   ', '   '], null, false],
  [['abc'], [1, 3, 1, 1], false],
  [['abc', 'def'], [1, 9, 2, 1], false],
];

const units = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16)).join(',');
const unitsOfArray = (a) => a.map((u) => u.toString(16)).join('.');
// Array.from(string) would walk code points; the elements are code units.
const codeUnits = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));
const pos = (p) => `${p.lineNumber}:${p.column}`;

function randomRange(lines) {
  const nLines = lines.length;
  const l1 = 1 + rand(nLines);
  const l2 = rand(8) === 0 ? 1 + rand(nLines) : l1 + rand(nLines - l1 + 1);
  const c = (l) => (rand(3) === 0 ? 1 : 1 + rand(lines[l - 1].length + 5));
  return [l1, c(l1), l2, c(l2)];
}

function oneCase(lines, rangeArr, ws) {
  const range = new Range(...(rangeArr ?? [1, 1, lines.length, lines[lines.length - 1].length + 1]));
  const seq = new LinesSliceCharSequence(lines, range, ws);
  const len = seq.length;
  const elements = [];
  for (let i = 0; i < len; i++) elements.push(seq.getElement(i));
  const scores = [];
  for (let i = 0; i <= len + 2; i++) scores.push(seq.getBoundaryScore(i));
  const translated = [];
  for (let i = 0; i <= len + 2; i++) translated.push(`${pos(seq.translateOffset(i, 'right'))}/${pos(seq.translateOffset(i, 'left'))}`);
  const words = [];
  const span = (r) => (r ? `${r.start}-${r.endExclusive}` : 'x');
  for (let i = -1; i <= len + 1; i++) words.push(`${span(seq.findWordContaining(i))}~${span(seq.findSubWordContaining(i))}`);
  const queries = [];
  for (let n = 0; n < 8; n++) {
    const a = rand(len + 1);
    const b = a + rand(len + 1 - a);
    const r = new OffsetRange(a, b);
    const tr = seq.translateRange(r);
    const ext = seq.extendToFullLines(r);
    queries.push(
      `${a}-${b}=${tr.startLineNumber},${tr.startColumn},${tr.endLineNumber},${tr.endColumn}` +
        `/${seq.countLinesIn(r)}/${ext.start}-${ext.endExclusive}/${unitsOfArray(codeUnits(seq.getText(r)))}`,
    );
  }
  const equal = [];
  for (let n = 0; n < 8; n++) {
    const a = rand(len + 3);
    const b = rand(5) === 0 ? a : rand(len + 3);
    equal.push(`${a}-${b}=${seq.isStronglyEqual(a, b) ? 1 : 0}`);
  }
  return [
    lines.map(units).join('|'),
    `${range.startLineNumber},${range.startColumn},${range.endLineNumber},${range.endColumn}`,
    ws ? 1 : 0,
    elements.map((e) => e.toString(16)).join(','),
    scores.join(','),
    translated.join(' '),
    words.join(' '),
    queries.join(' '),
    equal.join(' '),
  ].join(';');
}

const out = [
  '# Oracle corpus for lines_slice_char_sequence.rs, one case per line, nine `;`-separated fields:',
  '# lines (UTF-16 units in hex, comma-separated, lines joined by `|`); range `sl,sc,el,ec`; whitespace flag',
  '# (1 = considerWhitespaceChanges); elements (hex); getBoundaryScore(0..=len+2); translateOffset(0..=len+2)',
  '# as `right/left` line:column pairs; findWordContaining~findSubWordContaining(-1..=len+1) as start-end or x;',
  '# range queries `s-e=translateRange/countLinesIn/extendToFullLines/getText`; isStronglyEqual `a-b=0|1`.',
  '# Expected values were produced by running microsoft/vscode\'s LinesSliceCharSequence',
  `# (${SLICE}`,
  `# at commit ${COMMIT}, MIT, Copyright (c) Microsoft Corporation) over hand-picked and seeded cases.`,
  '# Regenerate with engine/native/diff/tests/oracle/gen-lines_slice_char_sequence.mjs.',
];
for (const [lines, range, ws] of HAND) out.push(oneCase(lines, range, ws));
for (let n = 0; n < 400; n++) {
  const lines = Array.from({ length: 1 + rand(4) }, randomLine);
  out.push(oneCase(lines, rand(4) === 0 ? null : randomRange(lines), rand(2) === 0));
}
process.stdout.write(out.join('\n') + '\n');
