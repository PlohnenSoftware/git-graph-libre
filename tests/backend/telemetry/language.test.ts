import { describe, expect, it } from "vitest";

import {
  buildLanguagePayload,
  DEFAULT_LANGUAGE,
  listBundleLanguages,
  resolveBundleLanguage
} from "@/telemetry/language";

describe("listBundleLanguages", () => {
  // Read from disk rather than a constant, so adding a language cannot leave
  // the reported list behind.
  it("lists the locales this build actually ships", () => {
    expect(listBundleLanguages(process.cwd())).toEqual(["en", "nl", "pl", "zh-cn", "zh-tw"]);
  });

  // A damaged install must not make telemetry the thing that fails.
  it("falls back to English when the directory is unreadable", () => {
    expect(listBundleLanguages("/nonexistent-extension-path")).toEqual([DEFAULT_LANGUAGE]);
  });
});

describe("resolveBundleLanguage", () => {
  const available = ["en", "nl", "pl", "zh-cn", "zh-tw"];

  it("takes an exact match", () => {
    expect(resolveBundleLanguage("pl", available)).toBe("pl");
    expect(resolveBundleLanguage("zh-cn", available)).toBe("zh-cn");
  });

  it("is case-insensitive about the display language", () => {
    expect(resolveBundleLanguage("ZH-TW", available)).toBe("zh-tw");
  });

  // The mismatch case is the one worth collecting: a request nobody answered.
  it("falls back to English for a language this build does not ship", () => {
    expect(resolveBundleLanguage("de", available)).toBe("en");
    expect(resolveBundleLanguage("ja", available)).toBe("en");
  });

  it("falls back to the base language when a regional variant is unknown", () => {
    expect(resolveBundleLanguage("nl-be", available)).toBe("nl");
    expect(resolveBundleLanguage("pt-br", available)).toBe("en");
  });

  it("prefers an exact regional bundle over its base", () => {
    expect(resolveBundleLanguage("zh-tw", ["en", "zh", "zh-tw"])).toBe("zh-tw");
  });

  it("handles an empty or blank display language", () => {
    expect(resolveBundleLanguage("", available)).toBe("en");
    expect(resolveBundleLanguage("   ", available)).toBe("en");
  });
});

describe("buildLanguagePayload", () => {
  it("reports what was asked for and what was served", () => {
    expect(
      buildLanguagePayload({ displayLanguage: "de", available: ["en", "pl"] })
    ).toEqual({ language: "de", translation: "en" });
  });

  it("reports both the same when the translation exists", () => {
    expect(
      buildLanguagePayload({ displayLanguage: "pl", available: ["en", "pl"] })
    ).toEqual({ language: "pl", translation: "pl" });
  });

  // Only primitives survive the sender's payload filter, and the ingest stores
  // nothing else — a nested value would be dropped silently.
  it("emits primitives only", () => {
    const payload = buildLanguagePayload({ displayLanguage: "nl", available: ["en", "nl"] });

    for (const value of Object.values(payload)) {
      expect(typeof value).toBe("string");
    }
  });
});
