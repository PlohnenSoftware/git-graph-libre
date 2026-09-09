import type { GitUncommittedChanges, GitUncommittedFile } from "@/backend/types/git.types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import { octicon } from "@/octicons";

import { renderCommitDetailsResizeHandle } from "./commitDetailsView";
import { escapeHtml } from "./utils/html";
import type { PathTreeFolder, PathTreeNode } from "./utils/pathTree";
import { buildPathTree, collectLeafPaths } from "./utils/pathTree";

export type UncommittedSection = "staged" | "unstaged";
export type StagingDropAction = "stageFiles" | "unstageFiles";

export type UncommittedDetailsSectionState = {
  stagedOpen: boolean;
  unstagedOpen: boolean;
  /**
   * Folder paths the user has collapsed, per pane. Folders default to open,
   * so only the exceptions are tracked — and they are keyed by path rather
   * than by position so a collapsed folder survives the panel's re-query
   * after every staging action.
   */
  collapsedFolders?: { staged: readonly string[]; unstaged: readonly string[] };
};

type RenderUncommittedDetailsOptions = {
  changes: GitUncommittedChanges;
  l10n: LocalizedStrings;
  sections: UncommittedDetailsSectionState;
  detailsHeight: number;
  /** Collapse single-child folder chains, following the commit-details setting. */
  compactFolders?: boolean;
  /** "tree" groups paths by folder; "list" is the flat path list. */
  fileViewMode?: "tree" | "list";
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
  sections,
  detailsHeight,
  compactFolders,
  fileViewMode
}: RenderUncommittedDetailsOptions): string {
  const collapsed = sections.collapsedFolders ?? { staged: [], unstaged: [] };
  const tree = (section: UncommittedSection) => ({
    collapsed: new Set(collapsed[section]),
    compactFolders: compactFolders === true,
    flat: fileViewMode === "list"
  });
  return [
    '<td></td><td colspan="5">',
    renderUncommittedPane("staged", changes.staged, l10n, sections.stagedOpen, tree("staged")),
    renderUncommittedPane(
      "unstaged",
      changes.unstaged,
      l10n,
      sections.unstagedOpen,
      tree("unstaged")
    ),
    renderCommitDetailsResizeHandle(l10n, detailsHeight),
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

type TreeOptions = { collapsed: Set<string>; compactFolders: boolean; flat: boolean };

function renderUncommittedPane(
  section: UncommittedSection,
  files: GitUncommittedFile[],
  l10n: LocalizedStrings,
  open: boolean,
  tree: TreeOptions
): string {
  const ids = sectionIds(section);
  const label = section === "staged" ? l10n.detailStaged : l10n.detailUnstaged;
  const expandedLabel =
    section === "staged" ? l10n.detailCollapseStaged : l10n.detailCollapseUnstaged;
  const collapsedLabel = section === "staged" ? l10n.detailExpandStaged : l10n.detailExpandUnstaged;
  const bodyClass = `commitDetailsPaneBody uncommittedPaneBody${open ? "" : " hidden"}`;
  return [
    `<div id="${ids.pane}" class="uncommittedPane" data-section="${section}">`,
    `<button id="${ids.toggle}" class="commitDetailsToggle uncommittedToggle" type="button"`,
    ` data-section="${section}" aria-controls="${ids.body}"`,
    ` aria-expanded="${open}" aria-label="${open ? expandedLabel : collapsedLabel}">`,
    `<span class="commitDetailsToggleGlyph" aria-hidden="true">${open ? "-" : "+"}</span>`,
    `<span class="commitDetailsToggleLabel">${escapeHtml(label)}</span>`,
    "</button>",
    `<div id="${ids.body}" class="${bodyClass}" data-section="${section}">`,
    renderUncommittedFileList(section, files, l10n, tree),
    "</div></div>"
  ].join("");
}

function renderUncommittedFileList(
  section: UncommittedSection,
  files: GitUncommittedFile[],
  l10n: LocalizedStrings,
  tree: TreeOptions
): string {
  if (files.length === 0) {
    const empty = section === "staged" ? l10n.detailNoStagedFiles : l10n.detailNoUnstagedFiles;
    return `<ul class="gitFileList"><li class="uncommittedEmpty">${escapeHtml(empty)}</li></ul>`;
  }
  // Flat mode is the pre-tree presentation: one row per change, showing the
  // whole path. Folder grouping is skipped entirely rather than rendered and
  // flattened, so a flat list has no folder rows to drag.
  if (tree.flat) {
    return `<ul class="gitFileList">${files
      .map((file) => renderUncommittedFileItem(section, file, l10n))
      .join("")}</ul>`;
  }
  const root = buildPathTree(
    files.map((file) => ({ path: file.path, value: file })),
    { compactFolders: tree.compactFolders }
  );
  return `<ul class="gitFileList">${root.children
    .map((node) => renderUncommittedNode(section, node, l10n, tree))
    .join("")}</ul>`;
}

function renderUncommittedNode(
  section: UncommittedSection,
  node: PathTreeNode<GitUncommittedFile>,
  l10n: LocalizedStrings,
  tree: TreeOptions
): string {
  return node.type === "folder"
    ? renderUncommittedFolder(section, node, l10n, tree)
    : renderUncommittedFileItem(section, node.value, l10n);
}

/**
 * A folder row. It is draggable in its own right and carries every descendant
 * path on offer in this pane, so dropping it stages or unstages the whole
 * subtree in one git call. The paths are listed rather than the folder's own
 * path because `git add -- <dir>` would also sweep in changes the pane is not
 * showing (a different section's changes to the same folder, for one).
 */
function renderUncommittedFolder(
  section: UncommittedSection,
  folder: PathTreeFolder<GitUncommittedFile>,
  l10n: LocalizedStrings,
  tree: TreeOptions
): string {
  const open = !tree.collapsed.has(folder.path);
  const encodedPaths = collectLeafPaths(folder).map(encodeURIComponent).join(" ");
  const moveLabel = section === "staged" ? l10n.actionUnstageFile : l10n.actionStageFile;
  return [
    `<li class="gitFolder uncommittedFolder${open ? "" : " closed"}"`,
    ` draggable="true" data-section="${section}"`,
    ` data-folderpath="${encodeURIComponent(folder.path)}"`,
    ` data-paths="${encodedPaths}" title="${escapeHtml(moveLabel)}">`,
    `<span class="gitFolderHeader uncommittedFolderHeader" role="button" tabindex="0"`,
    ` aria-expanded="${open}">`,
    `<span class="uncommittedFolderGlyph" aria-hidden="true">${open ? "-" : "+"}</span>`,
    `<span class="gitFolderName">${escapeHtml(folder.name)}</span>`,
    "</span>",
    `<ul class="gitFolderContents${open ? "" : " hidden"}">`,
    folder.children.map((child) => renderUncommittedNode(section, child, l10n, tree)).join(""),
    "</ul></li>"
  ].join("");
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
