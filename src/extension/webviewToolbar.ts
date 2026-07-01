import type { LocalizedStrings } from "./webviewL10n";

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildToolbarButton(opts: { id: string; label: string; icon: string }): string {
  const label = escapeAttribute(opts.label);
  return `<button id="${opts.id}" class="toolbarIconButton" type="button" title="${label}" aria-label="${label}"><span class="toolbarIcon" aria-hidden="true">${opts.icon}</span></button>`;
}

export function buildWebviewToolbar(l10n: LocalizedStrings): string {
  const repo = escapeAttribute(l10n.repo);
  const branch = escapeAttribute(l10n.branch);
  const showRemoteBranches = escapeAttribute(l10n.showRemoteBranches);
  const toolbar = escapeAttribute(l10n.toolbar);

  return `<header id="controls" class="gitGraphToolbar" role="toolbar" aria-label="${toolbar}">
    <span id="repoControl" class="toolbarGroup toolbarRepoGroup">
      <span class="toolbarLabel unselectable">${repo}</span>
      <div id="repoSelect" class="dropdown"></div>
    </span>
    <span id="branchControl" class="toolbarGroup toolbarBranchGroup">
      <span class="toolbarLabel unselectable">${branch}</span>
      <div id="branchSelect" class="dropdown"></div>
    </span>
    <label id="showRemoteBranchesControl" class="toolbarCheckbox">
      <input type="checkbox" id="showRemoteBranchesCheckbox" value="1" checked>
      <span>${showRemoteBranches}</span>
    </label>
    <span class="toolbarActions">
      ${buildToolbarButton({ id: "blinkHeadBtn", label: l10n.locateHead, icon: "&#8982;" })}
      ${buildToolbarButton({ id: "refreshBtn", label: l10n.refresh, icon: "&#8635;" })}
    </span>
  </header>`;
}
