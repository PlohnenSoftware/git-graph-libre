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
      locateHead: "Locate <HEAD>",
      refresh: 'Refresh "now"'
    });

    expect(document.querySelector("script")).toBeNull();
    expect(document.getElementById("controls")?.getAttribute("aria-label")).toBe(
      'Controls <script>alert("x")</script>'
    );
    expect(document.getElementById("repoControl")?.textContent).toContain("Repo <bad>");
    expect(document.getElementById("branchControl")?.textContent).toContain('Branch "quoted"');
    expect(document.getElementById("blinkHeadBtn")?.getAttribute("aria-label")).toBe(
      "Locate <HEAD>"
    );
    expect(document.getElementById("refreshBtn")?.getAttribute("title")).toBe('Refresh "now"');
  });
});
