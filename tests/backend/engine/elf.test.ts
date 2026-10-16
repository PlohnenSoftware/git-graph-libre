import { describe, expect, it } from "vitest";
import {
  GLIBC_LOADER,
  neededLibraries,
  removeNeeded,
  undefinedSymbols
} from "../../../engine/scripts/elf.mjs";

/**
 * The ELF editing `build-addon.mjs` does to every Linux glibc build of the engine: drop glibc's
 * dynamic loader from `DT_NEEDED` so musl's loader accepts the binary, then read the imports back
 * to assert that `gnu_get_libc_version` is not among them. The fixture is built here rather than
 * read from a compiled addon, so the tests run whether or not an engine has been built.
 */

type FixtureSymbol = { name: string; defined: boolean };

const DT_NEEDED = BigInt(1);
const DT_STRTAB = BigInt(5);
const DT_NULL_ENTRY: [bigint, bigint] = [BigInt(0), BigInt(0)];

/**
 * A minimal 64-bit little-endian shared object: one `PT_LOAD` mapping the file at address 0 (so
 * addresses equal file offsets), a `PT_DYNAMIC` with the given `DT_NEEDED` entries, a `DT_STRTAB`
 * and trailing `DT_NULL` padding, and `.dynsym`/`.dynstr`/`.dynamic` section headers.
 */
function makeSharedObject(needed: string[], symbols: FixtureSymbol[], nullPadding = 2): Uint8Array {
  const strings: number[] = [0];
  const intern = (text: string): number => {
    const at = strings.length;
    strings.push(...new TextEncoder().encode(text), 0);
    return at;
  };
  const neededAt = needed.map(intern);
  const symbolAt = symbols.map((symbol) => intern(symbol.name));

  const header = 64;
  const programHeaders = header;
  const stringsAt = programHeaders + 2 * 56;
  const symbolsAt = Math.ceil((stringsAt + strings.length) / 8) * 8;
  const dynamicAt = symbolsAt + (symbols.length + 1) * 24;
  const dynamicCount = needed.length + 1 + nullPadding;
  const sectionsAt = dynamicAt + dynamicCount * 16;
  const size = sectionsAt + 4 * 64;

  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
  view.setUint16(16, 3, true); // ET_DYN
  view.setUint16(18, 62, true); // EM_X86_64
  view.setUint32(20, 1, true);
  view.setBigUint64(0x20, BigInt(programHeaders), true);
  view.setBigUint64(0x28, BigInt(sectionsAt), true);
  view.setUint16(0x34, header, true);
  view.setUint16(0x36, 56, true);
  view.setUint16(0x38, 2, true);
  view.setUint16(0x3a, 64, true);
  view.setUint16(0x3c, 4, true);

  const segment = (index: number, type: number, offset: number, length: number) => {
    const at = programHeaders + index * 56;
    view.setUint32(at, type, true);
    view.setBigUint64(at + 8, BigInt(offset), true);
    view.setBigUint64(at + 16, BigInt(offset), true);
    view.setBigUint64(at + 32, BigInt(length), true);
    view.setBigUint64(at + 40, BigInt(length), true);
  };
  segment(0, 1, 0, size); // PT_LOAD over the whole file
  segment(1, 2, dynamicAt, dynamicCount * 16); // PT_DYNAMIC

  bytes.set(strings, stringsAt);
  symbols.forEach((symbol, index) => {
    const at = symbolsAt + (index + 1) * 24;
    view.setUint32(at, symbolAt[index], true);
    view.setUint8(at + 4, 0x12); // STB_GLOBAL, STT_FUNC
    view.setUint16(at + 6, symbol.defined ? 1 : 0, true);
  });
  neededAt.forEach((name, index) => {
    view.setBigInt64(dynamicAt + index * 16, DT_NEEDED, true);
    view.setBigUint64(dynamicAt + index * 16 + 8, BigInt(name), true);
  });
  view.setBigInt64(dynamicAt + needed.length * 16, DT_STRTAB, true);
  view.setBigUint64(dynamicAt + needed.length * 16 + 8, BigInt(stringsAt), true);

  const section = (index: number, type: number, offset: number, length: number, link: number) => {
    const at = sectionsAt + index * 64;
    view.setUint32(at + 4, type, true);
    view.setBigUint64(at + 24, BigInt(offset), true);
    view.setBigUint64(at + 32, BigInt(length), true);
    view.setUint32(at + 40, link, true);
  };
  section(1, 11, symbolsAt, (symbols.length + 1) * 24, 2); // .dynsym -> .dynstr
  section(2, 3, stringsAt, strings.length, 0); // .dynstr
  section(3, 6, dynamicAt, dynamicCount * 16, 2); // .dynamic
  return bytes;
}

/** The raw dynamic entries as `[tag, value]`, every slot including the DT_NULL padding. */
function dynamicEntries(bytes: Uint8Array): [bigint, bigint][] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = Number(view.getBigUint64(0x20, true)) + 56;
  const offset = Number(view.getBigUint64(at + 8, true));
  const length = Number(view.getBigUint64(at + 32, true));
  const entries: [bigint, bigint][] = [];
  for (let entry = offset; entry < offset + length; entry += 16) {
    entries.push([view.getBigInt64(entry, true), view.getBigUint64(entry + 8, true)]);
  }
  return entries;
}

const GNU_NEEDED = [
  "libm.so.6",
  "libpthread.so.0",
  "libc.so.6",
  "libdl.so.2",
  "ld-linux-x86-64.so.2"
];

describe("GLIBC_LOADER", () => {
  it("matches glibc's dynamic loader on both shipped architectures", () => {
    expect(GLIBC_LOADER.test("ld-linux-x86-64.so.2")).toBe(true);
    expect(GLIBC_LOADER.test("ld-linux-aarch64.so.1")).toBe(true);
  });

  it("matches nothing musl provides or the C library itself", () => {
    for (const name of [
      "libc.so.6",
      "libm.so.6",
      "libdl.so.2",
      "ld-musl-x86_64.so.1",
      "libld-linux-x86-64.so.2"
    ]) {
      expect(GLIBC_LOADER.test(name)).toBe(false);
    }
  });
});

describe("neededLibraries", () => {
  it("lists DT_NEEDED in the order the loader processes them", () => {
    expect(neededLibraries(makeSharedObject(GNU_NEEDED, []))).toEqual(GNU_NEEDED);
  });

  it("refuses what it does not support", () => {
    expect(() => neededLibraries(new Uint8Array(64))).toThrow("not an ELF file");
    const thirtyTwoBit = makeSharedObject(GNU_NEEDED, []);
    thirtyTwoBit[4] = 1;
    expect(() => neededLibraries(thirtyTwoBit)).toThrow("only 64-bit little-endian");
  });
});

describe("removeNeeded", () => {
  it("drops the loader, keeps the rest in order, and pads with DT_NULL", () => {
    const bytes = makeSharedObject(GNU_NEEDED, []);
    const before = dynamicEntries(bytes);

    expect(removeNeeded(bytes, (name) => GLIBC_LOADER.test(name))).toEqual([
      "ld-linux-x86-64.so.2"
    ]);

    expect(neededLibraries(bytes)).toEqual(GNU_NEEDED.slice(0, 4));
    const after = dynamicEntries(bytes);
    expect(after).toHaveLength(before.length);
    expect(after.slice(0, 4)).toEqual(before.slice(0, 4));
    expect(after[4]).toEqual(before[5]); // DT_STRTAB moved up into the vacated slot
    for (const padding of after.slice(5)) expect(padding).toEqual(DT_NULL_ENTRY);
  });

  it("removes entries anywhere in the list, not only the last", () => {
    const bytes = makeSharedObject(["ld-linux-aarch64.so.1", "libc.so.6"], [], 0);
    expect(removeNeeded(bytes, (name) => GLIBC_LOADER.test(name))).toEqual([
      "ld-linux-aarch64.so.1"
    ]);
    expect(neededLibraries(bytes)).toEqual(["libc.so.6"]);
    expect(dynamicEntries(bytes).at(-1)).toEqual(DT_NULL_ENTRY);
  });

  it("leaves the file byte-for-byte alone when nothing matches", () => {
    const bytes = makeSharedObject(["libc.so.6", "libm.so.6"], []);
    const copy = bytes.slice();
    expect(removeNeeded(bytes, (name) => GLIBC_LOADER.test(name))).toEqual([]);
    expect(bytes).toEqual(copy);
  });
});

describe("undefinedSymbols", () => {
  it("returns the imports and not the definitions", () => {
    const bytes = makeSharedObject(GNU_NEEDED, [
      { name: "malloc", defined: false },
      { name: "napi_register_module_v1", defined: true },
      { name: "gnu_get_libc_version", defined: false }
    ]);
    expect(undefinedSymbols(bytes).sort()).toEqual(["gnu_get_libc_version", "malloc"]);
  });
});
