import { readFileSync } from "node:fs";
import { join } from "node:path";

// Webview stylesheets in the order their link tags appear in webviewHtml.ts.
// Keep this list in sync with the link order there: the cascade depends on it.
const WEBVIEW_CSS_FILES = [
  "tokens.css",
  "base.css",
  "table.css",
  "commit-details.css",
  "refs.css",
  "toolbar.css",
  "settings.css",
  "dialogs.css"
] as const;

export function readWebviewCss(): string {
  return WEBVIEW_CSS_FILES.map((file) =>
    readFileSync(join(process.cwd(), "media", file), "utf8")
  ).join("\n");
}

export function readDropdownCss(): string {
  return readFileSync(join(process.cwd(), "media", "dropdown.css"), "utf8");
}
