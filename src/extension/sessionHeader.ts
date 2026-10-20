/**
 * The session header: what the extension ran with, written once per
 * activation so a log read alone says which build, host, machine, backend
 * and Git it came from.
 *
 * Local diagnostics only, never connected to telemetry. Deliberately free of
 * `vscode`, so the backend test project can drive it: the caller reads the
 * host facts and passes them in. Carries no repository, branch, tag, author
 * or remote name and no setting value beyond the backend preference.
 */

import { reducePlatformVersion } from "@/telemetry/commonProperties";
import type { EngineBackend, GitComponentStatus } from "@/types";
import {
  buildComponentStatus,
  type ComponentStatusDeps,
  describeEngineStatus
} from "./componentStatus";

/** The facts known synchronously at activation. */
export type SessionHeaderFacts = {
  extensionVersion: string;
  hostVersion: string;
  appName: string;
  platform: string;
  arch: string;
  /** `os.release()`, reduced to its numeric version like the telemetry property. */
  osRelease: string;
  /** `Date.prototype.getTimezoneOffset()`: minutes *behind* UTC, so UTC+2 is -120. */
  timezoneOffsetMinutes: number;
  /** The D61 mirror file, or undefined while the mirror is off. */
  logFilePath: string | undefined;
  backend: EngineBackend;
};

const MINUTES_PER_HOUR = 60;

/** `+02:00` for UTC+2; `+00:00` at UTC. */
export function formatUtcOffset(timezoneOffsetMinutes: number): string {
  const east = -timezoneOffsetMinutes;
  const sign = east < 0 ? "-" : "+";
  const absolute = Math.abs(east);
  const hours = String(Math.floor(absolute / MINUTES_PER_HOUR)).padStart(2, "0");
  const minutes = String(absolute % MINUTES_PER_HOUR).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

/** The lines known at activation, before Git answers. */
export function formatSessionHeader(facts: SessionHeaderFacts): string[] {
  const os = reducePlatformVersion(facts.osRelease);
  return [
    `[session] extension=${facts.extensionVersion} host=${facts.hostVersion} app=${JSON.stringify(facts.appName)}`,
    `[session] platform=${facts.platform} arch=${facts.arch} os=${os === "" ? "unknown" : os} utcOffset=${formatUtcOffset(facts.timezoneOffsetMinutes)}`,
    `[session] logFile=${JSON.stringify(facts.logFilePath ?? null)} backend=${facts.backend}`
  ];
}

function describeGit(git: GitComponentStatus | null): string {
  if (git === null) return "[session] git not probed";
  const path = JSON.stringify(git.path);
  return git.state === "ok"
    ? `[session] git path=${path} version=${JSON.stringify(git.version)}`
    : `[session] git path=${path} unavailable=${JSON.stringify(git.detail)}`;
}

/**
 * Writes the header, then the Git and engine lines once `git --version`
 * answers. Never throws: a header must not be the reason activation fails.
 * Returns when the last line is written, so callers may `void` it.
 */
export async function logSessionHeader(
  facts: SessionHeaderFacts,
  gitPath: string,
  log: (line: string) => void,
  status: Pick<ComponentStatusDeps, "probe" | "engine"> = {}
): Promise<void> {
  for (const line of formatSessionHeader(facts)) log(line);
  try {
    const components = await buildComponentStatus({
      preference: facts.backend,
      gitPath,
      probe: status.probe,
      engine: status.engine
    });
    log(describeGit(components.git));
    log(`[session] engine ${describeEngineStatus(components.engine)}`);
  } catch (error: unknown) {
    log(`[session] component status skipped: ${String(error)}`);
  }
}
