import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitCommitDetails, GitCommitNode, GitFileChange, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type { LocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";
import {
  alterGitFileTree,
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_MAX_HEIGHT,
  COMMIT_DETAILS_MIN_HEIGHT,
  type CommitComparisonDisplay,
  clampCommitDetailsHeight,
  generateGitFileTree,
  renderCommitDetailsRowHtml,
  renderGitFileListHtml,
  renderGitFileTreeHtml
} from "@/webview/commitDetailsView";

import { createVscodeMock, receive, setupHtml } from "./setup";

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
  comparedWithFirstParent: "Changes compared with the first parent",
  comparing: "Comparing {0} → {1}",
  swapComparison: "Swap comparison",
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

function renderSummaryHost(
  details: GitCommitDetails,
  comparison: CommitComparisonDisplay | null = null,
  strings: LocalizedStrings = l10n
): HTMLTableRowElement {
  const host = document.createElement("tr");
  host.innerHTML = renderCommitDetailsRowHtml({
    commitDetails: details,
    fileTree: generateGitFileTree(details.fileChanges),
    fileView: { mode: "tree" },
    avatars: {},
    l10n: strings,
    sections: { detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT, summaryOpen: true, filesOpen: true },
    comparison
  });
  return host;
}

function comparisonRefs(host: HTMLElement): string[] {
  return Array.from(
    host.querySelectorAll(".commitDetailsComparison .commitDetailsComparisonRef"),
    (ref) => ref.textContent ?? ""
  );
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

  it("shows the first-parent note only for a merge commit", () => {
    const mergeHost = renderSummaryHost({
      ...commitDetails,
      parents: ["def456", "789abc"]
    });
    const note = mergeHost.querySelector("#commitDetailsFilesBody > .commitDetailsFirstParentNote");
    expect(note?.textContent).toBe("Changes compared with the first parent");
    expect(note?.nextElementSibling?.classList.contains("gitFolderContents")).toBe(true);

    expect(
      renderSummaryHost(commitDetails).querySelector(".commitDetailsFirstParentNote")
    ).toBeNull();
    expect(
      renderSummaryHost({ ...commitDetails, parents: [] }).querySelector(
        ".commitDetailsFirstParentNote"
      )
    ).toBeNull();
  });

  it("renders the comparison header only for comparisons, above the summary", () => {
    expect(renderSummaryHost(commitDetails).querySelector(".commitDetailsComparison")).toBeNull();

    const host = renderSummaryHost(commitDetails, { base: "def45678", compare: "HEAD" });
    const header = host.querySelector("#commitDetailsSummaryBody > .commitDetailsComparison");
    expect(header?.textContent).toBe("Comparing def45678 → HEAD");
    expect(comparisonRefs(host)).toEqual(["def45678", "HEAD"]);
    expect(header?.nextElementSibling?.classList.contains("commitDetailsSummaryTop")).toBe(true);
    const swap = host.querySelector<HTMLButtonElement>(".commitDetailsComparisonSwap");
    expect(swap?.getAttribute("title")).toBe("Swap comparison");
    expect(swap?.getAttribute("aria-label")).toBe("Swap comparison");
    expect(swap?.querySelector("svg.commitDetailsComparisonSwapIcon")).not.toBeNull();
    // The summary's own key/value labels are unchanged by the header.
    expect(
      Array.from(host.querySelectorAll(".commitDetailsSummaryKeyValues > b"), (label) =>
        label.textContent?.trim()
      )
    ).toEqual(["Commit:", "Parents:", "Author:", "Author Date:", "Committer:", "Committer Date:"]);
  });

  it("escapes comparison labels and substitutes each placeholder once", () => {
    const host = renderSummaryHost(commitDetails, { base: "{1}", compare: "a$&b<i>x</i>" });
    expect(comparisonRefs(host)).toEqual(["{1}", "a$&b<i>x</i>"]);
    expect(host.querySelector(".commitDetailsComparison i")).toBeNull();

    // A translation may name the two sides in either order.
    const reordered = renderSummaryHost(
      commitDetails,
      { base: "main", compare: "v2.0" },
      { ...l10n, comparing: "{1} ← {0}" }
    );
    expect(reordered.querySelector(".commitDetailsComparison")?.textContent).toBe("v2.0 ← main");
  });

  it("does not claim a first-parent comparison for a compared merge commit", () => {
    const merge = { ...commitDetails, parents: ["def456", "789abc"] };
    const host = renderSummaryHost(merge, { base: "def45678", compare: "HEAD" });
    expect(host.querySelector(".commitDetailsFirstParentNote")).toBeNull();
    expect(renderSummaryHost(merge).querySelector(".commitDetailsFirstParentNote")).not.toBeNull();
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

const REPO = "/workspace/comparison-header";
const HEAD_HASH = "aaaaaaaa11111111";
const BRANCH_HASH = "bbbbbbbb22222222";
const TAG_HASH = "cccccccc33333333";
const PLAIN_HASH = "dddddddd44444444";
const graphViewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  uncommittedFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  showSignatureColumn: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [],
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  revealHighlightColor: "oklch(90% 0.25 150 / 0.42)",
  includeReflog: false,
  includeUnreachableCommits: false,
  initialLoadCommits: 250,
  lastActiveRepo: null,
  loadMoreCommits: 750,
  muteCommitsNotAncestorsOfHead: false,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
  mergeNoFastForward: true,
  pullBranchNoFastForward: false,
  createBranchCheckout: true,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8,
  language: "en",
  languages: [{ id: "en", label: "English" }]
};

function graphCommit(
  hash: string,
  parentHashes: string[],
  refs: GitCommitNode["refs"] = []
): GitCommitNode {
  return {
    hash,
    parentHashes,
    author: "Alice",
    email: "alice@example.com",
    date: 1,
    message: `Commit ${hash}`,
    refs
  };
}

const graphCommits = [
  graphCommit(HEAD_HASH, [BRANCH_HASH], [{ hash: HEAD_HASH, name: "main", type: "head" }]),
  graphCommit(BRANCH_HASH, [TAG_HASH], [{ hash: BRANCH_HASH, name: "feature/old", type: "head" }]),
  graphCommit(TAG_HASH, [PLAIN_HASH], [{ hash: TAG_HASH, name: "v1.0", type: "tag" }]),
  graphCommit(PLAIN_HASH, [])
];

const graphRepoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: HEAD_HASH,
  authors: ["Alice"],
  tags: ["v1.0"],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

function latestRequest<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }> {
  const message = messages.findLast((candidate) => candidate.command === command);
  if (message === undefined) throw new Error(`Missing ${command} request`);
  return message as Extract<GGL.RequestMessage, { command: T }>;
}

async function bootGraph() {
  const vscode = createVscodeMock();
  setupHtml(graphViewState);
  await import("@/webview/main");
  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscode.sentMessages, "loadRepoInfo").requestId,
    repoInfo: graphRepoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscode.sentMessages, "loadBranches").requestId,
    branches: ["main", "feature/old"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscode.sentMessages, "loadCommits").requestId,
    commits: graphCommits,
    head: HEAD_HASH,
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscode;
}

function graphRow(hash: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`tr[data-hash="${hash}"]`);
  if (element === null) throw new Error(`Missing row ${hash}`);
  return element;
}

function clickMenuItem(label: string) {
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
  ).find((candidate) => candidate.textContent === label);
  if (item === undefined) throw new Error(`Missing menu item ${label}`);
  item.click();
}

function receiveComparison(hash: string, parents: string[] = []) {
  receive({
    command: "commitComparison",
    commitDetails: { ...commitDetails, hash, parents },
    error: null
  });
}

function headerText(): string | null | undefined {
  return document.querySelector("#commitDetails .commitDetailsComparison")?.textContent;
}

describe("comparison header in the graph view", () => {
  beforeEach(() => vi.resetModules());

  it.each([
    ["branch", "feature/old", BRANCH_HASH],
    ["tag", "v1.0", TAG_HASH]
  ])("names a %s compared with HEAD by its ref name", async (_kind, refName, hash) => {
    const vscode = await bootGraph();
    document
      .querySelector(`.gitRef[data-name="${refName}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Compare with HEAD");

    // The labels stay in the view; the backend still gets only the refs.
    expect(latestRequest(vscode.sentMessages, "commitComparison")).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: hash,
      baseRef: hash,
      compareRef: "HEAD"
    });
    expect(vscode.getState()?.expandedCommit?.comparison).toMatchObject({
      baseRef: hash,
      compareRef: "HEAD",
      baseLabel: refName,
      compareLabel: "HEAD"
    });

    receiveComparison(hash, [PLAIN_HASH, HEAD_HASH]);
    expect(headerText()).toBe(`Comparing ${refName} → HEAD`);
    expect(document.querySelector("#commitDetails .commitDetailsFirstParentNote")).toBeNull();
  });

  it("shows a commit compared with HEAD by its abbreviated hash", async () => {
    await bootGraph();
    graphRow(PLAIN_HASH).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Compare with HEAD");
    receiveComparison(PLAIN_HASH);
    expect(headerText()).toBe("Comparing dddddddd → HEAD");
  });

  it("shows two selected commits by abbreviated hashes, older first", async () => {
    await bootGraph();
    for (const hash of [BRANCH_HASH, PLAIN_HASH]) {
      graphRow(hash).dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    }
    graphRow(BRANCH_HASH).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Compare Selected Commits");
    receiveComparison(BRANCH_HASH);
    expect(headerText()).toBe("Comparing dddddddd → bbbbbbbb");
  });

  it("swaps a comparison, exchanging refs and labels", async () => {
    const vscode = await bootGraph();
    document
      .querySelector('.gitRef[data-name="feature/old"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Compare with HEAD");
    receiveComparison(BRANCH_HASH);
    expect(headerText()).toBe("Comparing feature/old → HEAD");

    document.querySelector<HTMLButtonElement>(".commitDetailsComparisonSwap")?.click();

    expect(latestRequest(vscode.sentMessages, "commitComparison")).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: BRANCH_HASH,
      baseRef: "HEAD",
      compareRef: BRANCH_HASH
    });
    expect(vscode.getState()?.expandedCommit?.comparison).toMatchObject({
      baseRef: "HEAD",
      compareRef: BRANCH_HASH,
      baseLabel: "HEAD",
      compareLabel: "feature/old"
    });

    receiveComparison(BRANCH_HASH);
    expect(headerText()).toBe("Comparing HEAD → feature/old");
  });

  it("carries the comparison labels into a file diff", async () => {
    const vscode = await bootGraph();
    document
      .querySelector('.gitRef[data-name="feature/old"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Compare with HEAD");
    receiveComparison(BRANCH_HASH);

    document.querySelector<HTMLElement>("#commitDetails .gitFile")?.click();

    expect(latestRequest(vscode.sentMessages, "viewDiff")).toMatchObject({
      command: "viewDiff",
      commitHash: BRANCH_HASH,
      oldRef: "feature/old",
      newRef: "HEAD"
    });
  });

  it("shows no header for plain commit details", async () => {
    await bootGraph();
    graphRow(PLAIN_HASH).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "commitDetails",
      commitDetails: { ...commitDetails, hash: PLAIN_HASH, parents: [] },
      error: null
    });
    expect(document.querySelector("#commitDetails")).not.toBeNull();
    expect(headerText()).toBeUndefined();
  });
});
