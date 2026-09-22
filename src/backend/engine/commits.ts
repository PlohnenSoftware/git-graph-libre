/**
 * `loadCommits` through the engine (Phase 16, slice 16.5).
 *
 * Subslice 16.5a: routing and options. The wrapper routes to the engine only
 * when none of the declines applies — decided *before* the call, never by
 * catching a failure — and builds the engine `LogOptions` JSON from the same
 * route input the CLI implementation consumes. Nothing here reimplements a
 * CLI parse: ref selection, author normalization and hidden-remote
 * normalization reuse the CLI's own helpers, so both backends read the same
 * request by construction.
 *
 * The declines (each pinned by a test in `tests/backend/engine/commits.test.ts`):
 *
 * - the signature column is visible (`showSignature`): the engine reports no
 *   per-commit signatures, and the CLI's `%G?` plus batched `gpgsig` probe
 *   (the 1.2.0 work separating genuinely unsigned from SSH-signed-but-
 *   unverifiable) has no engine counterpart;
 * - `Author Date`: the engine's wire date is always the committer date, while
 *   the CLI formats `%at` here;
 * - reflog tips or unreachable-commit discovery on a show-all load: the CLI
 *   adds `--reflog` / runs `git fsck --unreachable`, and the engine has no
 *   equivalent for either. With explicit refs the CLI ignores both flags
 *   (early return before `--reflog`, no `fsck`), so those loads stay on the
 *   engine;
 * - a `--glob=` branch pattern: the engine's tip resolution silently skips
 *   revisions it cannot resolve instead of expanding the glob.
 * - the `topo` commit ordering: the engine walks each line of history
 *   depth-first while git interleaves branch lines by date within the same
 *   topological constraint — both valid, visibly different row orders, so
 *   topo loads stay on the CLI (pinned by the parity table).
 */

import type { SimpleGit } from "simple-git";

import { gitRefSignatureAtom } from "@/backend/queries/loadCommits";
import type { CommitOrdering, DateType, GitCommitNode, GitRef } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { selectedLogRefs, uniqueNonEmpty } from "@/backend/utils/logFilters";
import { isHiddenRemoteRef, normalizeHiddenRemotes } from "@/backend/utils/remoteRefs";

/** The route fields the engine decision, options and (16.5b) mapping need. */
export type EngineLoadCommitsInput = {
  branchName: string;
  branches?: string[] | null;
  authors?: string[] | null;
  tags?: string[] | null;
  maxCommits: number;
  showRemoteBranches: boolean;
  hiddenRemotes?: string[];
  showTags?: boolean;
  includeReflog?: boolean;
  includeUnreachableCommits?: boolean;
  onlyFollowFirstParent?: boolean;
  commitOrdering?: CommitOrdering;
  showSignature?: boolean;
  /**
   * Consumed by the 16.5b mapper, not by the predicate or options: the engine
   * always reads stashes (it walks from their bases), so when the caller did
   * not opt into stash rows the mapper strips them back out to match the CLI.
   */
  showStashes?: boolean;
  dateType: DateType;
  showUncommittedChanges: boolean;
};

/**
 * The `git log` tip list both backends read: null is the show-all load, an
 * array is the filtered one. Single source of truth — the CLI builds its log
 * args from exactly this, so the decline below sees the same show-all test.
 */
export function engineLoadCommitsRefs(input: EngineLoadCommitsInput): string[] | null {
  return selectedLogRefs({
    branches: input.branches,
    legacyBranchName: input.branchName,
    tags: input.tags
  });
}

/**
 * Whether the engine may serve this load. Every false is a *decline*, not a
 * bug: the caller routes those loads straight to the CLI, unchanged.
 */
export function shouldServeLoadCommitsFromEngine(input: EngineLoadCommitsInput): boolean {
  // The signature column needs the CLI's `%G?` + `gpgsig` probe per commit.
  if (input.showSignature === true) return false;
  // The engine's wire date is always the committer date.
  if (input.dateType === "Author Date") return false;
  // The engine's topo tie-breaks differ visibly from git's (see above).
  if (input.commitOrdering === "topo") return false;
  const refs = engineLoadCommitsRefs(input);
  // `--glob=` is not understood by the engine's tip resolution.
  if (refs !== null && refs.some((ref) => ref.startsWith("--glob="))) return false;
  if (refs !== null) return true;
  // On a show-all load the CLI adds `--reflog` / `git fsck --unreachable`,
  // which have no engine equivalent at all. With explicit refs the CLI
  // ignores both flags, so those loads stay on the engine.
  if (input.includeReflog === true) return false;
  if (input.includeUnreachableCommits === true) return false;
  return true;
}

/** One tag label as the engine encodes it. `annotated` marks the peeled record. */
export type EngineCommitTag = {
  name: string;
  annotated: boolean;
};

/** One remote label as the engine encodes it. `remote` names the owning remote, if known. */
export type EngineCommitRemote = {
  name: string;
  remote: string | null;
};

/** The stash attached to a wire commit: a row of its own above its base, or an in-place mark. */
export type EngineCommitStash = {
  selector: string;
  baseHash: string;
  untrackedFilesHash: string | null;
};

/** One commit as the engine encodes it. Ref order is the engine's scan order (see 16.5d). */
export type EngineCommit = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  heads: string[];
  tags: EngineCommitTag[];
  remotes: EngineCommitRemote[];
  stash: EngineCommitStash | null;
};

/**
 * `load_commits` decoded. `tags` and `branches` ride along for callers that
 * need them; this read consumes neither (branch display stays on
 * `loadBranches`, on the CLI), so they are carried, not mapped.
 */
export type EngineCommitData = {
  commits: EngineCommit[];
  head: string | null;
  tags: string[];
  branches?: string[] | null;
  moreCommitsAvailable: boolean;
  error: string | null;
};

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string");
}

function isEngineCommitTag(value: unknown): value is EngineCommitTag {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { annotated?: unknown }).annotated === "boolean"
  );
}

function isEngineCommitRemote(value: unknown): value is EngineCommitRemote {
  if (typeof value !== "object" || value === null) return false;
  const { name, remote } = value as { name?: unknown; remote?: unknown };
  return typeof name === "string" && (typeof remote === "string" || remote === null);
}

function isEngineCommitStash(value: unknown): value is EngineCommitStash {
  if (typeof value !== "object" || value === null) return false;
  const { selector, baseHash, untrackedFilesHash } = value as {
    selector?: unknown;
    baseHash?: unknown;
    untrackedFilesHash?: unknown;
  };
  return (
    typeof selector === "string" &&
    typeof baseHash === "string" &&
    (typeof untrackedFilesHash === "string" || untrackedFilesHash === null)
  );
}

function isEngineCommit(value: unknown): value is EngineCommit {
  if (typeof value !== "object" || value === null) return false;
  const commit = value as Record<string, unknown>;
  return (
    typeof commit.hash === "string" &&
    isStringList(commit.parents) &&
    typeof commit.author === "string" &&
    typeof commit.email === "string" &&
    typeof commit.date === "number" &&
    typeof commit.message === "string" &&
    isStringList(commit.heads) &&
    Array.isArray(commit.tags) &&
    (commit.tags as unknown[]).every(isEngineCommitTag) &&
    Array.isArray(commit.remotes) &&
    (commit.remotes as unknown[]).every(isEngineCommitRemote) &&
    (commit.stash === null || isEngineCommitStash(commit.stash))
  );
}

/**
 * Decode and validate an engine payload. Anything malformed is null — never
 * a partial page the caller would have to second-guess.
 */
export function parseEngineCommitData(text: string): EngineCommitData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { commits, head, tags, branches, moreCommitsAvailable, error } =
    parsed as Record<string, unknown>;
  if (!Array.isArray(commits) || !(commits as unknown[]).every(isEngineCommit)) return null;
  if (head !== null && typeof head !== "string") return null;
  if (!isStringList(tags)) return null;
  if (
    branches !== undefined &&
    branches !== null &&
    !isStringList(branches as unknown)
  ) {
    return null;
  }
  if (typeof moreCommitsAvailable !== "boolean") return null;
  if (error !== null && typeof error !== "string") return null;
  return {
    commits: commits as EngineCommit[],
    head: head as string | null,
    tags: tags as string[],
    branches: (branches ?? null) as string[] | null,
    moreCommitsAvailable,
    error: error as string | null
  };
}

/**
 * The `stash@{n}` selector as the CLI contract carries it. The engine names
 * the whole ref (`refs/stash@{0}`); selectors are never cached across
 * refreshes because they renumber on drop/pop, so the short form is resolved
 * fresh per load like the CLI's own rows.
 */
export function shortStashRef(selector: string): string {
  return selector.startsWith("refs/") ? selector.slice("refs/".length) : selector;
}

/**
 * Whether a stashed wire commit is a synthetic row above its base (the only
 * parent is the base) rather than an in-place mark on a stash commit that is
 * itself on screen. A stash commit always carries its index state as a second
 * parent, so a single parent equal to the base is the row fingerprint.
 */
function isStashRow(commit: EngineCommit, stash: EngineCommitStash): boolean {
  return commit.parents.length === 1 && commit.parents[0] === stash.baseHash;
}

const headRefName = (name: string): string => `refs/heads/${name}`;
const remoteRefName = (name: string): string => `refs/remotes/${name}`;
const tagRefName = (name: string): string => `refs/tags/${name}`;

const refNameEncoder = new TextEncoder();

/**
 * Byte order over UTF-8, the order `git for-each-ref` lists refnames in.
 * Only reachable with non-ASCII refnames (every ASCII order agrees); kept
 * exact so the seam never depends on the engine's scan order.
 */
function compareRefNames(a: string, b: string): number {
  const left = refNameEncoder.encode(a);
  const right = refNameEncoder.encode(b);
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return left.length - right.length;
}

/** `for-each-ref` sorts the whole ref set by refname, so every head sorts before every remote before every tag. */
function refSortRank(ref: GitRef): number {
  if (ref.type === "head") return 0;
  if (ref.type === "remote") return 1;
  return 2;
}

function fullRefName(ref: GitRef): string {
  if (ref.type === "head") return headRefName(ref.name);
  if (ref.type === "remote") return remoteRefName(ref.name);
  return tagRefName(ref.name);
}

/**
 * Map one engine page onto the project node shape. Ref labels are re-sorted
 * into the CLI's `for-each-ref` order (the engine annotates heads, tags,
 * remotes; the CLI lists heads, remotes, tags, each byte-sorted), so label
 * order agrees by construction rather than by scan luck; the CLI's
 * `signature` key stays absent everywhere except stash rows, which the CLI
 * pins to null; in-place stash marks are always stripped because the CLI
 * never marks — it only injects rows.
 *
 * Two CLI parse artifacts are mirrored deliberately, so the parity table
 * stays a strict `toEqual` and any future CLI change fails loudly instead of
 * drifting silently: a root commit's parents are `[""]` (`"".split(" ")`),
 * and tag `signed` is provisionally false (the engine reports presence
 * nowhere — 16.5d decides between a CLI fill and a recorded deviation).
 */
export function mapEngineCommitData(data: EngineCommitData, showStashes: boolean): GitCommitNode[] {
  const nodes: GitCommitNode[] = [];
  for (const commit of data.commits) {
    const { stash } = commit;
    if (stash !== null && isStashRow(commit, stash)) {
      if (!showStashes) continue;
      nodes.push({
        hash: commit.hash,
        parentHashes: [stash.baseHash],
        author: "",
        email: "",
        date: commit.date,
        message: commit.message,
        refs: [],
        signature: null,
        stash: { ref: shortStashRef(stash.selector) }
      });
      continue;
    }
    const refs: GitRef[] = [
      ...commit.heads.map((name): GitRef => ({ hash: commit.hash, name, type: "head" })),
      ...commit.tags.map(
        (tag): GitRef => ({ hash: commit.hash, name: tag.name, type: "tag", signed: false })
      ),
      ...commit.remotes.map(
        (remote): GitRef => ({ hash: commit.hash, name: remote.name, type: "remote" })
      )
    ];
    refs.sort(
      (a, b) => refSortRank(a) - refSortRank(b) || compareRefNames(fullRefName(a), fullRefName(b))
    );
    nodes.push({
      hash: commit.hash,
      parentHashes: commit.parents.length === 0 ? [""] : [...commit.parents],
      author: commit.author,
      email: commit.email,
      date: commit.date,
      message: commit.message,
      refs
    });
  }
  return nodes;
}

/** One remote `HEAD` symref target as the fill reads it. */
export type RemoteHeadLabel = {
  hash: string;
  name: string;
};

const remoteHeadLineEndings = /\r\n|\r|\n/;

/**
 * Parse a `for-each-ref` symref scan over `refs/remotes`. Only symrefs carry
 * a target, so a line with an empty third field is a plain ref the engine
 * already recorded. Nothing here reimplements a CLI parse: the shape mirrors
 * the loader's own ref records, narrowed to the symbolic labels.
 */
export function parseRemoteHeadLabels(stdout: string): RemoteHeadLabel[] {
  const labels: RemoteHeadLabel[] = [];
  for (const line of stdout.split(remoteHeadLineEndings)) {
    if (line === "") continue;
    const [hash = "", refName = "", symref = ""] = line.split("\0");
    if (hash === "" || symref === "" || !refName.startsWith("refs/remotes/")) continue;
    labels.push({ hash, name: refName.slice("refs/remotes/".length) });
  }
  return labels;
}

/**
 * Attach remote `HEAD` symref labels to the nodes at their targets, in
 * `for-each-ref` byte order among the node's remote labels. Hidden remotes
 * stay hidden via the CLI's own predicate; labels whose target is off-page
 * or already recorded are skipped.
 */
export function insertRemoteHeadLabels(
  nodes: GitCommitNode[],
  labels: RemoteHeadLabel[],
  hiddenRemotes?: string[]
): void {
  if (labels.length === 0) return;
  const byHash = new Map<string, GitCommitNode>();
  for (const node of nodes) {
    if (!byHash.has(node.hash)) byHash.set(node.hash, node);
  }
  for (const label of labels) {
    if (isHiddenRemoteRef(label.name, hiddenRemotes)) continue;
    const node = byHash.get(label.hash);
    if (node === undefined) continue;
    if (node.refs.some((ref) => ref.type === "remote" && ref.name === label.name)) continue;
    const ref: GitRef = { hash: label.hash, name: label.name, type: "remote" };
    const fullName = remoteRefName(label.name);
    let index = node.refs.length;
    for (let existingIndex = 0; existingIndex < node.refs.length; existingIndex++) {
      const existing = node.refs[existingIndex];
      if (
        refSortRank(existing) > 1 ||
        (refSortRank(existing) === 1 &&
          compareRefNames(fullRefName(existing), fullName) > 0)
      ) {
        index = existingIndex;
        break;
      }
    }
    node.refs.splice(index, 0, ref);
  }
}

export type RemoteHeadFills = {
  git: SimpleGit;
  repo: string;
  recordGitCommand?: GitCommandRecorder;
};

/**
 * One narrow `for-each-ref` over `refs/remotes` for the symbolic `HEAD`
 * labels the engine never records, attached in CLI order. A failed scan
 * resolves to no labels rather than a failed graph — the same trade the
 * stash rows make: the engine served the page, and losing it over pendant
 * labels would be the wrong trade.
 */
export async function attachRemoteHeadLabels(
  fills: RemoteHeadFills,
  nodes: GitCommitNode[],
  hiddenRemotes?: string[]
): Promise<void> {
  let stdout: string;
  try {
    stdout = await runGitRaw(fills.git, {
      label: "loadCommits.remoteHeads",
      args: ["for-each-ref", "--format=%(objectname)%00%(refname)%00%(symref)", "refs/remotes"],
      repo: fills.repo,
      record: fills.recordGitCommand
    });
  } catch {
    return;
  }
  insertRemoteHeadLabels(nodes, parseRemoteHeadLabels(stdout), hiddenRemotes);
}

/**
 * Tag names carrying a signature block, as the fill reads them. Only
 * annotated tags can carry one, so every name here flips a badge the CLI
 * would also show.
 */
export function parseSignedTagNames(stdout: string): string[] {
  const signed: string[] = [];
  for (const line of stdout.split(remoteHeadLineEndings)) {
    if (line === "") continue;
    const [refName = "", hasSignature = ""] = line.split("\0");
    if (hasSignature !== "1" || !refName.startsWith("refs/tags/")) continue;
    signed.push(refName.slice("refs/tags/".length));
  }
  return signed;
}

/** Flip the signed badge on the named tag labels. Unknown names are ignored. */
export function applySignedTagNames(nodes: GitCommitNode[], signed: string[]): void {
  if (signed.length === 0) return;
  const names = new Set(signed);
  for (const node of nodes) {
    for (const ref of node.refs) {
      if (ref.type === "tag" && names.has(ref.name)) ref.signed = true;
    }
  }
}

/**
 * One narrow `for-each-ref` over `refs/tags` for the signature presence the
 * engine never reports, reusing the loader's own signature atom so both
 * scans classify identically. Same failure trade as the other fills: a
 * failed scan keeps the page rather than failing the graph.
 */
export async function attachSignedTagNames(
  fills: RemoteHeadFills,
  nodes: GitCommitNode[]
): Promise<void> {
  let stdout: string;
  try {
    stdout = await runGitRaw(fills.git, {
      label: "loadCommits.signedTags",
      args: ["for-each-ref", `--format=%(refname)%00${gitRefSignatureAtom}`, "refs/tags"],
      repo: fills.repo,
      record: fills.recordGitCommand
    });
  } catch {
    return;
  }
  applySignedTagNames(nodes, parseSignedTagNames(stdout));
}

/**
 * The `load_commits` options JSON. Every field is threaded from the route
 * input the CLI consumes, or pinned to the CLI-equivalent constant where the
 * CLI has no such knob:
 *
 * - `showRemoteHeads: true`: the CLI's `for-each-ref` lists non-symbolic
 *   `/HEAD` refs, which the engine only includes with the flag on (symbolic
 *   remote HEADs stay an engine gap — probed in 16.5d);
 * - `showUntrackedFiles: true`: the CLI counts every `status.files` entry,
 *   untracked files included;
 * - `showTags` covers tags shown *or* selected as filters (the CLI scans
 *   `refs/tags` for both), while `showCommitsOnlyReferencedByTags` follows
 *   the shown flag alone, reproducing the CLI's `--tags` walk tips;
 * - `filterPaths`, `deferRemoteRefs`, `deferUncommittedChanges`, `useMailmap`
 *   are all false/empty: this fork's `loadCommits` route sends none of them
 *   and the CLI honors none of them.
 */
export function buildLoadCommitsOptions(input: EngineLoadCommitsInput): string {
  // The CLI scans `refs/tags` when tags are shown OR selected as filters,
  // but only walks `--tags` tips when they are shown: two flags, not one.
  const showTags = input.showTags !== false || (input.tags ?? null) !== null;
  return JSON.stringify({
    branches: engineLoadCommitsRefs(input),
    authors: uniqueNonEmpty(input.authors),
    maxCommits: input.maxCommits,
    showTags,
    showRemoteBranches: input.showRemoteBranches,
    showRemoteHeads: true,
    deferRemoteRefs: false,
    includeCommitsMentionedByReflogs: input.includeReflog === true,
    onlyFollowFirstParent: input.onlyFollowFirstParent === true,
    commitOrdering: input.commitOrdering ?? "date",
    remotes: [],
    hideRemotes: normalizeHiddenRemotes(input.hiddenRemotes),
    filterPaths: [],
    deferUncommittedChanges: false,
    showUncommittedChanges: input.showUncommittedChanges,
    showUntrackedFiles: true,
    showCommitsOnlyReferencedByTags: input.showTags !== false,
    useMailmap: false
  });
}
