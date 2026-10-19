---
summary: >-
  D51 · ready · webview CSS/TS · ≤120 lines: the Summary and Files section
  headers in commit details scroll away with their content. Keep each
  section's header pinned while its body scrolls, in commit details, in
  comparisons and in the staging panel that reuses them. Maintainer bug
  report, `2026-10-19`.
---

# D51 — Pin the commit details section headers

Status: done — awaiting integration
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

- **Agent / date:** Claude Sonnet D51, 2026-10-19
- **Branch and commits:** `diff-1.9.0/d51`: claim `2b34d15`, fix `aeb18fc`, test `0a40191` (all signed, `G`); the report commit and the final status commit follow it.
- **Files changed:** `media/commit-details.css` (+17/-3), `tests/webview/tableStyles.test.ts` (+15), this slice file.
- **Tests added or changed:** one new test in `tests/webview/tableStyles.test.ts` ("pins each commit details section header while its body scrolls"); the five commit-details, staging and CSS test files run: 89 passed (88 before).
- **Gates:** biome strict clean on the touched `.ts` file; typecheck see below; webview focused 89/89 passed; l10n n/a (no text); kb:check see below; Rust arm n/a; Sonar: integrator
- **Acceptance:** met. Headless QtWebEngine renders with the real `media/*.css` (script `/tmp/claude-1000/-home-zam-Desktop-prog--GGL-git-graph-libre/5f80f5de-8c08-45fe-b4e2-9ed81938cdbe/scratchpad/d51/shot.py`, hand-built markup mirroring the renderers, both panes scrolled 150px, Dark Modern and Light Modern token values): the Summary and Files headers (and Staged and Unstaged) stay pinned and opaque. Screenshots in `/tmp/claude-1000/-home-zam-Desktop-prog--GGL-git-graph-libre/5f80f5de-8c08-45fe-b4e2-9ed81938cdbe/scratchpad/d51/`: `d51-files-dark.png`, `d51-files-light.png` (many files), `d51-summary-dark.png`, `d51-summary-light.png` (long summary), `d51-comparison-dark.png`, `d51-comparison-light.png` (D13 header scrolls with the body, headers pinned), `d51-staging-dark.png`, `d51-staging-light.png`.
- **Deviations from the slice:** none. CSS only: the toggle is already a direct child of each scrolling pane (summary, files, and the same ids in the staging panel), so `position: sticky; top: 0` on `.commitDetailsToggle` suffices and no markup moved. The background is the editor background with the previous translucent tints layered on top as gradients, so it looks the same but is opaque.
- **Open questions / follow-ups:** the renders use hand-built markup, not the live extension, so collapse/expand, the resize handle, the list/tree toggle and drag and drop were checked by reasoning (no DOM or handler changed; the sticky header stays in flow and the handle is an absolute sibling), not by interaction. The Styling Guide gained no note, since it is outside the Touch list; the integrator may add one line.
