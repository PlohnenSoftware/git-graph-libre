---
summary: >-
  F2-06: fixup, squash and reword commits created from the graph, and an
  autosquash switch in the editor whose arrangement comes from Git's own
  autosquash when the spike allows it. Waits for F2-04, F2-05 and decision IQ11.
---

# F2-06 — Autosquash and fixup creation

Status: claimed by Muse Code on 2026-11-23 17:46

Needs: F2-04, F2-05; decision IQ11 settled by its spike

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.2 (Autosquash, the gap), 1.3 (Autosquash in Git),
3 (principle 5), 4 (F2-06) and 5 (IQ11) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/actions/commit.ts`: `commitFixup { target, kind, message }`
- `src/backend/rebase/autosquash.ts` (new): the preview through Git, or the parity-tested reimplementation the spike chooses
- `src/webview/rebaseEditor/*`: the autosquash switch
- `src/contextMenuVisibility.ts`, `src/types.ts`, `package.json`: menu entries and visibility (IQ12)
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/actions/commitFixup.test.ts`, `tests/backend/rebase/autosquash.test.ts` (real Git)
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Creation.** Context-menu entries Create Fixup Commit..., Create Squash Commit...
and Create Reword Commit..., for ancestors of HEAD only. Each opens a small
dialog that shows the staged file count and the message to be written. Fixup
and squash need staged changes; a reword with no staged changes needs
`--allow-empty`.

**Git commands.** `git commit --fixup <c>` and `git commit --squash <c>`.
`--fixup=amend:<c>` and `--fixup=reword:<c>` are allowed where the spike shows
Git accepts them; `amend:` with `-m` is refused by Git (verified in the research),
so pass `-m` only where Git allows it.

**Autosquash switch.** Appears in the editor only when `fixup!`, `squash!` or
`amend!` markers exist in the range. On by default when markers exist, and
turning it off restores the source order. `rebase.autoSquash` (read through
`git config --get rebase.autoSquash`) sets the default.

**Preview (IQ11).** The spike tries Git's own arrangement: `git rebase -i
--autosquash <base>` with a sequence editor that writes the todo to a capture
file and exits non-zero, then `git rebase --abort` only if a state directory
was left (the research verified that a failing editor leaves none, so the
abort is a guarded no-op). The parse reads `pick`, `fixup`, `squash` and
`fixup -C` lines. The spike also checks whether a dirty index blocks it; if so,
`--autostash` is used only on the dry run. If the spike does not work, fall
back to a faithful reimplementation of the documented rule: subject or
hash-prefix match, `amend!`, chains, with a parity test against real Git. The
Report names the choice.

**Tests (real Git):** subject match; hash-prefix match; a chain; `amend!`
becoming `fixup -C`; no match; a marker outside the range; a fixup created for
a non-HEAD commit and then autosquashed through F2-01b; a dirty tree does not
change the preview's result.

**Risk.** This is the most uncertain slice, as the research says. Report
honestly if the preview cannot match Git's exact arrangement.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

Not started.
