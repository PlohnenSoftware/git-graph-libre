/**
 * The rebase-in-progress banner (F2-03): where the current repository's
 * rebase stopped, what to do about it, and the Continue, Skip and Abort
 * controls. It renders one `operationState` answer for the repository the
 * graph shows — whatever started the rebase — and nothing at all when no
 * rebase is in progress.
 *
 * Every value from outside the extension (the stopped commit's subject, the
 * conflicted paths) is set through `textContent`; only the static octicon
 * markup goes through `innerHTML`. Continue is disabled while unmerged
 * paths remain (IQ9): resolving and staging happens in the Source Control
 * view, and nothing here stages files silently.
 */

import type {
  GitAutostashConflict,
  GitOperationStateResult,
  GitRebaseState
} from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import { octicon } from "@/octicons";

export type RebaseBannerCallbacks = {
  onContinue: () => void;
  onSkip: () => void;
  onAbort: () => void;
  /** Open one conflicted file; VS Code offers its merge editor for it. */
  onOpenFile: (filePath: string) => void;
};

export type RebaseBannerOptions = {
  /** The graph's own hash length (`shortHashLength`); the banner shares it. */
  shortHashLength: number;
  /** A control is running: every button stays disabled until it answers. */
  busy?: boolean;
};

/**
 * Renders `state` into `container`, replacing what was there. Anything that
 * is not an in-progress rebase — no answer yet, a failed read, a merge or
 * cherry-pick in progress, no operation at all — leaves the container
 * empty, which the slot's CSS collapses completely.
 */
export function renderRebaseBanner(
  container: HTMLElement,
  state: GitOperationStateResult | null,
  options: RebaseBannerOptions,
  callbacks: RebaseBannerCallbacks
): void {
  if (state === null || state.error !== null) {
    container.replaceChildren();
    return;
  }
  if (
    state.kind === null &&
    state.autostashConflict !== undefined &&
    state.conflictFiles.length > 0
  ) {
    renderAutostashConflictBanner(
      container,
      state.autostashConflict,
      state.conflictFiles,
      callbacks.onOpenFile
    );
    return;
  }
  if (state.kind !== "rebase" || state.rebase === null) {
    container.replaceChildren();
    return;
  }
  const busy = options.busy === true;
  const banner = document.createElement("section");
  banner.className = "rebaseBanner";
  banner.dataset.reason = state.rebase.stopReason;
  banner.setAttribute("aria-label", l10n.rebaseInProgress);

  const main = document.createElement("div");
  main.className = "rebaseBannerMain";
  const icon = document.createElement("span");
  icon.className = "rebaseBannerIcon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = octicon("alert");
  const text = document.createElement("span");
  text.className = "rebaseBannerText";
  text.textContent = bannerTitle(state.rebase, options.shortHashLength);
  const hint = document.createElement("span");
  hint.className = "rebaseBannerHint";
  hint.textContent = bannerHint(state.rebase);
  main.append(icon, text, hint);
  banner.appendChild(main);

  if (state.conflictFiles.length > 0) {
    banner.appendChild(renderConflictFiles(state.conflictFiles, callbacks.onOpenFile));
  }
  banner.appendChild(renderActions(state, busy, callbacks));
  container.replaceChildren(banner);
}

function renderAutostashConflictBanner(
  container: HTMLElement,
  autostash: GitAutostashConflict,
  conflictFiles: string[],
  onOpenFile: (filePath: string) => void
): void {
  const banner = document.createElement("section");
  banner.className = "rebaseBanner";
  banner.dataset.reason = "autostash-conflict";
  banner.setAttribute("aria-label", l10n.rebaseAutostashConflictTitle);

  const main = document.createElement("div");
  main.className = "rebaseBannerMain";
  const icon = document.createElement("span");
  icon.className = "rebaseBannerIcon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = octicon("alert");
  const text = document.createElement("span");
  text.className = "rebaseBannerText";
  text.textContent = l10n.rebaseAutostashConflictTitle;
  const hint = document.createElement("span");
  hint.className = "rebaseBannerHint";
  hint.textContent = l10n.rebaseAutostashConflictHint.replace("{0}", () => autostash.stashSelector);
  main.append(icon, text, hint);
  banner.append(main, renderConflictFiles(conflictFiles, onOpenFile));
  container.replaceChildren(banner);
}

function bannerTitle(rebase: GitRebaseState, shortHashLength: number): string {
  let title: string;
  if (rebase.stoppedHash !== null && rebase.subject !== null) {
    const shortHash = abbrevCommit(rebase.stoppedHash, shortHashLength);
    // Replacer functions: a subject holding `$&` or a backtick must reach
    // the banner verbatim, never as a replacement pattern.
    title = l10n.rebaseStoppedAt
      .replace("{0}", () => shortHash)
      .replace("{1}", () => rebase.subject as string);
  } else {
    title = l10n.rebaseInProgress;
  }
  if (rebase.current !== null && rebase.total !== null) {
    const current = String(rebase.current);
    const total = String(rebase.total);
    title += ` ${l10n.rebaseProgress.replace("{0}", () => current).replace("{1}", () => total)}`;
  }
  return title;
}

function bannerHint(rebase: GitRebaseState): string {
  switch (rebase.stopReason) {
    case "edit":
      return l10n.rebaseEditHint;
    case "conflict":
      return l10n.rebaseConflictHint;
    case "other":
      return l10n.rebaseStoppedHint;
  }
}

function renderConflictFiles(files: string[], onOpenFile: (filePath: string) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "rebaseConflictFiles";
  const label = document.createElement("span");
  label.className = "rebaseConflictLabel";
  label.textContent = l10n.rebaseConflictFiles;
  wrap.appendChild(label);
  for (const filePath of files) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rebaseConflictFile";
    button.textContent = filePath;
    button.title = l10n.openFile;
    button.addEventListener("click", () => onOpenFile(filePath));
    wrap.appendChild(button);
  }
  return wrap;
}

function renderActions(
  state: GitOperationStateResult,
  busy: boolean,
  callbacks: RebaseBannerCallbacks
): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "rebaseBannerActions";
  const blockedByConflicts = state.conflictFiles.length > 0;

  const continueBtn = bannerButton(
    l10n.rebaseContinue,
    "rebaseBannerBtnPrimary",
    callbacks.onContinue
  );
  continueBtn.dataset.action = "continue";
  continueBtn.disabled = busy || blockedByConflicts;
  if (blockedByConflicts) continueBtn.title = l10n.rebaseConflictHint;

  const skipBtn = bannerButton(l10n.rebaseSkip, "", callbacks.onSkip);
  skipBtn.dataset.action = "skip";
  skipBtn.disabled = busy;

  const abortBtn = bannerButton(l10n.rebaseAbort, "", callbacks.onAbort);
  abortBtn.dataset.action = "abort";
  abortBtn.disabled = busy;

  actions.append(continueBtn, skipBtn, abortBtn);
  return actions;
}

function bannerButton(label: string, extraClass: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = extraClass === "" ? "rebaseBannerBtn" : `rebaseBannerBtn ${extraClass}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
