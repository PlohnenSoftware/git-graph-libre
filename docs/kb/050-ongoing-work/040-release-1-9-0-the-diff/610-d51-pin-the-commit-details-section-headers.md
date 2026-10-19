---
summary: >-
  D51 · ready · webview CSS/TS · ≤120 lines: the Summary and Files section
  headers in commit details scroll away with their content. Keep each
  section's header pinned while its body scrolls, in commit details, in
  comparisons and in the staging panel that reuses them. Maintainer bug
  report, `2026-10-19`.
---

# D51 — Pin the commit details section headers

Status: ready
Needs: —
Decisions: — (maintainer bug report, `2026-10-19`)
Kind: webview (CSS, and TypeScript markup if needed) · Size budget: ≤ 120 changed lines outside tests
Source: the maintainer: "same with headers in commit details namely Summary and Files"

## Goal

In commit details, the "Summary" and "Files" section headers (with their
collapse controls and any header buttons) stay visible while each
section's content scrolls beneath them.

## Read first

- [The agent protocol](010-agent-protocol.md), especially Commits
- Webview UI Styling Guide, and its "Verifying webview visuals without a
  browser" record, under Reference
- `media/commit-details.css`: `#commitDetailsSummary` (about line 115,
  `overflow-y: auto`) and `#commitDetailsFiles` (about line 263,
  `overflow-y: scroll`), plus the `summaryCollapsed` / `filesCollapsed`
  rules
- `src/webview/commitDetailsView.ts` (`capitalizeSection` about line 387,
  and where the section headers are rendered) and the staging panel
  (`src/webview/uncommittedDetailsView.ts`), which reuses `#commitDetails`

## Facts (checked `2026-10-19`)

- Each section's header is inside the element that scrolls, so it scrolls
  out of view with the section's content.
- The comparison header (D13) and the first-parent note (D06) sit above the
  summary; check they behave sensibly too.

## Steps

1. Keep each section's header row fixed at the top of its section while
   only the section body scrolls: either move the scroll to a body element
   below the header, or make the header `position: sticky; top: 0` with an
   opaque theme background (VS Code tokens first, OKLCH fallback) so
   content doesn't show through.
2. Collapsing and expanding a section, the resize handle, the list/tree
   toggle, and the staging panel's drag and drop keep working.
3. Change no behavior beyond the pinning.

## Touch

`media/commit-details.css`, `src/webview/commitDetailsView.ts` and
`src/webview/uncommittedDetailsView.ts` (markup only if a header must move
out of its scroll container), their tests under `tests/webview/` (for
example `commitDetailsView.test.ts`, `uncommittedDetailsView.test.ts`, the
CSS tests)

## Tests

- A CSS regression test for the pinned headers, in the style of the
  existing CSS tests.
- The existing commit-details, comparison and staging-panel tests stay
  green.

## Acceptance

- Gates pass (focused checks per the protocol).
- Headless renders, per the styling guide's method, of a commit with many
  files scrolled down, and of a long summary scrolled down, in a dark and a
  light theme, with both headers visible. Put the screenshot paths in the
  report.

## Report

_(not started)_
