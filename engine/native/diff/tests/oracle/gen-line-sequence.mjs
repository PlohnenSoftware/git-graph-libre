// Generates ../data/line-sequence-oracle.txt: the expected output of
// microsoft/vscode's LineSequence (getElement, length, getBoundaryScore,
// isStronglyEqual, getText) over hand-picked and seeded inputs.
//
// Run from the repository root (needs Node 20+ and network access):
//   node engine/native/diff/tests/oracle/gen-line-sequence.mjs
// A rerun reproduces the committed data byte for byte.
//
// Source of the oracle: microsoft/vscode at commit
// 28a562309973a386b2bdefae78127788a4742fe8,
// src/vs/editor/common/diff/defaultLinesDiffComputer/lineSequence.ts and the
// files it imports. They are fetched from GitHub at run time, bundled with the
// repository's `esbuild`, and run in memory; none of it is vendored or written
// to disk. The fetched code is MIT, Copyright (c) Microsoft Corporation. This
// script is part of Git Graph Libre, AGPL-3.0-or-later.
import { writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { build } from 'esbuild';

const COMMIT = '28a562309973a386b2bdefae78127788a4742fe8';
const RAW = `https://raw.githubusercontent.com/microsoft/vscode/${COMMIT}/`;
const DIR = 'src/vs/editor/common/diff/defaultLinesDiffComputer/';

const cache = new Map();
async function fetchSource(path) {
	if (!cache.has(path)) {
		const res = await fetch(RAW + path);
		if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
		cache.set(path, await res.text());
	}
	return cache.get(path);
}

const vscodeSources = {
	name: 'vscode-sources',
	setup(b) {
		b.onResolve({ filter: /^vscode-src:/ }, (a) => ({ path: a.path.slice('vscode-src:'.length), namespace: 'vscode' }));
		b.onResolve({ filter: /^\./, namespace: 'vscode' }, (a) => ({
			path: posix.join(posix.dirname(a.importer), a.path.replace(/\.js$/, '.ts')),
			namespace: 'vscode',
		}));
		b.onLoad({ filter: /.*/, namespace: 'vscode' }, async (a) => ({ contents: await fetchSource(a.path), loader: 'ts' }));
		b.onResolve({ filter: /^harness$/ }, () => ({ path: 'harness', namespace: 'harness' }));
		b.onLoad({ filter: /.*/, namespace: 'harness' }, () => ({
			contents: `
				export { LineSequence } from 'vscode-src:${DIR}lineSequence.ts';
			`,
			loader: 'ts',
			resolveDir: '.',
		}));
	},
};

const bundled = await build({
	entryPoints: ['harness'],
	bundle: true,
	write: false,
	format: 'esm',
	platform: 'node',
	plugins: [vscodeSources],
	logLevel: 'error',
});
const code = bundled.outputFiles[0].text;
const { LineSequence } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);


// Line identities are numbered as defaultLinesDiffComputer.ts numbers them: a
// Map over the trimmed text, in order of first occurrence.
const hashesOf = (lines) => {
	const perfectHashes = new Map();
	return lines.map((l) => {
		const text = l.trim();
		let hash = perfectHashes.get(text);
		if (hash === undefined) {
			hash = perfectHashes.size;
			perfectHashes.set(text, hash);
		}
		return hash;
	});
};

// A seeded linear congruential generator.
let state = 22;
const next = (n) => {
	state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
	return Math.floor((state / 4294967296) * n);
};

const cases = [
	[],
	[''],
	['a'],
	['a', 'a'],
	['a', ' a', '\ta', 'a '],
	['    four', '\t\ttwo tabs', ' \t mixed', 'x'],
	['', ' ', '\t', '  ', ''],
	['\u00a0nbsp', '\u2003em', '\u3000ideographic', '\u{1F600} emoji', ' \u{1F600}'],
	['a;b', 'c|d', String.raw`e\f`, String.raw`g\ph`, ' ;| '],
	['{', '  if (x) {', '    y();', '  }', '}'],
];
// Seeded random cases drawn from a small alphabet of indentation and text.
const pieces = [' ', '\t', '  ', 'a', 'b', 'ab', '\u00a0', ';', '|', '\\'];
for (let i = 0; i < 80; i++) {
	cases.push(
		Array.from({ length: next(9) }, () =>
			Array.from({ length: next(6) }, () => pieces[next(pieces.length)]).join(''),
		),
	);
}

// Fields are separated by `;` and list items by `|`, so both are escaped.
const esc = (s) =>
	s.replaceAll('\\', String.raw`\\`).replaceAll(';', String.raw`\c`).replaceAll('|', String.raw`\p`).replaceAll('\t', String.raw`\t`).replaceAll('\n', String.raw`\n`);

const out = [
	'# Oracle corpus for line_sequence.rs, one case per line: `n:lines;hashes;scores;strong;texts`.',
	'# lines are `|`-separated with `\\\\`, `\\c` (;), `\\p` (|), `\\t`, `\\n` escapes; hashes are the Map numbering of the',
	'# trimmed lines; scores are getBoundaryScore(0..=n); strong is isStronglyEqual(i, j) for all i, j as 0/1',
	'# (row-major); texts are getText([s, e)) for every 0 <= s <= e <= n, in that order, `|`-separated.',
	'# Expected values were produced by running microsoft/vscode\'s LineSequence',
	`# (${DIR}lineSequence.ts at commit`,
	`# ${COMMIT}, MIT, Copyright (c) Microsoft Corporation).`,
	'# Regenerate with engine/native/diff/tests/oracle/gen-line-sequence.mjs.',
];
for (const lines of cases) {
	const hashes = hashesOf(lines);
	const seq = new LineSequence(hashes, lines);
	const n = lines.length;
	if (seq.length !== n || hashes.some((h, i) => seq.getElement(i) !== h)) throw new Error('sequence mismatch');
	const scores = Array.from({ length: n + 1 }, (_, l) => seq.getBoundaryScore(l));
	let strong = '';
	for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) strong += seq.isStronglyEqual(i, j) ? '1' : '0';
	const texts = [];
	for (let s = 0; s <= n; s++) for (let e = s; e <= n; e++) texts.push(esc(seq.getText({ start: s, endExclusive: e })));
	out.push(`${n}:${lines.map(esc).join('|')};${hashes.join(',')};${scores.join(',')};${strong};${texts.join('|')}`);
}
writeFileSync(new URL('../data/line-sequence-oracle.txt', import.meta.url), `${out.join('\n')}\n`);
console.log(`wrote ${cases.length} cases`);
