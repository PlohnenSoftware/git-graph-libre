import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vscodeL10n = vi.hoisted(() => ({
  uri: undefined as { fsPath: string } | undefined,
  // Stands in for a locale with no entry for the key, which is what makes the
  // English bundle fallback run.
  translate: (key: string, ..._args: unknown[]) => key
}));

vi.mock("vscode", () => ({
  l10n: {
    get uri() {
      return vscodeL10n.uri;
    },
    t: (key: string, ...args: unknown[]) => vscodeL10n.translate(key, ...args)
  }
}));

const repoRoot = path.resolve(__dirname, "../..");

describe("l10n fallback", () => {
  beforeEach(() => {
    vscodeL10n.uri = undefined;
    vscodeL10n.translate = (key: string) => key;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns the active locale translation without consulting the bundle", async () => {
    vscodeL10n.translate = () => "Data";
    const { t } = await import("@/l10n");

    expect(t("ui.date")).toBe("Data");
  });

  it("returns the key unchanged when no translation path can be resolved", async () => {
    const { t } = await import("@/l10n");

    expect(t("ui.date")).toBe("ui.date");
  });

  it.each([
    { name: "resolves a plain key from the bundle", key: "ui.date", args: [], expected: "Date" },
    {
      name: "returns a key that the bundle does not define",
      key: "no.such.key.exists",
      args: [],
      expected: "no.such.key.exists"
    },
    {
      name: "interpolates a positional placeholder",
      key: "signature.signer",
      args: ["Alice <alice@example.com>"],
      expected: "Signer: Alice <alice@example.com>"
    },
    {
      name: "leaves a positional placeholder that has no argument",
      key: "signature.signer",
      args: [],
      expected: "Signer: {0}"
    }
  ])("falls back to the English bundle and $name", async ({ key, args, expected }) => {
    const { initL10n, t } = await import("@/l10n");
    initL10n(repoRoot);

    expect(t(key, ...args)).toBe(expected);
  });

  it("interpolates named placeholders in the fallback", async () => {
    const { initL10n, t } = await import("@/l10n");
    initL10n(repoRoot);

    expect(t("signature.key", { 0: "ABCD1234" })).toBe("Key: ABCD1234");
  });

  it("prefers the l10n uri over the extension path", async () => {
    const { initL10n, t } = await import("@/l10n");
    initL10n("/nonexistent");
    vscodeL10n.uri = { fsPath: path.join(repoRoot, "l10n", "bundle.l10n.json") };

    expect(t("ui.commit")).toBe("Commit");
  });

  it("returns the key when the bundle cannot be read", async () => {
    const { t } = await import("@/l10n");
    vscodeL10n.uri = { fsPath: "/nonexistent/l10n/bundle.l10n.json" };

    expect(t("ui.date")).toBe("ui.date");
  });

  it("caches the bundle across calls", async () => {
    const { initL10n, t } = await import("@/l10n");
    initL10n(repoRoot);

    expect(t("ui.date")).toBe("Date");
    // A second lookup must not re-read the file; pointing the extension path at a
    // missing directory would break it if the cache were bypassed.
    initL10n("/nonexistent");
    expect(t("ui.author")).toBe("Author");
  });
});
