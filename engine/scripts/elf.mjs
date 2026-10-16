/**
 * Just enough ELF for `build-addon.mjs` to make the Linux glibc build of the engine loadable by
 * musl as well, with nothing to install: no `patchelf`, no binutils, only Node.
 *
 * Scope is deliberately narrow — 64-bit little-endian shared objects, which is every Linux target
 * the engine ships (x86_64 and aarch64):
 *
 * - the `DT_NEEDED` list, read and edited through the dynamic segment, the way the dynamic loader
 *   itself finds it;
 * - the undefined dynamic symbols, read through the `.dynsym` section, to assert what the binary
 *   imports.
 *
 * Removing a `DT_NEEDED` entry is what `patchelf --remove-needed` does: the dynamic entries after
 * it move up one slot and the freed slot at the end becomes another `DT_NULL`. Nothing else in the
 * file moves.
 */

const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const DT_NULL = 0n;
const DT_NEEDED = 1n;
const DT_STRTAB = 5n;
const SHT_DYNSYM = 11;
const DYNAMIC_ENTRY_SIZE = 16;
const SYMBOL_SIZE = 24;

/**
 * glibc's dynamic loader as a `DT_NEEDED` entry names it: `ld-linux-x86-64.so.2`,
 * `ld-linux-aarch64.so.1`. musl's loader knows no such file, and glibc's is always loaded already
 * (it is the program interpreter), so this is the entry that can go.
 */
export const GLIBC_LOADER = /^ld-linux-[\w-]+\.so\.\d+$/;

function readHeader(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (bytes.length < 64 || view.getUint32(0) !== 0x7f454c46) throw new Error('not an ELF file');
	if (bytes[4] !== 2 || bytes[5] !== 1) throw new Error('only 64-bit little-endian ELF is supported');
	return {
		view,
		programHeaderOffset: Number(view.getBigUint64(0x20, true)),
		sectionHeaderOffset: Number(view.getBigUint64(0x28, true)),
		programHeaderSize: view.getUint16(0x36, true),
		programHeaderCount: view.getUint16(0x38, true),
		sectionHeaderSize: view.getUint16(0x3a, true),
		sectionHeaderCount: view.getUint16(0x3c, true)
	};
}

function segments(elf) {
	const list = [];
	for (let i = 0; i < elf.programHeaderCount; i++) {
		const at = elf.programHeaderOffset + i * elf.programHeaderSize;
		list.push({
			type: elf.view.getUint32(at, true),
			offset: Number(elf.view.getBigUint64(at + 8, true)),
			address: Number(elf.view.getBigUint64(at + 16, true)),
			fileSize: Number(elf.view.getBigUint64(at + 32, true))
		});
	}
	return list;
}

/** Where a virtual address lives in the file, through the loaded segment that maps it. */
function fileOffset(list, address) {
	const load = list.find(
		(segment) => segment.type === PT_LOAD && address >= segment.address && address < segment.address + segment.fileSize
	);
	if (load === undefined) throw new Error(`address 0x${address.toString(16)} is in no loaded segment`);
	return address - load.address + load.offset;
}

function readString(bytes, at) {
	const end = bytes.indexOf(0, at);
	if (end === -1) throw new Error(`unterminated string at ${at}`);
	return new TextDecoder().decode(bytes.subarray(at, end));
}

/** The dynamic entries up to and including the first `DT_NULL`, and the string table they use. */
function readDynamic(bytes) {
	const elf = readHeader(bytes);
	const list = segments(elf);
	const dynamic = list.find((segment) => segment.type === PT_DYNAMIC);
	if (dynamic === undefined) throw new Error('no dynamic segment: not a shared object');
	const entries = [];
	for (let at = dynamic.offset; at + DYNAMIC_ENTRY_SIZE <= dynamic.offset + dynamic.fileSize; at += DYNAMIC_ENTRY_SIZE) {
		const tag = elf.view.getBigInt64(at, true);
		entries.push({ at, tag, value: elf.view.getBigUint64(at + 8, true) });
		if (tag === DT_NULL) break;
	}
	const strtab = entries.find((entry) => entry.tag === DT_STRTAB);
	if (strtab === undefined) throw new Error('dynamic segment has no DT_STRTAB');
	return { dynamic, entries, strings: fileOffset(list, Number(strtab.value)) };
}

/** The `DT_NEEDED` sonames, in the order the loader processes them. */
export function neededLibraries(bytes) {
	const { entries, strings } = readDynamic(bytes);
	return entries.filter((entry) => entry.tag === DT_NEEDED).map((entry) => readString(bytes, strings + Number(entry.value)));
}

/**
 * Remove every `DT_NEEDED` entry whose soname `remove` accepts, editing `bytes` in place.
 * Returns the sonames removed (none: `bytes` is untouched).
 */
export function removeNeeded(bytes, remove) {
	const { dynamic, entries, strings } = readDynamic(bytes);
	const removed = [];
	const kept = [];
	for (const entry of entries) {
		const name = entry.tag === DT_NEEDED ? readString(bytes, strings + Number(entry.value)) : null;
		if (name !== null && remove(name)) removed.push(name);
		else kept.push(bytes.slice(entry.at, entry.at + DYNAMIC_ENTRY_SIZE));
	}
	if (removed.length === 0) return removed;
	let at = dynamic.offset;
	for (const entry of kept) {
		bytes.set(entry, at);
		at += DYNAMIC_ENTRY_SIZE;
	}
	// The slots the removed entries vacated become DT_NULL, which is all zeros.
	bytes.fill(0, at, at + removed.length * DYNAMIC_ENTRY_SIZE);
	return removed;
}

/** The names of the undefined symbols in `.dynsym` — what the binary imports at load time. */
export function undefinedSymbols(bytes) {
	const elf = readHeader(bytes);
	const section = (index) => {
		const at = elf.sectionHeaderOffset + index * elf.sectionHeaderSize;
		return {
			type: elf.view.getUint32(at + 4, true),
			offset: Number(elf.view.getBigUint64(at + 24, true)),
			size: Number(elf.view.getBigUint64(at + 32, true)),
			link: elf.view.getUint32(at + 40, true)
		};
	};
	const names = new Set();
	for (let index = 0; index < elf.sectionHeaderCount; index++) {
		const symbols = section(index);
		if (symbols.type !== SHT_DYNSYM) continue;
		const strings = section(symbols.link).offset;
		for (let at = symbols.offset + SYMBOL_SIZE; at + SYMBOL_SIZE <= symbols.offset + symbols.size; at += SYMBOL_SIZE) {
			const name = elf.view.getUint32(at, true);
			const sectionIndex = elf.view.getUint16(at + 6, true);
			if (sectionIndex === 0 && name !== 0) names.add(readString(bytes, strings + name));
		}
	}
	return [...names];
}
