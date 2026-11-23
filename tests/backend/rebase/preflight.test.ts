import { describe, expect, it } from "vitest";
import {
  effectiveRebasePreflight,
  evaluateRebasePreflight,
  type RebasePreflightFacts
} from "@/backend/rebase/preflight";
import type { GitQueryError } from "@/backend/types";

const clean: RebasePreflightFacts = {
  commitCount: 3,
  dirty: false,
  inProgress: false,
  alreadyUsedElsewhere: false,
  error: null
};

function facts(overrides: Partial<RebasePreflightFacts> = {}): RebasePreflightFacts {
  return { ...clean, ...overrides };
}

const failed: GitQueryError = { message: "boom", stderr: null, exitCode: null, task: null };

describe("evaluateRebasePreflight", () => {
  it("allows a clean, non-empty range", () => {
    expect(evaluateRebasePreflight(facts())).toEqual({ canStart: true, reasons: [] });
  });

  it("refuses an empty range", () => {
    expect(evaluateRebasePreflight(facts({ commitCount: 0 }))).toEqual({
      canStart: false,
      reasons: ["emptyRange"]
    });
  });

  it("refuses a dirty tree", () => {
    expect(evaluateRebasePreflight(facts({ dirty: true }))).toEqual({
      canStart: false,
      reasons: ["dirty"]
    });
  });

  it("refuses while another operation is in progress", () => {
    expect(evaluateRebasePreflight(facts({ inProgress: true }))).toEqual({
      canStart: false,
      reasons: ["inProgress"]
    });
  });

  it("refuses a branch checked out in another worktree", () => {
    expect(evaluateRebasePreflight(facts({ alreadyUsedElsewhere: true }))).toEqual({
      canStart: false,
      reasons: ["alreadyUsedElsewhere"]
    });
  });

  it("does not refuse on an unknown worktree answer", () => {
    expect(evaluateRebasePreflight(facts({ alreadyUsedElsewhere: "unknown" }))).toEqual({
      canStart: true,
      reasons: []
    });
  });

  it("names every reason that applies, in a stable order", () => {
    expect(
      evaluateRebasePreflight(
        facts({
          commitCount: 0,
          dirty: true,
          inProgress: true,
          alreadyUsedElsewhere: true
        })
      )
    ).toEqual({
      canStart: false,
      reasons: ["inProgress", "emptyRange", "dirty", "alreadyUsedElsewhere"]
    });
  });

  it("reports a failed read as its only reason", () => {
    expect(
      evaluateRebasePreflight(
        facts({ commitCount: 0, dirty: true, inProgress: true, error: failed })
      )
    ).toEqual({ canStart: false, reasons: ["readFailed"] });
  });

  it("clears dirty when autostash is opted in without clearing other blockers", () => {
    expect(evaluateRebasePreflight(facts({ dirty: true, autostash: true }))).toEqual({
      canStart: true,
      reasons: []
    });
    expect(
      evaluateRebasePreflight(facts({ dirty: true, inProgress: true, autostash: true }))
    ).toEqual({
      canStart: false,
      reasons: ["inProgress"]
    });
  });
});

describe("effectiveRebasePreflight", () => {
  it("drops dirty when autostash is chosen and preserves all other reasons", () => {
    const dirtyOnly = evaluateRebasePreflight(facts({ dirty: true }));
    expect(effectiveRebasePreflight(dirtyOnly, { autostash: false })).toBe(dirtyOnly);
    expect(effectiveRebasePreflight(dirtyOnly, { autostash: true })).toEqual({
      canStart: true,
      reasons: []
    });

    const dirtyAndWorktree = evaluateRebasePreflight(
      facts({ dirty: true, alreadyUsedElsewhere: true })
    );
    expect(effectiveRebasePreflight(dirtyAndWorktree, { autostash: true })).toEqual({
      canStart: false,
      reasons: ["alreadyUsedElsewhere"]
    });
  });
});
