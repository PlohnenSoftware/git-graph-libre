/**
 * Builds a folder tree out of flat `a/b/c.txt` paths.
 *
 * Rendering is deliberately not part of this module: the commit-details file
 * tree and the uncommitted staging panes need the same grouping but very
 * different rows (diff actions on one side, drag handles and status letters on
 * the other), so only the grouping is shared. `commitDetailsView` still has
 * its own older builder; migrating it onto this one is a follow-up, since its
 * per-folder open state and leaf renderer are entangled with its markup.
 */

export type PathTreeLeaf<T> = {
  type: "leaf";
  /** Last path segment, for display. */
  name: string;
  /** Full path as supplied, which is what git commands take. */
  path: string;
  value: T;
};

export type PathTreeFolder<T> = {
  type: "folder";
  /**
   * Display name. Normally one segment; with `compactFolders` a chain of
   * single-child folders collapses into one node named `a/b/c`.
   */
  name: string;
  /** Full folder path, no trailing slash. Empty string for the root. */
  path: string;
  children: PathTreeNode<T>[];
};

export type PathTreeNode<T> = PathTreeFolder<T> | PathTreeLeaf<T>;

/** Folders before leaves, then by name — the order the file tree already uses. */
function compareNodes<T>(a: PathTreeNode<T>, b: PathTreeNode<T>): number {
  if (a.type === "folder" && b.type === "leaf") return -1;
  if (a.type === "leaf" && b.type === "folder") return 1;
  return a.name.localeCompare(b.name);
}

function emptyFolder<T>(name: string, path: string): PathTreeFolder<T> {
  return { type: "folder", name, path, children: [] };
}

function childFolder<T>(parent: PathTreeFolder<T>, name: string): PathTreeFolder<T> {
  const existing = parent.children.find(
    (child): child is PathTreeFolder<T> => child.type === "folder" && child.name === name
  );
  if (existing !== undefined) return existing;
  const created = emptyFolder<T>(name, parent.path === "" ? name : `${parent.path}/${name}`);
  parent.children.push(created);
  return created;
}

/**
 * Collapses each chain of folders that has exactly one child folder and no
 * leaves into a single node, so `src/webview/utils` is one row rather than
 * three. Mirrors the commit-details compact-folder behavior.
 */
function compact<T>(folder: PathTreeFolder<T>): void {
  for (const child of folder.children) {
    if (child.type === "folder") compact(child);
  }
  if (folder.children.length !== 1) return;
  const only = folder.children[0];
  if (only.type !== "folder") return;
  folder.name = `${folder.name}/${only.name}`;
  folder.path = only.path;
  folder.children = only.children;
}

/**
 * Groups `entries` by their path segments. Paths are taken as given: they are
 * git output, already `/`-separated and repository-relative, and are the exact
 * strings handed back to git, so they are never normalized here.
 *
 * Entries whose path is empty are skipped rather than producing a nameless
 * leaf. A trailing `/` (git reports a wholly untracked directory as `sub/`)
 * makes the entry a leaf named for that directory, because it is one row in
 * the UI and one argument to git — not a folder to descend into.
 */
export function buildPathTree<T>(
  entries: readonly { path: string; value: T }[],
  options: { compactFolders?: boolean } = {}
): PathTreeFolder<T> {
  const root = emptyFolder<T>("", "");
  for (const entry of entries) {
    if (entry.path === "") continue;
    const directoryEntry = entry.path.endsWith("/");
    const segments = (directoryEntry ? entry.path.slice(0, -1) : entry.path).split("/");
    let folder = root;
    for (const segment of segments.slice(0, -1)) folder = childFolder(folder, segment);
    folder.children.push({
      type: "leaf",
      name: segments.at(-1) ?? entry.path,
      path: entry.path,
      value: entry.value
    });
  }

  if (options.compactFolders === true) {
    for (const child of root.children) {
      if (child.type === "folder") compact(child);
    }
  }
  sortTree(root);
  return root;
}

function sortTree<T>(folder: PathTreeFolder<T>): void {
  folder.children.sort(compareNodes);
  for (const child of folder.children) {
    if (child.type === "folder") sortTree(child);
  }
}

/**
 * Every leaf path under `node`, in render order. This is what a folder drag
 * hands to git: the folder's own path would also sweep in files git happens to
 * consider changed but the pane is not showing, so the descendants that are
 * actually on screen are listed explicitly instead.
 */
export function collectLeafPaths<T>(node: PathTreeNode<T>): string[] {
  if (node.type === "leaf") return [node.path];
  return node.children.flatMap((child) => collectLeafPaths(child));
}

/** Finds a folder by its full path, or null. */
export function findFolder<T>(folder: PathTreeFolder<T>, path: string): PathTreeFolder<T> | null {
  if (folder.path === path) return folder;
  for (const child of folder.children) {
    if (child.type !== "folder") continue;
    const match = findFolder(child, path);
    if (match !== null) return match;
  }
  return null;
}
