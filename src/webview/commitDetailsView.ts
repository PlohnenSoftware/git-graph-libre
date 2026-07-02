import type { GitCommitDetails, GitFileChange } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import type { CommitDetailsFileViewMode } from "@/types";

import { escapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";
import { linkifyHttpUrls } from "./utils/linkify";

type RenderCommitDetailsOptions = {
  commitDetails: GitCommitDetails;
  fileTree: GitFolder;
  fileView?: CommitDetailsFileViewOptions;
  avatars: AvatarImageCollection;
  l10n: LocalizedStrings;
  sections: CommitDetailsSectionState;
};

type GenerateGitFileTreeOptions = {
  compactFolders?: boolean;
};

export type CommitDetailsFileViewOptions = {
  mode: CommitDetailsFileViewMode;
};

const defaultCommitDetailsFileView: CommitDetailsFileViewOptions = { mode: "tree" };
export const COMMIT_DETAILS_COLLAPSED_HEIGHT = 44;
export const COMMIT_DETAILS_DEFAULT_HEIGHT = 250;
export const COMMIT_DETAILS_KEYBOARD_RESIZE_STEP = 24;
export const COMMIT_DETAILS_MAX_HEIGHT = 900;
export const COMMIT_DETAILS_MIN_HEIGHT = 160;

export type CommitDetailsSection = "summary" | "files";

export type CommitDetailsSectionState = {
  detailsHeight: number;
  summaryOpen: boolean;
  filesOpen: boolean;
};

export function clampCommitDetailsHeight(height: number): number {
  if (typeof height !== "number" || !Number.isFinite(height)) return COMMIT_DETAILS_DEFAULT_HEIGHT;
  return Math.min(
    COMMIT_DETAILS_MAX_HEIGHT,
    Math.max(COMMIT_DETAILS_MIN_HEIGHT, Math.round(height))
  );
}

export function renderCommitDetailsRowHtml({
  commitDetails,
  fileTree,
  fileView,
  avatars,
  l10n,
  sections
}: RenderCommitDetailsOptions): string {
  const resolvedFileView = fileView ?? defaultCommitDetailsFileView;
  return [
    '<td></td><td colspan="4">',
    renderCommitDetailsSummary(commitDetails, avatars, l10n, sections.summaryOpen),
    renderCommitDetailsFiles(
      fileTree,
      commitDetails.fileChanges,
      l10n,
      sections.filesOpen,
      resolvedFileView
    ),
    renderCommitDetailsResizeHandle(l10n, sections.detailsHeight),
    "</td>"
  ].join("");
}

export function renderCommitDetailsSummary(
  commitDetails: GitCommitDetails,
  avatars: AvatarImageCollection,
  l10n: LocalizedStrings,
  open = true
): string {
  const avatar = avatars[commitDetails.email];
  const topClass = `commitDetailsSummaryTop${typeof avatar === "string" ? " withAvatar" : ""}`;
  const authorEmail = escapeHtml(commitDetails.email);
  const body = linkifyHttpUrls(commitDetails.body);
  const bodyClass = `commitDetailsPaneBody${open ? "" : " hidden"}`;

  return [
    '<div id="commitDetailsSummary">',
    renderCommitDetailsSectionToggle("summary", l10n.detailSummary, open, {
      expanded: l10n.detailCollapseSummary,
      collapsed: l10n.detailExpandSummary
    }),
    `<div id="commitDetailsSummaryBody" class="${bodyClass}">`,
    `<span class="${topClass}">`,
    '<span class="commitDetailsSummaryTopRow">',
    '<span class="commitDetailsSummaryKeyValues">',
    `<b>${l10n.detailCommit}</b>${escapeHtml(commitDetails.hash)}<br>`,
    `<b>${l10n.detailParents}</b>${commitDetails.parents.join(", ")}<br>`,
    `<b>${l10n.detailAuthor}</b>${escapeHtml(commitDetails.author)} &lt;<a href="mailto:${encodeURIComponent(
      commitDetails.email
    )}">${authorEmail}</a>&gt;<br>`,
    `<b>${l10n.detailDate}</b>${new Date(commitDetails.date * 1000).toString()}<br>`,
    `<b>${l10n.detailCommitter}</b>${escapeHtml(commitDetails.committer)}</span>`,
    typeof avatar === "string"
      ? `<span class="commitDetailsSummaryAvatar"><img src="${escapeHtml(avatar)}"></span>`
      : "",
    "</span></span><br><br>",
    body,
    "</div></div>"
  ].join("");
}

export function renderCommitDetailsFiles(
  fileTree: GitFolder,
  fileChanges: GitFileChange[],
  l10n: LocalizedStrings,
  open = true,
  fileView?: CommitDetailsFileViewOptions
): string {
  const fileViewMode = fileView?.mode ?? "tree";
  const bodyClass = `commitDetailsPaneBody${open ? "" : " hidden"}`;
  return [
    '<div id="commitDetailsFiles">',
    renderCommitDetailsSectionToggle("files", l10n.detailFiles, open, {
      expanded: l10n.detailCollapseFiles,
      collapsed: l10n.detailExpandFiles
    }),
    `<div id="commitDetailsFilesBody" class="${bodyClass}">`,
    fileViewMode === "list"
      ? renderGitFileListHtml(fileChanges, l10n)
      : renderGitFileTreeHtml(fileTree, fileChanges, l10n),
    "</div></div>"
  ].join("");
}

export function generateGitFileTree(
  gitFiles: GitFileChange[],
  options: GenerateGitFileTreeOptions = {}
): GitFolder {
  const files: GitFolder = {
    type: "folder",
    name: "",
    folderPath: "",
    contents: {},
    open: true
  };

  for (let i = 0; i < gitFiles.length; i++) {
    let cur = files;
    const path = gitFiles[i].newFilePath.split("/");
    for (let j = 0; j < path.length; j++) {
      if (j < path.length - 1) {
        const folderName = path[j];
        cur.contents[folderName] ??= {
          type: "folder",
          name: folderName,
          folderPath: path.slice(0, j + 1).join("/"),
          contents: {},
          open: true
        };
        cur = cur.contents[folderName] as GitFolder;
      } else {
        cur.contents[path[j]] = { type: "file", name: path[j], index: i };
      }
    }
  }

  if (options.compactFolders === true) compactFolderContents(files);

  return files;
}

export function renderGitFileTreeHtml(
  folder: GitFolder,
  gitFiles: GitFileChange[],
  l10n: LocalizedStrings
): string {
  const folderOpenClass = folder.open ? "" : " hidden";
  let html = `${renderGitFolderHeader(folder)}<ul class="gitFolderContents${folderOpenClass}">`;
  const keys = Object.keys(folder.contents);
  keys.sort((a, b) => compareGitFolderEntries(folder.contents[a], folder.contents[b]));

  for (const key of keys) {
    const entry = folder.contents[key];
    if (entry.type === "folder") {
      const closedClass = entry.open ? "" : ' class="closed"';
      html += `<li${closedClass}>${renderGitFileTreeHtml(entry, gitFiles, l10n)}</li>`;
    } else {
      html += renderGitFileListItem(entry, gitFiles[entry.index], l10n);
    }
  }

  return `${html}</ul>`;
}

export function alterGitFileTree(folder: GitFolder, folderPath: string, open: boolean): void {
  const match = findGitFolderByPath(folder, folderPath);
  if (match !== null) match.open = open;
}

export function renderGitFileListHtml(gitFiles: GitFileChange[], l10n: LocalizedStrings): string {
  const files = gitFiles
    .map((fileChange, index) => ({
      gitFile: { type: "file" as const, name: fileChange.newFilePath, index },
      fileChange
    }))
    .sort((a, b) => a.fileChange.newFilePath.localeCompare(b.fileChange.newFilePath));

  return `<ul class="gitFileList">${files
    .map(({ gitFile, fileChange }) => renderGitFileListItem(gitFile, fileChange, l10n))
    .join("")}</ul>`;
}

function renderGitFolderHeader(folder: GitFolder): string {
  if (folder.name === "") return "";
  return [
    `<span class="gitFolder" data-folderpath="${encodeURIComponent(folder.folderPath)}">`,
    '<span class="gitFolderIcon">',
    folder.open ? svgIcons.openFolder : svgIcons.closedFolder,
    '</span><span class="gitFolderName">',
    escapeHtml(folder.name),
    "</span></span>"
  ].join("");
}

function renderCommitDetailsResizeHandle(l10n: LocalizedStrings, detailsHeight: number): string {
  return [
    '<div id="commitDetailsResizeHandle" role="separator" tabindex="0"',
    ' aria-orientation="horizontal"',
    ` aria-label="${escapeHtml(l10n.detailResize)}"`,
    ` aria-valuemin="${COMMIT_DETAILS_MIN_HEIGHT}"`,
    ` aria-valuemax="${COMMIT_DETAILS_MAX_HEIGHT}"`,
    ` aria-valuenow="${clampCommitDetailsHeight(detailsHeight)}">`,
    "</div>"
  ].join("");
}

function compactFolderContents(folder: GitFolder): void {
  const compactedContents: GitFolderContents = {};
  for (const entry of Object.values(folder.contents)) {
    if (entry.type === "file") {
      compactedContents[entry.name] = entry;
      continue;
    }

    const compactedFolder = compactFolderChain(entry);
    compactedContents[compactedFolder.name] = compactedFolder;
  }
  folder.contents = compactedContents;
}

function compactFolderChain(folder: GitFolder): GitFolder {
  let current = folder;
  while (true) {
    const entries = Object.values(current.contents);
    const childFolders = entries.filter((entry): entry is GitFolder => entry.type === "folder");
    const childFiles = entries.filter((entry) => entry.type === "file");
    if (childFolders.length !== 1 || childFiles.length !== 0) break;

    const child = childFolders[0];
    current = {
      type: "folder",
      name: `${current.name}/${child.name}`,
      folderPath: child.folderPath,
      contents: child.contents,
      open: current.open && child.open
    };
  }

  compactFolderContents(current);
  return current;
}

function findGitFolderByPath(folder: GitFolder, folderPath: string): GitFolder | null {
  if (folder.folderPath === folderPath) return folder;
  for (const entry of Object.values(folder.contents)) {
    if (entry.type !== "folder") continue;
    const match = findGitFolderByPath(entry, folderPath);
    if (match !== null) return match;
  }
  return null;
}

function renderCommitDetailsSectionToggle(
  section: CommitDetailsSection,
  label: string,
  expanded: boolean,
  ariaLabel: { expanded: string; collapsed: string }
): string {
  const glyph = expanded ? "-" : "+";
  return [
    `<button id="commitDetails${capitalizeSection(
      section
    )}Toggle" class="commitDetailsToggle" type="button" data-section="${section}"`,
    ` aria-controls="commitDetails${capitalizeSection(section)}Body"`,
    ` aria-expanded="${expanded}" aria-label="${expanded ? ariaLabel.expanded : ariaLabel.collapsed}">`,
    `<span class="commitDetailsToggleGlyph" aria-hidden="true">${glyph}</span>`,
    `<span class="commitDetailsToggleLabel">${escapeHtml(label)}</span>`,
    "</button>"
  ].join("");
}

function capitalizeSection(section: CommitDetailsSection): "Summary" | "Files" {
  return section === "summary" ? "Summary" : "Files";
}

function compareGitFolderEntries(a: GitFolderOrFile, b: GitFolderOrFile): number {
  if (a.type === "folder" && b.type === "file") return -1;
  if (a.type === "file" && b.type === "folder") return 1;
  return a.name.localeCompare(b.name);
}

function renderGitFileListItem(
  gitFile: GitFile,
  fileChange: GitFileChange,
  l10n: LocalizedStrings
): string {
  return [
    '<li class="gitFile ',
    fileChange.type,
    fileChange.additions !== null && fileChange.deletions !== null ? " gitDiffPossible" : "",
    `" data-oldfilepath="${encodeURIComponent(fileChange.oldFilePath)}"`,
    ` data-newfilepath="${encodeURIComponent(fileChange.newFilePath)}"`,
    ` data-type="${fileChange.type}"`,
    fileChange.additions === null || fileChange.deletions === null
      ? ` title="${l10n.tooltipBinaryFile}"`
      : "",
    '><span class="gitFileMain"><span class="gitFileIcon">',
    svgIcons.file,
    '</span><span class="gitFileName">',
    escapeHtml(gitFile.name),
    "</span>",
    renderRenameBadge(fileChange, l10n),
    renderAddDelSummary(fileChange, l10n),
    "</span>",
    renderGitFileActions(fileChange, l10n),
    "</li>"
  ].join("");
}

function renderGitFileActions(fileChange: GitFileChange, l10n: LocalizedStrings): string {
  const encodedFilePath = encodeURIComponent(fileChange.newFilePath);
  const copyLabel = escapeHtml(l10n.copyFilePath);
  const openLabel = escapeHtml(l10n.openFile);
  const openButton =
    fileChange.type === "D"
      ? ""
      : [
          `<button class="gitFileAction gitFileOpenFile" type="button" data-filepath="${encodedFilePath}"`,
          ` title="${openLabel}" aria-label="${openLabel}">`,
          svgIcons.openFile,
          "</button>"
        ].join("");

  return [
    '<span class="gitFileActions">',
    `<button class="gitFileAction gitFileCopyPath" type="button" data-filepath="${encodedFilePath}"`,
    ` title="${copyLabel}" aria-label="${copyLabel}">`,
    svgIcons.copy,
    "</button>",
    openButton,
    "</span>"
  ].join("");
}

function renderRenameBadge(fileChange: GitFileChange, l10n: LocalizedStrings): string {
  if (fileChange.type !== "R") return "";
  return ` <span class="gitFileRename" title="${escapeHtml(
    fileChange.oldFilePath + l10n.tooltipRenamedTo + fileChange.newFilePath
  )}">R</span>`;
}

function renderAddDelSummary(fileChange: GitFileChange, l10n: LocalizedStrings): string {
  if (
    fileChange.type === "A" ||
    fileChange.type === "D" ||
    fileChange.additions === null ||
    fileChange.deletions === null
  ) {
    return "";
  }

  const additionLabel = fileChange.additions === 1 ? l10n.tooltipAddition : l10n.tooltipAdditions;
  const deletionLabel = fileChange.deletions === 1 ? l10n.tooltipDeletion : l10n.tooltipDeletions;
  return [
    '<span class="gitFileAddDel">(<span class="gitFileAdditions" title="',
    fileChange.additions,
    additionLabel,
    '">+',
    fileChange.additions,
    '</span>|<span class="gitFileDeletions" title="',
    fileChange.deletions,
    deletionLabel,
    '">-',
    fileChange.deletions,
    "</span>)</span>"
  ].join("");
}
