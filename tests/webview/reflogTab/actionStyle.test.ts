import { describe, expect, it } from "vitest";

import { REFLOG_ACTION_KINDS, REFLOG_SUB_ACTIONS } from "@/reflogTabTypes";
import {
  kindClass,
  kindLabel,
  REFLOG_SUB_INTENTS,
  subIntentClass,
  subLabel
} from "@/webview/reflogTab/actionStyle";

import { LABELS } from "./fixtures";

describe("reflog action styles", () => {
  it("gives every known kind its own marker class", () => {
    for (const kind of REFLOG_ACTION_KINDS) {
      expect(kindClass(kind), kind).toBe(`reflog-kind-${kind}`);
    }
    // The 13 kinds classifyReflogMessage returns today, spelled out so a
    // list edit cannot silently shrink the table this test walks.
    expect(REFLOG_ACTION_KINDS).toEqual([
      "commit",
      "checkout",
      "reset",
      "rebase",
      "merge",
      "pull",
      "fetch",
      "cherry-pick",
      "revert",
      "branch",
      "stash",
      "clone",
      "other"
    ]);
  });

  it("marks an unknown kind (the open set) with the neutral marker", () => {
    expect(kindClass("frobnicate")).toBe("reflog-kind-other");
    expect(kindClass("update by push")).toBe("reflog-kind-other");
    expect(kindClass("")).toBe("reflog-kind-other");
    // Case and padding from another tool's subject still find the kind.
    expect(kindClass(" Commit ")).toBe("reflog-kind-commit");
  });

  it("groups every intent-bearing sub-action and leaves the rest neutral", () => {
    const expected: Record<string, string> = {
      amend: "rewrite",
      reword: "rewrite",
      edit: "rewrite",
      squash: "combine",
      fixup: "combine",
      start: "advance",
      pick: "advance",
      continue: "advance",
      finish: "advance",
      "fast-forward": "advance",
      initial: "advance",
      merge: "advance",
      abort: "abort",
      created: "ref",
      renamed: "ref",
      copied: "ref"
    };
    expect(REFLOG_SUB_INTENTS).toEqual(expected);
    for (const [sub, intent] of Object.entries(expected)) {
      expect(subIntentClass(sub), sub).toBe(`reflog-sub-intent-${intent}`);
    }
    // Every known sub-action is either grouped above or neutral on
    // purpose (the stash's wording), never dropped by accident.
    for (const sub of REFLOG_SUB_ACTIONS) {
      if (!(sub in expected)) {
        expect(subIntentClass(sub), sub).toBe("reflog-sub-intent-neutral");
      }
    }
    expect(REFLOG_SUB_ACTIONS).toHaveLength(18);
  });

  it("tags an unknown sub-action neutral and normalizes case", () => {
    expect(subIntentClass("detached-from-abc")).toBe("reflog-sub-intent-neutral");
    expect(subIntentClass("wip")).toBe("reflog-sub-intent-neutral");
    expect(subIntentClass("named")).toBe("reflog-sub-intent-neutral");
    expect(subIntentClass("Squash")).toBe("reflog-sub-intent-combine");
    expect(subIntentClass(" ABORT ")).toBe("reflog-sub-intent-abort");
  });

  it("localizes known labels and keeps Git's raw word for unknown ones", () => {
    expect(kindLabel("cherry-pick", LABELS)).toBe("Cherry-pick");
    expect(kindLabel("rebase", LABELS)).toBe("Rebase");
    expect(kindLabel("frobnicate", LABELS)).toBe("frobnicate");
    expect(subLabel("fast-forward", LABELS)).toBe("Fast-forward");
    expect(subLabel("wip", LABELS)).toBe("Work in progress");
    expect(subLabel("detached-from-abc", LABELS)).toBe("detached-from-abc");
  });

  it("has a fixture label for every known kind and sub-action", () => {
    // The panel builds both records from these two lists, so the
    // fixtures mirror them; a missing key here means a missing label
    // in the tab (the raw English word would show instead).
    for (const kind of REFLOG_ACTION_KINDS) {
      expect(LABELS.actions[kind], kind).toBeTruthy();
    }
    for (const sub of REFLOG_SUB_ACTIONS) {
      expect(LABELS.subActions[sub], sub).toBeTruthy();
    }
  });
});
