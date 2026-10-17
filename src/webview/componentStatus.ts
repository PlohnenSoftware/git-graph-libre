/**
 * The status indicator's popup: what is working, and through what.
 *
 * A pointer resting on the indicator (the dot and the status text beside it)
 * opens the popup after a deliberate pause, so passing over the strip on the
 * way to the toolbar shows nothing; focusing the indicator opens it at once.
 * Fresh answers are asked for the moment the hover begins, so they have
 * usually arrived by the time the popup opens, and an answer that arrives
 * while it is open re-renders it in place.
 *
 * Every value is set through `textContent`: the git version line and the
 * loader's failure detail come from outside the extension.
 */

import type {
  ComponentStatus,
  EngineComponentStatus,
  EngineUnavailableReason,
  GraphLoadRoute
} from "@/types";

import { setEngineState } from "./statusStrip";

/** How long a pointer has to rest on the indicator before the popup opens. */
export const COMPONENT_STATUS_HOVER_DELAY_MS = 700;
/** Grace before closing, so the pointer can cross the gap into the popup. */
const CLOSE_DELAY_MS = 200;
/** Space kept between the popup and the window edge, and below the indicator. */
const EDGE_GAP_PX = 6;

const POPUP_ID = "componentStatusPopup";

type Tone = "ok" | "warning" | "error" | "neutral";
type Row = { label: string; value: string; tone: Tone; detail?: string | null };

let latestStatus: ComponentStatus | null = null;
/** Whether the pointer is over the indicator or the popup — a blur then must not close it. */
let pointerOver = false;
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Wire the indicator. `requestStatus` asks the host for a fresh
 * `componentStatus` answer; the reply comes back through
 * `applyComponentStatus`.
 */
export function initComponentStatus(requestStatus: () => void): void {
  const summary = document.getElementById("statusSummary");
  if (summary === null) return;
  summary.addEventListener("mouseenter", () => {
    pointerOver = true;
    cancelClose();
    if (isPopupOpen() || openTimer !== null) return;
    requestStatus();
    openTimer = setTimeout(() => {
      openTimer = null;
      openPopup();
    }, COMPONENT_STATUS_HOVER_DELAY_MS);
  });
  summary.addEventListener("mouseleave", onPointerLeave);
  summary.addEventListener("focus", () => {
    requestStatus();
    openPopup();
  });
  // Clicking into the popup to select its text blurs the indicator; the
  // pointer is still over the popup then, and leaving it closes it later.
  summary.addEventListener("blur", () => {
    if (!pointerOver) closePopup();
  });
  summary.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopup();
  });
}

/** Take a host answer: recolor the indicator, and refresh the popup if it is open. */
export function applyComponentStatus(status: ComponentStatus): void {
  latestStatus = status;
  setEngineState(status.engine.state);
  const popup = document.getElementById(POPUP_ID);
  if (popup !== null && !popup.hidden) renderPopup(popup, status);
}

/** Test seam: the module keeps the last answer and its timers across calls. */
export function resetComponentStatus(): void {
  latestStatus = null;
  pointerOver = false;
  cancelOpen();
  cancelClose();
  document.getElementById(POPUP_ID)?.remove();
}

function isPopupOpen(): boolean {
  const popup = document.getElementById(POPUP_ID);
  return popup !== null && !popup.hidden;
}

function openPopup(): void {
  cancelOpen();
  cancelClose();
  const summary = document.getElementById("statusSummary");
  if (summary === null) return;
  const popup = ensurePopup();
  renderPopup(popup, latestStatus);
  popup.hidden = false;
  summary.setAttribute("aria-describedby", POPUP_ID);
  positionPopup(popup, summary);
}

function closePopup(): void {
  cancelOpen();
  cancelClose();
  const popup = document.getElementById(POPUP_ID);
  if (popup !== null) popup.hidden = true;
  document.getElementById("statusSummary")?.removeAttribute("aria-describedby");
}

function onPointerLeave(): void {
  pointerOver = false;
  scheduleClose();
}

function scheduleClose(): void {
  cancelOpen();
  if (closeTimer !== null) return;
  closeTimer = setTimeout(() => {
    closeTimer = null;
    closePopup();
  }, CLOSE_DELAY_MS);
}

function cancelOpen(): void {
  if (openTimer === null) return;
  clearTimeout(openTimer);
  openTimer = null;
}

function cancelClose(): void {
  if (closeTimer === null) return;
  clearTimeout(closeTimer);
  closeTimer = null;
}

/**
 * The popup lives on `body`, not inside the strip: the strip clips its
 * overflow so it can collapse to nothing when the graph scrolls.
 */
function ensurePopup(): HTMLElement {
  const existing = document.getElementById(POPUP_ID);
  if (existing !== null) return existing;
  const popup = document.createElement("div");
  popup.id = POPUP_ID;
  popup.className = "componentStatusPopup";
  popup.setAttribute("role", "tooltip");
  popup.hidden = true;
  // Moving onto the popup keeps it open, so its text can be read and copied.
  popup.addEventListener("mouseenter", () => {
    pointerOver = true;
    cancelClose();
  });
  popup.addEventListener("mouseleave", onPointerLeave);
  document.body.appendChild(popup);
  return popup;
}

function positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const maxLeft = window.innerWidth - popup.offsetWidth - EDGE_GAP_PX;
  popup.style.top = `${Math.round(rect.bottom + EDGE_GAP_PX)}px`;
  popup.style.left = `${Math.round(Math.max(EDGE_GAP_PX, Math.min(rect.left, maxLeft)))}px`;
}

export function renderComponentDetails(popup: HTMLElement, status: ComponentStatus | null): void {
  const title = document.createElement("div");
  title.className = "componentStatusTitle";
  title.textContent = l10n.componentStatusTitle;

  const list = document.createElement("dl");
  list.className = "componentStatusList";
  for (const row of componentRows(status)) list.appendChild(renderRow(row));

  const children: HTMLElement[] = [title, list];
  if (status?.engine.state === "unavailable") {
    const note = document.createElement("p");
    note.className = "componentStatusNote";
    note.textContent = l10n.componentStatusCliFallback;
    children.push(note);
  }
  popup.replaceChildren(...children);
}

const renderPopup = renderComponentDetails;

function renderRow(row: Row): HTMLElement {
  const group = document.createElement("div");
  group.className = "componentStatusRow";
  group.dataset.tone = row.tone;
  const term = document.createElement("dt");
  const dot = document.createElement("span");
  dot.className = "componentStatusDot";
  dot.setAttribute("aria-hidden", "true");
  term.append(dot, row.label);
  const value = document.createElement("dd");
  value.textContent = row.value;
  group.append(term, value);
  if (row.detail !== undefined && row.detail !== null) {
    const detail = document.createElement("dd");
    detail.className = "componentStatusDetail";
    detail.textContent = row.detail;
    group.appendChild(detail);
  }
  return group;
}

/**
 * The three rows, in the order a reader checks them: the command line
 * everything falls back to, the engine, and which of the two the graph used.
 * Before the first answer arrives, every row says it is being checked.
 */
export function componentRows(status: ComponentStatus | null): Row[] {
  if (status === null) {
    const checking: Tone = "neutral";
    return [
      { label: l10n.componentStatusGit, value: l10n.componentStatusChecking, tone: checking },
      { label: l10n.componentStatusEngine, value: l10n.componentStatusChecking, tone: checking },
      { label: l10n.componentStatusGraphLoad, value: l10n.componentStatusChecking, tone: checking }
    ];
  }
  return [gitRow(status), engineRow(status.engine), graphLoadRow(status.graphLoad)];
}

function gitRow(status: ComponentStatus): Row {
  const label = l10n.componentStatusGit;
  if (status.git === null) return { label, value: l10n.componentStatusChecking, tone: "neutral" };
  if (status.git.state === "ok")
    return { label, value: status.git.version, tone: "ok", detail: status.git.path };
  return {
    label,
    value: l10n.componentStatusGitFailed.replace("{0}", status.git.detail),
    tone: "error"
  };
}

const UNAVAILABLE_REASONS: Record<EngineUnavailableReason, () => string> = {
  unsupportedPlatform: () => l10n.componentStatusReasonUnsupportedPlatform,
  missing: () => l10n.componentStatusReasonMissing,
  loadFailed: () => l10n.componentStatusReasonLoadFailed,
  versionMismatch: () => l10n.componentStatusReasonVersionMismatch,
  incompatible: () => l10n.componentStatusReasonIncompatible
};

function engineRow(engine: EngineComponentStatus): Row {
  const label = l10n.componentStatusEngine;
  switch (engine.state) {
    case "active":
      return {
        label,
        value: l10n.componentStatusEngineActive
          .replace("{0}", engine.version)
          .replace("{1}", engine.platform),
        tone: "ok"
      };
    case "off":
      return { label, value: l10n.componentStatusEngineOff, tone: "neutral" };
    case "unavailable":
      return {
        label,
        value: l10n.componentStatusEngineUnavailable.replace(
          "{0}",
          UNAVAILABLE_REASONS[engine.reason]().replace("{0}", engine.platform)
        ),
        tone: "warning",
        detail: engine.detail
      };
  }
}

const CLI_ROUTES: Record<Exclude<GraphLoadRoute, "engine">, () => string> = {
  setting: () => l10n.componentStatusRouteSetting,
  forced: () => l10n.componentStatusRouteForced,
  unavailable: () => l10n.componentStatusRouteUnavailable,
  handedBack: () => l10n.componentStatusRouteHandedBack,
  topoOrdering: () => l10n.componentStatusRouteTopoOrdering,
  reflog: () => l10n.componentStatusRouteReflog,
  unreachableCommits: () => l10n.componentStatusRouteUnreachableCommits,
  globPattern: () => l10n.componentStatusRouteGlobPattern
};

/**
 * A command-line load is neutral, not a fault — every route but one is the
 * design working — so only the one caused by an unavailable engine is amber.
 */
function graphLoadRow(route: GraphLoadRoute | null): Row {
  const label = l10n.componentStatusGraphLoad;
  if (route === null) return { label, value: l10n.componentStatusGraphLoadNone, tone: "neutral" };
  if (route === "engine") return { label, value: l10n.componentStatusRouteEngine, tone: "ok" };
  return {
    label,
    value: l10n.componentStatusRouteCli.replace("{0}", CLI_ROUTES[route]()),
    tone: route === "unavailable" ? "warning" : "neutral"
  };
}
