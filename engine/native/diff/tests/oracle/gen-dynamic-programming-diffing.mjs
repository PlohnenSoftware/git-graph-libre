// Generates ../data/dynamic-programming-oracle.txt: the expected output of
// microsoft/vscode's DynamicProgrammingDiffing.compute over a seeded corpus.
//
// Run from the repository root (needs Node 20+ and network access):
//   node engine/native/diff/tests/oracle/gen-dynamic-programming-diffing.mjs
// A rerun reproduces the committed data byte for byte.
//
// Source of the oracle: microsoft/vscode at commit
// 28a562309973a386b2bdefae78127788a4742fe8,
// src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/dynamicProgrammingDiffing.ts
// and the files it imports. They are fetched from GitHub at run time, bundled
// with the repository's `esbuild`, and run in memory; none of it is vendored
// or written to disk. The fetched code is MIT, Copyright (c) Microsoft
// Corporation. This script is part of Git Graph Libre, AGPL-3.0-or-later.
import { writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { build } from 'esbuild';

const COMMIT = '28a562309973a386b2bdefae78127788a4742fe8';
const RAW = `https://raw.githubusercontent.com/microsoft/vscode/${COMMIT}/`;
const ALGO = 'src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/';

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
				export { DynamicProgrammingDiffing } from 'vscode-src:${ALGO}dynamicProgrammingDiffing.ts';
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
const { DynamicProgrammingDiffing } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

// The equality score used when a case's mode is `f`: exact arithmetic only, so
// the Rust test reproduces it bit for bit (VS Code's own score uses Math.log,
// which belongs to the computer's slice).
const score = (a, b) => (o1, o2) => ((a[o1] * 7 + b[o2] * 3 + o1 + o2) % 5 === 0 ? 0.1 : 0.99 + ((o1 * 3 + o2) % 4) / 10);

// A seeded linear congruential generator.
let state = 22;
const next = (n) => {
	state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
	return Math.floor((state / 4294967296) * n);
};
const seq = (len, alphabet) => Array.from({ length: len }, () => next(alphabet));

const cases = [];
const add = (a, b, mode = 'u', limit = -1) => cases.push({ a, b, mode, limit });

// Hand-picked cases.
add([], []);
add([1], []);
add([], [1]);
add([1, 2, 3], [1, 2, 3]);
add([1, 2, 3], [4, 5, 6]);
add([0], [0]);
add([1, 2, 3, 4, 5], [1, 2, 9, 4, 5]);
add([1, 1, 1, 1], [1, 1]);
add([1, 2, 1, 2, 1, 2], [2, 1, 2, 1]);
add([1, 2, 3, 1, 2, 3], [3, 2, 1, 3, 2, 1], 'f');
add([5, 1, 2, 3, 4], [1, 2, 3, 4, 5], 'f');
add([1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1]);
add([1, 2, 3, 9, 9, 1, 2, 3], [1, 2, 3, 1, 2, 3]);
add([1, 2, 3, 1, 2, 3], [1, 2, 3, 9, 9, 1, 2, 3], 'f');
add([1, 2, 3, 4], [1, 2, 3, 4], 'u', 0);
add([1, 2, 3, 4], [1, 2, 3, 4], 'u', 3);
// Seeded random cases: small alphabets give many ties and repeats.
for (let i = 0; i < 560; i++) {
	const alphabet = 2 + next(4);
	const big = i % 40 === 0;
	const a = seq(next(big ? 40 : 14), alphabet);
	const b = seq(next(big ? 40 : 14), alphabet);
	add(a, b, i % 2 === 0 ? 'u' : 'f');
}
// Timeouts: the nth `isValid` call and every later one fail.
for (let i = 0; i < 40; i++) {
	const a = seq(1 + next(8), 3);
	const b = seq(1 + next(8), 3);
	add(a, b, 'u', next(a.length * b.length + 2));
}

const fmt = (diffs) =>
	diffs.map((d) => `${d.seq1Range.start},${d.seq1Range.endExclusive},${d.seq2Range.start},${d.seq2Range.endExclusive}`).join(' ');

const lines = [
	'# Oracle corpus for dynamic_programming_diffing.rs, one case per line: `a;b;mode;limit;diffs|hit_timeout`.',
	'# a and b are comma-separated element numbers; mode `u` scores every match 1, mode `f` uses a fixed',
	'# fractional score function of (offset1, offset2) (see the Rust test); limit is the number of `isValid`',
	'# calls that succeed before the timeout expires (-1: never); diffs are `s1,e1,s2,e2` groups separated by spaces.',
	'# Expected values were produced by running microsoft/vscode\'s DynamicProgrammingDiffing.compute',
	`# (${ALGO}dynamicProgrammingDiffing.ts at commit`,
	`# ${COMMIT}, MIT, Copyright (c) Microsoft Corporation) over a seeded linear congruential corpus.`,
	'# Regenerate with engine/native/diff/tests/oracle/gen-dynamic-programming-diffing.mjs.',
];
for (const { a, b, mode, limit } of cases) {
	const sa = { length: a.length, getElement: (o) => a[o] };
	const sb = { length: b.length, getElement: (o) => b[o] };
	let calls = 0;
	const timeout = { isValid: () => limit < 0 || calls++ < limit };
	const result = new DynamicProgrammingDiffing().compute(sa, sb, timeout, mode === 'f' ? score(a, b) : undefined);
	lines.push(`${a.join(',')};${b.join(',')};${mode};${limit};${fmt(result.diffs)}|${result.hitTimeout}`);
}
writeFileSync(new URL('../data/dynamic-programming-oracle.txt', import.meta.url), `${lines.join('\n')}\n`);
console.log(`wrote ${cases.length} cases`);
