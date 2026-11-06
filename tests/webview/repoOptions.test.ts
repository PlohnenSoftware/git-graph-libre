import { describe, expect, it } from "vitest";
import type { GitRepoSet, OutsideWorktree, RepoLayout, RepoWorktreeInfo } from "@/types";
import { buildRepoOptions } from "@/webview/repoOptions";

const labels = {
  detached: "detached",
  outsideWorkspace: "outside workspace",
  bareRepository: "bare repository"
};

const repos = (...paths: string[]): GitRepoSet =>
  Object.fromEntries(paths.map((repo) => [repo, { columnWidths: null }]));

function info(commonDir: string, linked: boolean, branch: string | null): RepoWorktreeInfo {
  return { commonDir, linked, branch, detached: branch === null };
}

function outsideEntry(path: string, commonDir: string, overrides: Partial<OutsideWorktree> = {}) {
  return {
    path,
    commonDir,
    linked: true,
    branch: "b",
    detached: false,
    repo: "/ws/main",
    ...overrides
  };
}

function rows(set: GitRepoSet, layout: RepoLayout | undefined) {
  return buildRepoOptions(set, layout, labels).map((option) => [
    option.name,
    option.indentLevel,
    option.treeBranch
  ]);
}

describe("buildRepoOptions", () => {
  it("nests by path prefix when the host sent no layout, as before", () => {
    const set = repos("/ws/main", "/ws/main/modules/child", "/ws/main/modules/tools", "/ws/other");

    expect(rows(set, undefined)).toEqual([
      ["main", 0, undefined],
      ["child", 1, "middle"],
      ["tools", 1, "last"],
      ["other", 0, undefined]
    ]);
  });

  it("groups sibling worktrees under their main worktree, whatever the folder names sort to", () => {
    // `a-wt` sorts before `main`, and neither path contains the other.
    const set = repos("/ws/a-wt", "/ws/main", "/ws/zz-wt", "/ws/unrelated");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/a-wt": info("/ws/main/.git", true, "feat-a"),
        "/ws/main": info("/ws/main/.git", false, "main"),
        "/ws/zz-wt": info("/ws/main/.git", true, "feat-z"),
        "/ws/unrelated": info("/ws/unrelated/.git", false, "main")
      },
      outside: []
    };

    expect(rows(set, layout)).toEqual([
      ["main (main)", 0, undefined],
      ["a-wt (feat-a)", 1, "middle"],
      ["zz-wt (feat-z)", 1, "last"],
      ["unrelated", 0, undefined]
    ]);
  });

  it("indents a worktree nested inside its main worktree once, like a sibling", () => {
    const set = repos("/ws/main", "/ws/main/.worktrees/x");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/main": info("/ws/main/.git", false, "main"),
        "/ws/main/.worktrees/x": info("/ws/main/.git", true, "x")
      },
      outside: []
    };

    expect(rows(set, layout)).toEqual([
      ["main (main)", 0, undefined],
      ["x (x)", 1, "last"]
    ]);
  });

  it("keeps a submodule of a linked worktree under that worktree, which is under the main", () => {
    const set = repos("/ws/main", "/ws/wt", "/ws/wt/modules/sub");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/main": info("/ws/main/.git", false, "main"),
        "/ws/wt": info("/ws/main/.git", true, "wt-b"),
        "/ws/wt/modules/sub": info("/ws/main/.git/modules/sub", false, null)
      },
      outside: []
    };

    expect(rows(set, layout)).toEqual([
      ["main (main)", 0, undefined],
      ["wt (wt-b)", 1, "last"],
      ["sub", 2, "last"]
    ]);
  });

  it("lists linked worktrees of a bare group flat when the host names no bare group", () => {
    const set = repos("/ws/one", "/ws/two");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/one": info("/store.git", true, "one-b"),
        "/ws/two": info("/store.git", true, null)
      },
      outside: []
    };

    expect(rows(set, layout)).toEqual([
      ["one (one-b)", 0, undefined],
      ["two (detached)", 0, undefined]
    ]);
  });

  it("gives a bare group a header row above its linked worktrees, which sit beneath it", () => {
    const set = repos("/ws/one", "/ws/two", "/ws/unrelated");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/one": info("/store.git", true, "one-b"),
        "/ws/two": info("/store.git", true, null),
        "/ws/unrelated": info("/unrelated/.git", false, "main")
      },
      outside: [],
      bareGroups: ["/store.git"]
    };

    expect(rows(set, layout)).toEqual([
      ["store.git · bare repository", 0, undefined],
      ["one (one-b)", 1, "middle"],
      ["two (detached)", 1, "last"],
      ["unrelated", 0, undefined]
    ]);
    const headers = buildRepoOptions(set, layout, labels).filter((option) => option.header);
    expect(headers.map((option) => option.value)).toEqual(["/store.git"]);
  });

  it("gives a bare group a header with its outside worktrees beneath it", () => {
    const set = repos("/ws/one");
    const layout: RepoLayout = {
      worktrees: { "/ws/one": info("/store.git", true, "one-b") },
      outside: [outsideEntry("/elsewhere/two", "/store.git", { branch: "two-b" })],
      bareGroups: ["/store.git"]
    };

    expect(rows(set, layout)).toEqual([
      ["store.git · bare repository", 0, undefined],
      ["one (one-b)", 1, "middle"],
      ["two (two-b) · outside workspace", 1, "last"]
    ]);
  });

  it("shows no header for a bare common dir whose main worktree is listed", () => {
    const set = repos("/ws/main", "/ws/wt");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/main": info("/store.git", false, "main"),
        "/ws/wt": info("/store.git", true, "wt-b")
      },
      outside: [],
      bareGroups: ["/store.git"]
    };

    expect(rows(set, layout)).toEqual([
      ["main (main)", 0, undefined],
      ["wt (wt-b)", 1, "last"]
    ]);
    expect(buildRepoOptions(set, layout, labels).some((option) => option.header)).toBe(false);
  });

  it("follows a group with its outside worktrees, marked and labelled with the branch", () => {
    const set = repos("/ws/main", "/ws/wt");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/main": info("/ws/main/.git", false, "main"),
        "/ws/wt": info("/ws/main/.git", true, "wt-b")
      },
      outside: [outsideEntry("/elsewhere/out wt", "/ws/main/.git", { branch: "out-b" })]
    };

    expect(rows(set, layout)).toEqual([
      ["main (main)", 0, undefined],
      ["wt (wt-b)", 1, "middle"],
      ["out wt (out-b) · outside workspace", 1, "last"]
    ]);
  });

  it("makes an outside main worktree the group's head when only linked ones are listed", () => {
    const set = repos("/ws/wt");
    const layout: RepoLayout = {
      worktrees: { "/ws/wt": info("/far/main/.git", true, "wt-b") },
      outside: [outsideEntry("/far/main", "/far/main/.git", { linked: false, branch: "main" })]
    };

    expect(rows(set, layout)).toEqual([
      ["main (main) · outside workspace", 0, undefined],
      ["wt (wt-b)", 1, "last"]
    ]);
  });

  it("shows an outside worktree with a detached HEAD as detached", () => {
    const layout: RepoLayout = {
      worktrees: {},
      outside: [outsideEntry("/elsewhere/d", "/x/.git", { branch: null, detached: true })]
    };

    expect(rows({}, layout)).toEqual([["d (detached) · outside workspace", 0, undefined]]);
  });

  it("never loses a repository to a parent loop", () => {
    // The main worktree's folder sits inside its own linked worktree's folder.
    const set = repos("/ws/wt", "/ws/wt/main");
    const layout: RepoLayout = {
      worktrees: {
        "/ws/wt": info("/ws/wt/main/.git", true, "wt-b"),
        "/ws/wt/main": info("/ws/wt/main/.git", false, "main")
      },
      outside: []
    };

    expect(
      buildRepoOptions(set, layout, labels)
        .map((option) => option.value)
        .toSorted()
    ).toEqual(["/ws/wt", "/ws/wt/main"]);
  });

  it("uses a custom display name for the repository part of the label", () => {
    const set: GitRepoSet = {
      "/ws/main": { columnWidths: null, displayName: "Project" },
      "/ws/wt": { columnWidths: null }
    };
    const layout: RepoLayout = {
      worktrees: {
        "/ws/main": info("/ws/main/.git", false, "main"),
        "/ws/wt": info("/ws/main/.git", true, "wt-b")
      },
      outside: []
    };

    expect(rows(set, layout)[0]).toEqual(["Project (main)", 0, undefined]);
  });
});
