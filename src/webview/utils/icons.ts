import { octicon } from "@/octicons";

// Shared inline-SVG icons for the webview. All icons are octicons rendered
// through the generated `@/octicons` module, except `loading`, which reuses
// the sync octicon and is animated by CSS (octicons has no spinner icon).
export const svgIcons = {
  alert: octicon("alert"),
  branch: octicon("git-branch"),
  copy: octicon("copy", "fileActionIcon copyIcon"),
  info: octicon("info"),
  tag: octicon("tag"),
  verified: octicon("verified", "signedTagIcon"),
  signedTag: octicon("verified", "signedTagIcon"),
  loading: octicon("sync"),
  openFolder: octicon("file-directory-open-fill", "openFolderIcon"),
  closedFolder: octicon("file-directory-fill", "closedFolderIcon"),
  file: octicon("file", "fileIcon"),
  openFile: octicon("link-external", "fileActionIcon openFileIcon")
};
