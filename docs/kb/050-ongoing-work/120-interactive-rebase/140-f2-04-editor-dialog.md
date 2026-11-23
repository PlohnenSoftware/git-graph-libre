---
summary: >-
  F2-04: the interactive rebase editor dialog in the graph: entry points from
  the commit menu, the branch menu and a multi-selection; a list oldest first
  with pick, drop, reorder and start; warnings for dropped, merged and
  published commits. Waits for F2-01b, F2-02, F2-03 and decisions IQ1, IQ2, IQ3, IQ12.
---

# F2-04 — Editor dialog: open, list, pick/drop/reorder, start

Status: done — awaiting integration

Needs: F2-01b, F2-02, F2-03; decisions IQ1, IQ2, IQ3, IQ12 confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; the Webview UI Styling Guide (Reference); research sections 1.1
(Entry points, Editor), 2 (Dialogs, Visibility), 4 (F2-04) and 5 (IQ1, IQ3,
IQ12) of `060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English, OKLCH
colors through tokens. Every user-visible string goes into all five l10n
bundles, and `pnpm run l10n:check` reports complete. No new telemetry events or
declarations. Do not bump versions or edit CHANGELOG, README or notices. Report
`Sonar: integrator`.

## Touch

- `src/webview/rebaseEditor/` (new; model, view and keyboard in separate, testable modules)
- `media/rebase-editor.css` (new, OKLCH tokens)
- `src/webview/main.ts`: entry points only
- `src/extension/webviewHtml.ts`: the stylesheet link
- `src/contextMenuVisibility.ts` and `src/types.ts`: an `interactiveRebase` toggle (IQ12)
- `package.json`: the setting that gates the menu items, following the existing visibility settings
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json` (five bundles)
- tests: `tests/webview/rebaseEditor/*.test.ts` (jsdom), `tests/backend/extension/rebaseEditorHandler.test.ts` (real repository through the message handler, as `worktreeHandlers.test.ts` does)
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Entry points.** The commit menu "Interactive Rebase..." (starts after that
commit, as the base, so the todo is `base..HEAD`); a branch menu entry; and a
multi-selection when it is one contiguous first-parent chain ending at a local
branch tip (it starts after the oldest selected commit's parent). The existing
"Interactive" checkbox in the rebase dialog stays as the terminal option (IQ3).

**The dialog.** A large dialog lists commits oldest first, as the todo. Each
row has an action select (pick, drop in this slice), up and down buttons,
Shift+Up and Shift+Down to move, and Ctrl or Cmd+Enter to start. The first row
cannot take squash or fixup (that verb arrives in F2-05).

**Notices and warnings.** A note counts the dropped commits. A notice names
merge commits that Git will flatten (IQ6: allowed, flattened, said so). A
warning names published commits: "rewrites history; needs a force push". Start
is disabled until the todo differs from the original; a published-commit
acknowledgement checkbox is F2-07's (IQ5).

**Start** calls F2-01b's `runInteractiveRebase` with the serialized todo. The
result is shown; a pause hands over to the F2-03 banner.

**Accessibility.** Keyboard and buttons are the accessible path. Drag reorder
inside the dialog is optional polish, not required for this slice. Focus is
trapped while the dialog is open, and it scrolls within the viewport in both
themes (the W06 and W22 headless render check applies).

**Tests.** Jsdom tests for the model: move, reorder, first-entry guard, change
detection, keyboard. Menu visibility. The message payload to the backend. An
integration test through the message handler against a real repository.

**Localization.** About 25 strings in five bundles.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

Also run a headless render of the dialog in both themes and record it in the
Report (the W06 and W22 check).

## Report

- **Agent / date:** Gemini 4 Argon (agy), 2026-11-23 12:45–13:05, cut off by a
  provider quota error (HTTP 429); finished by Muse Code
  (muse-wonder-full-1.0) on 2026-11-23 17:17 in the same worktree. The
  continuation kept the previous run's signed commits, verified its
  untracked tests, fixed the defects below, and completed the gates,
  renders and this report.
- **Branch and commits:** `rebase/F2-04` on base `3f9cccdc` —
  `fe0a4e9b G docs(rebase): claim F2-04 (F2-04)`;
  `70c7d307 G feat(rebase): add interactiveRebase context menu visibility toggle (F2-04)`;
  `c7654151 G feat(rebase): add interactive rebase editor localization strings (F2-04)`;
  `e7a85dd0 G feat(rebase): add interactive rebase editor model, keyboard, view and styles (F2-04)`;
  `834e375c G feat(rebase): wire interactive rebase editor entry points and messages (F2-04)`;
  `70bd00fb G fix(rebase): match the todo payload contract and warning token (F2-04)`;
  `2a18fabb G test(rebase): add interactive rebase editor model and view tests (F2-04)`;
  `24795559 G test(rebase): add interactive rebase editor message-handler tests (F2-04)`;
  plus this report commit.
- **Files changed:** 19 files, +2,879/−6 against `3f9cccdc` (including this
  slice file's status line): `src/webview/rebaseEditor/{model,keyboard,view,index}.ts` (new),
  `media/rebase-editor.css` (new), `src/webview/main.ts` (entry points and
  message wiring), `src/extension/webviewHtml.ts` (stylesheet link),
  `src/types.ts` and `src/contextMenuVisibility.ts` (`interactiveRebase`
  toggle, default on, branch and commit groups), `src/extension/webviewL10n.ts`
  and all five `l10n/bundle.l10n*.json` (35 `rebase.*` keys in the existing
  rebase block; nl, pl, zh-cn and zh-tw translated by the slice agents — a
  native review would help), `tests/webview/rebaseEditor/{model,view}.test.ts`,
  `tests/backend/extension/rebaseEditorHandler.test.ts`, and this file.
- **Tests added or changed:** 19 new tests (16 webview, 3 backend): model
  oldest-first init, empty range, drop/change detection, move/reorder and
  bounds, first-entry squash/fixup guard (direct set and reorder), merge and
  published collection, preflight and published-acknowledgement gating,
  payload shape, and keyboard interpretation/application; view rendering,
  notices and badges, Start/Reset gating, buttons, Shift+arrow reorder,
  Ctrl/Cmd+Enter start, Tab focus-trap wrap, HTML escaping, and a CSS token
  guard; full-webview entry points (ancestor commit, ancestor branch,
  contiguous HEAD multi-selection including the root `--root` case, and no
  offer on HEAD itself or non-ancestors), visibility toggles, and the
  `rebaseRange` → editor → `interactiveRebase` → F2-03 banner hand-over;
  real-Git message-handler tests for range read order, drop, reorder, an
  `edit` pause read back through `operationState`, and stale-range refusal.
- **Gates:** strict Biome
  (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`)
  clean on all 17 touched .ts/.json files (the config schema-version info
  note is pre-existing); `pnpm run typecheck` clean;
  `npx vitest run --project webview tests/webview/rebaseEditor/` 16 passed;
  `npx vitest run --project backend tests/backend/extension/rebaseEditorHandler.test.ts`
  3 passed; full `pnpm run test`: backend 1,700 passed (60 skipped, as
  expected in a linked worktree) and webview 1,181 passed;
  `pnpm run l10n:check` complete (100% for nl, pl, zh-cn, zh-tw);
  `node ./docs/kb/housekeeping.mjs --check` run with this report (see the
  report commit); headless renders of the real editor modules and
  stylesheets (PyQt6 QtWebEngine on a private Xvfb, injected Dark/Light
  Modern token values) inspected by eye in both themes:
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-04/rebase-editor-dark.png`
  and `.../rebase-editor-light.png` — notices, badges, dropped-row
  strikethrough, wrapped long subject, reordered rows, selected row and
  enabled Start all render cleanly with no horizontal scrolling.
  Forced-colors was not rendered (no emulation used); the stylesheet's
  `@media (forced-colors: active)` block is pinned by the CSS guard test.
  Sonar: integrator.
- **Acceptance:**
  - Entry points: **met.** Commit menu "Interactive Rebase…" for strict
    loaded HEAD ancestors (base is that commit, range `base..HEAD`); branch
    menu for strict HEAD-ancestor branch tips (base is the tip hash,
    labelled with the branch name); multi-selection only for the existing
    loaded contiguous first-parent HEAD chain (the rule squash/drop
    selection already use), starting after the oldest selected commit's
    parent, or `null` (`--root`) when the selection reaches the root. The
    existing terminal "Interactive" checkbox is untouched (IQ3). Entry
    points are HEAD-relative by construction, since the range read is the
    literal `base..HEAD`.
  - The dialog: **met.** Large dialog in the graph webview (IQ1), commits
    oldest first, per-row pick/drop select, up/down buttons, Shift+Up and
    Shift+Down to move, plain arrows to select, `p`/`d` shortcuts,
    Ctrl or Cmd+Enter to start, Reset, Cancel and Escape. The first row
    cannot take squash or fixup: the select offers only pick/drop in this
    slice, and the model refuses and normalizes a leading squash/fixup on
    direct set and on reorder, ready for F2-05's verbs.
  - Notices and warnings: **met.** A note counts dropped commits; a notice
    names merge commits Git will flatten (IQ6) with their short hashes; a
    warning names published commits as "rewrites history; needs a force
    push". Preflight blockers from F2-02 render as error notices and keep
    Start disabled. Start is disabled until the todo differs from the
    original. The model carries the F2-07 hook
    (`requirePublishedAck`/`publishedAcked`/`setPublishedAcked`, default
    off); no acknowledgement checkbox is rendered in this slice, per the
    slice text (IQ5 protection details are F2-07's).
  - Start: **met.** Sends the `interactiveRebase` action with the
    serialized todo entries and range hashes through F2-01b's
    `runInteractiveRebase`; the generic action completion refreshes the
    graph and re-reads `operationState`, so a pause hands over to the
    F2-03 banner (proven in both the webview integration test and the
    real-Git handler test).
  - Accessibility: **met.** Keyboard and buttons are the reorder path (no
    drag in this slice); focus is trapped on Tab/Shift+Tab while open;
    the list scrolls inside the viewport-capped dialog (`overflow-y: auto`
    body, sticky table header, pinned header and actions); short hashes
    use the in-house `abbrevCommit` at the `shortHashLength` setting.
  - Tests: **met**, as listed above.
  - Localization: **met.** 35 strings in all five bundles inside the
    existing `rebase.` block; `l10n:check` complete.
  - Visibility (IQ12): **met.** `interactiveRebase` joins the branch and
    commit visibility groups, default on, at both ends the settings-twice
    rule needs (defaults map + normalization), and the menus honor it.
- **Deviations from the slice:** three notes for the integrator.
  (1) `package.json` was not edited: the `contextMenuActionsVisibility`
  schema already admits any boolean key per group through
  `additionalProperties`, so the new toggle needs no manifest change.
  (2) The multi-selection rule reuses the existing loaded HEAD-chain test
  (contiguous first-parent chain whose newest commit is HEAD), which the
  slice's "ending at a local branch tip" reduces to for a `base..HEAD`
  editor; a selection ending at a non-HEAD branch tip is not offered.
  (3) Continuation fix-ups to the previous run's work (`70bd00fb`): the
  start payload dropped its non-contract `subject` field, the stylesheet's
  undefined `--ngg-status-warning` fallback became the existing
  `--ngg-warning` token, and the branch entry point now passes the tip
  hash instead of the branch name as the base. No file outside the Touch
  list was edited. Clean-room record: implemented from Git's documented
  todo behavior and this project's own dialog, menu and banner patterns;
  the research's Git Graph+ reading was behavioral only and no code was
  copied.
- **Open questions / follow-ups:** F2-05 extends the model's action set
  and message state (the first-entry guard and payload already carry
  them); F2-07 renders the published-commit acknowledgement checkbox
  behind `requirePublishedAck`. The ancestor offer only sees loaded
  commits, like the mute-non-ancestors walk it shares code with, so a
  base beyond the loaded page cannot be offered from the graph until
  more commits load. Native review of the four translations would help.
