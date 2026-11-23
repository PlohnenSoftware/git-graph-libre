---
summary: >-
  F2-04: the interactive rebase editor dialog in the graph: entry points from
  the commit menu, the branch menu and a multi-selection; a list oldest first
  with pick, drop, reorder and start; warnings for dropped, merged and
  published commits. Waits for F2-01b, F2-02, F2-03 and decisions IQ1, IQ2, IQ3, IQ12.
---

# F2-04 — Editor dialog: open, list, pick/drop/reorder, start

Status: waiting

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

Not started.
