import { describe, expect, it } from "vitest";

import { getNonce } from "@/backend/utils/nonce";

describe("nonce", () => {
  it("generates unique CSP-safe nonces", () => {
    const first = getNonce();
    const second = getNonce();

    expect(first).toMatch(/^[\w-]+$/);
    expect(first).toHaveLength(32);
    expect(second).toMatch(/^[\w-]+$/);
    expect(second).toHaveLength(32);
    expect(second).not.toBe(first);
  });
});
