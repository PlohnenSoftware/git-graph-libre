---
summary: >-
  D15 · wave B · gated on X4 · TypeScript + webview · ≤200 lines: from a
  comparison's header, open both sides in the user's own diff tool with
  `git difftool --dir-diff`, detached and only when a tool is configured.
  This is the "external directory diff" left open in Phases 8 and 10, built
  from Git's documentation alone.
---

# D15 — Open a comparison in the external diff tool

Status: waiting on D13
Needs: D13
Decisions: X4
Kind: TypeScript (backend action and webview) · Size budget: ≤ 200 changed lines outside tests
Source: Phase 8 ("external directory diff"); Phase 10 ("Add external directory diff only after the file details model is robust")

## Licensing note, read first

Upstream Git Graph and `vscode-git-graph-rs` have a feature with this
purpose. Their code is under a license that forbids reuse: see the
`vscode-git-graph-rs` verdict under Licensing. **Don't look at either
implementation.** Build it only from `git help difftool` and this
repository's existing patterns, and say so in the report.

## Goal

People with a configured diff tool (Meld, Beyond Compare, KDiff3, …) can
review a whole comparison there.

## Read first

- [The agent protocol](010-agent-protocol.md), the answer to X4, and D13's
  report
- `git help difftool`, specifically `--dir-diff`, `--no-prompt` and `--gui`,
  and `git help config` for `diff.tool` and `diff.guitool`
- `src/backend/utils/gitRunner.ts`; `src/extension/messageHandler.ts`, for
  how an action message is handled and answered

## Steps

1. Add the backend action `openExternalDirDiff({ repo, baseRef, compareRef })`.
   - First read the configuration with `git config --get diff.guitool`, then
     `diff.tool`, both through `runGitRaw`.
   - With neither set: return `{ configured: false }`. The webview then shows
     an information dialog explaining how to set `diff.tool`.
   - Otherwise: start `git difftool --dir-diff --no-prompt [--gui]
     <baseHash> <compareHash>` as a detached child process (with `spawn`,
     `detached: true`, `stdio: "ignore"`, then `unref()`), in the repository
     directory. Add `--gui` only when `diff.guitool` is the one set. Record
     the command in the Git command log, and don't wait for it to exit.
   - Pass only full hashes, already resolved by the comparison; never raw
     user text.
2. Add an "Open in External Diff Tool" button to D13's comparison header,
   with its strings in all five bundles.
3. Working-tree comparisons from D14 pass a single ref (`git difftool
   --dir-diff <base>` compares with the working tree). Cover that case too.

## Touch

`src/backend/actions/externalDiff.ts` (new), `src/types.ts`,
`src/extension/messageHandler.ts`, `src/webview/commitDetailsView.ts`,
`src/webview/main.ts`, `src/extension/webviewL10n.ts`,
`l10n/bundle.l10n*.json`, `tests/backend/actions/externalDiff.test.ts` (new),
`tests/webview/commitDetailsView.test.ts`

## Tests

- With no tool configured (use `GIT_CONFIG_GLOBAL` pointing at an empty temp
  file), the action returns `configured: false` and starts nothing.
- With `diff.tool` set, the spawn function (injected, faked in the test)
  receives exactly `difftool --dir-diff --no-prompt <base> <compare>`, with
  `detached: true`.
- With `diff.guitool` set, `--gui` is added.
- The tests never launch a real tool.

## Acceptance

Gates pass, and the report states that no outside implementation was
consulted.

## Report

_(not started)_
