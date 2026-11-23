import type * as vscode from "vscode";

import { buildExtensionUri } from "@/backend/utils/path";

/**
 * The two icon variants of the tab icon, named after the `tabIconColorTheme`
 * setting values, which double as the filename segment.
 */
export type TabIconVariant = "color" | "grey";

/**
 * The light and dark icon files every Git Graph Libre tab uses, so the graph,
 * Diff, Reflog and Blame tabs show the same icon. The grey variant has to
 * invert to stay legible; the color variant keeps its graph hues but greys
 * the bird to suit the background.
 */
export function tabIconPaths(
  extensionPath: string,
  variant: TabIconVariant
): { light: vscode.Uri; dark: vscode.Uri } {
  return {
    light: buildExtensionUri(extensionPath, "resources", `webview-icon-${variant}-light.svg`),
    dark: buildExtensionUri(extensionPath, "resources", `webview-icon-${variant}-dark.svg`)
  };
}
