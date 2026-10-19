// Oracle generator for `src/compute_moved_lines.rs` (Phase 17, slice 22g).
//
// Run from the repository root (needs Node 18+ with `fetch`, network access,
// and the repository's own `esbuild`):
//
//   node engine/native/diff/tests/oracle/gen-compute-moved-lines.mjs \
//     > engine/native/diff/tests/data/compute-moved-lines-oracle.txt
//
// It fetches microsoft/vscode's own TypeScript at the pinned commit below
// (`computeMovedLines` and what it imports, plus `DefaultLinesDiffComputer`,
// used only to produce realistic line-level changes), bundles it with esbuild,
// runs `computeMovedLines` over hand-picked and seeded cases, and prints one
// case per line. A rerun reproduces the committed data byte for byte. The
// fetched VS Code code is MIT, Copyright (c) Microsoft Corporation; it is
// fetched at run time and never vendored. This script is part of Git Graph
// Libre, AGPL-3.0-or-later.
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
    contents: `
      export { computeMovedLines } from 'vscode-src:${DIFF}computeMovedLines.ts';
      export { DefaultLinesDiffComputer } from 'vscode-src:${DIFF}defaultLinesDiffComputer.ts';`,
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
const { computeMovedLines, DefaultLinesDiffComputer } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

// ---- seeded corpus --------------------------------------------------------
let state = 0x1badc0de;
const rand = (n) => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return Math.floor((state / 4294967296) * n);
};
const pick = (list) => list[rand(list.length)];

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'value', 'count', 'items', 'result', 'index', 'total'];
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
];
const freshLine = () => pick(TEMPLATES)(pick(WORDS), pick(WORDS));
const linesFrom = (pool, n) => Array.from({ length: n }, () => pick(pool));

function edit(line) {
  switch (rand(6)) {
    case 0: return `${line} // x`;
    case 1: return line.replaceAll('a', 'e');
    case 2: return `${line}   `;
    case 3: return `  ${line}`;
    case 4: return line.trim();
    default: return line.length > 3 ? line.slice(0, line.length - 2) : `${line}zz`;
  }
}

function moveBlock(lines, len) {
  const n = Math.min(len, lines.length);
  const from = rand(lines.length - n + 1);
  const block = lines.splice(from, n);
  const to = rand(lines.length + 1);
  lines.splice(to, 0, ...block);
}

function mutate(base, { moves, edits, indels }) {
  let lines = [...base];
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

const HAND = [
  // A clean move of one block.
  [[...block('head', 2), ...block('moved', 5), ...block('tail', 3)], [...block('head', 2), ...block('tail', 3), ...block('moved', 5)], -1],
  // A move with an edit inside.
  [[...block('head', 2), ...block('moved', 6), ...block('tail', 3)], [...block('head', 2), ...block('tail', 3), ...block('moved', 3), 'moved statement edited here;', ...block('moved', 6).slice(4)], -1],
  // Two blocks swap.
  [[...block('one', 4), ...block('two', 4), 'end of file marker'], [...block('two', 4), ...block('one', 4), 'end of file marker'], -1],
  // Trailing whitespace and indentation variants of a moved block.
  [[...block('keep', 2), ...block('ws', 5), ...block('after', 2)], [...block('keep', 2), ...block('after', 2), ...block('ws', 5).map((l, i) => (i % 2 ? `${l}   ` : `    ${l}`))], -1],
  // Blocks too short to count as moves.
  [['a', 'b', 'c', 'd', 'x', 'y'], ['x', 'y', 'a', 'b', 'c', 'd'], -1],
  // Repeated lines: many identical three-line windows.
  [Array.from({ length: 12 }, (_, i) => ['{', 'x = 1;', '}'][i % 3]), Array.from({ length: 15 }, (_, i) => ['}', '{', 'x = 1;'][i % 3]), -1],
  // Single lines, empty text.
  [[''], ['some code here', 'and more code here', 'and a third line of it'], -1],
  [['same line'], ['same line'], -1],
  // A move to the very top and one to the very bottom.
  [[...block('top', 1), ...block('mid', 6), ...block('low', 4)], [...block('low', 4), ...block('top', 1), ...block('mid', 6)], -1],
  [[...block('a', 3), ...block('b', 6)], [...block('b', 6), ...block('a', 3)], -1],
  // Lines with lone-looking edits next to a move (extension over similar lines).
  [[...block('p', 3), 'the neighbour line stays here', ...block('mv', 4), 'another neighbour line here', ...block('q', 3)], [...block('p', 3), ...block('q', 3), 'the neighbour line stays here!', ...block('mv', 4), 'another neighbour line here?'], -1],
];

const units = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16)).join(',');
const rng = (r) => `${r.startLineNumber},${r.endLineNumberExclusive}`;
const mapping = (m) => `${rng(m.original)},${rng(m.modified)}`;

function oneCase(original, modified, limit) {
  const perfect = new Map();
  const hash = (t) => {
    if (!perfect.has(t)) perfect.set(t, perfect.size);
    return perfect.get(t);
  };
  const h1 = original.map((l) => hash(l.trim()));
  const h2 = modified.map((l) => hash(l.trim()));
  const changes = new DefaultLinesDiffComputer().computeDiff(original, modified, {
    ignoreTrimWhitespace: false,
    maxComputationTimeMs: 0,
    computeMoves: false,
    extendToSubwords: false,
  }).changes;
  let calls = 0;
  const timeout = { isValid: () => limit < 0 || calls++ < limit };
  let result;
  try {
    result = computeMovedLines(changes, original, modified, h1, h2, timeout).map(mapping).join(' ');
  } catch (e) {
    result = 'THROW';
  }
  return [
    original.map(units).join('|'),
    modified.map(units).join('|'),
    h1.join(','),
    h2.join(','),
    changes.map(mapping).join(' '),
    limit,
    result,
  ].join(';');
}

const out = [
  '# Oracle corpus for compute_moved_lines.rs, one case per line, seven `;`-separated fields:',
  '# original lines and modified lines (UTF-16 units in hex, comma-separated, lines joined by `|`);',
  '# the line hashes of each side (equal trimmed lines share a number); the line-level changes from',
  '# VS Code\'s own DefaultLinesDiffComputer as `os,oe,ms,me` groups (line ranges, end exclusive);',
  '# the timeout limit (number of `isValid` calls that succeed, -1 for never); the moves',
  '# computeMovedLines returned as `os,oe,ms,me` groups, or THROW if it threw.',
  '# Expected values were produced by running microsoft/vscode\'s computeMovedLines',
  `# (${DIFF}computeMovedLines.ts`,
  `# at commit ${COMMIT}, MIT, Copyright (c) Microsoft Corporation) over hand-picked and seeded cases.`,
  '# Regenerate with engine/native/diff/tests/oracle/gen-compute-moved-lines.mjs.',
];
for (const [o, m, limit] of HAND) out.push(oneCase(o, m, limit));
// Realistic edits: moves, edits and insertions or deletions on code-like text.
for (let n = 0; n < 350; n++) {
  const base = Array.from({ length: 6 + rand(40) }, freshLine);
  out.push(oneCase(base, mutate(base, { moves: 1 + rand(3), edits: rand(5), indels: rand(4) }), -1));
}
// Whole blocks with distinct lines, so real moves are likely.
for (let n = 0; n < 150; n++) {
  const base = block('line', 8 + rand(30)).map((l, i) => (rand(5) === 0 ? freshLine() : l + (i % 7 === 0 ? ' x' : '')));
  out.push(oneCase(base, mutate(base, { moves: 1 + rand(3), edits: rand(4), indels: rand(3) }), -1));
}
// Many small candidate moves: shuffles over a tiny pool of lines.
for (let n = 0; n < 120; n++) {
  const pool = Array.from({ length: 2 + rand(5) }, freshLine);
  const base = linesFrom(pool, 8 + rand(30));
  out.push(oneCase(base, mutate(base, { moves: 2 + rand(5), edits: rand(3), indels: rand(3) }), -1));
}
// Timeouts: the nth `isValid` call and every later one fail.
for (let n = 0; n < 40; n++) {
  const base = Array.from({ length: 10 + rand(25) }, freshLine);
  out.push(oneCase(base, mutate(base, { moves: 1 + rand(3), edits: rand(4), indels: rand(3) }), rand(40)));
}
process.stdout.write(out.join('\n') + '\n');
