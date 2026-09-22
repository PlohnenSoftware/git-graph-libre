/**
 * Smoke test for the locally built engine addon (Phase 16, slice 16.2).
 *
 * require()s `engine/native/<platform>/git-graph.node` for the host triple
 * and asserts `engineVersion()` equals the workspace version declared in
 * `engine/Cargo.toml`. A mismatch means the binary is stale — built from
 * different sources than the tree — and must not be trusted by the loader
 * (slice 16.3 refuses it into the CLI path on exactly this signal).
 *
 * Run by hand via `pnpm run engine:smoke`, not by vitest: it needs a compiled
 * binary, which the TypeScript test projects never build.
 *
 * Usage: node engine/scripts/smoke-addon.mjs [path-to-git-graph.node]
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The target triple cargo builds for when none is asked for. */
function hostTarget() {
	const output = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
	if (output.status !== 0) {
		throw new Error('Could not run `rustc`. Is a Rust toolchain installed and on the PATH?');
	}
	const match = /^host:\s*(.+)$/m.exec(output.stdout);
	if (match === null) throw new Error('Could not determine the host target from `rustc -vV`');
	return match[1].trim();
}

/**
 * Rust target triple -> the directory the build writes that binary to.
 * Mirrors TARGET_DIRECTORIES in build-addon.mjs, which owns this mapping;
 * do not extend here — pass an explicit path argument instead.
 */
const TARGET_DIRECTORIES = {
	'x86_64-pc-windows-msvc': 'win32-x64-msvc',
	'aarch64-pc-windows-msvc': 'win32-arm64-msvc',
	'x86_64-unknown-linux-gnu': 'linux-x64-gnu',
	'aarch64-unknown-linux-gnu': 'linux-arm64-gnu',
	'x86_64-apple-darwin': 'darwin-x64',
	'aarch64-apple-darwin': 'darwin-arm64'
};

/** The workspace version in engine/Cargo.toml (`[workspace.package]`). */
function workspaceVersion() {
	const manifest = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8');
	const section = manifest.split(/^\[workspace\.package\]/m)[1] ?? '';
	const match = /^version\s*=\s*"([^"]+)"/m.exec(section);
	if (match === null) throw new Error('Could not read [workspace.package] version from engine/Cargo.toml');
	return match[1];
}

function main() {
	const explicit = process.argv[2];
	let addon = explicit ?? null;
	if (addon === null) {
		const target = hostTarget();
		const directory = TARGET_DIRECTORIES[target];
		if (directory === undefined) throw new Error(`No extension directory is defined for the host target ${target}.`);
		addon = path.join(root, 'native', directory, 'git-graph.node');
	}
	if (!fs.existsSync(addon)) {
		throw new Error(`No addon at ${addon}. Run \`pnpm run engine:build\` first.`);
	}
	const require = createRequire(import.meta.url);
	const loaded = require(addon);
	if (typeof loaded.engineVersion !== 'function') {
		throw new Error(`The addon at ${addon} exports no engineVersion().`);
	}
	const expected = workspaceVersion();
	const actual = loaded.engineVersion();
	if (actual !== expected) {
		throw new Error(`Stale addon: engineVersion() is ${actual}, engine/Cargo.toml says ${expected}. Rebuild with \`pnpm run engine:build\`.`);
	}
	console.log(`Smoke OK: ${path.relative(process.cwd(), addon)} reports engineVersion() ${actual}.`);
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
