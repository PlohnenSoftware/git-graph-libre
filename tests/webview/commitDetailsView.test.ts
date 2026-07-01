import type { GitCommitDetails, GitFileChange } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import {
  alterGitFileTree,
  generateGitFileTree,
  renderCommitDetailsRowHtml,
  renderGitFileTreeHtml
} from "@/webview/commitDetailsView";
import { describe, expect, it } from "vitest";

const l10n = {
  detailCommit: "Commit: ",
  detailParents: "Parents: ",
  detailAuthor: "Author: ",
  detailDate: "Date: ",
  detailCommitter: "Committer: ",
  detailSummary: "Summary",
  detailFiles: "Files",
  detailCollapseSummary: "Collapse commit summary",
  detailExpandSummary: "Expand commit summary",
  detailCollapseFiles: "Collapse changed files",
  detailExpandFiles: "Expand changed files",
  tooltipBinaryFile: "Binary file",
  tooltipRenamedTo: " renamed to ",
  tooltipAddition: " addition",
  tooltipAdditions: " additions",
  tooltipDeletion: " deletion",
  tooltipDeletions: " deletions"
} as LocalizedStrings;

const commitDetails: GitCommitDetails = {
  hash: "abc123",
  parents: ["def456"],
  author: "Alice <unsafe>",
  email: "alice+review@example.com",
  date: 1700000000,
  committer: "Bob & Carol",
  body: "First line\n<script>alert(1)</script>",
  fileChanges: [
    {
      oldFilePath: "README.md",
      newFilePath: "README.md",
      type: "M",
      additions: 2,
      deletions: 1
    }
  ]
};

describe("commit details view rendering", () => {
  it("renders escaped summary, body, avatar, file list, and close control", () => {
    const fileTree = generateGitFileTree(commitDetails.fileChanges);
    const host = document.createElement("tr");
    const html = renderCommitDetailsRowHtml({
      commitDetails,
      fileTree,
      avatars: { "alice+review@example.com": "https://avatars.test/a?name=Alice&Bob" },
      l10n,
      sections: { summaryOpen: true, filesOpen: true }
    });

    host.innerHTML = html;

    expect(html).toContain("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
    expect(host.querySelector("#commitDetailsSummary")?.innerHTML).not.toContain("<script>");
    expect(host.querySelector("#commitDetailsSummary")?.innerHTML).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(host.querySelector(".commitDetailsSummaryAvatar img")?.getAttribute("src")).toBe(
      "https://avatars.test/a?name=Alice&Bob"
    );
    expect(host.querySelector("#commitDetailsSummaryToggle")?.getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(host.querySelector("#commitDetailsFilesToggle")?.getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(host.querySelector("#commitDetailsFiles .gitFile")?.textContent).toContain("README.md");
    expect(host.querySelector("#commitDetailsClose")).not.toBeNull();
  });

  it("renders collapsed section state for summary and files", () => {
    const fileTree = generateGitFileTree(commitDetails.fileChanges);
    const host = document.createElement("tr");

    host.innerHTML = renderCommitDetailsRowHtml({
      commitDetails,
      fileTree,
      avatars: {},
      l10n,
      sections: { summaryOpen: false, filesOpen: false }
    });

    expect(host.querySelector("#commitDetailsSummaryToggle")?.getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(host.querySelector("#commitDetailsSummaryToggle")?.getAttribute("aria-label")).toBe(
      "Expand commit summary"
    );
    expect(host.querySelector("#commitDetailsSummaryBody")?.classList.contains("hidden")).toBe(
      true
    );
    expect(host.querySelector("#commitDetailsFilesToggle")?.getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(host.querySelector("#commitDetailsFilesToggle")?.getAttribute("aria-label")).toBe(
      "Expand changed files"
    );
    expect(host.querySelector("#commitDetailsFilesBody")?.classList.contains("hidden")).toBe(true);
  });

  it("builds sortable file trees and preserves folder open state", () => {
    const fileChanges: GitFileChange[] = [
      {
        oldFilePath: "README.md",
        newFilePath: "README.md",
        type: "M",
        additions: 1,
        deletions: 1
      },
      {
        oldFilePath: "src/old-name.ts",
        newFilePath: "src/new-name.ts",
        type: "R",
        additions: 3,
        deletions: 2
      }
    ];
    const fileTree = generateGitFileTree(fileChanges);

    expect(Object.keys(fileTree.contents)).toEqual(["README.md", "src"]);

    const openHtml = renderGitFileTreeHtml(fileTree, fileChanges, l10n);
    expect(openHtml.indexOf('gitFolderName">src')).toBeLessThan(openHtml.indexOf("README.md"));
    expect(openHtml).toContain('data-oldfilepath="src%2Fold-name.ts"');
    expect(openHtml).toContain('data-newfilepath="src%2Fnew-name.ts"');
    expect(openHtml).toContain("gitFileRename");

    alterGitFileTree(fileTree, "src", false);

    expect((fileTree.contents.src as GitFolder).open).toBe(false);
    expect(renderGitFileTreeHtml(fileTree, fileChanges, l10n)).toContain(
      '<ul class="gitFolderContents hidden">'
    );
  });
});
