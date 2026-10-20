import type {
  FailureScreen,
  RepositoryProbe,
  RequestMessage,
  ResponseMessage,
  StartupStatus
} from "@/types";
import { renderComponentDetails } from "./componentStatus";
import { createFailureScreenReporter } from "./failureScreen";
import { sendMessage, vscode } from "./utils/vscode";

export function startupFailure(status: StartupStatus): FailureScreen {
  if (status.roots.length === 0) return "noWorkspace";
  if (status.repositories.some((repo) => repo.state === "untrusted")) return "gitUntrusted";
  if (status.components.git?.state === "failed") return "gitUnavailable";
  if (status.error || status.repositories.some((repo) => repo.state === "error"))
    return "repositoryError";
  return "noRepository";
}

function titleFor(screen: FailureScreen): string {
  const titles: Record<FailureScreen, string> = {
    noWorkspace: l10n.startupNoWorkspace,
    gitUntrusted: l10n.startupUntrusted,
    gitUnavailable: l10n.startupGitUnavailable,
    noRepository: l10n.startupNoRepository,
    repositoryError: l10n.startupRepositoryError,
    graphLoadError: l10n.unableToLoadGitGraph
  };
  return titles[screen];
}

/**
 * The line under the title. No workspace and no repository are empty states,
 * not faults, so they say what would fill the view instead of asking for a
 * fix and a retry.
 */
function summaryFor(screen: FailureScreen): string {
  if (screen === "noWorkspace") return l10n.startupNoWorkspaceHint;
  if (screen === "noRepository") return l10n.startupNoRepositoryHint;
  return l10n.startupRecoveryHint;
}

function repositoryStateText(repo: RepositoryProbe): string {
  if (repo.state === "untrusted") return l10n.startupTrustHint;
  if (repo.repository === true)
    return repo.detectedBy === "engine" ? l10n.startupFoundEngine : l10n.startupFound;
  return repo.repository === false ? l10n.startupNotFound : l10n.startupUnknown;
}

function renderRepository(repo: RepositoryProbe): HTMLElement {
  const row = document.createElement("section");
  row.className = "startupRepository";
  const name = document.createElement("code");
  name.textContent = repo.path;
  const state = document.createElement("p");
  state.textContent = repositoryStateText(repo);
  row.append(name, state);
  for (const detail of [repo.detail, repo.engineDetail]) {
    if (!detail) continue;
    const text = document.createElement("pre");
    text.textContent = detail;
    row.append(text);
  }
  if (repo.state === "untrusted") {
    const trust = document.createElement("button");
    trust.type = "button";
    trust.textContent = l10n.startupTrust;
    trust.dataset.repo = repo.path;
    row.append(trust);
  }
  return row;
}

export function initStartupScreen(
  send: (message: RequestMessage) => void = sendMessage
): () => void {
  const title = document.getElementById("startupTitle");
  const summary = document.getElementById("startupSummary");
  const repositories = document.getElementById("startupRepositories");
  const components = document.getElementById("startupComponents");
  if (!title || !summary || !repositories || !components) return () => {};
  const listeners = new AbortController();
  const { signal } = listeners;
  let pendingSince: number | null = null;
  const failures = createFailureScreenReporter(send);
  const search = document.getElementById("startupSearchDepth");
  const refresh = () => {
    if (document.hidden || (pendingSince !== null && Date.now() - pendingSince < 15000)) return;
    pendingSince = Date.now();
    send({ command: "repositoryStatus" });
  };
  const receive = (event: MessageEvent<ResponseMessage>) => {
    if (event.origin !== globalThis.location.origin || event.data?.command !== "repositoryStatus")
      return;
    pendingSince = null;
    const status = event.data.startup;
    const latest = startupFailure(status);
    title.textContent = titleFor(latest);
    const depth = document.getElementById("repoSearchDepth") as HTMLInputElement | null;
    if (search) search.hidden = latest !== "noRepository";
    if (depth && document.activeElement !== depth) depth.value = String(status.searchDepth);
    summary.textContent = status.error ?? summaryFor(latest);
    repositories.replaceChildren(...status.repositories.map(renderRepository));
    renderComponentDetails(components, status.components);
    failures.show(latest);
  };
  const retry = document.getElementById("retryRepositories");
  const settings = document.getElementById("openGitSettings");
  const output = document.getElementById("showOutput");
  const openLog = document.getElementById("openLogFile");
  const copyLog = document.getElementById("copyRecentLog");
  repositories.addEventListener(
    "click",
    (event) => {
      const button = event.target;
      if (!(button instanceof HTMLButtonElement) || button.dataset.repo === undefined) return;
      button.disabled = true;
      send({ command: "trustRepository", repo: button.dataset.repo });
    },
    { signal }
  );
  search?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const input = document.getElementById("repoSearchDepth") as HTMLInputElement;
      const depth = input.valueAsNumber;
      if (Number.isInteger(depth) && depth >= 0 && depth <= 20)
        send({ command: "setRepoSearchDepth", depth });
    },
    { signal }
  );
  retry?.addEventListener(
    "click",
    () => {
      pendingSince = null;
      refresh();
    },
    { signal }
  );
  settings?.addEventListener("click", () => send({ command: "openGitSettings" }), { signal });
  output?.addEventListener("click", () => send({ command: "showOutput" }), { signal });
  openLog?.addEventListener("click", () => send({ command: "openLogFile" }), { signal });
  copyLog?.addEventListener("click", () => send({ command: "copyRecentLog" }), { signal });
  window.addEventListener("message", receive, { signal });
  document.addEventListener("visibilitychange", refresh, { signal });
  renderComponentDetails(components, null);
  refresh();
  const timer = setInterval(refresh, 5000);
  return () => {
    clearInterval(timer);
    failures.dispose();
    listeners.abort();
  };
}

// Persist even the initial failure screen so VS Code can revive its panel.
if (document.getElementById("startupTitle")) {
  vscode.setState(vscode.getState() ?? { startup: true });
  const dispose = initStartupScreen();
  window.addEventListener("pagehide", dispose, { once: true });
}
