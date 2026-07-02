import { describe, expect, it } from "vitest";

import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildWebviewToolbar } from "@/extension/webviewToolbar";

function renderToolbar(strings = getWebviewLocalizedStrings()) {
  document.body.innerHTML = buildWebviewToolbar(strings);
}

describe("buildWebviewToolbar", () => {
  it("renders the stable controls expected by the webview runtime", () => {
    renderToolbar();

    const controls = document.getElementById("controls");
    expect(controls?.tagName).toBe("HEADER");
    expect(controls?.getAttribute("role")).toBe("toolbar");
    expect(controls?.getAttribute("aria-label")).toBe("Git Graph controls");

    expect(document.getElementById("repoControl")).not.toBeNull();
    expect(document.getElementById("repoSelect")?.classList.contains("dropdown")).toBe(true);
    expect(document.getElementById("branchControl")).not.toBeNull();
    expect(document.getElementById("branchSelect")?.classList.contains("dropdown")).toBe(true);

    const showRemoteBranches = document.getElementById(
      "showRemoteBranchesCheckbox"
    ) as HTMLInputElement | null;
    expect(showRemoteBranches?.checked).toBe(true);

    const findControl = document.getElementById("findControl") as HTMLElement | null;
    expect(findControl?.hidden).toBe(true);
    expect(document.getElementById("findInput")?.getAttribute("aria-label")).toBe("Find commits");
    expect(document.getElementById("findInput")?.getAttribute("placeholder")).toBe("Find commits");
    expect(document.getElementById("findMatchCount")?.getAttribute("aria-live")).toBe("polite");

    const find = document.getElementById("findBtn") as HTMLButtonElement | null;
    expect(find?.tagName).toBe("BUTTON");
    expect(find?.type).toBe("button");
    expect(find?.getAttribute("aria-label")).toBe("Find commits");
    expect(find?.textContent).toContain("⌕");

    const findPrevious = document.getElementById("findPreviousBtn") as HTMLButtonElement | null;
    expect(findPrevious?.tagName).toBe("BUTTON");
    expect(findPrevious?.getAttribute("aria-label")).toBe("Previous match");

    const findNext = document.getElementById("findNextBtn") as HTMLButtonElement | null;
    expect(findNext?.tagName).toBe("BUTTON");
    expect(findNext?.getAttribute("aria-label")).toBe("Next match");

    const findClear = document.getElementById("findClearBtn") as HTMLButtonElement | null;
    expect(findClear?.tagName).toBe("BUTTON");
    expect(findClear?.getAttribute("aria-label")).toBe("Clear find");

    const locateHead = document.getElementById("blinkHeadBtn") as HTMLButtonElement | null;
    expect(locateHead?.tagName).toBe("BUTTON");
    expect(locateHead?.type).toBe("button");
    expect(locateHead?.getAttribute("aria-label")).toBe("Locate HEAD");
    expect(locateHead?.textContent).toContain("⌖");

    const refresh = document.getElementById("refreshBtn") as HTMLButtonElement | null;
    expect(refresh?.tagName).toBe("BUTTON");
    expect(refresh?.type).toBe("button");
    expect(refresh?.getAttribute("aria-label")).toBe("Refresh");
    expect(refresh?.textContent).toContain("↻");
  });

  it("escapes localized labels before embedding them in toolbar markup", () => {
    renderToolbar({
      ...getWebviewLocalizedStrings(),
      toolbar: 'Controls <script>alert("x")</script>',
      repo: "Repo <bad>",
      branch: 'Branch "quoted"',
      findCommits: "Find <commits>",
      findCommitsPlaceholder: 'Find "query"',
      findPrevious: "Previous <match>",
      findNext: 'Next "match"',
      findClear: "Clear <find>",
      locateHead: "Locate <HEAD>",
      refresh: 'Refresh "now"'
    });

    expect(document.querySelector("script")).toBeNull();
    expect(document.getElementById("controls")?.getAttribute("aria-label")).toBe(
      'Controls <script>alert("x")</script>'
    );
    expect(document.getElementById("repoControl")?.textContent).toContain("Repo <bad>");
    expect(document.getElementById("branchControl")?.textContent).toContain('Branch "quoted"');
    expect(document.getElementById("findInput")?.getAttribute("aria-label")).toBe("Find <commits>");
    expect(document.getElementById("findInput")?.getAttribute("placeholder")).toBe('Find "query"');
    expect(document.getElementById("findPreviousBtn")?.getAttribute("aria-label")).toBe(
      "Previous <match>"
    );
    expect(document.getElementById("findNextBtn")?.getAttribute("title")).toBe('Next "match"');
    expect(document.getElementById("findClearBtn")?.getAttribute("aria-label")).toBe(
      "Clear <find>"
    );
    expect(document.getElementById("blinkHeadBtn")?.getAttribute("aria-label")).toBe(
      "Locate <HEAD>"
    );
    expect(document.getElementById("refreshBtn")?.getAttribute("title")).toBe('Refresh "now"');
  });
});
