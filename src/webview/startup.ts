import type { FailureScreen, RepositoryProbe, RequestMessage, ResponseMessage, StartupStatus } from "@/types";
import { renderComponentDetails } from "./componentStatus";
import { sendMessage, vscode } from "./utils/vscode";

export function startupFailure(status: StartupStatus): FailureScreen {
  if (status.roots.length === 0) return "noWorkspace";
  if (status.repositories.some(repo => repo.state === "untrusted")) return "gitUntrusted";
  if (status.components.git?.state === "failed") return "gitUnavailable";
  if (status.error || status.repositories.some(repo => repo.state === "error")) return "repositoryError";
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

function renderRepository(repo: RepositoryProbe, send: (message: RequestMessage) => void): HTMLElement {
  const row = document.createElement("section");
  row.className = "startupRepository";
  const name = document.createElement("code");
  name.textContent = repo.path;
  const state = document.createElement("p");
  state.textContent = repo.state === "untrusted" ? l10n.startupTrustHint :
    repo.repository === true ? (repo.detectedBy === "engine" ? l10n.startupFoundEngine : l10n.startupFound) :
      repo.repository === false ? l10n.startupNotFound : l10n.startupUnknown;
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
    trust.addEventListener("click", () => {
      trust.disabled = true;
      send({ command: "trustRepository", repo: repo.path });
    });
    row.append(trust);
  }
  return row;
}

export function initStartupScreen(send: (message: RequestMessage) => void = sendMessage): () => void {
  const title = document.getElementById("startupTitle");
  const summary = document.getElementById("startupSummary");
  const repositories = document.getElementById("startupRepositories");
  const components = document.getElementById("startupComponents");
  if (!title || !summary || !repositories || !components) return () => {};
  let pending = false;
  let shown: FailureScreen | null = null;
  let latest: FailureScreen | null = null;
  const reportShown = () => {
    if (document.hidden || latest === null || latest === shown) return;
    shown = latest;
    send({ command: "failureScreenShown", screen: shown });
  };
  const refresh = () => {
    if (pending || document.hidden) return;
    pending = true;
    send({ command: "repositoryStatus" });
  };
  const receive = (event: MessageEvent<ResponseMessage>) => {
    if (event.data.command !== "repositoryStatus") return;
    pending = false;
    const status = event.data.startup;
    latest = startupFailure(status);
    title.textContent = titleFor(latest);
    const search = document.getElementById("startupSearchDepth");
    const depth = document.getElementById("repoSearchDepth") as HTMLInputElement | null;
    if (search) search.hidden = latest !== "noRepository";
    if (depth && document.activeElement !== depth) depth.value = String(status.searchDepth);
    summary.textContent = status.error ?? l10n.startupRecoveryHint;
    repositories.replaceChildren(...status.repositories.map(repo => renderRepository(repo, send)));
    renderComponentDetails(components, status.components);
    reportShown();
  };
  const visibility = () => { reportShown(); refresh(); };
  const retry = document.getElementById("retryRepositories");
  const settings = document.getElementById("openGitSettings");
  const output = document.getElementById("showOutput");
  const search = document.getElementById("startupSearchDepth");
  search?.addEventListener("submit", event => {
    event.preventDefault();
    const input = document.getElementById("repoSearchDepth") as HTMLInputElement;
    const depth = input.valueAsNumber;
    if (Number.isInteger(depth) && depth >= 0 && depth <= 20) send({ command: "setRepoSearchDepth", depth });
  });
  retry?.addEventListener("click", refresh);
  settings?.addEventListener("click", () => send({ command: "openGitSettings" }));
  output?.addEventListener("click", () => send({ command: "showOutput" }));
  window.addEventListener("message", receive);
  document.addEventListener("visibilitychange", visibility);
  renderComponentDetails(components, null);
  refresh();
  const timer = setInterval(refresh, 5000);
  return () => {
    clearInterval(timer);
    window.removeEventListener("message", receive);
    document.removeEventListener("visibilitychange", visibility);
    retry?.removeEventListener("click", refresh);
  };
}

// Persist even the initial failure screen so VS Code can revive its panel.
if (document.getElementById("startupTitle")) {
  vscode.setState(vscode.getState() ?? { startup: true });
  const dispose = initStartupScreen();
  window.addEventListener("pagehide", dispose, { once: true });
}
