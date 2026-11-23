---
summary: >-
  F2-07: the protections for starting an interactive rebase: autostash for a
  dirty tree with an explained choice, an acknowledgement before rewriting
  published commits, a disabled entry for a branch checked out in another
  worktree, and a prompt for a very long range. Waits for F2-04 and decision IQ5.
---

# F2-07 — Dirty tree, published history and worktree protections

Status: waiting

Needs: F2-04; decision IQ5 confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.1 (Dirty tree), 1.3 (Branch checked out in another
worktree), 4 (F2-07) and 5 (IQ5) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/webview/rebaseEditor/*`: the dirty-tree choice, the acknowledgement, the disabled state, the long-range prompt
- `src/backend/rebase/preflight.ts` (from F2-02): the reasons only
- `src/backend/actions/rebaseInteractive.ts`: `--autostash` and a `--no-autostash` pass-through
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/actions/rebaseInteractive.test.ts` (extended), `tests/webview/rebaseEditor/protections.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Dirty tree.** The dialog offers "Stash and reapply local changes"
(`--autostash`) and "Cancel", and explains the choice in one sentence. Without
the choice, Git refuses; the refusal is shown with Git's stderr.

**Published commits (IQ5, recommended: warn and require acknowledgement).** When
the range has published commits, Start needs an explicit acknowledgement
checkbox, and the published commits are listed. No force push is offered or
run by this slice.

**Branch in another worktree.** The entry is disabled, with the reason
"checked out at <path>", and offers Open Worktree where W31 exists. Use the
worktree data, and the preflight's `alreadyUsedElsewhere`.

**Rebase already in progress.** The entry is disabled and points at the F2-03
banner.

**Very long range.** When the preflight marks `tooLong`, Start asks for
confirmation first.

**Autostash conflicts.** When the stash pop conflicts, Git keeps the stash and
says so. The F2-03 state read must notice "Applying autostash resulted in
conflicts" in a way that does not parse text: check the stash entry and the
unmerged paths instead. Show the stash entry is kept.

**Tests (real Git):** autostash success; autostash with a conflict leaves the
stash entry and the message; the refusal copy for a branch checked out in
another worktree; published ahead and behind variants with a bare remote.

**Localization.** About ten strings.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

Not started.
