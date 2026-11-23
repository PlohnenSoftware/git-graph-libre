import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { tabIconPaths } from "@/extension/tabIcon";

vi.mock("vscode", () => ({
  Uri: { file: (fsPath: string) => ({ fsPath }) }
}));

const EXTENSION = path.join("/", "extension");
const resource = (name: string) => ({ fsPath: path.join(EXTENSION, "resources", name) });

describe("tabIconPaths", () => {
  it("returns the color light/dark pair for the color variant", () => {
    expect(tabIconPaths(EXTENSION, "color")).toEqual({
      light: resource("webview-icon-color-light.svg"),
      dark: resource("webview-icon-color-dark.svg")
    });
  });

  it("returns the grey light/dark pair for the grey variant", () => {
    expect(tabIconPaths(EXTENSION, "grey")).toEqual({
      light: resource("webview-icon-grey-light.svg"),
      dark: resource("webview-icon-grey-dark.svg")
    });
  });
});
