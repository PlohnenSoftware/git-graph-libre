---
summary: >-
  D50 · ready · webview CSS/TS · ≤120 lines: the settings popup's header row
  and its close button scroll away with the content. Keep the header pinned
  while the body scrolls, and fix any other popup or dialog with the same
  pattern. Maintainer bug report, `2026-10-19`.
---

# D50 — Pin the settings popup's header

Status: integrated 2fb2b82
Needs: —
Decisions: — (maintainer bug report, `2026-10-19`)
Kind: webview (CSS, and TypeScript markup if needed) · Size budget: ≤ 120 changed lines outside tests
Source: the maintainer: "in settings popup closing button can be scrolled up and it should be more like header"

## Goal

In the settings popup, the title row with its close button stays visible
while the settings scroll beneath it, like a header. The same holds in any
other popup or dialog of the webview that scrolls its header away.

## Read first

- [The agent protocol](010-agent-protocol.md), especially Commits
- Webview UI Styling Guide, and its "Verifying webview visuals without a
  browser" record, under Reference
- `src/webview/settingsWidget.ts` (the close button is about line 554,
  `settingsCloseBtn`) and `media/settings.css` (the scroll container is
  about line 21, `overflow: auto`)
- `media/dialogs.css` and the dialog code, to check for the same pattern

## Facts (checked `2026-10-19`)

- The close button is part of the content inside the popup's scrolling
  container, so it scrolls out of view with the settings.

## Steps

1. Make the popup a fixed header plus a scrolling body: the title row
   (with the close button and the tabs, if they belong to the header) stays
   put; only the body scrolls. Prefer moving the scroll to a body element
   over `position: sticky` if sticky would leave content showing through
   the header; either way the header needs an opaque theme background
   (VS Code tokens first, OKLCH fallback).
2. Check every other popup and dialog in the webview for the same pattern
   (a close button or title inside the scrolling element). Fix the ones that
   share it within the budget; list any you leave in the report.
3. Keyboard focus, `Escape` to close and the existing tab behavior stay
   unchanged.

## Touch

`media/settings.css`, `src/webview/settingsWidget.ts` (markup only if the
header must move out of the scroll container), `media/dialogs.css` and the
dialog-building code only for the step-2 fixes, their tests under
`tests/webview/` (for example `settingsWidget.test.ts`, `dialogStyles.test.ts`)

## Tests

- A CSS regression test asserting the scroll container is the body, not
  the element holding the close button (or that the header is sticky with
  a background), in the style of the existing CSS tests.
- The existing settings-widget tests stay green.

## Acceptance

- Gates pass (focused checks per the protocol; `l10n:check` if any text
  changes).
- Headless renders, per the styling guide's method, of the settings popup
  scrolled to its bottom in a dark and a light theme, with the close button
  visible. Put the screenshot paths in the report.

## Report

- **Agent / date:** Claude Sonnet D50, 2026-10-19
- **Branch and commits:** `diff-1.9.0/d50`; commit list in the hand-back message (claim, markup, CSS, test, this report)
- **Files changed:** `media/settings.css`, `src/webview/settingsWidget.ts`, `tests/webview/dialogStyles.test.ts`, this slice file (about 40 changed lines outside tests)
- **Approach:** the title row and tabs are wrapped in `.settingsWidgetHead`, which is `position: sticky; top: 0` with the opaque `--vscode-editorWidget-background` token. The padding moved from `#settingsWidget` onto the head and `.settingsTabPanel`, so nothing shows above the pinned head. Sticky was chosen over a separate scrolling body element so the scroll position survives `main.ts` re-rendering the widget with `innerHTML` (a new body element would reset to the top, and `main.ts` is outside the Touch list). Ids, tab order, keyboard handling and Escape are unchanged.
- **Tests added or changed:** one added in `dialogStyles.test.ts` (pins the sticky head, no popup padding, panel padding); webview files run (dialogStyles, settingsWidget, rendering, settingsWidgetActions): 136 passed, all green
- **Gates:** focused strict biome on touched .ts clean; typecheck clean; l10n n/a (no text change); Sonar: integrator
- **Acceptance:** met. Headless QtWebEngine renders of the real media CSS with the real `renderSettingsWidget` markup (panel content repeated to force overflow), scrolled to the bottom, close button and tabs visible: dark `/tmp/claude-1000/-home-zam-Desktop-prog--GGL-git-graph-libre/5f80f5de-8c08-45fe-b4e2-9ed81938cdbe/scratchpad/d50/dark.png`, light `/tmp/claude-1000/-home-zam-Desktop-prog--GGL-git-graph-libre/5f80f5de-8c08-45fe-b4e2-9ed81938cdbe/scratchpad/d50/light.png`
- **Other popups checked:** `#dialog` (confirmation, form, error dialogs) scrolls as a whole at `max-height: 80%`, but has no close button and only overflows with very long content; left unchanged. The dropdown menu already pins its filter header; the stash list and context menu have no header. No other popup shares the pattern.
- **Deviations from the slice:** none. `dialogs.css` and `main.ts` untouched.
- **Open questions / follow-ups:** none
