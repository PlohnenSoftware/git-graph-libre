---
summary: >-
  F2-10 (optional, later): route the existing drop and squash-of-selection
  actions through the interactive todo, so one rebase replaces several
  sequential runs and the HEAD-chain restriction goes. Changes two shipped
  actions, so it needs the maintainer's go-ahead. Waits for F2-05 and decision IQ10.
---

# F2-10 — Route drop and squash through the todo (optional, later)

Status: claimed by Muse Code on 2026-11-23 17:46

Needs: F2-05; decision IQ10 (yes, after F2-05, with its own release note) confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 2 (Related rewriting actions), 4 (F2-10) and 5 (IQ10)
of `060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/actions/commit.ts`: `dropCommit` and `dropCommitSelection` (currently `git rebase --onto <hash>^ <hash>`), and `squashCommitSelection` (currently `git reset --soft` then `git commit`)
- `src/backend/actions/rebaseInteractive.ts`: the todo route, reused
- `src/webview/main.ts` and `src/contextMenuVisibility.ts`: only where the HEAD-chain restriction is enforced (`selectedCommitsAreLoadedHeadChain`, `main.ts:3784`), if the maintainer approves its removal
- existing action tests, re-pointed; new cases in `tests/backend/actions/`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Scope.** The research says this changes two shipped actions and needs the
maintainer's OK before it starts. Do not start it on the agent's own judgment.

- Drop: `dropCommit` and `dropCommitSelection` run one interactive rebase
  with `drop` lines, instead of N sequential `rebase --onto` runs. The root
  and merge-commit exclusions in the menu stay until the maintainer decides.
- Squash of a selection: `pick` plus `fixup` lines through the todo, so the
  HEAD-chain restriction is no longer needed and author and hook semantics are
  those of a real rebase. The current squash dialog (textarea and "bypass
  hooks") keeps its meaning; the bypass option is not offered on the rebase
  path (the editor's rule, F2-05).
- The terminal-only interactive path stays behind the mode setting (IQ3).

**Tests.** Existing action tests re-pointed. New cases for non-HEAD ranges and
for non-contiguous selections. Real Git for every sequence.

**Release note.** The integrator writes the change into the CHANGELOG, since
this changes shipped behavior.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

Not started.
