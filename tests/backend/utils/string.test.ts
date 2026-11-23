import { describe, expect, it } from "vitest";

import {
  abbrevCommit,
  clampShortHashLength,
  DEFAULT_SHORT_HASH_LENGTH,
  hasControlCharacter,
  MAX_SHORT_HASH_LENGTH,
  MIN_SHORT_HASH_LENGTH
} from "@/backend/utils/string";

describe("string utilities", () => {
  it("abbreviates commit hashes with the default display length", () => {
    expect(abbrevCommit("abcdef1234567890")).toBe("abcdef12");
  });

  it("uses a requested display length while keeping short hashes intact", () => {
    expect(abbrevCommit("abcdef1234567890", 12)).toBe("abcdef123456");
    expect(abbrevCommit("abc", 12)).toBe("abc");
  });

  it("clamps short hash display lengths to stable bounds", () => {
    expect(clampShortHashLength(1)).toBe(MIN_SHORT_HASH_LENGTH);
    expect(clampShortHashLength(80)).toBe(MAX_SHORT_HASH_LENGTH);
    expect(clampShortHashLength(Number.NaN)).toBe(DEFAULT_SHORT_HASH_LENGTH);
    expect(clampShortHashLength(7.9)).toBe(7);
  });

  it("finds C0 control characters and DEL, and nothing else", () => {
    expect(hasControlCharacter("main\nfoo")).toBe(true);
    expect(hasControlCharacter("a\u0000b")).toBe(true);
    expect(hasControlCharacter("a\u001fb")).toBe(true);
    expect(hasControlCharacter("a\u007fb")).toBe(true);
    expect(hasControlCharacter("refs/heads/feature-1 ok~2")).toBe(false);
    expect(hasControlCharacter("a\u0020b\u00e9\u{1f600}")).toBe(false);
  });
});
