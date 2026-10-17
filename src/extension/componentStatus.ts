/**
 * What the status indicator's popup lists: the Git command line, the Rust
 * engine, and which of the two answered the last graph load.
 *
 * Deliberately free of `vscode`, so the backend test project can drive it:
 * the caller reads the live preference and git path and passes them in.
 */

import { execFile } from "node:child_process";
import { engineComponentStatus, lastGraphLoadRoute } from "@/backend/engine/index";
import { traceBackend } from "@/backend/utils/operationLog";
import type {
  ComponentStatus,
  EngineBackend,
  EngineComponentStatus,
  GitComponentStatus,
  GraphLoadRoute
} from "@/types";

/** Long enough for a cold start on a slow disk; a hung binary must not hold the popup forever. */
const GIT_PROBE_TIMEOUT_MS = 5000;

/**
 * `git --version` through the binary the extension is configured to use.
 * Total: a missing binary, a non-zero exit or a timeout all resolve to a
 * `failed` status carrying the first line of the reason.
 */
export async function probeGit(gitPath: string): Promise<GitComponentStatus> {
  try {
    const version = await traceBackend(
      "cli",
      "gitVersion",
      null,
      () =>
        new Promise<string>((resolve, reject) => {
          execFile(
            gitPath,
            ["--version"],
            { timeout: GIT_PROBE_TIMEOUT_MS, windowsHide: true },
            (error, stdout, stderr) => {
              const output = String(stdout).trim();
              if (error === null && output !== "") {
                resolve(output);
                return;
              }
              const reason = String(stderr).trim() || error?.message || "no output";
              reject(new Error(reason.split("\n", 1)[0] ?? reason));
            }
          );
        })
    );
    return { state: "ok", path: gitPath, version };
  } catch (error) {
    return {
      state: "failed",
      path: gitPath,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

export type ComponentStatusDeps = {
  /** Read live by the caller, like every other reader of the setting. */
  preference: EngineBackend;
  gitPath: string;
  probe?: (gitPath: string) => Promise<GitComponentStatus>;
  engine?: (preference: EngineBackend) => EngineComponentStatus;
  graphLoad?: () => GraphLoadRoute | null;
};

export async function buildComponentStatus(deps: ComponentStatusDeps): Promise<ComponentStatus> {
  const probe = deps.probe ?? probeGit;
  const engine = deps.engine ?? ((preference: EngineBackend) => engineComponentStatus(preference));
  const graphLoad = deps.graphLoad ?? lastGraphLoadRoute;
  return {
    git: await probe(deps.gitPath),
    engine: engine(deps.preference),
    graphLoad: graphLoad()
  };
}

/**
 * The engine's state as one output-channel line, in English like every
 * other line there. Written when the graph document is built, so "did the
 * engine start?" is answered in the log without hovering anything.
 */
export function describeEngineStatus(status: EngineComponentStatus): string {
  switch (status.state) {
    case "active":
      return `Rust engine ${status.version} active (${status.platform})`;
    case "off":
      return "Rust engine off: the backend setting is git-cli, so every read uses the git CLI";
    case "unavailable": {
      const detail = status.detail === null ? "" : `: ${status.detail}`;
      return `Rust engine unavailable (${status.reason}, ${status.platform}${detail}); every read uses the git CLI`;
    }
  }
}
