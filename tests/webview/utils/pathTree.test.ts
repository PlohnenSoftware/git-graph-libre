import { describe, expect, it } from "vitest";
import { buildPathTree, collectLeafPaths, findFolder } from "@/webview/utils/pathTree";

function entries(...paths: string[]) {
  return paths.map((path) => ({ path, value: path }));
}

/** Compact shape for assertions: folders as `name/`, leaves as `name`. */
function shape(node: ReturnType<typeof buildPathTree<string>>): unknown {
  return node.children.map((child) =>
    child.type === "folder" ? { [`${child.name}/`]: shape(child) } : child.name
  );
}

describe("buildPathTree", () => {
  it("groups paths by folder and keeps the full path on each leaf", () => {
    const tree = buildPathTree(entries("src/a.ts", "src/b.ts", "root.md"));

    expect(shape(tree)).toEqual([{ "src/": ["a.ts", "b.ts"] }, "root.md"]);
    const src = findFolder(tree, "src");
    expect(src?.children.map((c) => c.type === "leaf" && c.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("sorts folders before leaves, then by name", () => {
    const tree = buildPathTree(entries("z.txt", "a.txt", "beta/x.txt", "alpha/y.txt"));

    expect(shape(tree)).toEqual([
      { "alpha/": ["y.txt"] },
      { "beta/": ["x.txt"] },
      "a.txt",
      "z.txt"
    ]);
  });

  it("nests deeply without collapsing when compactFolders is off", () => {
    const tree = buildPathTree(entries("src/webview/utils/a.ts"));

    expect(shape(tree)).toEqual([{ "src/": [{ "webview/": [{ "utils/": ["a.ts"] }] }] }]);
  });

  it("collapses single-child folder chains when compactFolders is on", () => {
    const tree = buildPathTree(entries("src/webview/utils/a.ts"), { compactFolders: true });

    expect(shape(tree)).toEqual([{ "src/webview/utils/": ["a.ts"] }]);
    // The collapsed node keeps the deepest real path, so folder actions still
    // address the folder that actually holds the files.
    expect(findFolder(tree, "src/webview/utils")).not.toBeNull();
  });

  it("stops collapsing where a folder branches", () => {
    const tree = buildPathTree(entries("a/b/c/one.ts", "a/b/d/two.ts"), {
      compactFolders: true
    });

    expect(shape(tree)).toEqual([{ "a/b/": [{ "c/": ["one.ts"] }, { "d/": ["two.ts"] }] }]);
  });

  it("treats a trailing slash as one leaf, the way git reports an untracked folder", () => {
    // `git status --untracked-files=normal` collapses a wholly untracked
    // directory to a single `sub/` entry; that is one row and one git argument.
    const tree = buildPathTree(entries("sub/", "kept.txt"));

    expect(shape(tree)).toEqual(["kept.txt", "sub"]);
    expect(collectLeafPaths(tree)).toEqual(["kept.txt", "sub/"]);
  });

  it("skips empty paths instead of making a nameless leaf", () => {
    const tree = buildPathTree(entries("", "a.txt"));

    expect(shape(tree)).toEqual(["a.txt"]);
  });
});

describe("collectLeafPaths", () => {
  it("returns every descendant path of a folder, in render order", () => {
    const tree = buildPathTree(entries("src/b.ts", "src/nested/c.ts", "src/a.ts", "other.md"));
    const src = findFolder(tree, "src");

    expect(src).not.toBeNull();
    expect(collectLeafPaths(src as NonNullable<typeof src>)).toEqual([
      "src/nested/c.ts",
      "src/a.ts",
      "src/b.ts"
    ]);
    // The root covers everything, which is what a whole-pane action needs.
    expect(collectLeafPaths(tree)).toHaveLength(4);
  });

  it("returns the single path for a leaf", () => {
    const tree = buildPathTree(entries("only.txt"));

    expect(collectLeafPaths(tree.children[0])).toEqual(["only.txt"]);
  });
});
