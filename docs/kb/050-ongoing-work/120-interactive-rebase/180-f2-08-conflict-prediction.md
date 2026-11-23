---
summary: >-
  F2-08: a conflict prediction for the todo the user has planned: a debounced
  status line in the editor that names the first conflicting commit and its
  files, built from `git merge-tree --write-tree` replays, labeled as a
  prediction. Waits for F2-04, F2-05 and decision IQ7.
---

# F2-08 — Conflict prediction for the planned todo

Status: waiting

Needs: F2-04, F2-05; decision IQ7 (follow-up release) confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.2 (Prediction), 4 (F2-08) and 5 (IQ7) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/queries/rebasePrediction.ts` (new)
- `src/webview/rebaseEditor/*`: the status line, debounced
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/queries/rebasePrediction.test.ts` (real Git), `tests/webview/rebaseEditor/prediction.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Behavior.** A status line in the editor reads "No conflicts predicted", or
"Conflict at <hash>: <n> files", with the file list in the popover pattern used
elsewhere in the project. It is re-evaluated, debounced, when the todo changes.
When the range exceeds the probe limit, the line says the result is capped.
The line always labels the result as a prediction.

**Method.** Simulate the todo in order. For each non-dropped `pick`, run `git
merge-tree --write-tree --merge-base=<commit>^ <accumulated> <commit>`, and
chain the printed tree OID into the next probe. A `squash` or `fixup` merges
its commit onto the accumulated tree against its own parent the same way.
Stop at the first conflict. Exit status 1 means conflict; file names come from
the `-z` conflicted-file information, never from messages. Cap the number of
probes at a probe limit and say so. Git older than 2.40 (no `--write-tree`
with `--merge-base`) gets "prediction unavailable".

**Limits to state in the code's comment and in the Report.** This models a
merge, not Git's exact rebase. Rename detection and whitespace settings may
differ. The cost grows with the range.

**Tests (real Git):** a reorder with no conflict; a reorder that conflicts
(names the commit and the file); a drop that causes a later conflict; a squash
that conflicts; a non-ASCII path; a fixup chain; the probe cap; Git older than
2.40 through an injected "unsupported" result (the check is injected, not the
Git binary).

**Localization.** About six strings.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

Not started.
