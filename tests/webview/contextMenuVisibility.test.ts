import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  normalizeContextMenuActionsVisibility
} from "@/contextMenuVisibility";

describe("context menu action visibility", () => {
  it("defaults every known action to visible", () => {
    const normalized = normalizeContextMenuActionsVisibility(null);

    expect(normalized).toEqual(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY);
    expect(Object.values(normalized).flatMap((group) => Object.values(group))).not.toContain(false);
  });

  it("accepts boolean overrides for known groups and actions", () => {
    const normalized = normalizeContextMenuActionsVisibility({
      commit: { copyHash: false },
      tag: { push: false, fetchTags: false }
    });

    expect(normalized.commit.copyHash).toBe(false);
    expect(normalized.tag.push).toBe(false);
    expect(normalized.tag.fetchTags).toBe(false);
    expect(normalized.tag.delete).toBe(true);
  });

  it("defaults the GGL Diff tab action to visible and honors hiding it", () => {
    // `{}` is the raw settings-hub echo shape: the default must survive it.
    expect(normalizeContextMenuActionsVisibility({}).commitDetailsViewFile.openDiffTab).toBe(true);

    const normalized = normalizeContextMenuActionsVisibility({
      commitDetailsViewFile: { openDiffTab: false }
    });

    expect(normalized.commitDetailsViewFile.openDiffTab).toBe(false);
    expect(normalized.commitDetailsViewFile.viewDiff).toBe(true);
  });

  it("ignores unknown groups, unknown actions, and non-boolean values", () => {
    const normalized = normalizeContextMenuActionsVisibility({
      unknownGroup: { copyHash: false },
      tag: {
        delete: "false",
        push: false,
        unknownAction: false
      }
    });

    expect(normalized.tag.delete).toBe(true);
    expect(normalized.tag.push).toBe(false);
    expect("unknownGroup" in normalized).toBe(false);
    expect("unknownAction" in normalized.tag).toBe(false);
  });
});
