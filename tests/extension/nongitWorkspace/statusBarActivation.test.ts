import * as assert from "node:assert";

import * as vscode from "vscode";

const EXTENSION_ID = "PlohnenSoftware.git-graph-libre";

// This suite runs in its own VS Code launch (see .vscode-test.mjs) whose
// workspace folder is tests/extension/fixtures/empty-workspace, which contains
// no .git anywhere beneath it, so neither workspaceContains activation event
// can fire. Only onStartupFinished can activate the extension there — the
// precondition for the watching-eye status bar item to exist in a non-Git
// folder (BUG-5). The VS Code API cannot inspect status bar items from tests,
// so the zero-repo eye rendering itself is locked by
// tests/backend/statusBarItem.test.ts; this suite locks the activation side.
suite("status bar in a non-Git workspace", function () {
  this.timeout(30000);

  test("extension activates on startup so the status bar item is created", async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    assert.ok(workspaceRoot, "this suite must run with a workspace folder open");

    let hasGitDir = true;
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspaceRoot, ".git"));
    } catch {
      hasGitDir = false;
    }
    assert.ok(!hasGitDir, "the fixture workspace must not be a Git repository");

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be loaded in the development host`);

    const deadline = Date.now() + 15000;
    while (!ext.isActive && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ext.isActive, "extension should activate via onStartupFinished without any .git");

    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("git-graph-libre.view"),
      "activate() should have reached command registration, which runs after StatusBarItem creation"
    );
  });
});
