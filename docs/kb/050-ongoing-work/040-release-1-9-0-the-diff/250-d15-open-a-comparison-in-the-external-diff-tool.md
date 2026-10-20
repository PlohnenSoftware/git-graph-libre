---
summary: >-
  D15 · wave B · gated on X4 · TypeScript + webview · ≤200 lines: from a
  comparison's header, open both sides in the user's own diff tool with
  `git difftool --dir-diff`, detached and only when a tool is configured.
  This is the "external directory diff" left open in Phases 8 and 10, built
  from Git's documentation alone.
---

# D15 — Open a comparison in the external diff tool

Status: integrated 3e3a6f8
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

- **Agent / date:** Muse Code (general-purpose) sub-agent D15, claimed
  2026-10-19 11:12 Europe/Warsaw, report 2026-10-19 11:22. Model note:
  general-purpose on the inherited runtime model — no named-model
  selector exists in this runtime; the integrator records the constraint.
  No outside implementation was consulted: built only from
  `git help difftool` / `git help config` and this repository's patterns
  (`runGitRaw`, `resolveRef`, the D13 header), as the licensing note asks.
- **Branch and commits:** `diff-1.9.0/d15` — `f5ac20c G docs(release):
  claim D15 for Muse Code (D15)`, `97b378a G feat(compare): open a
  comparison in the external diff tool (D15)`, plus the signed report
  commit carrying this section. No push.
- **Files changed:** `src/backend/actions/externalDiff.ts` (new) +100,
  `src/types.ts` +14, `src/extension/messageHandler.ts` +21,
  `src/extension/webviewL10n.ts` +3, `src/webview/commitDetailsView.ts`
  +7/−2, `src/webview/main.ts` +33/−1, each of the five
  `l10n/bundle.l10n*.json` +3, `tests/backend/actions/externalDiff.test.ts`
  (new) +198, `tests/webview/commitDetailsView.test.ts` +66; 196 changed
  lines outside tests (budget ≤200), all within *Touch*.
- **Tests added or changed:** `externalDiff.test.ts` new, 8 cases, temp
  repos via `makeRepo` with `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` on an
  empty temp file and the spawn injected/faked (no real tool ever
  launches): unconfigured returns `{ configured: false }` and spawns
  nothing; `diff.tool` spawns exactly `difftool --dir-diff --no-prompt
  <base> <compare>` detached/`stdio: "ignore"`/`unref()` in the repo and
  records `externalDiff.open`; `diff.guitool` adds `--gui`; a `"*"`
  compare side passes a single hash; `HEAD` resolves to its full hash;
  an option-like ref, an unknown ref, and `"*"` as base all reject with
  nothing spawned. `commitDetailsView.test.ts` 22 → 26 cases (header
  button only for comparisons with the localized title and
  `link-external` icon; clicking it sends `openExternalDirDiff` with the
  refs — not D13's labels — and does not swap; the `"*"` sentinel passes
  through; `configured: false` shows the how-to-set-`diff.tool` dialog
  and a failed launch the error dialog). Backend total 957 → 965,
  webview total 678 → 682.
- **Gates:** strict Biome clean on the 13 touched code/locale/test files
  (also `lint:strict:staged` at commit); `pnpm run typecheck` green;
  full `pnpm run test` with the built engine addon (`engine:build` +
  `engine:smoke` OK at 1.0.26): backend 965/965, webview 682/682;
  `pnpm run l10n:check` 100% in all five bundles (all three new keys
  translated, no English copies); `pnpm run package` OK;
  `pnpm run kb:check` green; `git diff --check` clean. Rust arm n/a (no
  `engine/**` change). Sonar: integrator.
- **Acceptance:** gates pass — met, numbers above; no outside
  implementation consulted — stated above. Beyond the unit fakes, the
  real default spawn ran end to end against a temp repo whose configured
  tool is a shell script: the detached `git difftool --dir-diff` handed
  it the committed side and the working-tree side (`/tmp/ggl-d15-visual/`
  `e2e.ts`, marker `one|three`). Headless QtWebEngine/Xvfb renders of the
  real header markup and `media/*.css`, inspected in both themes:
  `/tmp/ggl-d15-visual/dark.png`, `/tmp/ggl-d15-visual/light.png` (the
  `link-external` button sits beside Swap at the same size).
- **Deviations from the slice:** four choices, all inside *Touch*.
  (1) X4 (a)'s "shown only when a tool is configured" is met at launch
  time, as the slice's own steps design it: the header button is always
  present, the backend returns `{ configured: false }` with neither
  `diff.guitool` nor `diff.tool` set, and the webview explains how to set
  `diff.tool` instead of launching anything; pre-hiding the button would
  need config state the slice never plumbs to the header. (2) Both sides
  are resolved to full hashes in the backend through D11's `resolveRef`
  before spawning — the comparison can carry `HEAD`, and the slice says
  to pass only full hashes; this also rejects option-like text, so argv
  is always built here. The webview sends the comparison's refs, never
  D13's display labels. (3) D14's swapped form (`"*"` on the left after
  Swap) is not covered by the slice and has no dir-diff spelling:
  `git difftool --dir-diff -R <commit>` fails in Git itself (probed in a
  temp repo: "unable to read sha1 file … 0000…"), and the plain
  single-ref form would silently reverse the sides, so the backend
  rejects a `"*"` base and the webview shows the unable-to-open error.
  (4) The button reuses D13's `.commitDetailsComparisonSwap` styling
  (no stylesheet is in *Touch*); Swap's click binding moved to a new
  `commitDetailsComparisonSwapButton` class on the same element so the
  two header buttons can never trigger each other.
- **Open questions / follow-ups:** a swapped working-tree comparison
  (`"*"` as base) cannot open externally until a form for it exists —
  see deviation (3); a follow-up could hide or disable the button for
  that state instead of erroring on click. When both `diff.guitool` and
  `diff.tool` are set, the slice's read order makes `diff.guitool` win
  (`--gui`); if the maintainer prefers `diff.tool` there, it is a
  two-line change. Integrator: full gate with coverage and Sonar; the
  `messageHandler` route itself has no dedicated test because
  `tests/webview/messageHandler.test.ts` is outside this slice's *Touch*
  (both ends it joins are tested).
