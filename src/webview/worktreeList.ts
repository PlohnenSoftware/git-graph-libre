import type { GitWorktree } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import { octicon } from "@/octicons";
import { worktreeFolderName } from "./utils/git";
import { escapeHtml } from "./utils/html";

/**
 * The Worktrees popup (W30): one place that lists the repository's worktrees
 * and acts on them. It only draws what Git's worktree list says, from the
 * data `loadBranches` carries, and hands every action to the host (`main.ts`),
 * which routes it through the existing flows: open, switch, copy (W31),
 * lock, unlock, move (W23), remove, repair, prune (W21) and create (W22). Nothing here decides from
 * Git's translated text.
 */

/** Every button a row can carry. Lock, Unlock and Move are offered by `lifecycleRowActions`. */
export type WorktreeRowAction =
  | "openNewWindow"
  | "openHere"
  | "switchGraph"
  | "copyPath"
  | "lock"
  | "unlock"
  | "move"
  | "remove"
  | "repair"
  | "removeStale";

/** Every button of the footer. */
export type WorktreeFooterAction = "create" | "prune";

export type WorktreeListLabels = {
  title: string;
  close: string;
  empty: string;
  badgeMain: string;
  badgeCurrent: string;
  badgeBare: string;
  bareNoBranch: string;
  detachedAt: string;
  locked: string;
  lockedNoReason: string;
  missing: string;
  actions: Record<WorktreeRowAction, string>;
  create: string;
  prune: string;
};

export type WorktreeListHandlers = {
  /** A row's button, for the worktree as it was listed when the popup last drew. */
  onRowAction: (action: WorktreeRowAction, worktree: GitWorktree) => void;
  onFooterAction: (action: WorktreeFooterAction) => void;
};

/** A real ellipsis: these labels are escaped as text, so the HTML entity would show as typed. */
const ELLIPSIS = "\u2026";

/** The popup's labels from the localized strings the extension passes to the webview. */
export function buildWorktreeListLabels(strings: LocalizedStrings): WorktreeListLabels {
  return {
    title: strings.worktrees,
    close: strings.worktreesClose,
    empty: strings.worktreesEmpty,
    badgeMain: strings.worktreeBadgeMain,
    badgeCurrent: strings.worktreeBadgeCurrent,
    badgeBare: strings.worktreeBadgeBare,
    bareNoBranch: strings.worktreeBareNoBranch,
    detachedAt: strings.worktreeDetachedAt,
    locked: strings.worktreeLocked,
    lockedNoReason: strings.worktreeLockedNoReason,
    missing: strings.worktreeMissing,
    actions: {
      openNewWindow: strings.worktreeOpenNewWindow,
      openHere: strings.worktreeOpenHere,
      switchGraph: strings.worktreeSwitchGraph,
      copyPath: strings.worktreeCopyPath,
      lock: strings.worktreeLock + ELLIPSIS,
      unlock: strings.worktreeUnlock,
      move: strings.worktreeMove + ELLIPSIS,
      remove: strings.worktreeRemove + ELLIPSIS,
      repair: strings.repairWorktree + ELLIPSIS,
      removeStale: strings.removeStaleWorktree
    },
    create: strings.createWorktree + ELLIPSIS,
    prune: strings.pruneWorktrees + ELLIPSIS
  };
}

/** Row actions after which the popup has nothing more to show and closes itself. */
const CLOSING_ROW_ACTIONS: ReadonlySet<WorktreeRowAction> = new Set([
  "openNewWindow",
  "openHere",
  "switchGraph"
]);

/** Prunable entries Git's `prune` removes: the folder is gone and the entry is not locked. */
export function prunableWorktrees(worktrees: readonly GitWorktree[]): GitWorktree[] {
  return worktrees.filter((worktree) => worktree.prunable !== null && worktree.locked === null);
}

/**
 * The lock buttons a worktree offers, from its listed state alone: Lock when it
 * is not locked, Unlock when it is. Git never locks the main worktree, so it
 * gets none. Move comes with them, for every linked worktree except the one
 * the graph shows (W23 refuses that one). A locked worktree still offers Move:
 * the flow says why and offers Unlock, so nothing is moved by force.
 */
export function lifecycleRowActions(worktree: GitWorktree): WorktreeRowAction[] {
  if (worktree.isMain) return [];
  const actions: WorktreeRowAction[] = [worktree.locked === null ? "lock" : "unlock"];
  if (!worktree.isCurrent) actions.push("move");
  return actions;
}

/**
 * The buttons a worktree's row offers, decided from its listed state alone.
 * A stale entry cannot be opened or switched to (W31 refuses it) and offers
 * Repair or removing the record instead. The main and the current worktree
 * cannot be removed (W21 refuses them), and the current one is already open.
 * A bare main has no files to open as a graph, so it only offers its path.
 * Lock, Unlock and Move follow the path (W23, `lifecycleRowActions`).
 */
export function worktreeRowActions(worktree: GitWorktree): WorktreeRowAction[] {
  if (worktree.prunable !== null) return ["repair", "removeStale", "copyPath"];
  const actions: WorktreeRowAction[] = [];
  if (!worktree.isCurrent) actions.push("openNewWindow", "openHere");
  if (!worktree.isCurrent && !worktree.bare) actions.push("switchGraph");
  actions.push("copyPath", ...lifecycleRowActions(worktree));
  if (!worktree.isCurrent && !worktree.isMain) actions.push("remove");
  return actions;
}

function badge(kind: string, text: string): string {
  return `<span class="worktreeBadge ${kind}">${escapeHtml(text)}</span>`;
}

function stateBadges(worktree: GitWorktree, labels: WorktreeListLabels): string {
  const badges: string[] = [];
  if (worktree.isMain) badges.push(badge("main", labels.badgeMain));
  if (worktree.isCurrent) badges.push(badge("current", labels.badgeCurrent));
  if (worktree.bare) badges.push(badge("bare", labels.badgeBare));
  if (worktree.locked !== null) {
    const reason = worktree.locked.reason;
    const text = reason === "" ? labels.lockedNoReason : labels.locked.replace("{0}", () => reason);
    badges.push(badge("locked", text));
  }
  if (worktree.prunable !== null) badges.push(badge("prunable", labels.missing));
  return badges.join("");
}

function branchLine(worktree: GitWorktree, labels: WorktreeListLabels, hashLength: number) {
  if (worktree.bare) return escapeHtml(labels.bareNoBranch);
  if (worktree.branch !== null) return escapeHtml(worktree.branch);
  const head = (worktree.head ?? "").slice(0, hashLength);
  return escapeHtml(labels.detachedAt.replace("{0}", () => head));
}

function renderRow(
  worktree: GitWorktree,
  index: number,
  labels: WorktreeListLabels,
  hashLength: number
): string {
  const name = escapeHtml(worktreeFolderName(worktree.path));
  const path = escapeHtml(worktree.path);
  const buttons = worktreeRowActions(worktree)
    .map(
      (action) =>
        `<button type="button" class="worktreeAction" data-worktree-action="${action}">${escapeHtml(labels.actions[action])}</button>`
    )
    .join("");
  return (
    `<li class="worktreeRow" data-worktree-index="${index}">` +
    `<div class="worktreeInfo">` +
    `<div class="worktreeTitle"><span class="worktreeName" title="${path}">${octicon("file-directory")}${name}</span>${stateBadges(worktree, labels)}</div>` +
    `<div class="worktreeBranch">${octicon("git-branch")}<span>${branchLine(worktree, labels, hashLength)}</span></div>` +
    `<div class="worktreePath" title="${path}">${path}</div>` +
    `</div>` +
    `<div class="worktreeActions" role="group" aria-label="${name}">${buttons}</div>` +
    `</li>`
  );
}

/** The popup's body and footer for the given worktrees. Pure, so tests render it directly. */
export function renderWorktreeList(
  worktrees: readonly GitWorktree[],
  labels: WorktreeListLabels,
  hashLength: number
): string {
  const rows =
    worktrees.length === 0
      ? `<p class="worktreeEmpty">${escapeHtml(labels.empty)}</p>`
      : `<ul class="worktreeRows">${worktrees.map((worktree, index) => renderRow(worktree, index, labels, hashLength)).join("")}</ul>`;
  const prune =
    prunableWorktrees(worktrees).length > 0
      ? `<button type="button" class="worktreeAction" data-worktree-footer="prune">${escapeHtml(labels.prune)}</button>`
      : "";
  return (
    `<div class="settingsWidgetHead"><div class="settingsWidgetHeader"><h2>${escapeHtml(labels.title)}</h2>` +
    `<button type="button" class="settingsCloseButton" id="worktreeListClose" title="${escapeHtml(labels.close)}" aria-label="${escapeHtml(labels.close)}">${octicon("x")}</button></div></div>` +
    `<div class="worktreeBody">${rows}</div>` +
    `<div class="worktreeFooter"><button type="button" class="worktreeAction" data-worktree-footer="create">${escapeHtml(labels.create)}</button>${prune}</div>`
  );
}

/** The popup itself: a backing, a panel, open and close, and re-drawing from new data. */
export class WorktreePopup {
  private readonly backing: HTMLElement;
  private readonly panel: HTMLElement;
  private worktrees: readonly GitWorktree[] = [];
  private open = false;

  constructor(
    private readonly button: HTMLElement,
    private readonly getLabels: () => WorktreeListLabels,
    private readonly getHashLength: () => number,
    private readonly handlers: WorktreeListHandlers
  ) {
    this.backing = document.createElement("div");
    this.backing.id = "worktreeListBacking";
    this.backing.hidden = true;
    this.panel = document.createElement("aside");
    this.panel.id = "worktreeList";
    this.panel.tabIndex = -1;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.hidden = true;
    document.body.append(this.backing, this.panel);
    this.backing.addEventListener("click", () => this.close());
    this.panel.addEventListener("click", (event) => this.handleClick(event));
    this.button.addEventListener("click", () => this.toggle());
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.open = true;
    this.draw();
    this.panel.focus({ preventScroll: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.draw();
    this.button.focus({ preventScroll: true });
  }

  /** The repository's worktrees changed (or another repository was selected). */
  update(worktrees: readonly GitWorktree[]) {
    this.worktrees = worktrees;
    if (this.open) this.draw();
  }

  private draw() {
    this.button.classList.toggle("active", this.open);
    this.button.setAttribute("aria-pressed", this.open.toString());
    this.backing.hidden = !this.open;
    this.panel.hidden = !this.open;
    if (!this.open) {
      this.panel.innerHTML = "";
      return;
    }
    const labels = this.getLabels();
    this.panel.setAttribute("aria-label", labels.title);
    this.panel.innerHTML = renderWorktreeList(this.worktrees, labels, this.getHashLength());
  }

  private handleClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("#worktreeListClose") !== null) {
      this.close();
      return;
    }
    const footer = target.closest<HTMLElement>("[data-worktree-footer]");
    if (footer !== null) {
      this.handlers.onFooterAction(footer.dataset.worktreeFooter as WorktreeFooterAction);
      return;
    }
    const action = target.closest<HTMLElement>("[data-worktree-action]");
    const row = target.closest<HTMLElement>("[data-worktree-index]");
    if (action === null || row === null) return;
    const worktree = this.worktrees[Number(row.dataset.worktreeIndex)];
    if (worktree === undefined) return;
    const rowAction = action.dataset.worktreeAction as WorktreeRowAction;
    if (CLOSING_ROW_ACTIONS.has(rowAction)) this.close();
    this.handlers.onRowAction(rowAction, worktree);
  }
}
