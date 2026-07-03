import { octicon } from "@/octicons";

import type { LocalizedStrings } from "./webviewL10n";

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildToolbarButton(opts: {
  id: string;
  label: string;
  icon: string;
  hidden?: boolean;
}): string {
  const label = escapeAttribute(opts.label);
  const hidden = opts.hidden === true ? " hidden" : "";
  return `<button id="${opts.id}" class="toolbarIconButton" type="button" title="${label}" aria-label="${label}"${hidden}><span class="toolbarIcon" aria-hidden="true">${opts.icon}</span></button>`;
}

function buildToolbarDropdownGroup(opts: { id: string; label: string; selectId: string }): string {
  const label = escapeAttribute(opts.label);
  return `<span id="${opts.id}" class="toolbarGroup" title="${label}">
      <span class="toolbarLabel unselectable">${label}</span>
      <div id="${opts.selectId}" class="dropdown"></div>
    </span>`;
}

export function buildWebviewToolbar(l10n: LocalizedStrings): string {
  const showRemoteBranches = escapeAttribute(l10n.showRemoteBranches);
  const toolbar = escapeAttribute(l10n.toolbar);
  const findCommits = escapeAttribute(l10n.findCommits);
  const findCommitsPlaceholder = escapeAttribute(l10n.findCommitsPlaceholder);

  return `<header id="controls" class="gitGraphToolbar" role="toolbar" aria-label="${toolbar}">
    ${buildToolbarDropdownGroup({ id: "repoControl", label: l10n.repo, selectId: "repoSelect" })}
    ${buildToolbarDropdownGroup({ id: "branchControl", label: l10n.branches, selectId: "branchSelect" })}
    ${buildToolbarDropdownGroup({ id: "authorControl", label: l10n.authors, selectId: "authorSelect" })}
    ${buildToolbarDropdownGroup({ id: "tagControl", label: l10n.tags, selectId: "tagSelect" })}
    <label id="showRemoteBranchesControl" class="toolbarCheckbox">
      <input type="checkbox" id="showRemoteBranchesCheckbox" value="1" checked>
      <span>${showRemoteBranches}</span>
    </label>
    <span id="findControl" class="toolbarFind" hidden>
      <input id="findInput" class="toolbarFindInput" type="search" aria-label="${findCommits}" placeholder="${findCommitsPlaceholder}" autocomplete="off" spellcheck="false">
      <span id="findMatchCount" class="toolbarFindCount" aria-live="polite"></span>
      ${buildToolbarButton({ id: "findSearchHistoryBtn", label: l10n.searchHistory, icon: octicon("history") })}
      ${buildToolbarButton({ id: "findPreviousBtn", label: l10n.findPrevious, icon: octicon("arrow-up") })}
      ${buildToolbarButton({ id: "findNextBtn", label: l10n.findNext, icon: octicon("arrow-down") })}
      ${buildToolbarButton({ id: "findClearBtn", label: l10n.findClear, icon: octicon("x") })}
    </span>
    <span class="toolbarActions">
      ${buildToolbarButton({ id: "findBtn", label: l10n.findCommits, icon: octicon("search") })}
      ${buildToolbarButton({ id: "blinkHeadBtn", label: l10n.locateHead, icon: octicon("crosshairs") })}
      ${buildToolbarButton({ id: "fetchBtn", label: l10n.fetch, icon: octicon("download"), hidden: true })}
      ${buildToolbarButton({ id: "settingsBtn", label: l10n.repositorySettings, icon: octicon("gear") })}
      ${buildToolbarButton({ id: "refreshBtn", label: l10n.refresh, icon: octicon("sync") })}
    </span>
  </header>`;
}
