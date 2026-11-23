---
summary: >-
  F2-03: a banner above the graph while a rebase is in progress, with
  Continue, Skip and Abort, the conflict file list, and the operation-state
  reader that tells a rebase begun anywhere from a stale one. Real-Git tests
  and webview tests.
---

# F2-03 — In-progress state and controls

Status: ready

Needs: none (F2-01b for the end-to-end checks)

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions IQ2, IQ9 and the
clean-room rules; the Webview UI Styling Guide (Reference) for the banner;
research sections 1.1 (In progress), 2 (Conflict / in-progress detection),
3 (principle 3) and 4 (F2-03) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English, OKLCH
colors through tokens (the VS Code theme tokens first). Every user-visible
string goes into all five l10n bundles, and `pnpm run l10n:check` reports
complete. No new telemetry events or declarations. Do not bump versions or edit
CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/queries/operationState.ts` (new): reads the state files, never messages
- `src/backend/actions/rebase.ts`: continue, skip and abort only
- `src/repoFileWatcher.ts`: watch `rebase-merge`, `rebase-apply`, `MERGE_HEAD`,
  `REBASE_HEAD` in the per-worktree git dir; check the debouncing
- `src/types.ts`: the state shape
- `src/webview/rebaseBanner.ts` (new), a banner module of its own
- `media/rebase-banner.css` (new, OKLCH through tokens)
- `src/webview/main.ts`: the hook-in only
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json` (five bundles)
- tests: `tests/backend/queries/operationState.test.ts`, `tests/backend/actions/rebaseControls.test.ts`, `tests/webview/rebaseBanner.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Behavior.** While a rebase is in progress, a banner above the graph reads
"Rebase in progress: stopped at <short hash> <subject> (<n> of <m>)" with
Continue, Skip and Abort. For a conflict it shows the unmerged file list with
an Open file action (VS Code opens its merge editor). For an `edit` stop it
says "Stopped to amend; commit your changes, then Continue". Abort asks for
confirmation first. Continue is blocked while unmerged paths remain (IQ9):
the banner tells the user to resolve and stage the files in the SCM view, and
offers no silent `add -A`.

**Detection.** From files only: `rebase-merge/` (with `stopped-sha`, `msgnum`,
`end`, `head-name`, `onto`) or `rebase-apply/`; plus `MERGE_HEAD`,
`CHERRY_PICK_HEAD`, `REVERT_HEAD` for context. Conflict files come from
`git diff --name-only --diff-filter=U`. Locale-independent: never parse Git's
messages. A rebase started from the terminal mode is detected the same way.

**Git commands.** `git rebase --continue` (with `GIT_EDITOR=true`),
`git rebase --skip`, `git rebase --abort`, through the recorded runner with
labels `rebase.continue`, `rebase.skip`, `rebase.abort`.

**Watcher.** The state directory and markers trigger a refresh; check the
debouncing so a burst of writes during a rebase does not cause a storm.

**Localization.** About twelve strings: banner states, the "n of m" progress,
button labels, confirm text and errors.

**Tests (real Git):** an edit stop; a conflict stop; continue to completion;
skip; abort restores the branch tip; a stale `REBASE_HEAD` after success is
not "in progress" (regression for `a79f444`); `rebase-apply` state; linked
worktree state in its own git dir; detection of a rebase started outside the
banner. Webview tests: banner rendering per state, and the confirm dialog.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run tests/backend/queries/operationState.test.ts tests/backend/actions/rebaseControls.test.ts tests/webview/rebaseBanner.test.ts
pnpm run l10n:check
```

## Report

Not started.
