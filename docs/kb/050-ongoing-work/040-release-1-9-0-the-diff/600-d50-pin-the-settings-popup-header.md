---
summary: >-
  D50 · ready · webview CSS/TS · ≤120 lines: the settings popup's header row
  and its close button scroll away with the content. Keep the header pinned
  while the body scrolls, and fix any other popup or dialog with the same
  pattern. Maintainer bug report, `2026-10-19`.
---

# D50 — Pin the settings popup's header

Status: claimed by Claude Sonnet D50 on 2026-10-19 15:01
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

_(not started)_
