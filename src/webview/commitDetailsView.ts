import type { GitCommitDetails, GitFileChange } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/webviewL10n";

import { escapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";

type RenderCommitDetailsOptions = {
  commitDetails: GitCommitDetails;
  fileTree: GitFolder;
  avatars: AvatarImageCollection;
  l10n: LocalizedStrings;
  sections: CommitDetailsSectionState;
};

export type CommitDetailsSection = "summary" | "files";

export type CommitDetailsSectionState = {
  summaryOpen: boolean;
  filesOpen: boolean;
};

export function renderCommitDetailsRowHtml({
  commitDetails,
  fileTree,
  avatars,
  l10n,
  sections
}: RenderCommitDetailsOptions): string {
  return [
    '<td></td><td colspan="4">',
    renderCommitDetailsSummary(commitDetails, avatars, l10n, sections.summaryOpen),
    renderCommitDetailsFiles(fileTree, commitDetails.fileChanges, l10n, sections.filesOpen),
    `<div id="commitDetailsClose">${svgIcons.close}</div>`,
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
  const body = escapeHtml(commitDetails.body).replaceAll("\n", "<br>");
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
  open = true
): string {
  const bodyClass = `commitDetailsPaneBody${open ? "" : " hidden"}`;
  return [
    '<div id="commitDetailsFiles">',
    renderCommitDetailsSectionToggle("files", l10n.detailFiles, open, {
      expanded: l10n.detailCollapseFiles,
      collapsed: l10n.detailExpandFiles
    }),
    `<div id="commitDetailsFilesBody" class="${bodyClass}">`,
    renderGitFileTreeHtml(fileTree, fileChanges, l10n),
    "</div></div>"
  ].join("");
}

export function generateGitFileTree(gitFiles: GitFileChange[]): GitFolder {
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
  const path = folderPath.split("/");
  let cur = folder;
  for (const segment of path) {
    const entry = cur.contents[segment];
    if (entry?.type !== "folder") return;
    cur = entry;
  }
  cur.open = open;
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
    '><span class="gitFileIcon">',
    svgIcons.file,
    "</span>",
    escapeHtml(gitFile.name),
    renderRenameBadge(fileChange, l10n),
    renderAddDelSummary(fileChange, l10n),
    "</li>"
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
