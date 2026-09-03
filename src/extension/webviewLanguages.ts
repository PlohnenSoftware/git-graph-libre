/**
 * Building the webview's strings in a language other than the editor's.
 *
 * VS Code's own `l10n.t()` is bound to the display language and cannot be
 * asked for a different one, so a temporary language switch has to read the
 * shipped bundles directly. That is all this module does: turn a locale id
 * into a `translate(key)` function `getWebviewLocalizedStrings()` can consume.
 *
 * English is always loaded as the fallback, so a bundle that is missing a key
 * degrades to English rather than to the raw key.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_LANGUAGE, listBundleLanguages } from "@/telemetry/language";

/** A language the webview can be switched to. */
export type WebviewLanguage = {
  /** Locale id as VS Code names it, e.g. `zh-cn`. */
  id: string;
  /** English name. The switcher is English-only by design; see its section
   * in the knowledge base. */
  label: string;
};

/**
 * English names for the locales this project ships. An id with no entry falls
 * back to the id itself, so adding a bundle cannot break the switcher — it
 * just shows up unprettified until a name is added here.
 */
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  nl: "Dutch",
  pl: "Polish",
  "zh-cn": "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)"
};

function bundlePath(extensionPath: string, language: string): string {
  const file = language === DEFAULT_LANGUAGE ? "bundle.l10n.json" : `bundle.l10n.${language}.json`;
  return path.join(extensionPath, "l10n", file);
}

function readBundle(extensionPath: string, language: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(bundlePath(extensionPath, language), "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    // A missing or damaged bundle must not take the graph down with it; the
    // English fallback below still produces a usable interface.
    return {};
  }
}

/** The languages the switcher offers, in a stable order with English first. */
export function listWebviewLanguages(extensionPath: string): WebviewLanguage[] {
  const ids = listBundleLanguages(extensionPath);
  const ordered = [
    DEFAULT_LANGUAGE,
    ...ids.filter((id) => id !== DEFAULT_LANGUAGE).sort((a, b) => a.localeCompare(b))
  ];
  return ordered.map((id) => ({ id, label: LANGUAGE_LABELS[id] ?? id }));
}

/**
 * Builds a `translate(key)` for one language, falling back to English and then
 * to the key itself — the same order `l10n.t()` degrades in, so a switched
 * webview never looks more broken than an unswitched one.
 */
export function createBundleTranslator(
  extensionPath: string,
  language: string
): (key: string) => string {
  const english = readBundle(extensionPath, DEFAULT_LANGUAGE);
  const target = language === DEFAULT_LANGUAGE ? english : readBundle(extensionPath, language);

  return (key: string) => target[key] ?? english[key] ?? key;
}
