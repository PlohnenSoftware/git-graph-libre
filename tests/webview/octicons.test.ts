import { describe, expect, it } from "vitest";

import { octicon } from "@/octicons";
import { svgIcons } from "@/webview/utils/icons";

describe("octicon", () => {
  it("renders a 16px inline svg that inherits the surrounding color", () => {
    document.body.innerHTML = octicon("search");

    const svg = document.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("octicon octicon-search");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("appends extra class names after the octicon classes", () => {
    document.body.innerHTML = octicon("copy", "fileActionIcon copyIcon");

    const svg = document.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("octicon octicon-copy fileActionIcon copyIcon");
  });
});

describe("svgIcons", () => {
  it("keeps the class names the stylesheet targets on file-tree icons", () => {
    document.body.innerHTML =
      svgIcons.openFolder + svgIcons.closedFolder + svgIcons.file + svgIcons.openFile;

    expect(document.querySelector("svg.openFolderIcon")).not.toBeNull();
    expect(document.querySelector("svg.closedFolderIcon")).not.toBeNull();
    expect(document.querySelector("svg.fileIcon")).not.toBeNull();
    expect(document.querySelector("svg.openFileIcon.fileActionIcon")).not.toBeNull();
  });

  it("provides inline svg markup for every icon", () => {
    for (const markup of Object.values(svgIcons)) {
      expect(markup).toContain("<svg");
      expect(markup).toContain("</svg>");
    }
  });
});
