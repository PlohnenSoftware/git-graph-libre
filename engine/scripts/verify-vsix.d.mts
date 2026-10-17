/** Types for `verify-vsix.mjs`, so the TypeScript test suite can import it. */

export type ZipEntry = {
  name: string;
  method: number;
  crc32: number;
  compressedSize: number;
  size: number;
  localHeader: number;
};

/** Each platform's binary directory, by `platform:arch`; mirrors the loader's table. */
export declare const PLATFORM_DIRECTORIES: Readonly<Record<string, string>>;

/** The functions the loader requires an engine binary to export. */
export declare const REQUIRED_EXPORTS: readonly string[];

/** The directory this platform's binary ships in, or undefined when none does. */
export declare function platformDirectoryFor(platform: string, arch: string): string | undefined;

/** A zip archive's entries by name, read from its central directory. */
export declare function readZipEntries(archive: Buffer): Map<string, ZipEntry>;

/** One entry's bytes, inflated and checked against its recorded size and CRC. */
export declare function readZipEntry(archive: Buffer, entry: ZipEntry): Buffer;

/** The engine binary directories a VSIX ships, and any other file under `engine/native`. */
export declare function nativeContents(entries: Map<string, ZipEntry>): {
  binaries: string[];
  strays: string[];
};

/** Writes a one-commit repository with plain file IO; returns what a read must give back. */
export declare function writeFixtureRepository(directory: string): {
  commit: string;
  file: string;
  contents: string;
};

/** The glibc version this Node runs on, or null off glibc. */
export declare function runningGlibc(): string | null;

/** `gnu` or `musl` on Linux, from what this Node actually runs on; null elsewhere. */
export declare function runningLibc(): "gnu" | "musl" | null;

/** Removes the fixture repository, and off Windows the whole work directory; never throws. */
export declare function cleanupWorkDirectory(
  work: string,
  repository: string,
  platform?: string
): void;
