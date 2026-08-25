import * as assert from "node:assert";

import * as vscode from "vscode";

suite("GitGraphPanel", () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension("PlohnenSoftware.git-graph-libre");
    await ext?.activate();
  });

  setup(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await new Promise((r) => setTimeout(r, 200));
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  function isPanelOpen() {
    return vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .some((t) => t.label === "Git Graph Libre");
  }

  async function openPanel() {
    await vscode.commands.executeCommand("git-graph-libre.view");
    const deadline = Date.now() + 2000;
    while (!isPanelOpen() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50)); // eslint-disable-line no-await-in-loop
    }
  }

  test("view command opens the panel", async () => {
    await openPanel();
    assert.ok(isPanelOpen(), "Panel should be visible after executing view command");
  });

  test("running view command a second time reveals rather than opening a new tab", async () => {
    await openPanel();
    assert.ok(isPanelOpen());

    const tabsBefore = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;
    await vscode.commands.executeCommand("git-graph-libre.view");
    await new Promise((r) => setTimeout(r, 300));
    const tabsAfter = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;

    assert.strictEqual(tabsAfter, tabsBefore, "Second invocation should not open a new tab");
  });

  test("closing the panel and running view command opens a fresh panel", async () => {
    await openPanel();
    assert.ok(isPanelOpen());

    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(!isPanelOpen(), "Panel should be closed");

    await openPanel();
    assert.ok(isPanelOpen(), "Panel should reopen after running view command again");
  });

  test("panel is created with retainContextWhenHidden for instant tab restore", async () => {
    const original = vscode.window.createWebviewPanel;
    const createOptions: Array<vscode.WebviewPanelOptions & vscode.WebviewOptions> = [];
    vscode.window.createWebviewPanel = ((viewType, title, showOptions, options) => {
      createOptions.push(options ?? {});
      return original.call(vscode.window, viewType, title, showOptions, options);
    }) as typeof vscode.window.createWebviewPanel;
    try {
      await openPanel();
    } finally {
      vscode.window.createWebviewPanel = original;
    }

    assert.ok(createOptions.length > 0, "Panel creation should have been observed");
    assert.ok(
      createOptions.some((options) => options.retainContextWhenHidden === true),
      "Panel should retain its webview context while hidden"
    );
  });
});
