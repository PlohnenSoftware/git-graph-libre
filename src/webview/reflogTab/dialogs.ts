import { abbrevCommit } from "@/backend/utils/string";
import type {
  ReflogActionResultMessage,
  ReflogLabels,
  ReflogRecoveryAction,
  ReflogResetMode,
  ReflogRow
} from "@/reflogTabTypes";
import { refInvalid } from "@/webview/utils/git";
import { escapeHtml } from "@/webview/utils/html";
import { svgIcons } from "@/webview/utils/icons";

import type { ReflogViewState } from "./rowModel";

export type ReflogDialogCallbacks = {
  onAction?: (action: ReflogRecoveryAction) => void;
  onCopyHash?: (hash: string) => void;
  onShowInGraph?: (hash: string, enableIncludeReflog: boolean) => void;
};

type MenuActionId =
  | "createBranch"
  | "createTag"
  | "checkoutDetached"
  | "copyHash"
  | "showInGraph"
  | "resetBranch";

type MenuSpec = {
  id: MenuActionId;
  title: string;
  run: () => void;
};

function dialogTitleHtml(inner: string): string {
  return `<div class="dialogTitle">${inner}</div>`;
}

function boldCode(text: string): string {
  return `<b><i>${escapeHtml(text)}</i></b>`;
}

function errorTitleFor(
  action: ReflogActionResultMessage["action"],
  labels: ReflogLabels | null
): string {
  switch (action) {
    case "createBranch":
      return labels?.errorUnableToCreateBranch ?? "Unable to Create Branch";
    case "addTag":
      return labels?.errorUnableToAddTag ?? "Unable to Add Tag";
    case "checkoutCommit":
      return labels?.errorUnableToCheckoutCommit ?? "Unable to Checkout Commit";
    case "resetToCommit":
      return labels?.errorUnableToReset ?? "Unable to Reset to Commit";
    case "copyHash":
      return (labels?.errorUnableToCopyToClipboard ?? "Unable to Copy {0} to Clipboard").replace(
        "{0}",
        () => labels?.typeCommitHash ?? "Commit Hash"
      );
  }
}

function renderMissingMenuHeader(labels: ReflogLabels): string {
  const note = labels.menuMissingNote ?? "";
  const caption =
    note === "" ? "" : `<span class="contextMenuHeaderCaption">${escapeHtml(note)}</span>`;
  return (
    `<li class="contextMenuHeader" role="presentation">` +
    `<span class="contextMenuHeaderTitle">${escapeHtml(labels.objectMissing)}</span>${caption}</li>`
  );
}

function renderMenuItems(items: MenuSpec[], missing: boolean, missingNote: string): string {
  const disabledAttrs = missing
    ? ` aria-disabled="true" title="${escapeHtml(missingNote)}"`
    : ' aria-disabled="false"';
  const disabledClass = missing ? " disabled" : "";
  return items
    .map(
      (item, index) =>
        `<li class="contextMenuItem${disabledClass}" role="menuitem" data-index="${index}" data-action="${item.id}"${disabledAttrs}>${escapeHtml(item.title)}</li>`
    )
    .join("");
}

function positionContextMenu(menu: HTMLElement, clientX: number, clientY: number): void {
  menu.style.maxHeight = `${window.innerHeight}px`;
  const bounds = menu.getBoundingClientRect();
  const left =
    clientX + bounds.width < window.innerWidth ? clientX - 2 : clientX - bounds.width + 2;
  const preferredTop =
    clientY - 2 + bounds.height < window.innerHeight ? clientY - 2 : clientY - bounds.height + 2;
  menu.style.left = `${Math.max(0, left)}px`;
  menu.style.top = `${Math.max(0, preferredTop)}px`;
}

/**
 * Owns the Reflog tab's context menu and modal dialogs (`#contextMenu`,
 * `#dialogBacking`, `#dialog`), reusing the graph's existing dialog markup
 * and `media/dialogs.css` rules (F1-06).
 */
export function createReflogDialogs(root: HTMLElement, callbacks: ReflogDialogCallbacks) {
  const doc = root.ownerDocument;
  const contextMenu = doc.createElement("ul");
  contextMenu.id = "contextMenu";
  contextMenu.setAttribute("role", "menu");

  const dialogBacking = doc.createElement("div");
  dialogBacking.id = "dialogBacking";

  const dialog = doc.createElement("div");
  dialog.id = "dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  let menuSource: HTMLElement | null = null;
  let dialogSource: HTMLElement | null = null;

  const hideContextMenu = (): void => {
    contextMenu.className = "";
    contextMenu.innerHTML = "";
    contextMenu.style.left = "0px";
    contextMenu.style.top = "0px";
    contextMenu.style.maxHeight = "";
    if (menuSource !== null) {
      menuSource.classList.remove("contextMenuActive");
      menuSource = null;
    }
  };

  const hideDialog = (): void => {
    dialogBacking.className = "";
    dialog.className = "";
    dialog.innerHTML = "";
    if (dialogSource !== null) {
      dialogSource.classList.remove("dialogActive");
      dialogSource = null;
    }
  };

  const showDialog = (
    html: string,
    actionName: string | null,
    dismissName: string,
    onAction: (() => void) | null,
    sourceElem: HTMLElement | null
  ): void => {
    if (dialogSource !== null) dialogSource.classList.remove("dialogActive");
    dialogBacking.className = "active";
    dialog.className = "active";
    const dismissClass = actionName === null ? "dialogBtn dialogBtnPrimary" : "dialogBtn";
    const actionButton =
      actionName === null
        ? ""
        : `<div id="dialogAction" class="dialogBtn dialogBtnPrimary">${escapeHtml(actionName)}</div>`;
    dialog.innerHTML =
      `<div class="dialogContent">${html}</div>` +
      `<div class="dialogActions">${actionButton}` +
      `<div id="dialogDismiss" class="${dismissClass}">${escapeHtml(dismissName)}</div></div>`;
    if (actionName !== null && onAction !== null) {
      dialog.querySelector<HTMLElement>("#dialogAction")?.addEventListener("click", onAction);
    }
    dialog.querySelector<HTMLElement>("#dialogDismiss")?.addEventListener("click", hideDialog);
    dialogSource = sourceElem;
    if (dialogSource !== null) dialogSource.classList.add("dialogActive");
  };

  const bindRefInputValidation = (
    input: HTMLInputElement,
    actionName: string,
    labels: ReflogLabels
  ) => {
    const actionBtn = dialog.querySelector<HTMLElement>("#dialogAction");
    const refresh = () => {
      const value = input.value;
      if (value === "") {
        dialog.className = "active noInput";
        if (actionBtn !== null) actionBtn.title = "";
        return;
      }
      if (refInvalid.test(value)) {
        dialog.className = "active inputInvalid";
        if (actionBtn !== null) {
          actionBtn.title = (
            labels.errorInvalidCharacters ??
            "Unable to {0}, one or more invalid characters entered."
          ).replace("{0}", () => actionName);
        }
        return;
      }
      dialog.className = "active";
      if (actionBtn !== null) actionBtn.title = "";
    };
    refresh();
    input.focus();
    input.addEventListener("input", refresh);
    input.addEventListener("keyup", refresh);
  };

  const isDialogInputBlocked = (): boolean =>
    dialog.className === "active noInput" || dialog.className === "active inputInvalid";

  const openCreateBranchDialog = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    const shortHash = abbrevCommit(row.hash, state.display.shortHashLength);
    const title = (labels.dialogCreateBranchTitle ?? "Enter the name of the branch {0}").replace(
      "{0}",
      () => boldCode(shortHash)
    );
    const submitLabel = labels.dialogCreateBranchSubmit ?? "Create Branch";
    const html =
      dialogTitleHtml(title) +
      `<table class="dialogForm single"><tr id="dialogInputRow0"><td><input id="dialogInput0" type="text" value=""/></td></tr></table>`;
    showDialog(
      html,
      submitLabel,
      labels.dialogCancel ?? "Cancel",
      () => {
        if (isDialogInputBlocked()) return;
        const branchNameInput = dialog.querySelector<HTMLInputElement>("#dialogInput0");
        const branchName = branchNameInput?.value.trim() ?? "";
        if (branchName === "") return;
        hideDialog();
        callbacks.onAction?.({
          kind: "createBranch",
          commitHash: row.hash,
          branchName,
          worktreePath: state.query.worktreePath
        });
      },
      sourceElem
    );
    const input = dialog.querySelector<HTMLInputElement>("#dialogInput0");
    if (input !== null) bindRefInputValidation(input, submitLabel, labels);
  };

  const openCreateTagDialog = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    const shortHash = abbrevCommit(row.hash, state.display.shortHashLength);
    const title = (labels.dialogAddTagTitle ?? "Add tag to commit {0}").replace("{0}", () =>
      boldCode(shortHash)
    );
    const submitLabel = labels.dialogAddTagSubmit ?? "Add Tag";
    const messageLabel = `${labels.dialogAddTagMessage ?? "Message"} (${labels.dialogAddTagOptional ?? "Optional"})`;
    const html =
      dialogTitleHtml(title) +
      `<table class="dialogForm multi">` +
      `<tr id="dialogInputRow0"><td>${escapeHtml(labels.dialogAddTagName ?? "Name")}</td><td><input id="dialogInput0" type="text" value=""/></td></tr>` +
      `<tr id="dialogInputRow1"><td>${escapeHtml(labels.dialogAddTagType ?? "Type")}</td><td><select id="dialogInput1">` +
      `<option value="annotated" selected>${escapeHtml(labels.dialogAddTagTypeAnnotated ?? "Annotated")}</option>` +
      `<option value="lightweight">${escapeHtml(labels.dialogAddTagTypeLightweight ?? "Lightweight (unsigned)")}</option>` +
      `</select></td></tr>` +
      `<tr id="dialogInputRow2"><td>${escapeHtml(messageLabel)}</td><td><input id="dialogInput2" type="text" value=""/></td></tr>` +
      `<tr id="dialogInputRow3" hidden><td colspan="2" class="dialogFormNoteCell"><span class="dialogFormNote">${escapeHtml(labels.dialogAddTagLightweightNote ?? "")}</span></td></tr>` +
      `</table>`;
    showDialog(
      html,
      submitLabel,
      labels.dialogCancel ?? "Cancel",
      () => {
        if (isDialogInputBlocked()) return;
        const tagNameInput = dialog.querySelector<HTMLInputElement>("#dialogInput0");
        const tagTypeSelect = dialog.querySelector<HTMLSelectElement>("#dialogInput1");
        const msgInput = dialog.querySelector<HTMLInputElement>("#dialogInput2");
        const tagName = tagNameInput?.value.trim() ?? "";
        if (tagName === "") return;
        const lightweight = tagTypeSelect?.value === "lightweight";
        const message = msgInput?.value ?? "";
        hideDialog();
        callbacks.onAction?.({
          kind: "addTag",
          commitHash: row.hash,
          tagName,
          lightweight,
          ...(lightweight ? {} : { message }),
          worktreePath: state.query.worktreePath
        });
      },
      sourceElem
    );
    const nameInput = dialog.querySelector<HTMLInputElement>("#dialogInput0");
    if (nameInput !== null) bindRefInputValidation(nameInput, submitLabel, labels);
    const typeSelect = dialog.querySelector<HTMLSelectElement>("#dialogInput1");
    const msgRow = dialog.querySelector<HTMLElement>("#dialogInputRow2");
    const noteRow = dialog.querySelector<HTMLElement>("#dialogInputRow3");
    typeSelect?.addEventListener("change", () => {
      const isLightweight = typeSelect.value === "lightweight";
      if (msgRow !== null) msgRow.hidden = isLightweight;
      if (noteRow !== null) noteRow.hidden = !isLightweight;
    });
  };

  const openCheckoutDetachedDialog = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    const shortHash = abbrevCommit(row.hash, state.display.shortHashLength);
    const title = (
      labels.dialogCheckoutConfirm ??
      "Are you sure you want to checkout commit {0}? This will result in a 'detached HEAD' state."
    ).replace("{0}", () => boldCode(shortHash));
    showDialog(
      dialogTitleHtml(title),
      labels.dialogYes ?? "Yes",
      labels.dialogCancel ?? "Cancel",
      () => {
        hideDialog();
        callbacks.onAction?.({
          kind: "checkoutCommit",
          commitHash: row.hash,
          worktreePath: state.query.worktreePath
        });
      },
      sourceElem
    );
  };

  const openShowInGraphDialog = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    if (row.state !== "reflogOnly" || state.display.includeReflog === true) {
      callbacks.onShowInGraph?.(row.hash, false);
      return;
    }
    const shortHash = abbrevCommit(row.hash, state.display.shortHashLength);
    const title = (
      labels.dialogShowInGraphConfirm ??
      "Commit {0} is only in the reflog, so it is not shown in the graph."
    ).replace("{0}", () => boldCode(shortHash));
    const note =
      labels.dialogShowInGraphNote ??
      'Turn on "Include reflog" for this repository to include reflog-only commits in the graph and reveal this commit.';
    const html =
      dialogTitleHtml(title) +
      `<table class="dialogForm single"><tr id="dialogInputRow0"><td colspan="2" class="dialogFormNoteCell"><span class="dialogFormNote">${escapeHtml(note)}</span></td></tr></table>`;
    showDialog(
      html,
      labels.dialogShowInGraphSubmit ?? "Turn On Include Reflog",
      labels.dialogCancel ?? "Cancel",
      () => {
        hideDialog();
        callbacks.onShowInGraph?.(row.hash, true);
      },
      sourceElem
    );
  };

  const openResetHardConfirmDialog = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    const shortHash = abbrevCommit(row.hash, state.display.shortHashLength);
    const title = (
      labels.dialogResetHardConfirm ??
      "Hard reset to commit {0} will permanently discard all uncommitted staged and working-tree changes. Reset anyway?"
    ).replace("{0}", () => boldCode(shortHash));
    showDialog(
      dialogTitleHtml(title),
      labels.dialogYesReset ?? "Yes, reset",
      labels.dialogCancel ?? "Cancel",
      () => {
        hideDialog();
        callbacks.onAction?.({
          kind: "resetToCommit",
          commitHash: row.hash,
          resetMode: "hard",
          worktreePath: state.query.worktreePath
        });
      },
      sourceElem
    );
  };

  const openResetBranchDialog = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    const shortHash = abbrevCommit(row.hash, state.display.shortHashLength);
    const branch = labels.labelCurrentBranch ?? "the current branch";
    // `git reset` always moves HEAD (the current branch of the target
    // worktree), never whichever branch reflog happens to be selected in
    // the picker, so match the graph's own reset dialog wording.
    const title = (labels.dialogResetConfirm ?? "Are you sure you want to reset {0} to commit {1}?")
      .replace("{0}", () => `<b>${escapeHtml(branch)}</b>`)
      .replace("{1}", () => boldCode(shortHash));
    const html =
      dialogTitleHtml(title) +
      `<table class="dialogForm single"><tr id="dialogInputRow0"><td><select id="dialogInput0">` +
      `<option value="soft">${escapeHtml(labels.dialogResetSoft ?? "Soft - Keep all changes, but reset head")}</option>` +
      `<option value="mixed" selected>${escapeHtml(labels.dialogResetMixed ?? "Mixed - Keep working tree, but reset index")}</option>` +
      `<option value="hard">${escapeHtml(labels.dialogResetHard ?? "Hard - Discard all changes")}</option>` +
      `</select></td></tr></table>`;
    showDialog(
      html,
      labels.dialogYesReset ?? "Yes, reset",
      labels.dialogCancel ?? "Cancel",
      () => {
        const select = dialog.querySelector<HTMLSelectElement>("#dialogInput0");
        const mode: ReflogResetMode =
          select?.value === "soft" || select?.value === "hard" ? select.value : "mixed";
        hideDialog();
        if (mode === "hard") {
          openResetHardConfirmDialog(row, state, labels, sourceElem);
          return;
        }
        callbacks.onAction?.({
          kind: "resetToCommit",
          commitHash: row.hash,
          resetMode: mode,
          worktreePath: state.query.worktreePath
        });
      },
      sourceElem
    );
  };

  const buildMenuSpecs = (
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): MenuSpec[] => [
    {
      id: "createBranch",
      title: labels.menuCreateBranch ?? "Create Branch Here…",
      run: () => openCreateBranchDialog(row, state, labels, sourceElem)
    },
    {
      id: "createTag",
      title: labels.menuCreateTag ?? "Create Tag Here…",
      run: () => openCreateTagDialog(row, state, labels, sourceElem)
    },
    {
      id: "checkoutDetached",
      title: labels.menuCheckoutDetached ?? "Check Out (Detached)",
      run: () => openCheckoutDetachedDialog(row, state, labels, sourceElem)
    },
    {
      id: "copyHash",
      title: labels.menuCopyHash ?? "Copy Hash",
      run: () => callbacks.onCopyHash?.(row.hash)
    },
    {
      id: "showInGraph",
      title: labels.menuShowInGraph ?? "Show in Graph",
      run: () => openShowInGraphDialog(row, state, labels, sourceElem)
    },
    {
      id: "resetBranch",
      title: labels.menuResetBranch ?? "Reset Current Branch to Here…",
      run: () => openResetBranchDialog(row, state, labels, sourceElem)
    }
  ];

  const openRowMenu = (
    event: MouseEvent,
    row: ReflogRow,
    state: ReflogViewState,
    labels: ReflogLabels,
    sourceElem: HTMLElement
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    hideContextMenu();
    const missing = row.state === "missing";
    const missingNote = labels.menuMissingNote ?? labels.objectMissing;
    const specs = buildMenuSpecs(row, state, labels, sourceElem);
    contextMenu.innerHTML =
      (missing ? renderMissingMenuHeader(labels) : "") +
      renderMenuItems(specs, missing, missingNote);
    contextMenu.className = "active";
    positionContextMenu(contextMenu, event.clientX, event.clientY);
    menuSource = sourceElem;
    menuSource.classList.add("contextMenuActive");

    for (const item of contextMenu.querySelectorAll<HTMLElement>(".contextMenuItem")) {
      item.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
        if (missing || item.getAttribute("aria-disabled") === "true") return;
        const index = Number.parseInt(item.dataset.index ?? "-1", 10);
        hideContextMenu();
        specs[index]?.run();
      });
    }
  };

  const showActionResult = (
    result: ReflogActionResultMessage,
    labels: ReflogLabels | null
  ): void => {
    if (result.error === null) {
      hideDialog();
      return;
    }
    const title = errorTitleFor(result.action, labels);
    const reasonHtml = `<span class="errorReason">${escapeHtml(result.error).replaceAll("\n", "<br>")}</span>`;
    showDialog(
      dialogTitleHtml(
        `<span class="dialogErrorIcon">${svgIcons.alert}</span>${escapeHtml(title)}`
      ) + reasonHtml,
      null,
      labels?.dialogDismiss ?? "Dismiss",
      null,
      null
    );
  };

  // Document-level dismissal and keyboard confirmation, scoped to this root.
  root.addEventListener("click", () => {
    if (contextMenu.classList.contains("active")) hideContextMenu();
  });
  dialogBacking.addEventListener("click", hideDialog);
  doc.addEventListener("keydown", (event) => {
    if (!root.isConnected) return;
    if (event.key === "Escape") {
      if (contextMenu.classList.contains("active")) hideContextMenu();
      if (dialog.classList.contains("active")) hideDialog();
      return;
    }
    if (event.key !== "Enter" || !dialog.classList.contains("active")) return;
    if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLButtonElement
    ) {
      return;
    }
    dialog.querySelector<HTMLElement>("#dialogAction")?.click();
  });

  return {
    overlays: [contextMenu, dialogBacking, dialog] as const,
    openRowMenu,
    showActionResult,
    hideContextMenu,
    hideDialog
  };
}
