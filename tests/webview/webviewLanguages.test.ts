import { describe, expect, it } from "vitest";

import { createBundleTranslator, listWebviewLanguages } from "@/extension/webviewLanguages";

const REPO = process.cwd();

describe("listWebviewLanguages", () => {
  it("offers every shipped locale, English first", () => {
    expect(listWebviewLanguages(REPO)).toEqual([
      { id: "en", label: "English" },
      { id: "nl", label: "Dutch" },
      { id: "pl", label: "Polish" },
      { id: "zh-cn", label: "Chinese (Simplified)" },
      { id: "zh-tw", label: "Chinese (Traditional)" }
    ]);
  });

  // English labels regardless of the active language: the switcher exists to
  // be readable when the interface is in a language the reader cannot follow.
  it("labels in English", () => {
    for (const language of listWebviewLanguages(REPO)) {
      expect(language.label).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it("degrades to English alone when the bundles cannot be read", () => {
    expect(listWebviewLanguages("/nonexistent")).toEqual([{ id: "en", label: "English" }]);
  });
});

describe("createBundleTranslator", () => {
  it("translates from the requested bundle", () => {
    const translate = createBundleTranslator(REPO, "pl");

    expect(translate("ui.refresh")).toBe("Odśwież");
    expect(translate("ui.branch")).toBe("Gałąź");
  });

  it("serves English when English is asked for", () => {
    expect(createBundleTranslator(REPO, "en")("ui.refresh")).toBe("Refresh");
  });

  // The same order l10n.t() degrades in, so a switched webview never looks
  // more broken than an unswitched one.
  it("falls back to English, then to the key", () => {
    const translate = createBundleTranslator(REPO, "nl");

    expect(translate("ui.refresh")).toBe("Vernieuwen");
    expect(translate("no.such.key.anywhere")).toBe("no.such.key.anywhere");
  });

  it("survives a missing bundle without throwing", () => {
    const translate = createBundleTranslator(REPO, "does-not-exist");

    expect(translate("ui.refresh")).toBe("Refresh");
  });

  it("survives an unreadable extension path", () => {
    expect(createBundleTranslator("/nonexistent", "pl")("ui.refresh")).toBe("ui.refresh");
  });
});
