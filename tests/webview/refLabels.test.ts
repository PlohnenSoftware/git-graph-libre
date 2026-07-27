import { describe, expect, it } from "vitest";

import type { GitRef } from "@/backend/types";
import { groupCommitRefs, parseRemoteBranchName } from "@/webview/refLabels";

function ref(name: string, type: GitRef["type"]): GitRef {
  return { hash: "abc123", name, type };
}

describe("commit ref labels", () => {
  it("parses known remote names before the branch path", () => {
    expect(parseRemoteBranchName("team/upstream/feature/menu", ["team/upstream"])).toEqual({
      remote: "team/upstream",
      branchName: "feature/menu"
    });
    expect(parseRemoteBranchName("origin/feature/menu", [])).toEqual({
      remote: "origin",
      branchName: "feature/menu"
    });
    expect(parseRemoteBranchName("invalid", ["origin"])).toBeNull();
  });

  it("groups matching local and remote branches regardless of ref order", () => {
    const local = ref("feature/menu", "head");
    const origin = ref("origin/feature/menu", "remote");
    const upstream = ref("upstream/feature/menu", "remote");

    expect(groupCommitRefs([origin, local, upstream], ["origin", "upstream"])).toEqual([
      {
        kind: "branch-group",
        local,
        remotes: [
          { ref: origin, remote: "origin" },
          { ref: upstream, remote: "upstream" }
        ]
      }
    ]);
  });

  it("leaves tags and unmatched remote branches as independent labels", () => {
    const local = ref("main", "head");
    const remote = ref("origin/other", "remote");
    const tag = ref("v1.0.0", "tag");

    expect(groupCommitRefs([local, remote, tag])).toEqual([
      { kind: "ref", ref: local },
      { kind: "ref", ref: remote },
      { kind: "ref", ref: tag }
    ]);
  });

  it("does not confuse a nested remote branch path with a matching local suffix", () => {
    const local = ref("main", "head");
    const remote = ref("origin/feature/main", "remote");

    expect(groupCommitRefs([local, remote], ["origin"])).toEqual([
      { kind: "ref", ref: local },
      { kind: "ref", ref: remote }
    ]);
  });
});
