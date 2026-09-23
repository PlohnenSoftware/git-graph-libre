/**
 * Build the engine for every shipped platform from whatever machine runs this.
 *
 *   node engine/scripts/build-all.mjs
 *
 * One code path, used unchanged by `.github/workflows/native-build.yml` and by
 * a maintainer on their own machine, so a release never depends on a CI
 * provider still existing or still offering the same runners. Every target is
 * built with `--cross-compile`, including the host's own, so the host platform
 * cannot change what comes out: the six binaries a laptop produces are built
 * by the same linkers, from the same toolchain versions, as the six a CI
 * runner produces.
 *
 * The routing is `build-addon.mjs`'s, which this only drives:
 *   - Linux and macOS targets -> cargo-zigbuild (zig supplies glibc and the
 *     macOS libc stubs, and ad-hoc signs arm64 Mach-O, which Apple Silicon
 *     refuses to load without)
 *   - Windows targets         -> cargo-xwin (downloads the MSVC CRT and SDK)
 * Both install themselves on first use; only zig and a Rust toolchain have to
 * be present, and zig is pinned below rather than taken from the system.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '..');

/**
 * The zig the build is pinned to, and the reason it is pinned rather than
 * taken from the system.
 *
 * zig `0.16.0` fails both macOS targets: rustc passes `-Wl,-exported_symbols_list`
 * for a cdylib and 0.16's Mach-O driver reads the *following* flag as the
 * list's path, so the link dies with `unable to read exported symbols list
 * '-dead_strip': FileNotFound`. `0.14.1` links both cleanly. Verified on this
 * machine 2026-09-23, against zig 0.16.0 from the distribution and 0.14.1 from
 * the `ziglang` wheel.
 *
 * The wheel is the delivery mechanism because it is the only one that installs
 * the same pinned zig on every operating system without a package manager
 * having an opinion.
 */
const ZIG_VERSION = '0.14.1';

/** Directory name under `native/` -> the Rust target triple that fills it. */
const TARGETS = {
	'win32-x64-msvc': 'x86_64-pc-windows-msvc',
	'win32-arm64-msvc': 'aarch64-pc-windows-msvc',
	'linux-x64-gnu': 'x86_64-unknown-linux-gnu',
	'linux-arm64-gnu': 'aarch64-unknown-linux-gnu',
	'darwin-x64': 'x86_64-apple-darwin',
	'darwin-arm64': 'aarch64-apple-darwin'
};

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { stdio: 'inherit', ...options });
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
	}
}

/**
 * The directory holding the pinned zig, installing it into a throwaway virtual
 * environment under `target/` on first use. Kept out of the system toolchain
 * deliberately: a distribution's zig moves on its own schedule, and this build
 * has already been broken once by exactly that.
 */
function pinnedZigDirectory() {
	const root = path.join(ENGINE, 'target', 'toolchain', `zig-${ZIG_VERSION}`);
	const marker = path.join(root, 'lib');
	if (!existsSync(marker)) {
		console.log(`> installing pinned zig ${ZIG_VERSION}`);
		mkdirSync(path.dirname(root), { recursive: true });
		const venv = path.join(ENGINE, 'target', 'toolchain', 'venv');
		run('python3', ['-m', 'venv', venv]);
		const pip = path.join(venv, 'bin', 'pip');
		run(pip, ['install', '--quiet', `ziglang==${ZIG_VERSION}`]);
		const sitePackages = execFileSync(
			path.join(venv, 'bin', 'python'),
			['-c', 'import ziglang, os; print(os.path.dirname(ziglang.__file__))'],
			{ encoding: 'utf8' }
		).trim();
		mkdirSync(path.dirname(root), { recursive: true });
		run('ln', ['-sfn', sitePackages, root]);
	}
	const version = execFileSync(path.join(root, 'zig'), ['version'], { encoding: 'utf8' }).trim();
	if (version !== ZIG_VERSION) {
		throw new Error(`pinned zig reports ${version}, expected ${ZIG_VERSION}`);
	}
	console.log(`> zig ${version} (pinned)`);
	return root;
}

function main() {
	const zigDirectory = pinnedZigDirectory();
	const env = { ...process.env, PATH: `${zigDirectory}${path.delimiter}${process.env.PATH}` };

	console.log('> rustup target add');
	run('rustup', ['target', 'add', ...Object.values(TARGETS)]);

	const built = [];
	for (const [directory, triple] of Object.entries(TARGETS)) {
		console.log(`\n=== ${directory} (${triple}) ===`);
		run(
			'node',
			[path.join(HERE, 'build-addon.mjs'), '--release', '--target', triple, '--cross-compile'],
			{ env, cwd: path.resolve(ENGINE, '..') }
		);
		const artifact = path.join(ENGINE, 'native', directory, 'git-graph.node');
		if (!existsSync(artifact)) throw new Error(`${triple} produced no binary at ${artifact}`);
		built.push(directory);
	}

	// Asserted rather than trusted: a missing binary packages silently and
	// leaves that platform on the `git` CLI with nothing to say why.
	const expected = Object.keys(TARGETS).length;
	if (built.length !== expected) {
		throw new Error(`built ${built.length} binaries, expected ${expected}`);
	}
	console.log(`\nBuilt all ${expected} platforms: ${built.join(', ')}`);
}

main();
