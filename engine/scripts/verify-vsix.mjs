/**
 * Release check: load the Rust engine out of the packaged VSIX on the machine
 * this runs on, and make it do one small piece of real work.
 *
 * Every engine binary is cross-built on one Linux runner (`native-build.yml`),
 * so none of them is otherwise loaded before it ships — and the loader's
 * contract hides a broken platform: a binary that fails to load, exports too
 * little, or reports another version than the TypeScript expects lands the
 * extension on the `git` CLI without a word. A broken platform would look like
 * a slow one. This script fails loudly on exactly those cases, against the very
 * file that is about to be published.
 *
 * It needs nothing but Node: the VSIX is read with `node:zlib`, and the fixture
 * repository is written byte by byte, so it runs unchanged in a bare Alpine
 * container with no git, unzip or package manager.
 *
 * Usage: node engine/scripts/verify-vsix.mjs <vsix-or-directory> [--libc gnu|musl] [--glibc <version>]
 *
 * `--libc` and `--glibc` make a leg refuse to run anywhere but where it says
 * it runs, so a drifting image cannot quietly test a newer C library.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Each platform's binary directory, by `platform:arch` — the loader's
 * `PLATFORM_DIRECTORIES` in `src/backend/engine/addon.ts`, mirrored here
 * because that file is TypeScript and this one must run on a bare Node. A
 * test (`tests/backend/engine/verifyVsix.test.ts`) keeps the two equal.
 */
export const PLATFORM_DIRECTORIES = {
	'win32:x64': 'win32-x64-msvc',
	'win32:arm64': 'win32-arm64-msvc',
	'darwin:x64': 'darwin-x64',
	'darwin:arm64': 'darwin-arm64',
	'linux:x64': 'linux-x64',
	'linux:arm64': 'linux-arm64'
};

/** The functions the loader's `isEngineAddon` requires; one missing means the CLI. */
export const REQUIRED_EXPORTS = [
	'engineVersion',
	'remoteUrl',
	'loadRepoInfo',
	'loadCommits',
	'loadCommitDetails',
	'loadLineCounts',
	'loadStashes',
	'loadStashDetails',
	'compareCommits',
	'loadCommitFile',
	'configList',
	'authors',
	'loadConfig',
	'searchCommits',
	'loadRefs',
	'closeRepository',
	'closeAllRepositories',
	'openRepositoryCount'
];

const NATIVE_PREFIX = 'extension/engine/native/';
const BINARY_NAME = 'git-graph.node';

/** The directory this platform's binary ships in, or undefined when none does. */
export function platformDirectoryFor(platform, arch) {
	return PLATFORM_DIRECTORIES[`${platform}:${arch}`];
}

/**
 * The entries of a zip archive by name, from its central directory. Enough of
 * the format for a VSIX: no ZIP64, no encryption, stored or deflated entries.
 */
export function readZipEntries(archive) {
	const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
	const CENTRAL_FILE_HEADER = 0x02014b50;
	// The end record is 22 bytes plus a comment of at most 64 KiB.
	const earliest = Math.max(0, archive.length - 22 - 0xffff);
	let end = -1;
	for (let at = archive.length - 22; at >= earliest; at--) {
		if (archive.readUInt32LE(at) === END_OF_CENTRAL_DIRECTORY) {
			end = at;
			break;
		}
	}
	if (end === -1) throw new Error('Not a zip archive: no end of central directory record.');
	const count = archive.readUInt16LE(end + 10);
	let at = archive.readUInt32LE(end + 16);
	const entries = new Map();
	for (let index = 0; index < count; index++) {
		if (archive.readUInt32LE(at) !== CENTRAL_FILE_HEADER) {
			throw new Error(`Corrupt zip central directory at byte ${at}.`);
		}
		const nameLength = archive.readUInt16LE(at + 28);
		const extraLength = archive.readUInt16LE(at + 30);
		const commentLength = archive.readUInt16LE(at + 32);
		const name = archive.toString('utf8', at + 46, at + 46 + nameLength);
		entries.set(name, {
			name,
			method: archive.readUInt16LE(at + 10),
			crc32: archive.readUInt32LE(at + 16),
			compressedSize: archive.readUInt32LE(at + 20),
			size: archive.readUInt32LE(at + 24),
			localHeader: archive.readUInt32LE(at + 42)
		});
		at += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

/** One entry's bytes, inflated and checked against its recorded size and CRC. */
export function readZipEntry(archive, entry) {
	const LOCAL_FILE_HEADER = 0x04034b50;
	const at = entry.localHeader;
	if (archive.readUInt32LE(at) !== LOCAL_FILE_HEADER) {
		throw new Error(`Corrupt zip local header for ${entry.name}.`);
	}
	const start = at + 30 + archive.readUInt16LE(at + 26) + archive.readUInt16LE(at + 28);
	const stored = archive.subarray(start, start + entry.compressedSize);
	let bytes;
	if (entry.method === 0) bytes = stored;
	else if (entry.method === 8) bytes = zlib.inflateRawSync(stored);
	else throw new Error(`Unsupported zip compression method ${entry.method} for ${entry.name}.`);
	if (bytes.length !== entry.size) {
		throw new Error(`${entry.name}: ${bytes.length} bytes inflated, ${entry.size} recorded.`);
	}
	if (typeof zlib.crc32 === 'function' && zlib.crc32(bytes) >>> 0 !== entry.crc32) {
		throw new Error(`${entry.name}: CRC mismatch.`);
	}
	return bytes;
}

/** The engine binaries a VSIX ships, by directory, and anything else under `engine/native`. */
export function nativeContents(entries) {
	const binaries = [];
	const strays = [];
	for (const name of entries.keys()) {
		if (!name.startsWith(NATIVE_PREFIX) || name.endsWith('/')) continue;
		const rest = name.slice(NATIVE_PREFIX.length).split('/');
		if (rest.length === 2 && rest[1] === BINARY_NAME) binaries.push(rest[0]);
		else strays.push(name);
	}
	return { binaries: binaries.sort(), strays };
}

/**
 * Writes a one-commit repository with plain file IO — one blob, one tree, one
 * commit as zlib-compressed loose objects — so the engine has real objects to
 * read where no `git` is installed. Returns what a read must give back.
 */
export function writeFixtureRepository(directory) {
	const contents = `engine read on ${process.platform}-${process.arch}\n`;
	const gitDir = path.join(directory, '.git');
	const write = (type, body) => {
		const object = Buffer.concat([Buffer.from(`${type} ${body.length}\0`), body]);
		const hash = createHash('sha1').update(object).digest('hex');
		const file = path.join(gitDir, 'objects', hash.slice(0, 2), hash.slice(2));
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, zlib.deflateSync(object));
		return hash;
	};
	fs.mkdirSync(path.join(gitDir, 'refs', 'heads'), { recursive: true });
	fs.writeFileSync(
		path.join(gitDir, 'config'),
		'[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n'
	);
	fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
	fs.writeFileSync(path.join(directory, 'hello.txt'), contents);
	const blob = write('blob', Buffer.from(contents));
	const tree = write(
		'tree',
		Buffer.concat([Buffer.from('100644 hello.txt\0'), Buffer.from(blob, 'hex')])
	);
	const identity = 'Release Check <release@example.invalid> 1700000000 +0000';
	const commit = write(
		'commit',
		Buffer.from(`tree ${tree}\nauthor ${identity}\ncommitter ${identity}\n\nverify the packaged engine\n`)
	);
	fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), `${commit}\n`);
	return { commit, file: 'hello.txt', contents };
}

/** The glibc version this Node process runs on, or null off glibc. */
export function runningGlibc() {
	if (process.platform !== 'linux') return null;
	return process.report?.getReport?.().header?.glibcVersionRuntime ?? null;
}

/** `gnu` or `musl` on Linux, from what this Node process actually runs on; null elsewhere. */
export function runningLibc() {
	if (process.platform !== 'linux') return null;
	return runningGlibc() === null ? 'musl' : 'gnu';
}

/** The engine version the sources expect: the crate's, and the loader's pinned one. */
function expectedVersions() {
	const cargo = fs.readFileSync(path.join(repositoryRoot, 'engine', 'Cargo.toml'), 'utf8');
	const crate = /^version\s*=\s*"([^"]+)"/m.exec(cargo.split(/^\[workspace\.package\]/m)[1] ?? '');
	const addon = fs.readFileSync(
		path.join(repositoryRoot, 'src', 'backend', 'engine', 'addon.ts'),
		'utf8'
	);
	const loader = /EXPECTED_ENGINE_VERSION\s*=\s*"([^"]+)"/.exec(addon);
	if (crate === null) throw new Error('Could not read [workspace.package] version from engine/Cargo.toml.');
	if (loader === null) throw new Error('Could not read EXPECTED_ENGINE_VERSION from addon.ts.');
	return { crate: crate[1], loader: loader[1] };
}

function resolveVsix(argument) {
	if (argument === undefined) {
		throw new Error('Usage: verify-vsix.mjs <vsix-or-directory> [--libc gnu|musl] [--glibc <version>]');
	}
	if (!fs.statSync(argument).isDirectory()) return argument;
	const found = fs.readdirSync(argument).filter((name) => name.endsWith('.vsix'));
	if (found.length !== 1) throw new Error(`Expected one .vsix in ${argument}, found ${found.length}.`);
	return path.join(argument, found[0]);
}

function parseArguments(argv) {
	const options = { vsix: undefined, libc: undefined, glibc: undefined };
	for (let index = 0; index < argv.length; index++) {
		if (argv[index] === '--libc') options.libc = argv[++index];
		else if (argv[index] === '--glibc') options.glibc = argv[++index];
		else options.vsix = argv[index];
	}
	if (options.libc !== undefined && options.libc !== 'gnu' && options.libc !== 'musl') {
		throw new Error(`--libc must be gnu or musl, not ${options.libc}.`);
	}
	return options;
}

async function main(argv) {
	const started = Date.now();
	const options = parseArguments(argv);
	const vsix = resolveVsix(options.vsix);
	const target = `${process.platform}-${process.arch}`;
	const libc = runningLibc();
	if (options.libc !== undefined && libc !== options.libc) {
		throw new Error(`Asked to verify on ${options.libc}, but this Node runs on ${libc ?? 'no libc check'}.`);
	}
	const glibc = runningGlibc();
	if (options.glibc !== undefined && glibc !== options.glibc) {
		throw new Error(`Asked to verify on glibc ${options.glibc}, but this Node runs on ${glibc ?? 'no glibc'}.`);
	}
	const directory = platformDirectoryFor(process.platform, process.arch);
	if (directory === undefined) throw new Error(`No engine binary ships for ${target}.`);

	// The package, whole: every platform present, nothing else under engine/native.
	const archive = fs.readFileSync(vsix);
	const entries = readZipEntries(archive);
	const { binaries, strays } = nativeContents(entries);
	const shipped = Object.values(PLATFORM_DIRECTORIES).sort();
	if (binaries.join() !== shipped.join()) {
		throw new Error(`The VSIX ships engine binaries for [${binaries}], expected [${shipped}].`);
	}
	if (strays.length > 0) throw new Error(`Unexpected files under engine/native: ${strays.join(', ')}`);

	// This platform's binary, loaded the way the extension's loader does.
	const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ggl-verify-'));
	const binary = path.join(work, BINARY_NAME);
	fs.writeFileSync(binary, readZipEntry(archive, entries.get(`${NATIVE_PREFIX}${directory}/${BINARY_NAME}`)));
	const addon = createRequire(import.meta.url)(binary);
	const missing = REQUIRED_EXPORTS.filter((name) => typeof addon[name] !== 'function');
	if (missing.length > 0) throw new Error(`The engine is missing exports the loader requires: ${missing.join(', ')}`);
	const version = addon.engineVersion();
	const expected = expectedVersions();
	if (version !== expected.crate || version !== expected.loader) {
		throw new Error(
			`The engine reports ${version}; engine/Cargo.toml says ${expected.crate} and the loader expects ${expected.loader}.`
		);
	}

	// One small piece of real work: discovery, then an object read through a tree.
	const repository = path.join(work, 'repository');
	fs.mkdirSync(repository);
	const fixture = writeFixtureRepository(repository);
	const root = await addon.repoRoot(repository);
	if (fs.realpathSync(root) !== fs.realpathSync(repository)) {
		throw new Error(`repoRoot answered ${root} for ${repository}.`);
	}
	const file = JSON.parse(await addon.loadCommitFile(repository, fixture.commit, fixture.file));
	if (file.binary !== false || file.contents !== fixture.contents) {
		throw new Error(`loadCommitFile returned ${JSON.stringify(file)}.`);
	}
	addon.closeAllRepositories();
	fs.rmSync(work, { recursive: true, force: true });

	const runtime = glibc === null ? libc : `glibc ${glibc}`;
	const summary =
		`${target}${runtime === null ? '' : ` (${runtime})`}: engine ${version} from ${directory} ` +
		`loaded and read a commit under Node ${process.versions.node} in ${Date.now() - started} ms`;
	console.log(`Verified ${path.basename(vsix)}. ${summary}.`);
	if (process.env.GITHUB_STEP_SUMMARY) {
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${summary}\n`);
	}
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	});
}
