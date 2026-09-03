/**
 * The environment properties VS Code does not inject — yet.
 *
 * `getBuiltInCommonProperties()` in the extension host supplies thirteen
 * `common.*` properties and none of them describes the machine's operating
 * system: VS Code's own `extHostTelemetry.ts` carries a comment acknowledging
 * the gap and leaving it open. The ingest has `os`, `node_arch` and
 * `platform_version` columns and the user-facing disclosure names them, so
 * they are supplied here through `createTelemetryLogger`'s
 * `additionalCommonProperties` instead.
 *
 * **Removal condition.** When VS Code closes that gap and starts injecting
 * these keys, delete this module in the same slice. Nothing breaks if it is
 * forgotten — the logger mixes its built-ins in *after* the additional
 * properties, so VS Code's values would win — but two sources for one key is
 * exactly the kind of quiet duplication that outlives the reason for it.
 *
 * Deliberately free of any `vscode` import so the backend test project can
 * load it, and deliberately regex-free: `S5852`-style backtracking is not a
 * risk worth carrying for a version string, and a hand-rolled scan states the
 * truncation rule more plainly than a pattern does.
 */

import * as os from "node:os";

/** The machine facts the properties are derived from. Injected in tests. */
export type EnvironmentFacts = {
  /** `process.platform`, e.g. `linux`, `darwin`, `win32`. */
  platform: string;
  /** `process.arch`, e.g. `x64`, `arm64`. */
  arch: string;
  /** `os.release()`, e.g. `7.2.2-1-cachyos` or `10.0.22631`. */
  release: string;
};

const DIGITS = "0123456789";
/** Kernel versions are `major.minor.patch`; anything beyond is a build tag. */
const MAX_VERSION_SEGMENTS = 3;

function leadingDigits(segment: string): string {
  let end = 0;
  while (end < segment.length && DIGITS.includes(segment.charAt(end))) end += 1;
  return segment.slice(0, end);
}

/**
 * Reduces an OS release string to its numeric version.
 *
 * `7.2.2-1-cachyos` becomes `7.2.2`: the distribution/build suffix is what
 * makes a release string identifying, and it is of no use for ranking
 * features. Stops at the first segment that is not purely numeric, so a
 * suffix cannot drag further segments along with it.
 */
export function reducePlatformVersion(release: string): string {
  const kept: string[] = [];
  for (const segment of release.split(".").slice(0, MAX_VERSION_SEGMENTS)) {
    const digits = leadingDigits(segment);
    if (digits === "") break;
    kept.push(digits);
    if (digits.length !== segment.length) break;
  }
  return kept.join(".");
}

function readEnvironmentFacts(): EnvironmentFacts {
  return { platform: process.platform, arch: process.arch, release: os.release() };
}

/**
 * Builds the `common.*` properties this extension adds to every event.
 *
 * Keys are lowercase to match the ones the ingest maps to columns. A value
 * that cannot be determined is omitted rather than sent empty, so the column
 * holds NULL instead of a string that has to be filtered out in every query.
 */
export function buildAdditionalCommonProperties(
  facts: EnvironmentFacts = readEnvironmentFacts()
): Record<string, string> {
  const properties: Record<string, string> = {};
  const platformVersion = reducePlatformVersion(facts.release);

  if (facts.platform !== "") properties["common.os"] = facts.platform;
  if (facts.arch !== "") properties["common.nodearch"] = facts.arch;
  if (platformVersion !== "") properties["common.platformversion"] = platformVersion;

  return properties;
}
