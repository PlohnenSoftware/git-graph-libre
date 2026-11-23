/**
 * Autosquash preview for interactive rebase (F2-06, decision IQ11).
 *
 * Implements Git's documented `--autosquash` rearrangement rules
 * (`git-rebase(1)`): `fixup!`, `squash!`, and `amend!` prefixes, chained
 * prefixes, subject exact and prefix matching, unambiguous hash-prefix
 * matching (4–64 hex digits), `amend!` mapping to `fixup -C`, and Git's
 * linked-list insertion order for chained targets.
 *
 * Why pure instead of spawning `git rebase -i --autosquash` in the live
 * worktree (IQ11 spike, Git 2.56.1):
 * - A dirty working tree or dirty index causes `git rebase -i --autosquash`
 *   to refuse outright without `--autostash`.
 * - Adding `--autostash` to the dry-run stashes and pops without `--index`,
 *   which silently unstages every staged change in the user's working tree
 *   merely for opening a preview.
 * - Spawning rebase for a preview also triggers `pre-rebase` hooks and fails
 *   when another rebase is already in progress.
 *
 * Keeping the rearrangement pure avoids every working-tree side effect,
 * works identically on clean and dirty trees, and lets the webview editor
 * compute the preview directly. Parity against real `git rebase -i
 * --autosquash` is pinned in `tests/backend/rebase/autosquash.test.ts`
 * using {@link parseAutosquashTodo}.
 */

import type { TodoFixupFlag } from "./todo";

export type AutosquashMarkerKind = "fixup" | "squash" | "amend";

export type AutosquashMarker = {
  readonly kind: AutosquashMarkerKind;
  readonly target: string;
};

export type AutosquashInputCommit = {
  readonly hash: string;
  readonly subject: string;
};

export type AutosquashTodoEntry = {
  readonly action: "pick" | "fixup" | "squash";
  readonly hash: string;
  readonly fixupFlag?: TodoFixupFlag;
};

type AutosquashActionSpec = {
  readonly action: "pick" | "fixup" | "squash";
  readonly fixupFlag?: TodoFixupFlag;
};

const MARKER_PREFIXES: readonly { readonly prefix: string; readonly kind: AutosquashMarkerKind }[] =
  [
    { prefix: "fixup! ", kind: "fixup" },
    { prefix: "squash! ", kind: "squash" },
    { prefix: "amend! ", kind: "amend" }
  ];

/** Git's minimum abbreviated object name length is 4 hex digits; SHA-256 is up to 64. */
const HASH_PREFIX_RE = /^[0-9a-f]{4,64}$/i;

function matchLeadingPrefix(
  value: string
): { readonly kind: AutosquashMarkerKind; readonly rest: string } | null {
  for (const { prefix, kind } of MARKER_PREFIXES) {
    if (value.startsWith(prefix)) {
      return { kind, rest: value.slice(prefix.length) };
    }
  }
  return null;
}

/**
 * Parses a commit subject's autosquash marker, matching Git's prefix rules:
 * the first `fixup! `, `squash! `, or `amend! ` chooses the action, and any
 * further chained markers and leading whitespace are stripped to yield the
 * target query. Returns `null` when the subject has no marker or an empty
 * target.
 */
export function parseAutosquashMarker(subject: string): AutosquashMarker | null {
  const first = matchLeadingPrefix(subject);
  if (first === null) return null;

  let rest = first.rest.trimStart();
  let next = matchLeadingPrefix(rest);
  while (next !== null) {
    rest = next.rest.trimStart();
    next = matchLeadingPrefix(rest);
  }
  if (rest === "") return null;
  return { kind: first.kind, target: rest };
}

/** True when at least one commit in the range carries a `fixup!`, `squash!`, or `amend!` marker. */
export function hasAutosquashMarkers(commits: readonly AutosquashInputCommit[]): boolean {
  return commits.some((commit) => parseAutosquashMarker(commit.subject) !== null);
}

function actionSpecForKind(kind: AutosquashMarkerKind): AutosquashActionSpec {
  if (kind === "squash") return { action: "squash" };
  if (kind === "amend") return { action: "fixup", fixupFlag: "-C" };
  return { action: "fixup" };
}

function findSubjectTarget(
  commits: readonly AutosquashInputCommit[],
  isPrefixed: readonly boolean[],
  limit: number,
  target: string
): number {
  let prefixMatch = -1;
  for (let j = 0; j < limit; j++) {
    if (isPrefixed[j]) continue;
    const candidate = commits[j].subject;
    if (candidate === target) return j;
    if (prefixMatch < 0 && candidate.startsWith(target)) prefixMatch = j;
  }
  return prefixMatch;
}

function findHashTarget(lowerHashes: readonly string[], limit: number, target: string): number {
  if (!HASH_PREFIX_RE.test(target)) return -1;
  const query = target.toLowerCase();
  let match = -1;
  for (let j = 0; j < limit; j++) {
    if (!lowerHashes[j].startsWith(query)) continue;
    if (match >= 0) return -1;
    match = j;
  }
  return match;
}

function findAutosquashTarget(
  commits: readonly AutosquashInputCommit[],
  lowerHashes: readonly string[],
  isPrefixed: readonly boolean[],
  index: number,
  target: string
): number {
  const bySubject = findSubjectTarget(commits, isPrefixed, index, target);
  if (bySubject >= 0) return bySubject;
  return findHashTarget(lowerHashes, index, target);
}

/**
 * Rearranges a commit range (oldest first) according to Git's `--autosquash`
 * rules. Never mutates its input. Unmatched markers, markers targeting
 * commits outside the range, and forward references remain `pick` in source
 * order.
 */
export function arrangeAutosquash(
  commits: readonly AutosquashInputCommit[]
): AutosquashTodoEntry[] {
  const count = commits.length;
  if (count === 0) return [];

  const lowerHashes = commits.map((commit) => commit.hash.toLowerCase());
  const isPrefixed = commits.map((commit) => matchLeadingPrefix(commit.subject) !== null);
  const next = new Array<number>(count).fill(-1);
  const tail = new Array<number>(count).fill(-1);
  const moved = new Array<boolean>(count).fill(false);
  const actions: AutosquashActionSpec[] = commits.map(() => ({ action: "pick" }));

  for (let i = 0; i < count; i++) {
    const marker = parseAutosquashMarker(commits[i].subject);
    if (marker === null) continue;
    const targetIndex = findAutosquashTarget(commits, lowerHashes, isPrefixed, i, marker.target);
    if (targetIndex < 0) continue;

    moved[i] = true;
    actions[i] = actionSpecForKind(marker.kind);
    if (tail[targetIndex] < 0) {
      next[i] = next[targetIndex];
      next[targetIndex] = i;
    } else {
      const anchor = tail[targetIndex];
      next[i] = next[anchor];
      next[anchor] = i;
    }
    tail[targetIndex] = i;
  }

  const arranged: AutosquashTodoEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (moved[i]) continue;
    let cursor = i;
    while (cursor >= 0) {
      const commit = commits[cursor];
      const spec = actions[cursor];
      arranged.push(
        spec.fixupFlag === "-C"
          ? { action: "fixup", hash: commit.hash, fixupFlag: "-C" }
          : { action: spec.action, hash: commit.hash }
      );
      cursor = next[cursor];
    }
  }
  return arranged;
}

const TODO_LINE_RE = /^(pick|p|fixup|f|squash|s)\s+(?:(-C|-c)\s+)?([0-9a-f]{4,64})\b/i;

function resolveFullHash(
  prefix: string,
  commits: readonly AutosquashInputCommit[],
  lowerHashes: readonly string[]
): string {
  const query = prefix.toLowerCase();
  const matches: string[] = [];
  for (let i = 0; i < commits.length; i++) {
    if (lowerHashes[i].startsWith(query)) matches.push(commits[i].hash);
  }
  return matches.length === 1 ? matches[0] : prefix;
}

/**
 * Parses a Git interactive-rebase todo (`pick`, `fixup`, `fixup -C`,
 * `squash`) and resolves abbreviated hashes back to the full hashes in
 * `commits`. Ignores comments and blank lines.
 */
export function parseAutosquashTodo(
  todoText: string,
  commits: readonly AutosquashInputCommit[]
): AutosquashTodoEntry[] {
  const lowerHashes = commits.map((commit) => commit.hash.toLowerCase());
  const entries: AutosquashTodoEntry[] = [];

  for (const rawLine of todoText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = TODO_LINE_RE.exec(line);
    if (match === null) continue;

    const verb = match[1].toLowerCase();
    const flag = match[2];
    const hash = resolveFullHash(match[3], commits, lowerHashes);

    if (verb === "pick" || verb === "p") {
      entries.push({ action: "pick", hash });
    } else if (verb === "squash" || verb === "s") {
      entries.push({ action: "squash", hash });
    } else if (flag === "-C") {
      entries.push({ action: "fixup", hash, fixupFlag: "-C" });
    } else {
      entries.push({ action: "fixup", hash });
    }
  }
  return entries;
}
