---
summary: >-
  F2-06: fixup, squash and reword commits created from the graph, and an
  autosquash switch in the editor whose arrangement comes from Git's own
  autosquash when the spike allows it. Waits for F2-04, F2-05 and decision IQ11.
---

# F2-06 — Autosquash and fixup creation

Status: done — awaiting integration

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

- **Agent / date:** Gemini 4 Neon (`agy`, continuing after earlier Muse Code claim commit `27881443`), 2026-11-23 19:40
- **Branch and commits:** `rebase/F2-06` (base `95268f02`):
  - `27881443 G docs(rebase): claim F2-06 (F2-06)` (earlier Muse Code claim)
  - `8922f3ad G feat(rebase): add pure autosquash arrangement and fixup -C todo support (F2-06)`
  - `b5fb2785 G feat(rebase): add commitFixup action, fixupDialogInfo, and rebase.autoSquash read (F2-06)`
  - `80ca2203 G feat(rebase): add autosquash switch, fixup creation menus, dialog and l10n (F2-06)`
  - (plus this report commit)
- **Clean-room note:** Git Graph+ was read for behavior only via the repository's research doc; no code was copied. Implemented from Git 2.56.1 behavior, Git documentation, and Git Graph Libre's own patterns.
- **IQ11 spike & choice:** Tested `git rebase -i --autosquash <base>` with a failing sequence editor on real Git 2.56.1. On a clean tree it captures the todo cleanly and leaves no state directory, **but** on a dirty working tree or dirty index Git refuses without `--autostash`, and with `--autostash` Git stashes and pops without `--index` on editor abort — silently unstaging every staged change in the user's index merely to preview. Spawning `rebase` for a preview would also trigger `pre-rebase` hooks and fail during an in-progress rebase. Therefore chose the **pure faithful reimplementation** in `src/backend/rebase/autosquash.ts` (`arrangeAutosquash`, `parseAutosquashMarker`, `hasAutosquashMarkers`, `parseAutosquashTodo`), verified line-for-line against real `git rebase -i --autosquash` in clean fixture repos (`tests/backend/rebase/autosquash.test.ts`), and proven identical on dirty working trees/indices without touching them.
- **Files changed:** 24 code/test/l10n files (+2,296 / −14 across `27881443..80ca2203`, plus this slice file):
  - `src/backend/rebase/autosquash.ts` (+249)
  - `src/backend/rebase/todo.ts` (+15/−4)
  - `src/backend/actions/commit.ts` (+294/−2)
  - `src/backend/queries/rebaseRange.ts` (+15)
  - `src/backend/types/actions.types.ts` (+4)
  - `src/backend/types/queries.types.ts` (+20)
  - `src/extension/messageHandler.ts` (+18)
  - `src/contextMenuVisibility.ts` (+3)
  - `src/types.ts` (+3)
  - `src/extension/webviewL10n.ts` (+25)
  - `l10n/bundle.l10n.json`, `.nl.json`, `.pl.json`, `.zh-cn.json`, `.zh-tw.json` (+25 each; agent-translated nl, pl, zh-cn, zh-tw — native review recommended)
  - `src/webview/rebaseEditor/model.ts` (+51/−4)
  - `src/webview/rebaseEditor/groups.ts` (+8/−3)
  - `src/webview/rebaseEditor/view.ts` (+40/−1)
  - `media/rebase-editor.css` (+22)
  - `src/webview/main.ts` (+169)
  - `tests/backend/rebase/autosquash.test.ts` (+373)
  - `tests/backend/rebase/todo.test.ts` (+6)
  - `tests/backend/actions/commitFixup.test.ts` (+323)
  - `tests/webview/rebaseEditor/autosquash.test.ts` (+533)
- **Tests added or changed:**
  - `tests/backend/rebase/autosquash.test.ts`: 10 tests (marker parsing, real-Git parity for subject exact/prefix match, 4–64 hex hash prefix & `<4` ignore, prefix/hash chains, `amend!` -> `fixup -C`, unmatched/out-of-range/forward-ref markers, dirty tree/index untouched parity, end-to-end through `runInteractiveRebase`)
  - `tests/backend/rebase/todo.test.ts`: +1 test (`fixup -C` serialization)
  - `tests/backend/actions/commitFixup.test.ts`: 9 tests (`fixup`, `squash`, `reword`, `amend`, empty-stage refusal, staged preservation on `reword`, validation, linked worktree + non-HEAD fixup/reword autosquashed through F2-01b, `loadFixupDialogInfo`, `rebase.autoSquash` config read)
  - `tests/webview/rebaseEditor/autosquash.test.ts`: 7 tests (switch hidden without markers, `rebase.autoSquash` unset/true/false defaults, toggle & Reset & `fixup -C` badge/payload/group message, visibility toggles `createFixup`/`createSquash`/`createReword`, HEAD-ancestor gating, fixup/squash/reword dialogs with 0 vs staged files)
  - Total suite counts: before 128 backend files (1,765 passed | 60 skipped) / 98 webview files (1,222 passed) -> after 130 backend files (1,785 passed | 60 skipped, expected in linked worktree) / 99 webview files (1,229 passed).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all touched `.ts`/`.json` files: pass (0 errors, 0 warnings)
  - `pnpm run typecheck`: pass (`src`, `src/webview`, `tests`)
  - `pnpm run l10n:check`: pass (`bundle.l10n` 1,005/1,005, `package.nls` 134/134, 100.0% across `nl`, `pl`, `zh-cn`, `zh-tw`)
  - `timeout 300 pnpm run test`: pass — backend 130 files (1,785 passed | 60 skipped), webview 99 files (1,229 passed)
  - `node ./docs/kb/housekeeping.mjs --check`: pass (verified before report commit)
  - Headless renders (PyQt6 QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, real `media/*.css` and bundled `src/webview/main.ts`), inspected visually:
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-06/autosquash-editor-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-06/autosquash-editor-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-06/create-reword-dialog-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-06/create-reword-dialog-light.png`
  - Sonar: integrator
- **Acceptance:**
  - Creation context-menu entries (Create Fixup Commit…, Create Squash Commit…, Create Reword Commit…) for ancestors of HEAD only, with small dialog showing staged file count and message to be written; fixup/squash require staged changes; reword allows empty with `--allow-empty`: **met** (`src/webview/main.ts`, `src/backend/actions/commit.ts`, `tests/backend/actions/commitFixup.test.ts`, `tests/webview/rebaseEditor/autosquash.test.ts`, headless renders).
  - Git commands (`--fixup`, `--squash`, `--fixup=reword:`, `--fixup=amend:`, never `-m` where Git refuses): **met** (`src/backend/actions/commit.ts`, verified on Git 2.56.1 in `commitFixup.test.ts`). Note: `commitFixup` uses `runGitWithEnv` because `simple-git.raw()` silently resolves when `git commit` exits 1 with `"nothing to commit"` on stdout and empty stderr.
  - Autosquash switch appears only when `fixup!`/`squash!`/`amend!` markers exist in range, ON by default when markers exist, OFF restores source order, default from `git config --bool --get rebase.autoSquash`: **met** (`src/backend/queries/rebaseRange.ts`, `src/webview/rebaseEditor/model.ts`, `view.ts`, `autosquash.test.ts`).
  - Preview (IQ11) with `pick`, `fixup`, `squash`, `fixup -C` and real-Git parity tests (subject match, hash-prefix match, chain, `amend!` -> `fixup -C`, no match, marker outside range, non-HEAD fixup autosquashed through F2-01b, dirty tree unchanged): **met** (`src/backend/rebase/autosquash.ts`, `tests/backend/rebase/autosquash.test.ts`, `tests/backend/actions/commitFixup.test.ts`).
  - Menu visibility settings (IQ12: `createFixup`, `createSquash`, `createReword`, default `true`): **met** (`src/contextMenuVisibility.ts`, `src/types.ts`, `tests/webview/rebaseEditor/autosquash.test.ts`).
- **Deviations from the slice:**
  - Minimal glue edits outside the Touch list:
    - `src/backend/rebase/todo.ts`: added optional `fixupFlag?: "-C"` on `TodoEntry` so `serializeTodo` emits `fixup -C <hash>` for `amend!` commits through F2-01b.
    - `src/backend/types/actions.types.ts` and `src/backend/types/queries.types.ts`: added `commitFixup` action payload, `fixupDialogInfo` query payload, and optional `autoSquash?: boolean | null` on `GitRebaseRangeResult`.
    - `src/backend/queries/rebaseRange.ts`: read `git config --bool --get rebase.autoSquash`.
    - `src/extension/messageHandler.ts`: registered `commitFixup` action (via `registerAction`, no new telemetry IDs) and `fixupDialogInfo` query.
    - `src/webview/main.ts` and `media/rebase-editor.css`: wired commit menu entries, small fixup/squash/reword creation dialogs, and autosquash switch / `fixup -C` badge styles.
  - `package.json` was not modified because `git-graph-libre.contextMenuActionsVisibility.properties.commit` already uses `"additionalProperties": { "type": "boolean" }` (matching F2-04).
- **Open questions / follow-ups:**
  - Native review of the 25 agent-translated `rebase.*` strings in `nl`, `pl`, `zh-cn`, and `zh-tw` would be helpful.
  - Windows verification of `COMMIT_MSG_EDITOR_COMMAND` (`cp -- "$GGL_COMMIT_MSG_FILE"`) inside Git for Windows' `sh` remains owed alongside F2-01b's `SEQUENCE_EDITOR_COMMAND`.
