import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import type {
  ExtensionSetting,
  ExtensionSettingScope,
  ExtensionSettingType,
  JsonValue
} from "@/types";

type ManifestSetting = {
  type: string;
  default: JsonValue;
  description?: string;
  markdownDescription?: string;
  enum?: string[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  items?: {
    pattern?: string;
  };
};

type PackageManifest = {
  contributes?: {
    configuration?: {
      properties?: Record<string, ManifestSetting>;
    };
  };
};

type ConfigInspection = {
  globalValue?: JsonValue;
  workspaceValue?: JsonValue;
  workspaceFolderValue?: JsonValue;
};

const configurationPrefix = "git-graph-libre";

export function loadExtensionSettings(extensionPath: string): ExtensionSetting[] {
  const settings = readManifestSettings(extensionPath);
  const packageNls = readPackageNls(extensionPath);
  const config = vscode.workspace.getConfiguration(configurationPrefix);

  return Object.entries(settings)
    .filter(([key]) => key.startsWith(`${configurationPrefix}.`))
    .map(([key, setting]) => {
      const configKey = key.slice(configurationPrefix.length + 1);
      const value = config.get<JsonValue>(configKey, setting.default);
      const inspection = config.inspect<JsonValue>(configKey) as ConfigInspection | undefined;
      return {
        key,
        configKey,
        title: configKey,
        description: resolvePackageText(
          setting.markdownDescription ?? setting.description ?? "",
          packageNls
        ),
        type: normalizeSettingType(setting.type),
        value,
        defaultValue: setting.default,
        scope: settingScope(inspection),
        ...(setting.enum === undefined ? {} : { enum: setting.enum }),
        ...(setting.enumDescriptions === undefined
          ? {}
          : {
              enumDescriptions: setting.enumDescriptions.map((text) =>
                resolvePackageText(text, packageNls)
              )
            }),
        ...(setting.minimum === undefined ? {} : { minimum: setting.minimum }),
        ...(setting.maximum === undefined ? {} : { maximum: setting.maximum })
      };
    });
}

export async function updateExtensionSetting(
  extensionPath: string,
  key: string,
  value: JsonValue
): Promise<ExtensionSetting[]> {
  const settings = readManifestSettings(extensionPath);
  const setting = settings[key];
  if (setting === undefined || !key.startsWith(`${configurationPrefix}.`)) {
    throw new Error(`Unknown setting: ${key}`);
  }

  const configKey = key.slice(configurationPrefix.length + 1);
  const sanitized = sanitizeSettingValue(key, setting, value);
  await vscode.workspace
    .getConfiguration(configurationPrefix)
    .update(configKey, sanitized, vscode.ConfigurationTarget.Global);
  return loadExtensionSettings(extensionPath);
}

export function explicitExtensionSettings(extensionPath: string): Record<string, JsonValue> {
  const settings = readManifestSettings(extensionPath);
  const config = vscode.workspace.getConfiguration(configurationPrefix);
  const exported: Record<string, JsonValue> = {};

  for (const key of Object.keys(settings)) {
    if (!key.startsWith(`${configurationPrefix}.`)) continue;
    const configKey = key.slice(configurationPrefix.length + 1);
    const inspection = config.inspect<JsonValue>(configKey) as ConfigInspection | undefined;
    const value =
      inspection?.workspaceFolderValue ?? inspection?.workspaceValue ?? inspection?.globalValue;
    if (value !== undefined) exported[key] = value;
  }

  return exported;
}

export function sanitizeImportedExtensionSettings(
  extensionPath: string,
  settings: Record<string, unknown>
) {
  const manifestSettings = readManifestSettings(extensionPath);
  const accepted: Record<string, JsonValue> = {};
  const skippedKeys: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    const setting = manifestSettings[key];
    if (setting === undefined || !key.startsWith(`${configurationPrefix}.`)) {
      skippedKeys.push(key);
      continue;
    }

    try {
      accepted[key] = sanitizeSettingValue(key, setting, value);
    } catch {
      skippedKeys.push(key);
    }
  }

  return { accepted, skippedKeys };
}

export async function applyExtensionSettings(settings: Record<string, JsonValue>) {
  const config = vscode.workspace.getConfiguration(configurationPrefix);
  for (const [key, value] of Object.entries(settings)) {
    const configKey = key.slice(configurationPrefix.length + 1);
    await config.update(configKey, value, vscode.ConfigurationTarget.Global);
  }
}

function readManifestSettings(extensionPath: string) {
  const manifestPath = path.join(extensionPath, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PackageManifest;
  return manifest.contributes?.configuration?.properties ?? {};
}

function readPackageNls(extensionPath: string) {
  const language = normalizeLanguage((vscode.env as { language?: string }).language);
  const localizedPath =
    language === null ? null : path.join(extensionPath, `package.nls.${language}.json`);
  const basePath = path.join(extensionPath, "package.nls.json");
  return {
    ...readJsonRecord(basePath),
    ...(localizedPath === null ? {} : readJsonRecord(localizedPath))
  };
}

function readJsonRecord(filePath: string): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function normalizeLanguage(language: string | undefined) {
  if (language === undefined || language === "" || language === "en") return null;
  return language.toLowerCase();
}

function resolvePackageText(text: string, packageNls: Record<string, string>) {
  const match = /^%(.+)%$/.exec(text);
  if (match === null) return text;
  return packageNls[match[1]] ?? text;
}

function normalizeSettingType(type: string): ExtensionSettingType {
  if (type === "boolean" || type === "number" || type === "string" || type === "array") {
    return type;
  }
  return "object";
}

function settingScope(inspection: ConfigInspection | undefined): ExtensionSettingScope {
  if (inspection?.workspaceFolderValue !== undefined) return "workspaceFolder";
  if (inspection?.workspaceValue !== undefined) return "workspace";
  if (inspection?.globalValue !== undefined) return "global";
  return "default";
}

function sanitizeSettingValue(key: string, setting: ManifestSetting, value: unknown): JsonValue {
  const type = normalizeSettingType(setting.type);
  if (type === "boolean") return expectBoolean(key, value);
  if (type === "number") return clampNumber(key, setting, value);
  if (type === "string") return expectString(key, setting, value);
  if (type === "array") return expectArray(key, setting, value);
  return expectObject(key, value);
}

function expectBoolean(key: string, value: unknown): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${key} must be a boolean.`);
  return value;
}

function clampNumber(key: string, setting: ManifestSetting, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${key} must be a number.`);
  }
  const minimum = setting.minimum ?? Number.NEGATIVE_INFINITY;
  const maximum = setting.maximum ?? Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(minimum, value));
}

function expectString(key: string, setting: ManifestSetting, value: unknown): string {
  if (typeof value !== "string") throw new TypeError(`${key} must be a string.`);
  if (setting.enum !== undefined && !setting.enum.includes(value)) {
    throw new Error(`${key} must be one of: ${setting.enum.join(", ")}.`);
  }
  return value;
}

function expectArray(key: string, setting: ManifestSetting, value: unknown): JsonValue[] {
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array.`);
  const pattern = setting.items?.pattern === undefined ? null : new RegExp(setting.items.pattern);
  if (pattern !== null) {
    for (const item of value) {
      if (typeof item !== "string" || !pattern.test(item)) {
        throw new TypeError(`${key} contains an invalid value.`);
      }
    }
  }
  return value as JsonValue[];
}

function expectObject(key: string, value: unknown): { [key: string]: JsonValue } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${key} must be an object.`);
  }
  return value as { [key: string]: JsonValue };
}
