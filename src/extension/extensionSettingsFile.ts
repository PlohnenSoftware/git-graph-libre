import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

import * as l10n from "@/l10n";
import type { JsonValue } from "@/types";

import {
  applyExtensionSettings,
  explicitExtensionSettings,
  loadExtensionSettings,
  sanitizeImportedExtensionSettings
} from "./extensionSettings";

export const EXTENSION_SETTINGS_KIND = "git-graph-libre.extension-settings";

type ExportedExtensionSettings = {
  kind: typeof EXTENSION_SETTINGS_KIND;
  version: 1;
  settings: Record<string, JsonValue>;
};

export async function exportExtensionSettingsFile(extensionPath: string) {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(os.homedir(), "git-graph-libre.settings.json")),
    saveLabel: l10n.t("settings.exportExtensionSettings"),
    filters: {
      [l10n.t("dialog.jsonFileFilter")]: ["json"]
    }
  });
  if (uri === undefined) return null;

  const payload: ExportedExtensionSettings = {
    kind: EXTENSION_SETTINGS_KIND,
    version: 1,
    settings: explicitExtensionSettings(extensionPath)
  };
  await fs.writeFile(uri.fsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return uri.fsPath;
}

export async function importExtensionSettingsFile(extensionPath: string) {
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    openLabel: l10n.t("settings.importExtensionSettings"),
    filters: {
      [l10n.t("dialog.jsonFileFilter")]: ["json"]
    }
  });
  const uri = uris?.[0];
  if (uri === undefined) {
    return { settings: loadExtensionSettings(extensionPath), importedKeys: [], skippedKeys: [] };
  }

  const raw = await fs.readFile(uri.fsPath, "utf8");
  const parsed = parseExportedExtensionSettings(JSON.parse(raw));
  const { accepted, skippedKeys } = sanitizeImportedExtensionSettings(
    extensionPath,
    parsed.settings
  );
  const importedKeys = Object.keys(accepted);
  if (importedKeys.length === 0) {
    return { settings: loadExtensionSettings(extensionPath), importedKeys, skippedKeys };
  }

  const applyLabel = l10n.t("settings.applyExtensionSettingsImport");
  const confirmed = await vscode.window.showWarningMessage(
    l10n.t(
      "dialog.importExtensionSettings.confirm",
      importedKeys.slice(0, 12).join(", "),
      importedKeys.length
    ),
    { modal: true },
    applyLabel
  );
  if (confirmed !== applyLabel) {
    return { settings: loadExtensionSettings(extensionPath), importedKeys: [], skippedKeys };
  }

  await applyExtensionSettings(accepted);
  return { settings: loadExtensionSettings(extensionPath), importedKeys, skippedKeys };
}

export function parseExportedExtensionSettings(value: unknown): ExportedExtensionSettings {
  if (!isRecord(value)) throw new Error(l10n.t("error.invalidExtensionSettingsFile"));
  if (value.kind !== EXTENSION_SETTINGS_KIND || value.version !== 1) {
    throw new Error(l10n.t("error.invalidExtensionSettingsFile"));
  }
  if (!isRecord(value.settings)) throw new Error(l10n.t("error.invalidExtensionSettingsFile"));
  return {
    kind: EXTENSION_SETTINGS_KIND,
    version: 1,
    settings: value.settings as Record<string, JsonValue>
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
