import * as assert from "node:assert";

import * as vscode from "vscode";

import { config } from "@/config";

/**
 * Reads the two dialog-default settings through *real* VS Code configuration
 * rather than a mock, so a key that the manifest and the accessor spell
 * differently — or a value that never reaches the accessor — fails here.
 * The jsdom suites prove the webview honors what it is handed; this proves the
 * host hands it the stored value.
 */
suite("no-fast-forward dialog defaults", () => {
  const section = "git-graph-libre";
  const mergeKey = "dialog.merge.noFastForward";
  const pullKey = "dialog.pullBranch.noFastForward";

  async function reset() {
    const settings = vscode.workspace.getConfiguration(section);
    await settings.update(mergeKey, undefined, vscode.ConfigurationTarget.Global);
    await settings.update(pullKey, undefined, vscode.ConfigurationTarget.Global);
  }

  suiteSetup(reset);
  teardown(reset);

  test("reads the manifest defaults when nothing is stored", () => {
    assert.strictEqual(config.mergeNoFastForward(), true);
    assert.strictEqual(config.pullBranchNoFastForward(), false);
  });

  test("reads a stored value back, in both directions", async () => {
    await vscode.workspace
      .getConfiguration(section)
      .update(mergeKey, false, vscode.ConfigurationTarget.Global);
    await vscode.workspace
      .getConfiguration(section)
      .update(pullKey, true, vscode.ConfigurationTarget.Global);

    assert.strictEqual(config.mergeNoFastForward(), false, "merge default should follow the store");
    assert.strictEqual(config.pullBranchNoFastForward(), true, "pull default should follow it too");
  });

  test("the settings the manifest contributes are the ones the accessors read", () => {
    const inspected = vscode.workspace.getConfiguration(section).inspect(mergeKey);
    assert.ok(inspected !== undefined, `${section}.${mergeKey} is not a contributed setting`);
    assert.strictEqual(inspected?.defaultValue, true);

    const pullInspected = vscode.workspace.getConfiguration(section).inspect(pullKey);
    assert.ok(pullInspected !== undefined, `${section}.${pullKey} is not a contributed setting`);
    assert.strictEqual(pullInspected?.defaultValue, false);
  });
});
