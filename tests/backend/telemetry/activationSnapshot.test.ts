import { describe, expect, it } from "vitest";

import { buildActivationPayload, MAX_SETTING_FLAGS } from "@/telemetry/activationSnapshot";

describe("activation snapshot", () => {
  it("counts the settings the user has explicitly set", () => {
    const payload = buildActivationPayload({
      "git-graph-libre.repository.showRemoteBranches": false,
      "git-graph-libre.graph.fontSize": 15
    });

    expect(payload.settingsChanged).toBe(2);
  });

  it("flags each setting by name with the prefix stripped", () => {
    const payload = buildActivationPayload({
      "git-graph-libre.repository.showRemoteBranches": false,
      "git-graph-libre.telemetry.enabled": true
    });

    expect(payload["setting.repository.showRemoteBranches"]).toBe(true);
    expect(payload["setting.telemetry.enabled"]).toBe(true);
  });

  // The whole point of recording presence rather than value: several settings
  // hold user-supplied strings that would leak content.
  it("never includes the value a setting was set to", () => {
    const payload = buildActivationPayload({
      "git-graph-libre.customBranchGlobPatterns": [
        { name: "Client work", glob: "feature/acme-corp/*" }
      ],
      "git-graph-libre.graphColors": ["oklch(59% 0.21 245)"]
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("acme-corp");
    expect(serialized).not.toContain("oklch");
    expect(payload["setting.customBranchGlobPatterns"]).toBe(true);

    for (const value of Object.values(payload)) {
      expect(["boolean", "number"]).toContain(typeof value);
    }
  });

  it("reports nothing changed for a default configuration", () => {
    const payload = buildActivationPayload({});

    expect(payload).toEqual({ settingsChanged: 0 });
  });

  // The server keeps 64 properties per event and VS Code injects a dozen of
  // its own, so this must truncate here rather than be cut server-side.
  it("caps the flags but still reports the true total", () => {
    const explicit: Record<string, unknown> = {};
    for (let i = 0; i < MAX_SETTING_FLAGS + 15; i++) {
      explicit[`git-graph-libre.setting${String(i).padStart(3, "0")}`] = true;
    }

    const payload = buildActivationPayload(explicit);

    expect(payload.settingsChanged).toBe(MAX_SETTING_FLAGS + 15);
    expect(Object.keys(payload)).toHaveLength(MAX_SETTING_FLAGS + 1);
  });

  it("truncates deterministically rather than by insertion order", () => {
    const keys = ["zebra", "alpha", "middle"].map((n) => `git-graph-libre.${n}`);
    const forward = Object.fromEntries(keys.map((k) => [k, true]));
    const reversed = Object.fromEntries([...keys].reverse().map((k) => [k, true]));

    expect(Object.keys(buildActivationPayload(forward))).toEqual(
      Object.keys(buildActivationPayload(reversed))
    );
  });

  it("leaves an unprefixed key alone", () => {
    const payload = buildActivationPayload({ "git.path": "/usr/bin/git" });

    expect(payload["setting.git.path"]).toBe(true);
  });
});
