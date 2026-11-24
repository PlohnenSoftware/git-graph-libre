import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import type { SimpleGit } from "simple-git";

import { runInteractiveRebase } from "@/backend/actions/rebaseInteractive";
import { loadRebaseRange } from "@/backend/queries/rebaseRange";
import { uncommittedDetails } from "@/backend/queries/uncommittedDetails";
import type { TodoEntry } from "@/backend/rebase/todo";
import type {
  ActionPayload,
  GitFixupCommitKind,
  GitFixupDialogInfoResult,
  GitRebaseRangeCommit,
  GitResetMode
} from "@/backend/types";
import { resolveGitDirs } from "@/backend/utils/gitDirs";
import {
  GitCommandError,
  type GitCommandRecorder,
  runGitRaw,
  runGitWithEnv
} from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

type CommitActionPayloads = {
  checkoutCommit: ActionPayload<"checkoutCommit">;
  cherrypickCommit: ActionPayload<"cherrypickCommit">;
  commitFixup: ActionPayload<"commitFixup">;
  dropCommit: ActionPayload<"dropCommit">;
  dropCommitSelection: ActionPayload<"dropCommitSelection">;
  editHeadCommitMessage: ActionPayload<"editHeadCommitMessage">;
  resetToCommit: ActionPayload<"resetToCommit">;
  revertCommit: ActionPayload<"revertCommit">;
  squashCommitSelection: ActionPayload<"squashCommitSelection">;
  undoLastCommit: ActionPayload<"undoLastCommit">;
};

type CommitActionInput<T extends keyof CommitActionPayloads> = CommitActionPayloads[T] & {
  repo?: string | null;
};

/**
 * Drop and squash run through the interactive-rebase handoff (F2-10), whose
 * dedicated spawn needs the resolved Git binary threaded in by the handler,
 * like the `interactiveRebase` action's (`config.gitPath()`).
 */
type TodoCommitActionInput<T extends keyof CommitActionPayloads> = CommitActionInput<T> & {
  binary: string;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function requireCommitHashes(commitHashes: readonly string[], label: string, minCount: number) {
  if (commitHashes.length < minCount) {
    throw new Error(`${label} requires at least ${minCount} commit hashes.`);
  }
  for (const commitHash of commitHashes) {
    requireValue(commitHash, "Commit hash");
  }
}

function requireResetMode(mode: string): asserts mode is GitResetMode {
  if (mode !== "soft" && mode !== "mixed" && mode !== "hard") {
    throw new Error("Reset mode must be soft, mixed, or hard.");
  }
}

function trimTrailingLineFeeds(message: string) {
  let end = message.length;
  while (end > 0 && message.codePointAt(end - 1) === 10) end -= 1;
  return message.slice(0, end);
}

function normalizeCommitMessage(message: string) {
  // Commit messages are user-controlled, so keep normalization regex-free and
  // avoid regex backtracking hotspots over unbounded text.
  return trimTrailingLineFeeds(message.replaceAll("\r\n", "\n"));
}

export async function checkoutCommit(
  git: SimpleGit,
  input: CommitActionInput<"checkoutCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  await runGitRaw(git, {
    label: "commit.checkout",
    kind: "action",
    args: ["checkout", input.commitHash],
    repo: input.repo ?? null,
    record
  });
}

export async function cherrypickCommit(
  git: SimpleGit,
  input: CommitActionInput<"cherrypickCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  const args = ["cherry-pick"];
  if (input.noCommit) args.push("--no-commit");
  if (input.parentIndex > 0) args.push("-m", String(input.parentIndex));
  args.push(input.commitHash);
  await runGitRaw(git, {
    label: "commit.cherrypick",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function revertCommit(
  git: SimpleGit,
  input: CommitActionInput<"revertCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  const args = ["revert", "--no-edit"];
  if (input.noCommit) args.push("--no-commit");
  if (input.parentIndex > 0) args.push("-m", String(input.parentIndex));
  args.push(input.commitHash);
  await runGitRaw(git, {
    label: "commit.revert",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function resetToCommit(
  git: SimpleGit,
  input: CommitActionInput<"resetToCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  requireResetMode(input.resetMode);
  await runGitRaw(git, {
    label: "commit.reset",
    kind: "action",
    args: ["reset", `--${input.resetMode}`, input.commitHash],
    repo: input.repo ?? null,
    record
  });
}

/** A full object name: SHA-1 (40 digits) or SHA-256 (64 digits), either letter case. */
const FULL_HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

/** The commits one drop or squash rebases over, with the selected set marked. */
type SelectionPlan = {
  readonly base: string;
  readonly range: readonly GitRebaseRangeCommit[];
  readonly selected: ReadonlySet<string>;
};

/**
 * The selected hashes as a lower-case set, rejecting anything that is not a
 * full hash before a hash reaches a Git argument list, where a leading dash
 * would read as an option.
 */
function fullHashSet(commitHashes: readonly string[]): ReadonlySet<string> {
  const selected = new Set<string>();
  for (const commitHash of commitHashes) {
    if (!FULL_HASH.test(commitHash)) {
      throw new Error(`"${commitHash}" is not a full commit hash.`);
    }
    selected.add(commitHash.toLowerCase());
  }
  return selected;
}

/** The first parent of `hash`, or null when it is the root commit. */
async function firstParentOf(
  git: SimpleGit,
  repo: string,
  hash: string,
  record?: GitCommandRecorder
): Promise<string | null> {
  const output = await runGitRaw(git, {
    label: "commit.todo.parent",
    kind: "action",
    args: ["show", "-s", "--format=%P", hash],
    repo,
    record
  });
  const first = output
    .trim()
    .split(" ")
    .find((parent) => parent !== "");
  return first ?? null;
}

/**
 * The revision the selection's rebase starts after. `--octopus` finds the
 * common ancestor of `HEAD` and every selected commit together (plain
 * `merge-base` with three or more arguments treats later arguments as a
 * hypothetical merge, returning the newest selected commit instead of the
 * oldest). When that ancestor is itself selected, the rebase starts after
 * its first parent; a selected root has no parent and is refused.
 */
async function selectionBase(
  git: SimpleGit,
  repo: string,
  selected: ReadonlySet<string>,
  record?: GitCommandRecorder
): Promise<string> {
  let mergeBase = "";
  try {
    mergeBase = (
      await runGitRaw(git, {
        label: "commit.todo.mergeBase",
        kind: "action",
        args: ["merge-base", "--octopus", "HEAD", ...selected],
        repo,
        record
      })
    )
      .trim()
      .toLowerCase();
  } catch (error: unknown) {
    if (error instanceof GitCommandError && error.record.error?.exitCode === 1) {
      throw new Error("Every selected commit must be in the current branch's history.");
    }
    throw error;
  }
  if (mergeBase === "") {
    throw new Error("Every selected commit must be in the current branch's history.");
  }
  if (!selected.has(mergeBase)) return mergeBase;
  const parent = await firstParentOf(git, repo, mergeBase, record);
  if (parent === null) {
    throw new Error("The root commit cannot be dropped or squashed.");
  }
  return parent;
}

/**
 * Reads the range the selection's todo must cover and checks the selection
 * against it: every selected commit must lie in `base..HEAD`, and — the
 * menu's standing exclusion, kept here so no caller can bypass it — have
 * exactly one parent, so merges are refused rather than flattened silently
 * by a `pick` or failed on by a `fixup`. Unselected merge commits in the
 * range are omitted from the todo (matching Git's linear `rebase -i` todo),
 * because Git refuses `pick <merge>` and leaves a broken rebase state.
 */
async function planSelectionRebase(
  git: SimpleGit,
  repo: string,
  selected: ReadonlySet<string>,
  record?: GitCommandRecorder
): Promise<SelectionPlan> {
  const base = await selectionBase(git, repo, selected, record);
  const range = await loadRebaseRange(git, { repo, base, recordGitCommand: record });
  if (range.error !== null) throw new Error(range.error.message);
  const inRange = new Map(range.commits.map((commit) => [commit.hash.toLowerCase(), commit]));
  for (const hash of selected) {
    const commit = inRange.get(hash);
    if (commit === undefined) {
      throw new Error("Every selected commit must be in the current branch's history.");
    }
    if (commit.parents.length !== 1) {
      throw new Error("Only commits with exactly one parent can be dropped or squashed.");
    }
  }
  return {
    base,
    range: range.commits.filter((commit) => !commit.isMerge),
    selected
  };
}

/**
 * Runs the planned todo through the interactive handoff. A pause is a
 * successful start — the in-progress banner (F2-03) takes over — while a
 * refusal surfaces Git's own words, as the `interactiveRebase` action does.
 */
async function runSelectionTodo(
  git: SimpleGit,
  input: { repo: string; binary: string; plan: SelectionPlan; entries: TodoEntry[] },
  fallback: string,
  record?: GitCommandRecorder
): Promise<void> {
  const result = await runInteractiveRebase(
    git,
    {
      repo: input.repo,
      binary: input.binary,
      base: input.plan.base,
      entries: input.entries,
      rangeHashes: input.plan.range.map((commit) => commit.hash)
    },
    record
  );
  if (result.outcome === "failed" || result.outcome === "invalid-todo") {
    throw new Error(result.stderr.trim() === "" ? fallback : result.stderr);
  }
}

function dropEntries(plan: SelectionPlan): TodoEntry[] {
  return plan.range.map((commit) => ({
    action: plan.selected.has(commit.hash.toLowerCase()) ? "drop" : "pick",
    hash: commit.hash
  }));
}

/**
 * The squash todo: the oldest selected commit is picked carrying the final
 * message, the other selected commits meld into it as `fixup`. A `fixup`
 * melds into the commit before it, so the selection must be one unbroken
 * parent-child chain in range order; a gap or sibling branch would meld a
 * commit into the wrong parent, so it is refused rather than reordered.
 */
function squashEntries(plan: SelectionPlan, message: string): TodoEntry[] {
  const indices = plan.range.flatMap((commit, index) =>
    plan.selected.has(commit.hash.toLowerCase()) ? [index] : []
  );
  const first = indices[0];
  const last = indices.at(-1);
  if (first === undefined || last === undefined || last - first !== indices.length - 1) {
    throw new Error("Only an unbroken run of commits can be squashed.");
  }
  for (let i = first + 1; i <= last; i++) {
    if (plan.range[i]?.parents[0]?.toLowerCase() !== plan.range[i - 1]?.hash.toLowerCase()) {
      throw new Error("Only an unbroken run of commits can be squashed.");
    }
  }
  return plan.range.map((commit, index) => {
    if (index === first) return { action: "pick", hash: commit.hash, message };
    return {
      action: plan.selected.has(commit.hash.toLowerCase()) ? "fixup" : "pick",
      hash: commit.hash
    };
  });
}

async function dropSelection(
  git: SimpleGit,
  input: { repo: string; binary: string; commitHashes: readonly string[] },
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.repo, "Repository");
  requireValue(input.binary, "Git binary");
  const plan = await planSelectionRebase(git, input.repo, fullHashSet(input.commitHashes), record);
  await runSelectionTodo(
    git,
    { repo: input.repo, binary: input.binary, plan, entries: dropEntries(plan) },
    "The selected commits could not be dropped.",
    record
  );
}

export async function dropCommit(
  git: SimpleGit,
  input: TodoCommitActionInput<"dropCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  await dropSelection(
    git,
    { repo: input.repo ?? "", binary: input.binary, commitHashes: [input.commitHash] },
    record
  );
}

export async function dropCommitSelection(
  git: SimpleGit,
  input: TodoCommitActionInput<"dropCommitSelection">,
  record?: GitCommandRecorder
): Promise<void> {
  requireCommitHashes(input.commitHashes, "Dropping selected commits", 1);
  await dropSelection(
    git,
    { repo: input.repo ?? "", binary: input.binary, commitHashes: input.commitHashes },
    record
  );
}

export async function squashCommitSelection(
  git: SimpleGit,
  input: TodoCommitActionInput<"squashCommitSelection">,
  record?: GitCommandRecorder
): Promise<void> {
  requireCommitHashes(input.commitHashes, "Squashing selected commits", 2);
  requireValue(input.message, "Commit message");
  const repo = input.repo ?? "";
  requireValue(repo, "Repository");
  requireValue(input.binary, "Git binary");
  const selected = fullHashSet(input.commitHashes);
  if (selected.size < 2) {
    throw new Error("Squashing selected commits requires at least 2 distinct commit hashes.");
  }
  const plan = await planSelectionRebase(git, repo, selected, record);
  await runSelectionTodo(
    git,
    {
      repo,
      binary: input.binary,
      plan,
      entries: squashEntries(plan, input.message)
    },
    "The selected commits could not be squashed.",
    record
  );
}

export async function undoLastCommit(
  git: SimpleGit,
  input: CommitActionInput<"undoLastCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  await runGitRaw(git, {
    label: "commit.undoLast",
    kind: "action",
    args: ["reset", "--soft", "HEAD^"],
    repo: input.repo ?? null,
    record
  });
}

export async function editHeadCommitMessage(
  git: SimpleGit,
  input: CommitActionInput<"editHeadCommitMessage">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  requireValue(input.message, "Commit message");

  const head = (
    await runGitRaw(git, {
      label: "commit.editMessage.head",
      kind: "action",
      args: ["rev-parse", "HEAD"],
      repo: input.repo ?? null,
      record
    })
  ).trim();
  if (head !== input.commitHash) {
    throw new Error("Editing commit messages is currently supported only for HEAD.");
  }

  const currentMessage = await runGitRaw(git, {
    label: "commit.editMessage.current",
    kind: "action",
    args: ["log", "-1", "--format=%B", "HEAD"],
    repo: input.repo ?? null,
    record
  });
  if (normalizeCommitMessage(currentMessage) === normalizeCommitMessage(input.message)) return;

  await runGitRaw(git, {
    label: "commit.editMessage.amend",
    kind: "action",
    args: ["commit", "--amend", "-m", input.message],
    repo: input.repo ?? null,
    record
  });
}

const FIXUP_KINDS: ReadonlySet<string> = new Set<GitFixupCommitKind>([
  "fixup",
  "squash",
  "reword",
  "amend"
]);

/**
 * Editor command for `--fixup=reword:` and `--fixup=amend:`, which refuse `-m`
 * and `-F` in Git (verified on Git 2.56.1). Follows the same env-var copy
 * pattern as `SEQUENCE_EDITOR_COMMAND` in `rebaseInteractive.ts`.
 */
const COMMIT_MSG_EDITOR_COMMAND = 'cp -- "$GGL_COMMIT_MSG_FILE"';

function requireFullCommitHash(hash: string): void {
  if (!FULL_HASH.test(hash)) {
    throw new Error(`"${hash}" is not a full commit hash.`);
  }
}

function requireFixupKind(kind: string): asserts kind is GitFixupCommitKind {
  if (!FIXUP_KINDS.has(kind)) {
    throw new Error(`Fixup commit kind must be fixup, squash, reword, or amend.`);
  }
}

async function readTargetSubject(
  git: SimpleGit,
  target: string,
  repo: string,
  record?: GitCommandRecorder
): Promise<string> {
  return (
    await runGitRaw(git, {
      label: "commit.fixup.subject",
      kind: "action",
      args: ["show", "-s", "--format=%s", target],
      repo,
      record
    })
  ).trim();
}

async function commitWithAmendEditor(
  git: SimpleGit,
  options: {
    readonly repo: string;
    readonly binary: string;
    readonly target: string;
    readonly mode: "reword" | "amend";
    readonly message: string;
    readonly allowEmpty: boolean;
  },
  record?: GitCommandRecorder
): Promise<void> {
  const subject = await readTargetSubject(git, options.target, options.repo, record);
  const { gitDir } = resolveGitDirs(path.resolve(options.repo));
  const msgFile = path.join(gitDir, `ggl-fixup-msg-${crypto.randomUUID()}`);
  const fullText = `amend! ${subject}\n\n${options.message}\n`;
  const args = ["commit"];
  if (options.allowEmpty) args.push("--allow-empty");
  args.push(`--fixup=${options.mode}:${options.target}`);

  try {
    fs.writeFileSync(msgFile, fullText, "utf8");
    await runGitWithEnv(git, {
      label: `commit.fixup.${options.mode}`,
      kind: "action",
      args,
      repo: options.repo,
      binary: options.binary,
      env: {
        GIT_EDITOR: COMMIT_MSG_EDITOR_COMMAND,
        GGL_COMMIT_MSG_FILE: msgFile,
        LC_ALL: "C",
        GIT_TERMINAL_PROMPT: "0"
      },
      record
    });
  } finally {
    fs.rmSync(msgFile, { force: true });
  }
}

async function requireStagedChanges(
  git: SimpleGit,
  repo: string,
  record?: GitCommandRecorder
): Promise<void> {
  const status = await uncommittedDetails(git, { repo, recordGitCommand: record });
  if (status.error !== null) throw new Error(status.error.message);
  if ((status.changes?.staged.length ?? 0) === 0) {
    throw new Error("Staged changes are required before creating this commit.");
  }
}

/**
 * Creates a `fixup!`, `squash!`, or `amend!` (`reword`/`amend`) commit
 * targeting `input.target` (F2-06).
 *
 * - `fixup`, `squash`, and `amend` require staged changes.
 * - `reword` creates an empty `amend!` commit with `--allow-empty
 *   --fixup=reword:<target>` and leaves any staged changes untouched.
 * - Every `git commit` call runs through `runGitWithEnv` rather than
 *   `simple-git.raw`, because `git commit` writes "nothing to commit" to
 *   stdout with empty stderr and exit 1, which `simple-git` silently resolves.
 * - `reword` and `amend` pass their replacement message via `GIT_EDITOR`
 *   because Git refuses `-m` and `-F` with `--fixup=reword:` / `--fixup=amend:`.
 */
export async function commitFixup(
  git: SimpleGit,
  input: TodoCommitActionInput<"commitFixup">,
  record?: GitCommandRecorder
): Promise<void> {
  requireFullCommitHash(input.target);
  requireFixupKind(input.kind);
  const repo = input.repo ?? "";
  requireValue(repo, "Repository");
  requireValue(input.binary, "Git binary");
  const message = normalizeCommitMessage(input.message ?? "");
  const hasMessage = message.trim() !== "";
  const baseEnv = { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" };

  if (input.kind === "reword") {
    requireValue(message, "Commit message");
    await commitWithAmendEditor(
      git,
      {
        repo,
        binary: input.binary,
        target: input.target,
        mode: "reword",
        message,
        allowEmpty: true
      },
      record
    );
    return;
  }

  await requireStagedChanges(git, repo, record);

  if (input.kind === "fixup") {
    const args = ["commit", "--fixup", input.target];
    if (hasMessage) args.push("-m", message);
    await runGitWithEnv(git, {
      label: "commit.fixup",
      kind: "action",
      args,
      repo,
      binary: input.binary,
      env: baseEnv,
      record
    });
    return;
  }

  if (input.kind === "squash") {
    const args = ["commit", "--squash", input.target];
    if (hasMessage) args.push("-m", message);
    else args.push("--no-edit");
    await runGitWithEnv(git, {
      label: "commit.fixup.squash",
      kind: "action",
      args,
      repo,
      binary: input.binary,
      env: baseEnv,
      record
    });
    return;
  }

  if (!hasMessage) {
    await runGitWithEnv(git, {
      label: "commit.fixup.amend",
      kind: "action",
      args: ["commit", `--fixup=amend:${input.target}`, "--no-edit"],
      repo,
      binary: input.binary,
      env: baseEnv,
      record
    });
    return;
  }

  await commitWithAmendEditor(
    git,
    {
      repo,
      binary: input.binary,
      target: input.target,
      mode: "amend",
      message,
      allowEmpty: false
    },
    record
  );
}

/**
 * Reads the current staged file count and target commit's subject/body for
 * the Create Fixup / Squash / Reword dialog (F2-06). Read-only and avoids
 * firing the staging-panel telemetry hook.
 */
export async function loadFixupDialogInfo(
  git: SimpleGit,
  input: {
    readonly repo: string;
    readonly target: string;
    readonly recordGitCommand?: GitCommandRecorder;
  }
): Promise<GitFixupDialogInfoResult> {
  if (!FULL_HASH.test(input.target)) {
    return {
      stagedCount: 0,
      targetSubject: "",
      targetMessage: "",
      error: {
        message: `"${input.target}" is not a full commit hash.`,
        stderr: null,
        exitCode: null,
        task: null
      }
    };
  }

  try {
    const status = await uncommittedDetails(git, {
      repo: input.repo,
      recordGitCommand: input.recordGitCommand
    });
    if (status.error !== null || status.changes === null) {
      return {
        stagedCount: 0,
        targetSubject: "",
        targetMessage: "",
        error: status.error ?? {
          message: "Unable to read staged changes.",
          stderr: null,
          exitCode: null,
          task: null
        }
      };
    }

    const raw = await runGitRaw(git, {
      label: "commit.fixup.targetInfo",
      kind: "query",
      args: ["show", "-s", "--format=%s%x1f%B", input.target],
      repo: input.repo,
      record: input.recordGitCommand
    });
    const sep = raw.indexOf("\u001f");
    const targetSubject = (sep < 0 ? raw : raw.slice(0, sep)).trim();
    const targetMessage = normalizeCommitMessage(sep < 0 ? targetSubject : raw.slice(sep + 1));

    return {
      stagedCount: status.changes.staged.length,
      targetSubject,
      targetMessage,
      error: null
    };
  } catch (error: unknown) {
    return {
      stagedCount: 0,
      targetSubject: "",
      targetMessage: "",
      error: toGitQueryError(error, "Unable to load fixup target details")
    };
  }
}
