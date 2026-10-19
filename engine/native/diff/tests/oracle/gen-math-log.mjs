// Generates ../data/math-log-oracle.txt: V8's `Math.log(1 + n)` for n in
// 0..=1,000,000, the range of the line-alignment score `1 + Math.log(1 + len)`
// in microsoft/vscode's defaultLinesDiffComputer.ts. The bit patterns of each
// block of 1,000 results are hashed (FNV-1a 64 over the little-endian bytes),
// so a mismatch names its block without a 17 MB data file.
//
// Run from the repository root (needs Node 20+, no network):
//   node engine/native/diff/tests/oracle/gen-math-log.mjs > engine/native/diff/tests/data/math-log-oracle.txt
// Node 20 (V8 11.3), 22 (V8 12.4) and 26 (V8 14.6) print identical output.
// This script is part of Git Graph Libre, AGPL-3.0-or-later.
const LAST = 1_000_000;
const BLOCK = 1000;
const OFFSET_BASIS = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;

const view = new DataView(new ArrayBuffer(8));
const lines = [
	'# V8 Math.log(1 + n), n in 0..=1000000: FNV-1a 64 of the little-endian bits of each block of 1000',
	`last ${LAST}`,
	`block ${BLOCK}`,
];
for (let start = 0; start <= LAST; start += BLOCK) {
	let hash = OFFSET_BASIS;
	for (let n = start; n < Math.min(start + BLOCK, LAST + 1); n++) {
		view.setFloat64(0, Math.log(1 + n), true);
		for (let i = 0; i < 8; i++) {
			hash = BigInt.asUintN(64, (hash ^ BigInt(view.getUint8(i))) * PRIME);
		}
	}
	lines.push(`${start / BLOCK} ${hash.toString(16).padStart(16, '0')}`);
}
console.log(lines.join('\n'));
