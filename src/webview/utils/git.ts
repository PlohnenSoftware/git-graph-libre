export const refInvalid = /^[-/].*|[\\" ><~^:?*[]|\.\.|\/\/|\/\.|@{|[./]$|\.lock$|^@$/g;
export const ELLIPSIS = "&#8230;";

export function arraysEqual<T>(a: T[], b: T[], equalElements: (a: T, b: T) => boolean) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!equalElements(a[i], b[i])) return false;
  }
  return true;
}

/** A worktree's folder name: the last segment of its path, on either separator. */
export function worktreeFolderName(worktreePath: string): string {
  let end = worktreePath.length;
  while (end > 0 && (worktreePath[end - 1] === "/" || worktreePath[end - 1] === "\\")) {
    end -= 1;
  }
  const segments = worktreePath.slice(0, end).split(/[/\\]/);
  return segments.at(-1) || worktreePath;
}
