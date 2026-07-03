export function addListenerToClass(className: string, event: string, eventListener: EventListener) {
  const elems = document.getElementsByClassName(className);
  for (const elem of Array.from(elems)) {
    elem.addEventListener(event, eventListener);
  }
}
export function insertAfter(newNode: HTMLElement, referenceNode: HTMLElement) {
  referenceNode.parentNode?.insertBefore(newNode, referenceNode.nextSibling);
}

let revealHighlightCleanup: (() => void) | null = null;

export function clearRevealHighlight() {
  const cleanup = revealHighlightCleanup;
  if (cleanup !== null) cleanup();
}

/**
 * Table refreshes rebuild rows with innerHTML, which naturally drops this
 * transient class. Pending-focus reveals reapply it after history reloads.
 */
export function startRevealHighlight(row: HTMLElement) {
  clearRevealHighlight();
  row.classList.add("blinking");

  const dismiss = () => clearRevealHighlight();
  const cleanup = () => {
    row.classList.remove("blinking");
    row.removeEventListener("mouseenter", dismiss);
    row.removeEventListener("click", dismiss);
    row.removeEventListener("contextmenu", dismiss);
    if (revealHighlightCleanup === cleanup) revealHighlightCleanup = null;
  };

  revealHighlightCleanup = cleanup;
  row.addEventListener("mouseenter", dismiss);
  row.addEventListener("click", dismiss);
  row.addEventListener("contextmenu", dismiss);
}
