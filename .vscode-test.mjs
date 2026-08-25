import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
  {
    label: "git-workspace",
    files: "tests/out/extension/tests/extension/*.test.js",
    workspaceFolder: ".",
    version: "stable"
  },
  {
    // Separate launch whose workspace has no .git, so only onStartupFinished
    // can activate the extension — the precondition for the watching-eye
    // status bar item (see tests/extension/nongitWorkspace/).
    label: "non-git-workspace",
    files: "tests/out/extension/tests/extension/nongitWorkspace/*.test.js",
    workspaceFolder: "tests/extension/fixtures/empty-workspace",
    version: "stable"
  }
]);
