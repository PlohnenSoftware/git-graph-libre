import type { GitBlameCommit } from "@/backend/types";
import type {
  BlameCommitPopoverMessage,
  BlameDisplay,
  BlameHunkView,
  BlameLabels,
  BlameOpenCommitFileDiffMessage
} from "@/blameTabTypes";
import { octicon } from "@/octicons";
import { linkifyText } from "../utils/linkify";
import { commitDate } from "./rowModel";

/** The diff one hunk's commit made to the blamed file, as the host opens it. */
export type BlamePopoverDiffRequest = Omit<BlameOpenCommitFileDiffMessage, "command">;

/** A parent-blame rewind target, the shape F4-05's rewind already takes. */
export type BlamePopoverRewindTarget = {
  rev: string;
  filePath: string;
  targetLine: number | null;
};

/** Everything the popover and the hunk context menu can ask the tab to do. */
export type BlamePopoverActions = {
  /** Fetch the commit's full details; the reply comes back by `requestId`. */
  onLoadDetails: (commitHash: string, requestId: number) => void;
  onShowInGraph: (commitHash: string) => void;
  onOpenDiff: (request: BlamePopoverDiffRequest) => void;
  onRewind: (target: BlamePopoverRewindTarget) => void;
  onIgnoreCommit: (commitHash: string) => void;
  onCopyText: (kind: "hash" | "message", commitHash: string) => void;
  onOpenFileAtLine: (line: number) => void;
  onBlameHead: () => void;
};

/** What one hunk hands the popover: its commit, the text to draw, and the line in focus. */
export type BlamePopoverContext = {
  commit: GitBlameCommit | undefined;
  hunk: BlameHunkView;
  labels: BlameLabels;
  display: BlameDisplay;
  locale: string;
  now: Date;
  /** The 1-based line Open File at Line lands on. */
  line: number;
  /** True when the commit already sits in the session `--ignore-rev` list. */
  ignored: boolean;
};

type PopoverAction = {
  id: string;
  label: string;
  run: () => void;
};

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isUncommitted(context: BlamePopoverContext): boolean {
  return context.commit?.uncommitted === true || context.hunk.heat.uncommitted;
}

/** The actions of one hunk, shared by the popover's buttons and its context menu. */
function actionsFor(context: BlamePopoverContext, actions: BlamePopoverActions): PopoverAction[] {
  const { commit, hunk, labels } = context;
  const list: PopoverAction[] = [
    {
      id: "openFileAtLine",
      label: labels.openFileAtLine,
      run: () => actions.onOpenFileAtLine(context.line)
    }
  ];
  if (isUncommitted(context)) {
    if (hunk.previous !== null) {
      list.push({
        id: "viewBlameAtHead",
        label: labels.viewBlameAtHead,
        run: () => actions.onBlameHead()
      });
    }
    return list;
  }
  const hash = hunk.commitHash;
  list.unshift(
    {
      id: "showCommitInGraph",
      label: labels.showCommitInGraph,
      run: () => actions.onShowInGraph(hash)
    },
    {
      id: "openDiff",
      label: labels.openInGglDiff,
      run: () =>
        actions.onOpenDiff({
          commitHash: hash,
          filePath: hunk.filename,
          previousHash: hunk.previous?.hash ?? null,
          previousPath: hunk.previous?.path ?? null
        })
    }
  );
  if (commit?.boundary !== true && hunk.previous !== null) {
    const previous = hunk.previous;
    list.push({
      id: "rewind",
      label: labels.rewind,
      run: () =>
        actions.onRewind({
          rev: previous.hash,
          filePath: previous.path,
          targetLine: hunk.origStartLine
        })
    });
  }
  if (!context.ignored) {
    list.push({
      id: "ignoreCommit",
      label: labels.ignoreCommitSession,
      run: () => actions.onIgnoreCommit(hash)
    });
  }
  list.push(
    {
      id: "copyHash",
      label: labels.copyCommitHash,
      run: () => actions.onCopyText("hash", hash)
    },
    {
      id: "copyMessage",
      label: labels.copyCommitMessage,
      run: () => actions.onCopyText("message", hash)
    }
  );
  return list;
}

/** `Name <mail>` with the mail a link, the graph's commit-details shape. */
function identityElement(doc: Document, name: string, mail: string): HTMLElement {
  const span = element(doc, "span", "blame-popover-identity");
  span.append(doc.createTextNode(mail === "" ? name : `${name} <`));
  if (mail !== "") {
    const link = element(doc, "a", "blame-popover-mail", mail);
    link.href = `mailto:${mail}`;
    span.append(link, doc.createTextNode(">"));
  }
  return span;
}

/** One meta row: the graph's own label word, then its value. */
function metaRow(doc: Document, label: string, value: Node): HTMLElement {
  const row = element(doc, "div", "blame-popover-meta-row");
  row.append(element(doc, "span", "blame-popover-meta-label", label), value);
  return row;
}

/** The formatted date, with the full local date beside it when they differ. */
function dateElement(
  doc: Document,
  commit: GitBlameCommit,
  time: number,
  context: BlamePopoverContext
): HTMLElement {
  const shown = commitDate(
    { ...commit, authorTime: time },
    context.display,
    context.now,
    context.locale
  );
  const span = element(doc, "span", "blame-popover-date", shown.value);
  span.title = shown.title;
  if (shown.value !== shown.title) {
    span.append(element(doc, "span", "blame-popover-date-full", ` (${shown.title})`));
  }
  return span;
}

/**
 * Author and committer rows with the graph's collapse rule
 * (`commitDetailsView.ts`): identical identity and date share one Date
 * row; anything else names each side's own date.
 */
function identityRows(doc: Document, context: BlamePopoverContext): HTMLElement[] {
  const commit = context.commit;
  if (commit === undefined) return [];
  const { labels } = context;
  const author = metaRow(
    doc,
    labels.detailAuthor,
    identityElement(doc, commit.author, commit.authorMail)
  );
  const committer = metaRow(
    doc,
    labels.detailCommitter,
    identityElement(doc, commit.committer, commit.committerMail)
  );
  const sameIdentity =
    commit.author === commit.committer && commit.authorMail === commit.committerMail;
  if (sameIdentity && commit.authorTime === commit.committerTime) {
    return [
      author,
      committer,
      metaRow(doc, labels.detailDate, dateElement(doc, commit, commit.authorTime, context))
    ];
  }
  return [
    author,
    metaRow(doc, labels.detailAuthorDate, dateElement(doc, commit, commit.authorTime, context)),
    committer,
    metaRow(
      doc,
      labels.detailCommitterDate,
      dateElement(doc, commit, commit.committerTime, context)
    )
  ];
}

/** The message under its subject line, leading blank lines dropped. */
function messageBody(message: string): string {
  const lines = message.split("\n").slice(1);
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  return lines.join("\n");
}

/** Keeps a fixed-position box inside the viewport, below its anchor or above it. */
function placeBelow(box: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const width = box.offsetWidth;
  const height = box.offsetHeight;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

/** Keeps a fixed-position menu inside the viewport around the pointer. */
function placeAtPointer(menu: HTMLElement, clientX: number, clientY: number): void {
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = clientX + width < window.innerWidth ? clientX - 2 : clientX - width + 2;
  const top = clientY - 2 + height < window.innerHeight ? clientY - 2 : clientY - height + 2;
  menu.style.left = `${Math.max(0, left)}px`;
  menu.style.top = `${Math.max(0, top)}px`;
}

/**
 * The Blame tab's commit popover and hunk context menu (F4-06). Both
 * live on `body` with fixed positioning, so a re-render of the hunks
 * never destroys them; the view closes them when the blamed target
 * changes. One action list feeds both, and both dismiss on Escape or
 * an outside click, returning focus to where they were opened from.
 */
export function createBlamePopover(doc: Document, actions: BlamePopoverActions) {
  const popover = element(doc, "div", "blame-popover");
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "false");
  popover.tabIndex = -1;
  popover.hidden = true;

  const menu = element(doc, "ul", "blame-context-menu");
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  doc.body.append(popover, menu);

  let anchor: HTMLElement | null = null;
  let openHash: string | null = null;
  let requestId = 0;
  // The labels of the open popover, for its own error word.
  let openLabels: BlameLabels | null = null;

  const restoreFocus = (): void => {
    if (anchor?.isConnected) anchor.focus();
    anchor = null;
  };

  const closeMenu = (focusBack = true): void => {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.replaceChildren();
    if (focusBack) restoreFocus();
  };

  const close = (focusBack = true): void => {
    if (!popover.hidden) {
      popover.hidden = true;
      popover.replaceChildren();
      openHash = null;
      if (focusBack) restoreFocus();
    } else {
      closeMenu(focusBack);
    }
  };

  const runAndClose = (action: PopoverAction): void => {
    close(false);
    closeMenu(false);
    anchor = null;
    action.run();
  };

  const actionButtons = (context: BlamePopoverContext): HTMLElement => {
    const group = element(doc, "div", "blame-popover-actions");
    for (const action of actionsFor(context, actions)) {
      const button = element(doc, "button", "blame-popover-action", action.label);
      button.type = "button";
      button.dataset.action = action.id;
      button.addEventListener("click", () => runAndClose(action));
      group.append(button);
    }
    return group;
  };

  const closeButton = (labels: BlameLabels): HTMLButtonElement => {
    const button = element(doc, "button", "blame-popover-close");
    button.type = "button";
    button.title = labels.popoverClose;
    button.setAttribute("aria-label", labels.popoverClose);
    button.innerHTML = octicon("x");
    button.addEventListener("click", () => close());
    return button;
  };

  const show = (nextAnchor: HTMLElement, build: () => void): void => {
    closeMenu(false);
    anchor = nextAnchor;
    build();
    popover.hidden = false;
    placeBelow(popover, nextAnchor);
    popover.focus();
  };

  const openUncommitted = (nextAnchor: HTMLElement, context: BlamePopoverContext): void => {
    if (!popover.hidden && anchor === nextAnchor) {
      close();
      return;
    }
    openHash = null;
    show(nextAnchor, () => {
      const header = element(doc, "div", "blame-popover-header");
      header.append(
        element(doc, "div", "blame-popover-subject", context.labels.uncommitted),
        closeButton(context.labels)
      );
      popover.setAttribute("aria-label", context.labels.uncommitted);
      popover.replaceChildren(
        header,
        element(doc, "p", "blame-popover-explanation", context.labels.uncommittedExplanation),
        actionButtons(context)
      );
    });
  };

  const openCommitted = (nextAnchor: HTMLElement, context: BlamePopoverContext): void => {
    if (!popover.hidden && anchor === nextAnchor) {
      close();
      return;
    }
    const { commit, hunk, labels } = context;
    openHash = hunk.commitHash;
    requestId += 1;
    const ownRequest = requestId;
    show(nextAnchor, () => {
      const subject = commit?.summary ?? hunk.commitHash;
      const header = element(doc, "div", "blame-popover-header");
      const avatar = element(doc, "img", "blame-popover-avatar");
      avatar.alt = "";
      avatar.hidden = true;
      const subjectEl = element(doc, "div", "blame-popover-subject", subject);
      subjectEl.title = subject;
      header.append(avatar, subjectEl, closeButton(labels));
      popover.setAttribute("aria-label", subject);

      const meta = element(doc, "div", "blame-popover-meta");
      const hashEl = element(doc, "code", "blame-popover-hash", hunk.commitHash);
      meta.append(metaRow(doc, labels.detailCommit, hashEl), ...identityRows(doc, context));

      const body = element(doc, "div", "blame-popover-body", labels.loading);
      body.setAttribute("aria-live", "polite");
      popover.replaceChildren(header, meta, body, actionButtons(context));
    });
    actions.onLoadDetails(hunk.commitHash, ownRequest);
  };

  const open = (nextAnchor: HTMLElement, context: BlamePopoverContext): void => {
    if (isUncommitted(context)) openUncommitted(nextAnchor, context);
    else openCommitted(nextAnchor, context);
  };

  const openContextMenu = (
    clientX: number,
    clientY: number,
    band: HTMLElement,
    context: BlamePopoverContext
  ): void => {
    close(false);
    anchor = band;
    const items = actionsFor(context, actions).map((action) => {
      const item = element(doc, "li", "blame-context-menu-item");
      const button = element(doc, "button", "blame-context-menu-button", action.label);
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.dataset.action = action.id;
      button.addEventListener("click", () => runAndClose(action));
      item.append(button);
      return item;
    });
    menu.replaceChildren(...items);
    menu.hidden = false;
    placeAtPointer(menu, clientX, clientY);
    menu.querySelector<HTMLButtonElement>(".blame-context-menu-button")?.focus();
  };

  /** A details reply landed: fill the popover it answers, drop any other. */
  const applyDetails = (message: BlameCommitPopoverMessage): void => {
    if (popover.hidden || message.requestId !== requestId || message.commitHash !== openHash) {
      return;
    }
    const body = popover.querySelector<HTMLElement>(".blame-popover-body");
    if (body === null) return;
    if (message.details === null) {
      body.textContent = (openLabels?.popoverLoadError ?? "{0}").replace(
        "{0}",
        message.error ?? ""
      );
      body.classList.add("blame-popover-error");
      body.setAttribute("role", "alert");
      return;
    }
    const subjectEl = popover.querySelector<HTMLElement>(".blame-popover-subject");
    if (subjectEl !== null) {
      subjectEl.innerHTML = linkifyText(message.details.subject, message.issueLinking);
      popover.setAttribute("aria-label", message.details.subject);
    }
    const rest = messageBody(message.details.message);
    if (rest === "") {
      body.remove();
    } else {
      body.innerHTML = linkifyText(rest, message.issueLinking);
    }
    const avatar = popover.querySelector<HTMLImageElement>(".blame-popover-avatar");
    if (avatar !== null && message.avatar !== null) {
      avatar.src = message.avatar;
      avatar.hidden = false;
    }
    if (anchor !== null) placeBelow(popover, anchor);
  };

  const openWithLabels = (nextAnchor: HTMLElement, context: BlamePopoverContext): void => {
    openLabels = context.labels;
    open(nextAnchor, context);
  };

  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!menu.hidden) {
      event.preventDefault();
      closeMenu();
    } else if (!popover.hidden) {
      event.preventDefault();
      close();
    }
  });
  doc.addEventListener("mousedown", (event) => {
    const target = event.target instanceof Node ? event.target : null;
    if (target === null) return;
    if (!menu.hidden && !menu.contains(target) && anchor?.contains(target) !== true) closeMenu();
    if (!popover.hidden && !popover.contains(target) && anchor?.contains(target) !== true) {
      close(false);
    }
  });

  return {
    open: openWithLabels,
    openContextMenu,
    applyDetails,
    close: () => {
      close(false);
      closeMenu(false);
      anchor = null;
    },
    isOpen: (): boolean => !popover.hidden || !menu.hidden
  };
}
