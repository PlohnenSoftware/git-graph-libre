/** Types for `elf.mjs`, so the TypeScript test suite can import it. */

/** glibc's dynamic loader as a `DT_NEEDED` entry names it (`ld-linux-x86-64.so.2`, …). */
export declare const GLIBC_LOADER: RegExp;

/** The `DT_NEEDED` sonames, in the order the loader processes them. */
export declare function neededLibraries(bytes: Uint8Array): string[];

/** Remove the `DT_NEEDED` entries `remove` accepts, in place; returns the sonames removed. */
export declare function removeNeeded(bytes: Uint8Array, remove: (name: string) => boolean): string[];

/** The names of the undefined symbols in `.dynsym`. */
export declare function undefinedSymbols(bytes: Uint8Array): string[];
