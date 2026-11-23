/**
 * The Git handoff for interactive rebase (F2-01b): validate a prepared
 * todo, hand it to `git rebase -i` through a sequence editor that copies
 * it over Git's own todo file, and classify how the run ended from Git's
 * state files and exit code, never from its message text.
 *
 * Message route (decision IQ4, settled by this slice's spike on real Git
 * 2.56.1): a reworded commit, or a squash group whose target carries an
 * edited message, becomes its todo lines plus one trailing
 * `exec git commit --amend -F '<file>'`, with the message in a file under
 * the per-worktree git dir. The alternative, a `GIT_EDITOR` script handing
 * out prepared messages in order, loses the message when the user runs
 * `git rebase --continue` from a terminal after a stop (the environment is
 * gone; the exec line is in Git's own todo, so it survives). Measured with
 * counting hooks and a fake `gpg.program`, the two routes cost the same:
 * Git's `reword` itself picks and then amends, so each reworded commit
 * that is recreated runs `post-commit` and signing twice and `commit-msg`
 * once, for the new message, either way.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import type { SimpleGit } from "simple-git";

import {
  findSquashGroups,
  serializeTodo,
  type TodoEntry,
  type TodoRejection,
  type TodoRunOutcome,
  validateTodo
} from "@/backend/rebase/todo";
import type { ActionPayload } from "@/backend/types";
import { resolveGitDirs } from "@/backend/utils/gitDirs";
import { GitCommandError, type GitCommandRecorder, runGitWithEnv } from "@/backend/utils/gitRunner";

/**
 * The sequence editor command. Git appends its todo file's path (shell
 * quoted by Git) when it runs the editor through its own `sh`, so this
 * copies our prepared todo over Git's. The path travels in the
 * `GGL_TODO_FILE` environment variable, never spliced into the command,
 * which is what keeps a repository path with spaces or `&` working.
 */
export const SEQUENCE_EDITOR_COMMAND = 'cp -- "$GGL_TODO_FILE"';

export type InteractiveRebaseInput = ActionPayload<"interactiveRebase"> & {
  repo?: string | null;
  /** Resolved git binary path for the dedicated spawn (`config.gitPath()`). */
  binary: string;
  /**
   * Overrides the sequence editor command. A test seam for the
   * editor-failure case; production callers leave it unset.
   */
  sequenceEditor?: string;
};

export type InteractiveRebaseResult = {
  outcome: TodoRunOutcome;
  exitCode: number | null;
  /** Git's stderr, verbatim (empty when the process exited 0). */
  stderr: string;
  /**
   * True when `--autostash` finished the rebase itself (state directory gone,
   * exit 0) but reapplying the stash left unmerged paths in the index.
   */
  autostashConflict?: boolean;
};

/** The facts an outcome is decided from: files and the exit code, never messages. */
export type RebaseOutcomeFacts = {
  exitCode: number | null;
  hasState: boolean;
  hasStoppedSha: boolean;
  hasProgress: boolean;
  hasUnmergedPaths: boolean;
};

/**
 * Decides how a rebase run ended. A left-over state directory alone proves
 * nothing (spike, Git 2.56.1): an `edit` stop and a conflict stop both
 * write `stopped-sha`; a stop after a failed `exec` line has no
 * `stopped-sha` but its `done` file lists the lines that already ran; a
 * todo Git refuses up front (for example a leading `fixup`) leaves a state
 * directory with neither, before any line ran.
 */
export function classifyRebaseOutcome(facts: RebaseOutcomeFacts): TodoRunOutcome {
  if (!facts.hasState) return facts.exitCode === 0 ? "completed" : "failed";
  if (facts.hasUnmergedPaths) return "paused-conflict";
  if (facts.hasStoppedSha || facts.hasProgress) return "paused-edit";
  return "invalid-todo";
}

const TODO_ACTIONS: ReadonlySet<string> = new Set([
  "pick",
  "reword",
  "edit",
  "squash",
  "fixup",
  "drop"
]);

const shellSingleQuoteEscape = String.raw`'\''`;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", shellSingleQuoteEscape)}'`;
}

function requireValue(value: string, label: string): void {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function rejectionError(rejection: TodoRejection): Error {
  return new Error(`Invalid interactive rebase todo: ${rejection.reason}.`);
}

function carriesMessage(entry: TodoEntry): boolean {
  return (entry.action === "pick" || entry.action === "reword") && entry.message !== undefined;
}

/**
 * For each entry index after which an `exec` amend runs, the target entry
 * whose message it applies. The amend follows the group's last member, so
 * Git has melded every member before the combined message is replaced;
 * a `drop` inside the group does not move it earlier.
 */
function amendAfterIndex(entries: readonly TodoEntry[]): ReadonlyMap<number, TodoEntry> {
  const amends = new Map<number, TodoEntry>();
  for (const group of findSquashGroups(entries)) {
    const target = entries[group.targetIndex] as TodoEntry;
    if (!carriesMessage(target)) continue;
    const lastMember = group.memberIndices[group.memberIndices.length - 1];
    amends.set(lastMember ?? group.targetIndex, target);
  }
  return amends;
}

type PlannedTodo = {
  text: string;
  /** Message files to write before the run, absolute path and content. */
  messageFiles: readonly { filePath: string; content: string }[];
};

/**
 * Builds the todo text Git runs: {@link serializeTodo} line by line, with
 * one `exec git commit --amend -F '<file>'` after each squash group whose
 * target carries a message (see {@link amendAfterIndex}). A message on
 * any other entry (a member, an `edit`, a `drop`) is not applied: a
 * member's text is Git's to combine, and an `edit` stops for a manual
 * amend. A `reword` without a message is an unchanged reword and
 * serializes as plain `pick`, so no editor ever opens.
 */
function planTodo(entries: readonly TodoEntry[], messageDir: string, runId: string): PlannedTodo {
  const messageFiles: { filePath: string; content: string }[] = [];
  const amends = amendAfterIndex(entries);
  let text = "";
  for (const [index, entry] of entries.entries()) {
    if (!TODO_ACTIONS.has(entry.action)) {
      throw new Error(`Unknown interactive rebase action: ${String(entry.action)}.`);
    }
    text += serializeTodo([entry]);
    const amendTarget = amends.get(index);
    if (amendTarget !== undefined) {
      const filePath = path.join(messageDir, `msg-${runId}-${messageFiles.length}`);
      messageFiles.push({ filePath, content: amendTarget.message as string });
      text += `exec git commit --amend -F ${shellQuote(filePath)}\n`;
    }
  }
  return { text, messageFiles };
}

function stateDirOf(gitDir: string): string | null {
  for (const name of ["rebase-merge", "rebase-apply"]) {
    const candidate = path.join(gitDir, name);
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Not present; the other candidate may be.
    }
  }
  return null;
}

/** Whether the state's `done` file lists a todo line that already ran. */
function hasProgress(stateDir: string): boolean {
  try {
    return fs
      .readFileSync(path.join(stateDir, "done"), "utf8")
      .split("\n")
      .some((line) => line.trim() !== "" && !line.startsWith("#"));
  } catch {
    return false;
  }
}

async function readHasUnmergedPaths(
  git: SimpleGit,
  input: InteractiveRebaseInput,
  record?: GitCommandRecorder
): Promise<boolean> {
  try {
    const output = await runGitWithEnv(git, {
      label: "rebase.interactive.unmerged",
      kind: "query",
      args: ["diff", "--name-only", "--diff-filter=U", "-z"],
      repo: input.repo ?? null,
      binary: input.binary,
      env: { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
      record
    });
    return output.split("\0").some((name) => name !== "");
  } catch (error: unknown) {
    // The failed read is recorded by the runner. Without it, classification
    // proceeds on the state files alone rather than failing the whole run.
    if (error instanceof GitCommandError) return false;
    throw error;
  }
}

function buildInteractiveRebaseArgs(base: string | null, autostash?: boolean): string[] {
  const args = ["rebase", "-i"];
  if (autostash === true) args.push("--autostash");
  else if (autostash === false) args.push("--no-autostash");
  args.push(base === null ? "--root" : base);
  return args;
}

function removeMessageFiles(files: readonly { filePath: string }[], messageDir: string): void {
  for (const { filePath } of files) fs.rmSync(filePath, { force: true });
  try {
    fs.rmdirSync(messageDir);
  } catch {
    // Another run's messages (or none at all): the directory stays.
  }
}

/**
 * Runs one interactive rebase from a prepared todo and reports how it
 * ended. Throws before any Git process starts when the todo fails
 * {@link validateTodo}, when a rebase is already in progress in this
 * worktree, or when the repository or binary is missing. A run Git itself
 * refuses or stops is reported through the result, not thrown.
 *
 * The prepared todo file is always removed. The message files are removed
 * when the run completed or failed without leaving state; while Git's
 * state is left (a pause, or a refused todo) they stay, because the
 * remaining `exec` lines still name them — removing them after an abort
 * belongs to the abort action (F2-03).
 */
export async function runInteractiveRebase(
  git: SimpleGit,
  input: InteractiveRebaseInput,
  record?: GitCommandRecorder
): Promise<InteractiveRebaseResult> {
  const repo = input.repo ?? "";
  requireValue(repo, "Repository");
  requireValue(input.binary, "Git binary");

  const validation = validateTodo(input.entries, input.rangeHashes, input.base ?? "");
  if (!validation.ok) throw rejectionError(validation.rejection);
  if (input.base !== null) requireValue(input.base, "Rebase base");

  // Resolved to an absolute path: the todo file's path travels to Git's
  // sequence editor in `GGL_TODO_FILE`, whose working directory is Git's.
  const { gitDir } = resolveGitDirs(path.resolve(repo));
  if (stateDirOf(gitDir) !== null) throw new Error("A rebase is already in progress.");

  const runId = crypto.randomUUID();
  const todoFile = path.join(gitDir, `ggl-rebase-todo-${runId}`);
  const messageDir = path.join(gitDir, "ggl-rebase");
  const planned = planTodo(input.entries, messageDir, runId);

  let keepMessageFiles = false;
  try {
    if (planned.messageFiles.length > 0) fs.mkdirSync(messageDir, { recursive: true });
    for (const file of planned.messageFiles) fs.writeFileSync(file.filePath, file.content, "utf8");
    fs.writeFileSync(todoFile, planned.text, "utf8");

    const args = buildInteractiveRebaseArgs(input.base, input.autostash);
    let exitCode: number | null = 0;
    let stderr = "";
    try {
      await runGitWithEnv(git, {
        label: "rebase.interactive",
        kind: "action",
        args,
        repo,
        binary: input.binary,
        env: {
          GIT_SEQUENCE_EDITOR: input.sequenceEditor ?? SEQUENCE_EDITOR_COMMAND,
          GGL_TODO_FILE: todoFile,
          GIT_EDITOR: "true",
          LC_ALL: "C",
          GIT_TERMINAL_PROMPT: "0"
        },
        record
      });
    } catch (error: unknown) {
      if (!(error instanceof GitCommandError)) throw error;
      exitCode = error.record.error?.exitCode ?? null;
      stderr = error.record.error?.stderr ?? error.message;
    }

    const stateDir = stateDirOf(gitDir);
    const checkUnmerged = stateDir !== null || (exitCode === 0 && input.autostash === true);
    const hasUnmergedPaths = checkUnmerged && (await readHasUnmergedPaths(git, input, record));
    const outcome = classifyRebaseOutcome({
      exitCode,
      hasState: stateDir !== null,
      hasStoppedSha: stateDir !== null && fs.existsSync(path.join(stateDir, "stopped-sha")),
      hasProgress: stateDir !== null && hasProgress(stateDir),
      hasUnmergedPaths
    });
    keepMessageFiles = stateDir !== null;
    if (stateDir === null && exitCode === 0 && input.autostash === true && hasUnmergedPaths) {
      return { outcome, exitCode, stderr, autostashConflict: true };
    }
    return { outcome, exitCode, stderr };
  } finally {
    fs.rmSync(todoFile, { force: true });
    if (!keepMessageFiles) removeMessageFiles(planned.messageFiles, messageDir);
  }
}
