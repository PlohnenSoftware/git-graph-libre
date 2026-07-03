import * as fs from "node:fs";
import * as path from "node:path";

import {
  configurationGlobalValues,
  env as vscodeEnv,
  openDialogResults,
  resetVscodeMock,
  setConfigurationValue,
  warningMessageResults
} from "@tests/webview/__mocks__/vscode";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyExtensionSettings,
  explicitExtensionSettings,
  loadExtensionSettings,
  sanitizeImportedExtensionSettings,
  updateExtensionSetting
} from "@/extension/extensionSettings";
import {
  importExtensionSettingsFile,
  parseExportedExtensionSettings
} from "@/extension/extensionSettingsFile";

const extensionPath = process.cwd();

describe("extension settings helpers", () => {
  beforeEach(() => {
    resetVscodeMock();
    vscodeEnv.language = "en";
  });

  it("loads every contributed git-graph-libre setting with localized descriptions and scopes", () => {
    setConfigurationValue("git-graph-libre", "graph.fontSize", 16, "workspace");
    const settings = loadExtensionSettings(extensionPath);
    const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, "package.json"), "utf8"));
    const manifestKeys = Object.keys(
      manifest.contributes.configuration.properties as Record<string, unknown>
    ).filter((key) => key.startsWith("git-graph-libre."));

    expect(settings.map((setting) => setting.key).sort()).toEqual(manifestKeys.sort());
    expect(
      settings.find((setting) => setting.key === "git-graph-libre.graph.fontSize")
    ).toMatchObject({
      value: 16,
      scope: "workspace",
      type: "number",
      minimum: 8,
      maximum: 24
    });
    expect(settings.find((setting) => setting.key === "git-graph-libre.dateType")).toMatchObject({
      enum: ["Author Date", "Commit Date"],
      enumDescriptions: ["Use the author date of a commit", "Use the committer date of a commit"]
    });
  });

  it("falls back to base package nls records when a locale file is missing", () => {
    vscodeEnv.language = "fr";

    expect(
      loadExtensionSettings(extensionPath).find(
        (setting) => setting.key === "git-graph-libre.dateType"
      )
    ).toMatchObject({
      description: "Specifies the date type to be displayed throughout Git Graph."
    });
  });

  it("sanitizes imports and clamps bounded numeric settings", async () => {
    const sanitized = sanitizeImportedExtensionSettings(extensionPath, {
      "git-graph-libre.graph.fontSize": 99,
      "git-graph-libre.repository.showTags": "bad",
      "git-graph-libre.unknown": true
    });

    expect(sanitized).toEqual({
      accepted: { "git-graph-libre.graph.fontSize": 24 },
      skippedKeys: ["git-graph-libre.repository.showTags", "git-graph-libre.unknown"]
    });

    await updateExtensionSetting(extensionPath, "git-graph-libre.graph.fontSize", 2);
    expect(configurationGlobalValues.get("git-graph-libre.graph.fontSize")).toBe(8);
    await expect(
      updateExtensionSetting(extensionPath, "git-graph-libre.unknown", true)
    ).rejects.toThrow("Unknown setting");
  });

  it("accepts valid imported values and skips invalid values by manifest type", () => {
    const accepted = sanitizeImportedExtensionSettings(extensionPath, {
      "git-graph-libre.repository.showTags": false,
      "git-graph-libre.dateType": "Commit Date",
      "git-graph-libre.revealHighlightColor": "oklch(87.44% 0.2383 150 / 0.5)",
      "git-graph-libre.graphColors": ["oklch(63% 0.2 245)"],
      "git-graph-libre.contextMenuActionsVisibility": { branch: { checkout: false } },
      "git-graph-libre.customBranchGlobPatterns": [
        { name: "Features", glob: "--glob=heads/feature/*" }
      ]
    });
    const rejected = sanitizeImportedExtensionSettings(extensionPath, {
      "git-graph-libre.graph.fontSize": "bad",
      "git-graph-libre.graphStyle": "bad",
      "git-graph-libre.revealHighlightColor": "blue",
      "git-graph-libre.graphColors.invalid": ["not a setting"],
      "git-graph-libre.graphColors": ["bad color"],
      "git-graph-libre.contextMenuActionsVisibility": null
    });

    expect(accepted.accepted).toMatchObject({
      "git-graph-libre.repository.showTags": false,
      "git-graph-libre.dateType": "Commit Date",
      "git-graph-libre.revealHighlightColor": "oklch(87.44% 0.2383 150 / 0.5)",
      "git-graph-libre.graphColors": ["oklch(63% 0.2 245)"],
      "git-graph-libre.contextMenuActionsVisibility": { branch: { checkout: false } },
      "git-graph-libre.customBranchGlobPatterns": [
        { name: "Features", glob: "--glob=heads/feature/*" }
      ]
    });
    expect(rejected.skippedKeys).toContain("git-graph-libre.graphStyle");
    expect(rejected.skippedKeys).toContain("git-graph-libre.revealHighlightColor");
    expect(rejected.skippedKeys).toContain("git-graph-libre.graph.fontSize");
    expect(rejected.skippedKeys).toContain("git-graph-libre.graphColors.invalid");
    expect(rejected.skippedKeys).toContain("git-graph-libre.graphColors");
    expect(rejected.skippedKeys).toContain("git-graph-libre.contextMenuActionsVisibility");
  });

  it("exports only explicitly configured settings and applies imported settings globally", async () => {
    setConfigurationValue("git-graph-libre", "graph.fontSize", 15, "global");
    setConfigurationValue("git-graph-libre", "graph.rowHeight", 26, "workspaceFolder");

    expect(explicitExtensionSettings(extensionPath)).toEqual({
      "git-graph-libre.graph.fontSize": 15,
      "git-graph-libre.graph.rowHeight": 26
    });

    await applyExtensionSettings({
      "git-graph-libre.graph.rowHeight": 30,
      "git-graph-libre.repository.showTags": false
    });
    expect(configurationGlobalValues.get("git-graph-libre.graph.rowHeight")).toBe(30);
    expect(configurationGlobalValues.get("git-graph-libre.repository.showTags")).toBe(false);
  });

  it("rejects invalid extension settings files and treats canceled imports as no-ops", async () => {
    expect(() => parseExportedExtensionSettings({ version: 1, settings: {} })).toThrow(
      "valid Git Graph Libre extension settings file"
    );

    openDialogResults.push(undefined);
    await expect(importExtensionSettingsFile(extensionPath)).resolves.toMatchObject({
      importedKeys: [],
      skippedKeys: []
    });
  });

  it("skips imports with no accepted keys and cancels confirmation without applying", async () => {
    const skippedPath = path.join(extensionPath, "tmp-skipped-extension-settings.json");
    const cancelPath = path.join(extensionPath, "tmp-cancel-extension-settings.json");
    try {
      fs.writeFileSync(
        skippedPath,
        JSON.stringify({
          kind: "git-graph-libre.extension-settings",
          version: 1,
          settings: { "git-graph-libre.unknown": true }
        })
      );
      openDialogResults.push([{ fsPath: skippedPath }]);
      await expect(importExtensionSettingsFile(extensionPath)).resolves.toMatchObject({
        importedKeys: [],
        skippedKeys: ["git-graph-libre.unknown"]
      });

      fs.writeFileSync(
        cancelPath,
        JSON.stringify({
          kind: "git-graph-libre.extension-settings",
          version: 1,
          settings: { "git-graph-libre.graph.fontSize": 19 }
        })
      );
      openDialogResults.push([{ fsPath: cancelPath }]);
      warningMessageResults.push(undefined);
      await expect(importExtensionSettingsFile(extensionPath)).resolves.toMatchObject({
        importedKeys: [],
        skippedKeys: []
      });
      expect(configurationGlobalValues.get("git-graph-libre.graph.fontSize")).toBeUndefined();
    } finally {
      fs.rmSync(skippedPath, { force: true });
      fs.rmSync(cancelPath, { force: true });
    }
  });
});
