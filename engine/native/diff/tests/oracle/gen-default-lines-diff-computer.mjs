// Oracle generator for `src/default_lines_diff_computer.rs` (Phase 17, slice
// 22f): the whole `DefaultLinesDiffComputer.computeDiff` flow, which the 58
// fixtures reach only partly (small texts, the default options).
//
// Run from the repository root (needs Node 18+ with `fetch`, network access,
// and the repository's own `esbuild`):
//
//   node engine/native/diff/tests/oracle/gen-default-lines-diff-computer.mjs \
//     > engine/native/diff/tests/data/default-lines-diff-computer-oracle.txt
//
// It fetches microsoft/vscode's own TypeScript at the pinned commit below
// (`DefaultLinesDiffComputer` and what it imports), bundles it with esbuild,
// runs `computeDiff` over hand-picked and seeded cases, and prints one case
// per line. A rerun reproduces the committed data byte for byte. The fetched
// VS Code code is MIT, Copyright (c) Microsoft Corporation; it is fetched at
// run time and never vendored. This script is part of Git Graph Libre,
// AGPL-3.0-or-later.
import { build } from 'esbuild';
import path from 'node:path';

const COMMIT = '28a562309973a386b2bdefae78127788a4742fe8';
const BASE = `https://raw.githubusercontent.com/microsoft/vscode/${COMMIT}/`;
const DIFF = 'src/vs/editor/common/diff/defaultLinesDiffComputer/';

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
    contents: `export { DefaultLinesDiffComputer } from 'vscode-src:${DIFF}defaultLinesDiffComputer.ts';`,
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
const { DefaultLinesDiffComputer } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

// ---- seeded corpus --------------------------------------------------------
let state = 0x5eed1f22;
const rand = (n) => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return Math.floor((state / 4294967296) * n);
};
const pick = (list) => list[rand(list.length)];

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'value', 'count', 'items', 'result', 'index', 'total', 'fooBarBaz', 'getHTTPResponse', 'snake_case_name'];
const TEMPLATES = [
  (a, b) => `const ${a} = compute(${b}, ${a});`,
  (a, b) => `if (${a} > ${b}) { return ${a}; }`,
  (a, b) => `${a}.push(${b});`,
  (a) => `for (let i = 0; i < ${a}.length; i++) {`,
  (a, b) => `  ${b} += ${a}[i] * 2;`,
  () => '}',
  () => '',
  (a) => `// ${a} handling`,
  (a, b) => `\treturn ${a} + ${b};`,
  (a, b) => `let é${a} = '${b}\u{1F600}';`,
  (a, b) => `function ${a}${b}(x, y) {`,
  () => '  ',
  (a, b) => ` 　${a} = '日本語 ${b}';﻿`,
  (a, b) => `    ${a}(${b}, "${a} ${b} ${a} ${b}"); `,
];
const freshLine = () => pick(TEMPLATES)(pick(WORDS), pick(WORDS));
const longLine = () => Array.from({ length: 12 + rand(80) }, () => pick(WORDS)).join(' ');

function edit(line) {
  switch (rand(9)) {
    case 0: return `${line} // x`;
    case 1: return line.replaceAll('a', 'e');
    case 2: return `${line}   `;
    case 3: return `  ${line}`;
    case 4: return line.trim();
    case 5: return line.replaceAll(' ', '\t');
    case 6: return line.replace('Bar', 'Qux').replace('count', 'Count');
    case 7: return ` ${line} `;
    default: return line.length > 3 ? line.slice(0, -2) : `${line}zz`;
  }
}

function moveBlock(lines, len) {
  const n = Math.min(len, lines.length);
  const from = rand(lines.length - n + 1);
  const moved = lines.splice(from, n);
  lines.splice(rand(lines.length + 1), 0, ...moved);
}

function mutate(base, { moves, edits, indels }) {
  const lines = [...base];
  for (let i = 0; i < moves; i++) moveBlock(lines, 1 + rand(8));
  for (let i = 0; i < edits; i++) {
    const at = rand(lines.length);
    lines[at] = edit(lines[at]);
  }
  for (let i = 0; i < indels; i++) {
    if (rand(2) === 0 && lines.length > 1) lines.splice(rand(lines.length), 1);
    else lines.splice(rand(lines.length + 1), 0, freshLine());
  }
  return lines;
}

const block = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} statement number ${i + 1};`);

// ---- serialization --------------------------------------------------------
// A line is `encodeURIComponent` of its text; a text is its lines joined by `|`
// (`|` and `;` are escaped inside lines).
const text = (lines) => lines.map(encodeURIComponent).join('|');
const lineRange = (r) => `${r.startLineNumber},${r.endLineNumberExclusive}`;
const charRange = (r) => `${r.startLineNumber},${r.startColumn},${r.endLineNumber},${r.endColumn}`;
const change = (c) =>
  `c${lineRange(c.original)},${lineRange(c.modified)}` +
  (c.innerChanges
    ? c.innerChanges.map((i) => `[${charRange(i.originalRange)}>${charRange(i.modifiedRange)}]`).join('')
    : '!');
const move = (m) =>
  `m${lineRange(m.lineRangeMapping.original)},${lineRange(m.lineRangeMapping.modified)}(${m.changes.map(change).join('')})`;

let throws = 0;
function oneCase(original, modified, { ignoreTrim = false, moves = true, subwords = false } = {}) {
  let result;
  try {
    const diff = new DefaultLinesDiffComputer().computeDiff(original, modified, {
      ignoreTrimWhitespace: ignoreTrim,
      maxComputationTimeMs: 0,
      computeMoves: moves,
      extendToSubwords: subwords,
    });
    result = `${diff.changes.map(change).join(' ')} | ${diff.moves.map(move).join(' ')} | ${diff.hitTimeout ? 1 : 0}`;
  } catch {
    result = 'THROW';
    throws++;
  }
  return [text(original), text(modified), `${+ignoreTrim},${+moves},${+subwords}`, result].join(';');
}

const randomOptions = () => ({ ignoreTrim: rand(4) === 0, moves: rand(2) === 0, subwords: rand(4) === 0 });

const out = [
  '# Oracle corpus for default_lines_diff_computer.rs, one case per line, four `;`-separated fields:',
  '# the original and the modified lines (each line percent-encoded as by encodeURIComponent, lines joined by `|`);',
  '# the options `ignoreTrimWhitespace,computeMoves,extendToSubwords` as 0/1; and the result of VS Code\'s',
  '# DefaultLinesDiffComputer.computeDiff (maxComputationTimeMs 0): THROW, or `changes | moves | hitTimeout`.',
  '# A change is `c` + `os,oe,ms,me` + its inner changes `[sl,sc,el,ec>sl,sc,el,ec]` (`!` when undefined);',
  '# a move is `m` + `os,oe,ms,me` + `(` its changes `)`. Line ranges end exclusive; changes are space-separated.',
  '# Expected values were produced by running microsoft/vscode\'s DefaultLinesDiffComputer',
  `# (${DIFF}defaultLinesDiffComputer.ts`,
  `# at commit ${COMMIT}, MIT, Copyright (c) Microsoft Corporation) over hand-picked and seeded cases.`,
  '# Regenerate with engine/native/diff/tests/oracle/gen-default-lines-diff-computer.mjs.',
];

// Hand-picked cases.
const HAND = [
  [[''], ['some code here', 'and more']],
  [['a', 'b'], ['']],
  [['same line'], ['same line']],
  [[''], ['']],
  [['', ''], ['', '', '']],
  [['a', '', 'b'], ['a', '', '', 'b']],
  [[...block('head', 2), ...block('moved', 5), ...block('tail', 3)], [...block('head', 2), ...block('tail', 3), ...block('moved', 5)]],
  [[...block('one', 4), ...block('two', 4), 'end'], [...block('two', 4), ...block('one', 4), 'end']],
  [['const fooBarBaz = 1;', 'x'], ['const fooQuxBaz = 1;', 'x'], { subwords: true }],
  [['const fooBarBaz = 1;', 'x'], ['const fooQuxBaz = 1;', 'x'], { subwords: false }],
  [['  indented', 'next'], ['indented  ', 'next'], { ignoreTrim: true }],
  [['  indented', 'next'], ['indented  ', 'next'], { ignoreTrim: false }],
  [[' nbsp　', 'q'], ['nbsp', 'q'], { ignoreTrim: false }],
  [[' nbsp　', 'q'], ['nbsp', 'q'], { ignoreTrim: true }],
  [['😀 emoji 😀', 'x', 'y'], ['😀 emoji 😁', 'x', 'y']],
  [['日本語のテキスト', '二行目'], ['日本語のテキスト！', '二行目']],
  [['é combining', 'z'], ['é combining', 'z']],
  [[String.raw`a\b;c|d`, 'x'], [String.raw`a\b;c|e`, 'x']],
];
for (const [o, m, options] of HAND) out.push(oneCase(o, m, options));
// A run of equal characters with one more of them: the diff shifts at most 100
// elements to either side (`MAX_SHIFT_LIMIT`).
for (let run = 96; run <= 108; run++) {
  out.push(oneCase([`x${'a'.repeat(run)}y`], [`x${'a'.repeat(run + 1)}y`], { moves: false }));
  out.push(oneCase([`x${'a'.repeat(run + 1)}y`], [`x${'a'.repeat(run)}y`], { moves: false }));
}
// A short unchanged affix next to a long change is absorbed into it only when
// the change spans more than 100 elements (`removeVeryShortMatchingTextBetweenLongDiffs`).
for (let total = 96; total <= 104; total++) {
  const [k1, k2] = [Math.floor(total / 2), Math.ceil(total / 2)];
  out.push(oneCase(['top', `ab${'x'.repeat(k1)}`, 'end'], ['top', `ab${'y'.repeat(k2)}`, 'end'], { moves: false }));
  out.push(oneCase(['top', `${'x'.repeat(k1)}ab `, 'end'], ['top', `${'y'.repeat(k2)}ab `, 'end'], { moves: false }));
}

// Code-like text with moves, edits and insertions or deletions.
for (let n = 0; n < 260; n++) {
  const base = Array.from({ length: 3 + rand(45) }, freshLine);
  out.push(oneCase(base, mutate(base, { moves: rand(3), edits: rand(6), indels: rand(5) }), randomOptions()));
}
// Whitespace-only edits, with and without ignoreTrimWhitespace.
for (let n = 0; n < 60; n++) {
  const base = Array.from({ length: 4 + rand(25) }, freshLine);
  const lines = base.map((l) => (rand(3) === 0 ? pick([`  ${l}`, `${l}  `, l.replaceAll(' ', '\t'), ` ${l}`, l.trim()]) : l));
  out.push(oneCase(base, lines, { ignoreTrim: n % 2 === 0, moves: rand(2) === 0, subwords: false }));
}
// Long lines: the character diff past 500 elements uses Myers.
for (let n = 0; n < 40; n++) {
  const base = Array.from({ length: 2 + rand(6) }, () => (rand(2) ? longLine() : freshLine()));
  out.push(oneCase(base, mutate(base, { moves: 0, edits: 1 + rand(4), indels: rand(2) }), randomOptions()));
}
// Repeated lines over tiny pools: ties between equally good alignments.
for (let n = 0; n < 60; n++) {
  const pool = Array.from({ length: 2 + rand(4) }, freshLine);
  const base = Array.from({ length: 6 + rand(30) }, () => pick(pool));
  out.push(oneCase(base, mutate(base, { moves: rand(4), edits: rand(3), indels: rand(4) }), randomOptions()));
}
// Lines that differ only in whitespace over a tiny pool: the 0.99 score of
// lines equal after `trim` against the full score of identical ones.
const wsVariant = (l) => pick([l, l, `  ${l}`, `${l}  `, `\t${l}`, l.replaceAll(' ', '  ')]);
for (let n = 0; n < 80; n++) {
  const pool = Array.from({ length: 2 + rand(3) }, freshLine);
  const base = Array.from({ length: 5 + rand(16) }, () => wsVariant(pick(pool)));
  const modified = Array.from({ length: 5 + rand(16) }, () => wsVariant(pick(pool)));
  out.push(oneCase(base, modified, { ignoreTrim: n % 3 === 0, moves: false, subwords: false }));
}
// Character diffs around the 500-element switch from dynamic programming to
// Myers: two short words soups of about 250 characters each.
const soup = (length) => {
  let s = '';
  while (s.length < length) s += pick(['ab', 'ba', 'a', 'b', 'abc', ' ', 'cab']);
  return s;
};
for (let n = 0; n < 80; n++) {
  const a = soup(225 + rand(50));
  const b = soup(225 + rand(50));
  out.push(oneCase(['x', a, 'y'], ['x', b, 'y'], { moves: false }));
}
// Large texts around the 1700-line switch from dynamic programming to Myers.
const large = (a, b, options) => {
  const base = Array.from({ length: a }, (_, i) => (rand(6) === 0 ? freshLine() : `${block('row', 1)[0]} ${i % 40}`));
  const modified = mutate(base, { moves: 2, edits: 12, indels: 10 });
  while (modified.length > b) modified.splice(rand(modified.length), 1);
  while (modified.length < b) modified.splice(rand(modified.length + 1), 0, freshLine());
  out.push(oneCase(base, modified, options));
};
const largePool = (a, b, options) => {
  const pool = Array.from({ length: 25 }, freshLine);
  const base = Array.from({ length: a }, () => wsVariant(pick(pool)));
  const modified = Array.from({ length: b }, () => wsVariant(pick(pool)));
  out.push(oneCase(base, modified, options));
};
largePool(849, 850, { moves: false });
largePool(850, 850, { moves: false });
large(849, 850, { moves: false });
large(850, 850, { moves: false });
large(900, 900, { moves: true });
large(1200, 900, { moves: false, ignoreTrim: true });
process.stderr.write(`${out.length - 10} cases, ${throws} THROW\n`);
process.stdout.write(out.join('\n') + '\n');
