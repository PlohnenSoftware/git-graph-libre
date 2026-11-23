---
summary: >-
  F2-05: the rest of the interactive rebase verbs in the editor (reword, squash,
  fixup, edit) with message editing: reworded messages as `exec git commit
  --amend -F` lines, one combined message per squash group kept by target hash.
  Waits for F2-04 and decisions IQ4, IQ6.
---

# F2-05 — Reword, squash, fixup and edit with messages

Status: claimed by Muse Code on 2026-11-23 17:24

Needs: F2-04; decision IQ4 settled by the F2-01b spike

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; the F2-01a and F2-01b reports (the serializer and the message route the
spike chose); research sections 1.2 (Reword, Squash groups), 1.3 (Signing and
hooks), 3 (principle 4) and 4 (F2-05) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/webview/rebaseEditor/*` (the action select, message state, group logic in the view)
- `src/backend/rebase/todo.ts`: group and message logic, as specified in F2-01a and F2-01b; add rules only with a test
- `src/backend/actions/rebaseInteractive.ts`: the `exec` amend lines, only as the IQ4 spike chose
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/actions/rebaseInteractive.test.ts` (extended), `tests/webview/rebaseEditor/*.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Behavior.** The action select gains reword, edit, squash and fixup. Reword
turns the row into an editable multi-line message, pre-filled with the subject
and body. A squash group shows one combined, editable final message: the
target's message plus its `squash` members, not its `fixup` members. The
message is keyed by the target's hash, so reordering keeps manual edits. The
first row cannot be squash or fixup. Edit stops the rebase, and the F2-03
banner takes over.

**Git commands.** As F2-01b: a reworded commit, or a squash group with an
edited message, serializes as `pick <hash>` followed by one
`exec git commit --amend -F '<file>'` line, with the message in a file under
`<gitdir>/ggl-rebase/`. An unchanged reword serializes as plain `pick`,
because a `reword` line would open an editor. Group members serialize as
`squash` or `fixup` lines.

**Tests (real Git):** each verb's result, checked by the log and the file
content; a reworded multi-line message; squash-group messages with and without
edits; a fixup-only group with an edited message; a group moved after an edit
keeps its message; a `commit-msg` hook that rejects shows as a stop that F2-03
handles. The "bypass hooks" option is not offered here.

**Webview tests.** Message state keyed by hash; the reorder keeps edits.

**Localization.** About twelve strings.

**Risks, stated in the Report.** The `exec` amend runs commit hooks and signs
again for each reworded commit. Mitigation is a note in the user docs for the
release, not a silent change. Windows quoting of the message path is not
verified by this slice on Linux.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

Not started.
