import type { ContextMenuActionsVisibility } from "@/types";

export const DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY = {
  branch: {
    checkout: true,
    rename: true,
    delete: true,
    merge: true,
    rebase: true,
    push: true,
    pull: true,
    viewIssue: true,
    createPullRequest: true,
    createArchive: true,
    compareWithHead: true,
    copyName: true
  },
  commit: {
    addTag: true,
    createBranch: true,
    compareWithHead: true,
    checkout: true,
    cherryPick: true,
    revert: true,
    undoLastCommit: true,
    editMessage: true,
    drop: true,
    merge: true,
    rebase: true,
    reset: true,
    copyHash: true,
    copySubject: true,
    squashSelection: true,
    dropSelection: true
  },
  commitDetailsViewFile: {
    viewDiff: true,
    viewFileAtRevision: true,
    compareWithWorkingTree: true,
    openFile: true,
    resetFileToRevision: true,
    copyAbsoluteFilePath: true,
    copyRelativeFilePath: true
  },
  remoteBranch: {
    checkout: true,
    delete: true,
    merge: true,
    fetchIntoLocalBranch: true,
    pull: true,
    viewIssue: true,
    createPullRequest: true,
    createArchive: true,
    compareWithHead: true,
    copyName: true
  },
  stash: {
    apply: true,
    createBranch: true,
    pop: true,
    drop: true,
    copyName: true,
    copyHash: true
  },
  tag: {
    viewDetails: true,
    delete: true,
    push: true,
    fetchTags: true,
    createArchive: true,
    compareWithHead: true,
    copyName: true
  },
  uncommittedChanges: {
    stash: true,
    reset: true,
    clean: true,
    openSourceControlView: true
  }
} as const satisfies ContextMenuActionsVisibility;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createDefaultContextMenuActionsVisibility(): ContextMenuActionsVisibility {
  return Object.fromEntries(
    Object.entries(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY).map(([group, actions]) => [
      group,
      { ...actions }
    ])
  ) as ContextMenuActionsVisibility;
}

export function normalizeContextMenuActionsVisibility(
  input: unknown
): ContextMenuActionsVisibility {
  const config = createDefaultContextMenuActionsVisibility();
  if (!isRecord(input)) return config;

  for (const groupKey of Object.keys(config) as (keyof ContextMenuActionsVisibility)[]) {
    const groupInput = input[groupKey];
    if (!isRecord(groupInput)) continue;

    const groupConfig = config[groupKey] as Record<string, boolean>;
    for (const actionKey of Object.keys(groupConfig)) {
      const value = groupInput[actionKey];
      if (typeof value === "boolean") groupConfig[actionKey] = value;
    }
  }

  return config;
}
