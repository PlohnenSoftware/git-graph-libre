import type { GitCommitDetails, GitFileChange } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import {
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_MAX_HEIGHT,
  COMMIT_DETAILS_MIN_HEIGHT,
  alterGitFileTree,
  clampCommitDetailsHeight,
  generateGitFileTree,
  renderCommitDetailsRowHtml,
  renderGitFileListHtml,
  renderGitFileTreeHtml
} from "@/webview/commitDetailsView";
import { describe, expect, it } from "vitest";

const l10n = {
  detailCommit: "Commit: ",
  detailParents: "Parents: ",
  detailAuthor: "Author: ",
  detailAuthorDate: "Author Date: ",
  detailDate: "Date: ",
  detailCommitter: "Committer: ",
  detailCommitterDate: "Committer Date: ",
  detailSummary: "Summary",
  detailFiles: "Files",
  detailCollapseSummary: "Collapse commit summary",
  detailExpandSummary: "Expand commit summary",
  detailCollapseFiles: "Collapse changed files",
  detailExpandFiles: "Expand changed files",
  detailResize: "Resize commit details",
  copyFilePath: "Copy file path",
  openFile: "Open file",
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
  authorDate: 1700000000,
  committer: "Bob & Carol",
  committerEmail: "bob&carol@example.com",
  committerDate: 1700000100,
  body: "First line\n<script>alert(1)</script>\nSee https://example.test/review.",
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

function renderSummaryHost(details: GitCommitDetails): HTMLTableRowElement {
  const host = document.createElement("tr");
  host.innerHTML = renderCommitDetailsRowHtml({
    commitDetails: details,
    fileTree: generateGitFileTree(details.fileChanges),
    fileView: { mode: "tree" },
    avatars: {},
    l10n,
    sections: { detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT, summaryOpen: true, filesOpen: true }
  });
  return host;
}

function summaryLabels(details: GitCommitDetails): string[] {
  return Array.from(
    renderSummaryHost(details).querySelectorAll(".commitDetailsSummaryKeyValues > b"),
    (label) => label.textContent?.trim() ?? ""
  );
}

describe("commit details view rendering", () => {
  it("renders escaped summary, body, avatar, file list, and resize control", () => {
    const fileTree = generateGitFileTree(commitDetails.fileChanges);
    const host = document.createElement("tr");
    const html = renderCommitDetailsRowHtml({
      commitDetails,
      fileTree,
      fileView: { mode: "tree" },
      avatars: { "alice+review@example.com": "https://avatars.test/a?name=Alice&Bob" },
      l10n,
      sections: { detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT, summaryOpen: true, filesOpen: true }
    });

    host.innerHTML = html;

    expect(
      Array.from(host.querySelectorAll(".commitDetailsSummaryKeyValues > b"), (label) =>
        label.textContent?.trim()
      )
    ).toEqual(["Commit:", "Parents:", "Author:", "Author Date:", "Committer:", "Committer Date:"]);
    const identityLinks = host.querySelectorAll<HTMLAnchorElement>(
      '.commitDetailsSummaryKeyValues a[href^="mailto:"]'
    );
    expect(Array.from(identityLinks, (link) => link.textContent)).toEqual([
      "alice+review@example.com",
      "bob&carol@example.com"
    ]);
    expect(identityLinks[1].getAttribute("href")).toBe("mailto:bob%26carol%40example.com");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
    expect(host.querySelector("#commitDetailsSummary")?.innerHTML).not.toContain("<script>");
    expect(host.querySelector("#commitDetailsSummary")?.innerHTML).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    const bodyLink = Array.from(
      host.querySelectorAll<HTMLAnchorElement>("#commitDetailsSummaryBody a")
    ).find((link) => link.getAttribute("href")?.startsWith("https://"));
    expect(bodyLink?.getAttribute("href")).toBe("https://example.test/review");
    expect(bodyLink?.textContent).toBe("https://example.test/review");
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
    expect(host.querySelector(".gitFileCopyPath")?.getAttribute("aria-label")).toBe(
      "Copy file path"
    );
    expect(host.querySelector(".gitFileCopyPath")?.getAttribute("data-filepath")).toBe("README.md");
    expect(host.querySelector(".gitFileOpenFile")?.getAttribute("aria-label")).toBe("Open file");
    expect(host.querySelector("#commitDetailsClose")).toBeNull();
    expect(host.querySelector("#commitDetailsResizeHandle")?.getAttribute("aria-label")).toBe(
      "Resize commit details"
    );
    expect(host.querySelector("#commitDetailsResizeHandle")?.getAttribute("aria-valuenow")).toBe(
      COMMIT_DETAILS_DEFAULT_HEIGHT.toString()
    );
  });

  it("renders one shared date when author and committer metadata matches", () => {
    const matchingDetails: GitCommitDetails = {
      ...commitDetails,
      committer: commitDetails.author,
      committerEmail: commitDetails.email,
      committerDate: commitDetails.authorDate
    };
    const host = renderSummaryHost(matchingDetails);

    expect(summaryLabels(matchingDetails)).toEqual([
      "Commit:",
      "Parents:",
      "Author:",
      "Committer:",
      "Date:"
    ]);
    expect(host.querySelector(".commitDetailsSummaryKeyValues")?.textContent).toContain(
      new Date(matchingDetails.authorDate * 1000).toString()
    );
  });

  it("renders role-specific dates when either identity or timestamp differs", () => {
    const identityDiffers = {
      ...commitDetails,
      committerDate: commitDetails.authorDate
    };
    const timestampDiffers = {
      ...commitDetails,
      committer: commitDetails.author,
      committerEmail: commitDetails.email
    };
    const expectedLabels = [
      "Commit:",
      "Parents:",
      "Author:",
      "Author Date:",
      "Committer:",
      "Committer Date:"
    ];

    expect(summaryLabels(identityDiffers)).toEqual(expectedLabels);
    expect(summaryLabels(timestampDiffers)).toEqual(expectedLabels);
  });

  it("renders collapsed section state for summary and files", () => {
    const fileTree = generateGitFileTree(commitDetails.fileChanges);
    const host = document.createElement("tr");

    host.innerHTML = renderCommitDetailsRowHtml({
      commitDetails,
      fileTree,
      fileView: { mode: "tree" },
      avatars: {},
      l10n,
      sections: {
        detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT,
        summaryOpen: false,
        filesOpen: false
      }
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

  it("clamps commit details resize heights to stable bounds", () => {
    expect(clampCommitDetailsHeight(120)).toBe(COMMIT_DETAILS_MIN_HEIGHT);
    expect(clampCommitDetailsHeight(372.4)).toBe(372);
    expect(clampCommitDetailsHeight(950)).toBe(COMMIT_DETAILS_MAX_HEIGHT);
    expect(clampCommitDetailsHeight(Number.NaN)).toBe(COMMIT_DETAILS_DEFAULT_HEIGHT);
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

  it("renders a flat changed-file list mode with full paths", () => {
    const fileChanges: GitFileChange[] = [
      {
        oldFilePath: "src/old-name.ts",
        newFilePath: "src/new-name.ts",
        type: "R",
        additions: 3,
        deletions: 2
      },
      {
        oldFilePath: "README.md",
        newFilePath: "README.md",
        type: "M",
        additions: 1,
        deletions: 1
      },
      {
        oldFilePath: "docs/old guide.md",
        newFilePath: "docs/old guide.md",
        type: "D",
        additions: null,
        deletions: null
      }
    ];
    const host = document.createElement("div");

    host.innerHTML = renderGitFileListHtml(fileChanges, l10n);

    expect(host.querySelector(".gitFileList")).not.toBeNull();
    expect(host.querySelector(".gitFolder")).toBeNull();
    expect(host.querySelector('.gitFile[data-newfilepath="README.md"]')?.textContent).toContain(
      "README.md"
    );
    const renamedFile = host.querySelector<HTMLElement>(
      '.gitFile[data-newfilepath="src%2Fnew-name.ts"]'
    );
    expect(renamedFile?.textContent).toContain("src/new-name.ts");
    expect(renamedFile?.getAttribute("data-oldfilepath")).toBe("src%2Fold-name.ts");
    const deletedFile = host.querySelector<HTMLElement>(
      '.gitFile[data-newfilepath="docs%2Fold%20guide.md"]'
    );
    expect(deletedFile?.querySelector(".gitFileCopyPath")?.getAttribute("data-filepath")).toBe(
      "docs%2Fold%20guide.md"
    );
    expect(deletedFile?.querySelector(".gitFileOpenFile")).toBeNull();
  });

  it("compacts single-child folder chains while preserving toggle paths", () => {
    const fileChanges: GitFileChange[] = [
      {
        oldFilePath: "src/webview/utils/html.ts",
        newFilePath: "src/webview/utils/html.ts",
        type: "M",
        additions: 1,
        deletions: 1
      },
      {
        oldFilePath: "src/webview/main.ts",
        newFilePath: "src/webview/main.ts",
        type: "M",
        additions: 2,
        deletions: 1
      }
    ];
    const fileTree = generateGitFileTree(fileChanges, { compactFolders: true });
    const html = renderGitFileTreeHtml(fileTree, fileChanges, l10n);

    expect(html).toContain('gitFolderName">src&#x2F;webview');
    expect(html).toContain('data-folderpath="src%2Fwebview"');

    alterGitFileTree(fileTree, "src/webview", false);

    expect((fileTree.contents["src/webview"] as GitFolder).open).toBe(false);
    expect(renderGitFileTreeHtml(fileTree, fileChanges, l10n)).toContain(
      '<ul class="gitFolderContents hidden">'
    );
  });
});
