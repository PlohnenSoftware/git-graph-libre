import type { GitUncommittedChanges, GitUncommittedFile } from "@/backend/types/git.types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import { octicon } from "@/octicons";

import { escapeHtml } from "./utils/html";

export type UncommittedSection = "staged" | "unstaged";
export type StagingDropAction = "stageFiles" | "unstageFiles";

export type UncommittedDetailsSectionState = {
  stagedOpen: boolean;
  unstagedOpen: boolean;
};

type RenderUncommittedDetailsOptions = {
  changes: GitUncommittedChanges;
  l10n: LocalizedStrings;
  sections: UncommittedDetailsSectionState;
};

/**
 * Decide which staging command a file drop runs. Dropping onto the section
 * the file already sits in is a no-op so a stray drop never runs git.
 */
export function getStagingDropAction(
  source: UncommittedSection,
  target: UncommittedSection
): StagingDropAction | null {
  if (source === target) return null;
  return target === "staged" ? "stageFiles" : "unstageFiles";
}

export function isUncommittedSection(value: string | undefined): value is UncommittedSection {
  return value === "staged" || value === "unstaged";
}

/**
 * Render the uncommitted-changes details row. The two panes reuse the commit
 * details summary/files positions and toggle styling, so the collapse
 * behavior and layout come from the existing rules; only the labels and the
 * file rows (draggable, with a stage/unstage button each) differ.
 */
export function renderUncommittedDetailsRowHtml({
  changes,
  l10n,
  sections
}: RenderUncommittedDetailsOptions): string {
  return [
    '<td></td><td colspan="5">',
    renderUncommittedPane("staged", changes.staged, l10n, sections.stagedOpen),
    renderUncommittedPane("unstaged", changes.unstaged, l10n, sections.unstagedOpen),
    "</td>"
  ].join("");
}

function sectionIds(section: UncommittedSection): { pane: string; body: string; toggle: string } {
  return section === "staged"
    ? {
        pane: "commitDetailsSummary",
        body: "commitDetailsSummaryBody",
        toggle: "uncommittedStagedToggle"
      }
    : {
        pane: "commitDetailsFiles",
        body: "commitDetailsFilesBody",
        toggle: "uncommittedUnstagedToggle"
      };
}

function renderUncommittedPane(
  section: UncommittedSection,
  files: GitUncommittedFile[],
  l10n: LocalizedStrings,
  open: boolean
): string {
  const ids = sectionIds(section);
  const label = section === "staged" ? l10n.detailStaged : l10n.detailUnstaged;
  const expandedLabel =
    section === "staged" ? l10n.detailCollapseStaged : l10n.detailCollapseUnstaged;
  const collapsedLabel = section === "staged" ? l10n.detailExpandStaged : l10n.detailExpandUnstaged;
  const bodyClass = `commitDetailsPaneBody uncommittedPaneBody${open ? "" : " hidden"}`;
  return [
    `<div id="${ids.pane}">`,
    `<button id="${ids.toggle}" class="commitDetailsToggle uncommittedToggle" type="button"`,
    ` data-section="${section}" aria-controls="${ids.body}"`,
    ` aria-expanded="${open}" aria-label="${open ? expandedLabel : collapsedLabel}">`,
    `<span class="commitDetailsToggleGlyph" aria-hidden="true">${open ? "-" : "+"}</span>`,
    `<span class="commitDetailsToggleLabel">${escapeHtml(label)}</span>`,
    "</button>",
    `<div id="${ids.body}" class="${bodyClass}" data-section="${section}">`,
    renderUncommittedFileList(section, files, l10n),
    "</div></div>"
  ].join("");
}

function renderUncommittedFileList(
  section: UncommittedSection,
  files: GitUncommittedFile[],
  l10n: LocalizedStrings
): string {
  if (files.length === 0) {
    const empty = section === "staged" ? l10n.detailNoStagedFiles : l10n.detailNoUnstagedFiles;
    return `<ul class="gitFileList"><li class="uncommittedEmpty">${escapeHtml(empty)}</li></ul>`;
  }
  return `<ul class="gitFileList">${files
    .map((file) => renderUncommittedFileItem(section, file, l10n))
    .join("")}</ul>`;
}

function renderUncommittedFileItem(
  section: UncommittedSection,
  file: GitUncommittedFile,
  l10n: LocalizedStrings
): string {
  const kind = section === "staged" ? file.stagedKind : file.unstagedKind;
  const moveLabel = section === "staged" ? l10n.actionUnstageFile : l10n.actionStageFile;
  const icon = section === "staged" ? octicon("arrow-down") : octicon("arrow-up");
  const encodedPath = encodeURIComponent(file.path);
  const title =
    file.oldPath === null
      ? ""
      : ` title="${escapeHtml(file.oldPath + l10n.tooltipRenamedTo + file.path)}"`;
  return [
    `<li class="gitFile uncommittedFile" draggable="true" data-filepath="${encodedPath}"`,
    ` data-section="${section}"${title}>`,
    '<span class="gitFileMain"><span class="uncommittedStatus" aria-hidden="true">',
    escapeHtml(kind ?? "?"),
    '</span><span class="gitFileName">',
    escapeHtml(file.path),
    "</span></span>",
    '<span class="gitFileActions">',
    `<button class="gitFileAction uncommittedMoveFile" type="button" data-filepath="${encodedPath}"`,
    ` data-section="${section}" title="${escapeHtml(moveLabel)}" aria-label="${escapeHtml(moveLabel)}">`,
    icon,
    "</button></span></li>"
  ].join("");
}
