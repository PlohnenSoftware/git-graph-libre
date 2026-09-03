/**
 * Which translation the user is actually reading.
 *
 * Two properties rather than one, because the interesting cases are the ones
 * where they differ: VS Code's display language is what the user *asked* for,
 * and the resolved bundle is what this extension could *give* them. A session
 * reporting `language: de` with `translation: en` is a request for German that
 * nobody has answered yet — which is the whole reason to collect this. One
 * property alone cannot express it.
 *
 * Pure and free of any `vscode` import, so the backend test project can load
 * it; the caller supplies both the display language and the bundle list.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { TelemetryEventPayload } from "./eventQueue";

/** The bundle shipped for every locale, and the fallback VS Code itself uses. */
export const DEFAULT_LANGUAGE = "en";

const BUNDLE_PREFIX = "bundle.l10n.";
const BUNDLE_SUFFIX = ".json";

/**
 * Lists the locales this build actually ships, read from the `l10n` directory
 * rather than a hand-maintained constant — a list that has to be updated by
 * hand is a list that silently goes stale the first time a language is added.
 *
 * `bundle.l10n.json` is English; `bundle.l10n.<locale>.json` is everything
 * else. Returns just the default on an unreadable directory: a damaged install
 * must not make telemetry the thing that fails.
 */
export function listBundleLanguages(extensionPath: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(path.join(extensionPath, "l10n"));
  } catch {
    return [DEFAULT_LANGUAGE];
  }

  const languages = new Set<string>([DEFAULT_LANGUAGE]);
  for (const entry of entries) {
    if (!entry.startsWith(BUNDLE_PREFIX) || !entry.endsWith(BUNDLE_SUFFIX)) continue;
    const locale = entry.slice(BUNDLE_PREFIX.length, -BUNDLE_SUFFIX.length);
    if (locale !== "") languages.add(locale.toLowerCase());
  }
  return [...languages].sort((a, b) => a.localeCompare(b));
}

/**
 * Maps a VS Code display language onto the bundle that will serve it.
 *
 * Mirrors how VS Code resolves `l10n` bundles: an exact match first, then the
 * base language (`pt-br` falls back to a `pt` bundle if one exists), then
 * English. Kept in step with that deliberately — a resolver that disagreed
 * with the runtime would report a translation the user is not seeing, which is
 * worse than reporting nothing.
 */
export function resolveBundleLanguage(
  displayLanguage: string,
  available: readonly string[]
): string {
  const requested = displayLanguage.trim().toLowerCase();
  if (requested === "") return DEFAULT_LANGUAGE;
  if (available.includes(requested)) return requested;

  const base = requested.split("-")[0];
  if (base !== requested && available.includes(base)) return base;

  return DEFAULT_LANGUAGE;
}

export type LanguageFacts = {
  /** `vscode.env.language`, e.g. `en`, `pl`, `zh-cn`, `de`. */
  displayLanguage: string;
  /** Locales this build ships, from `listBundleLanguages()`. */
  available: readonly string[];
};

/** The language properties added to the once-per-session `activate` event. */
export function buildLanguagePayload(facts: LanguageFacts): TelemetryEventPayload {
  return {
    language: facts.displayLanguage.trim().toLowerCase() || DEFAULT_LANGUAGE,
    translation: resolveBundleLanguage(facts.displayLanguage, facts.available)
  };
}
