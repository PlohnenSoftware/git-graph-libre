---
summary: >-
  F2-05: the rest of the interactive rebase verbs in the editor (reword, squash,
  fixup, edit) with message editing: reworded messages as `exec git commit
  --amend -F` lines, one combined message per squash group kept by target hash.
  Waits for F2-04 and decisions IQ4, IQ6.
---

# F2-05 — Reword, squash, fixup and edit with messages

Status: done — awaiting integration

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

- **Agent / date:** Muse Code (`muse-wonder-full-1.0`), 2026-11-23 17:24 (claim) to 17:43 (report). Environment: Linux, Git 2.56.1. Git Graph+ was read for behavior only, through the research section; the implementation is from Git's documented and observed behavior and this project's own patterns, and copies no code.
- **Branch and commits:** `rebase/F2-05` on base `688fe71e` —
  `d35e4c9b G docs(rebase): claim F2-05 (F2-05)`;
  `0fdfbaeb G feat(rebase): squash groups, target and empty-message rules (F2-05)`;
  `8ef3378e G feat(rebase): editor model for reword, squash, fixup and edit (F2-05)`;
  `129723f8 G feat(rebase): strings for the remaining rebase actions and messages (F2-05)`;
  `d90d6f69 G feat(rebase): message editing in the rebase editor dialog (F2-05)`;
  `4fb39b10 G test(rebase): cover the F2-05 verbs end to end on real Git (F2-05)`;
  plus this report commit.
- **Files changed:** 19 files against `688fe71e`, +1,184/−61 including this slice file's status line (the report itself adds more): `src/backend/rebase/todo.ts` (group definition `findSquashGroups`, `isSquashGroupTarget`, two appended validation rules), `src/backend/actions/rebaseInteractive.ts` (`planTodo` places each `exec` amend after its group's last member via the shared grouping), new `src/webview/rebaseEditor/groups.ts` (combined-message, payload-message and guard logic), `src/webview/rebaseEditor/model.ts` (six actions, hash-keyed `setRebaseRowMessage`, empty-message gate), `view.ts` (message textareas, notices, chrome-only typing sync), `keyboard.ts` (`r`/`e`/`s`/`f`, textareas left alone), `index.ts`, `media/rebase-editor.css`, `src/extension/webviewL10n.ts` and all five `l10n/bundle.l10n*.json` (12 new `rebase.*` keys in the existing block; nl, pl, zh-cn and zh-tw translated by the slice agent — a native review would help), `tests/backend/rebase/todo.test.ts`, `tests/backend/actions/rebaseInteractive.test.ts`, `tests/webview/rebaseEditor/{model,view}.test.ts`.
- **Tests added or changed:** 29 net new tests. Backend: `todo.test.ts` 38 → 48 (targetless squash after a drop, empty/whitespace message, group finding across a drop); `rebaseInteractive.test.ts` 21 → 27 (unchanged reword as plain pick, reordered group keeps its message, squash+fixup under one edited message, group spanning a drop replaces the combined message whole, empty message and targetless squash refused before any spawn). Webview: `model.test.ts` 8 → 17 (six actions, reword pre-fill subject+body, payload carries only edited messages, combined message excludes fixup, reorder keeps the edit on its target hash, message clearing on action change, empty-message block, drop-then-squash normalization, new keys); `view.test.ts` +4 tests plus stronger option assertions in the first (reword textarea with caret preserved while typing and textarea keystrokes left alone, one group textarea with hint and member marking, empty message disables Start with the notice shown, edit notice and payload).
- **Gates:** strict Biome (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`) clean on all 17 touched .ts/.json files (the config schema-version info note is pre-existing); `pnpm run typecheck` clean; focused: backend `todo.test.ts` + `rebaseInteractive.test.ts` 75 passed, webview `tests/webview/rebaseEditor/` 29 passed; full `pnpm run test`: backend 1,725 passed (60 skipped, as expected in a linked worktree) and webview 1,203 passed; `pnpm run l10n:check` complete (100% for nl, pl, zh-cn, zh-tw); `node ./docs/kb/housekeeping.mjs --check` run with this report commit; headless renders of the real editor modules and stylesheets (PyQt6 QtWebEngine on Xvfb, `QT_QPA_PLATFORM=xcb`, injected Dark/Light Modern token values) inspected by eye in both themes: `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-05/rebase-editor-messages-dark.png` and `.../rebase-editor-messages-light.png` — squash/edit notices, the combined textarea without the fixup text, the reword textarea, indented member rows and an enabled Start render cleanly with no horizontal scrolling. Forced colors was not rendered; the textarea joins the stylesheet's `@media (forced-colors: active)` block and the existing CSS guard test still passes. No `engine/**` change, so no Rust arm. Sonar: integrator.
- **Acceptance:**
  - Behavior: **met.** The select offers pick, reword, edit, squash, fixup, drop; squash/fixup are barred on the first row and, after any reorder, wherever no target precedes them. Reword unfolds a multi-line textarea pre-filled with subject and body. A squash group shows one combined textarea (target plus `squash` members, never `fixup`) stored on the target row, keyed by its hash, so reordering keeps manual edits (model and view tests, and the reordered-group real-Git test). `edit` runs through F2-01b's handoff and stops, where the F2-03 banner takes over (edit pause proven by the existing backend and handler tests).
  - Git commands: **met.** As the IQ4 spike chose: a reworded commit or an edited group message becomes `pick <hash>`, its member lines, and one `exec git commit --amend -F '<file>'` under `<gitdir>/ggl-rebase/`; an unchanged reword and an unedited group carry no message, so they run as plain `pick` and Git's own combining, and no editor ever opens. Members serialize as `squash`/`fixup` lines through `serializeTodo`.
  - Tests (real Git): **met**, with F2-01b's suite (each verb by log and file content, multi-line reword, squash messages with and without edits, fixup-only edited group, a rejecting `commit-msg` hook stopping as `paused-edit` for F2-03) plus this slice's six above, including the group-moved-after-edit case. No "bypass hooks" option was added.
  - Webview tests: **met** (hash-keyed message state; reorder keeps edits; dialog behavior).
  - Localization: **met.** 12 strings in all five bundles; `l10n:check` complete.
- **Deviations from the slice:**
  - Two files outside the Touch list, both unavoidable glue: `media/rebase-editor.css` (the textarea, member and notice styles; there is no other stylesheet for this dialog) and `tests/backend/rebase/todo.test.ts` (the tests the Touch list requires beside any new `todo.ts` rule). Nothing else outside the list changed.
  - `validateTodo` gained two rules, appended after the F2-01a order so every existing order test stands: `squash-without-target` (a member after only drops has no commit to meld into; real Git confirms a member after a drop melds into the last target) and `empty-message` (the refusal F2-01b's report asked this slice for). Both carry tests, and the editor blocks both shapes before Start.
  - A squash group headed by `edit` gets no combined textarea: the F2-01b runner deliberately does not apply a message on an `edit`, which stops for a manual amend, so a textarea there would be silently ignored. Switching a group target to `edit` drops its edited message.
  - `planTodo` now groups across an interleaved `drop` (group definition lifted into `todo.ts` as F2-01b's report suggested); before, an edited message on a target separated from a later member by a drop was amended too early and Git then appended the member's message. Pinned by a real-Git test.
  - The dispatch named `docs/kb/030-licensing/010-licensing/040-git-graph-plus-licensing-verdict.md`, which does not exist in this tree; the verdict was read where it lives, in research section 0 and the register's clean-room rules. This slice file's status also still read `waiting` although F2-04 was integrated and the register says ready; it was claimed per the dispatch.
- **Risks, as the slice asks:** each `exec` amend runs the commit hooks again and signs again for every reworded commit or edited group (F2-01b measured this as identical in cost to Git's own reword; the mitigation is a note in the user docs for the release, not a silent change, and nothing here adds one). Windows quoting of the message-file path in the `exec` line remains unverified: this slice ran on Linux only.
- **Open questions / follow-ups:** native review of the four translations would help. F2-06 can build autosquash on `findSquashGroups`; F2-07 runs in parallel and also touches the editor model/view and the `rebase.` l10n block, so textual overlap there is for the integrator (this slice kept its additions in `groups.ts` and appended keys inside the block). One behavior to know: while a group's target is temporarily left without members (a member switched to `pick`), its edited message stays stored under its hash but is neither shown nor sent; it returns if a member rejoins.
