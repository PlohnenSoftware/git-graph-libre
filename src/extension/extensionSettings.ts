import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import { DEFAULT_LANGUAGE, resolveBundleLanguage } from "@/telemetry/language";
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
  pattern?: string;
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

/**
 * The settings the hub lists, localized.
 *
 * `language` is the graph's *effective* language, which is not always VS
 * Code's: the temporary language switcher changes the webview without touching
 * the editor, and a list built from `vscode.env.language` would then be the
 * one part of the panel still in the old language. Omitted, it falls back to
 * the editor's own display language.
 */
export function loadExtensionSettings(
  extensionPath: string,
  language?: string
): ExtensionSetting[] {
  const settings = readManifestSettings(extensionPath);
  const packageNls = readPackageNls(extensionPath, language);
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
        title: packageNls[`config.${configKey}.title`] ?? configKey,
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
  value: JsonValue,
  language?: string
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
  return loadExtensionSettings(extensionPath, language);
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

const NLS_PREFIX = "package.nls.";
const NLS_SUFFIX = ".json";

/**
 * The locales this build actually ships a `package.nls` file for, read off
 * disk for the same reason `listBundleLanguages()` is: a hand-maintained list
 * silently goes stale the first time a language is added.
 */
function listPackageNlsLanguages(extensionPath: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(extensionPath);
  } catch {
    return [DEFAULT_LANGUAGE];
  }

  const languages = new Set<string>([DEFAULT_LANGUAGE]);
  for (const entry of entries) {
    if (!entry.startsWith(NLS_PREFIX) || !entry.endsWith(NLS_SUFFIX)) continue;
    const locale = entry.slice(NLS_PREFIX.length, -NLS_SUFFIX.length);
    if (locale !== "") languages.add(locale.toLowerCase());
  }
  return [...languages];
}

/**
 * English is always loaded underneath the localized file, so a bundle missing
 * a key degrades to English rather than to the raw placeholder. Resolution
 * goes through `resolveBundleLanguage()` rather than matching the display
 * language against a filename directly: that gives the exact-then-base-then-
 * English order VS Code itself uses, so a display language of `pt-br` finds a
 * `pt` file instead of silently falling all the way back to English.
 */
function readPackageNls(extensionPath: string, displayLanguage?: string) {
  const requested = displayLanguage ?? (vscode.env as { language?: string }).language ?? "";
  const language = resolveBundleLanguage(requested, listPackageNlsLanguages(extensionPath));
  const base = readJsonRecord(path.join(extensionPath, "package.nls.json"));
  if (language === DEFAULT_LANGUAGE) return base;
  return {
    ...base,
    ...readJsonRecord(path.join(extensionPath, `${NLS_PREFIX}${language}${NLS_SUFFIX}`))
  };
}

function readJsonRecord(filePath: string): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
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
  if (setting.pattern !== undefined && !new RegExp(setting.pattern).test(value)) {
    throw new TypeError(`${key} has an invalid value.`);
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
