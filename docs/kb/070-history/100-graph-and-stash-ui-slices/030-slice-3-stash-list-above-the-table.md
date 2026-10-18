---
summary: >-
  Slice 3: `renderStashList()` moves the stash list from the footer into
  `#stashListSlot`; `renderGraph()` re-pins the canvas top. Rule:
  `tests/webview/setup.ts` duplicates the body markup, so update both.
---

# Slice 3 — Stash list above the table

`renderStashFooter()` became `renderStashList()` (same section HTML, same
`#stashList` id, `aria-label`, `.stashRow` markup, and `data-stash-ref` /
`data-stash-hash`), and `renderStashSection()` writes it into
`#stashListSlot` inside `#topBar`, between the status strip and the toolbar.
`renderLoadMoreFooter()` now renders only the load-more control; the loading
and error paths call `clearStashSection()`, since the list is outside both
the table and the footer and emptying either no longer covers it. The
`showStashes` gating is unchanged (it flows through the loaded stash data).
Both slot writers republish the sticky offset synchronously — see the
placement note at the top of this section.

One adjacency the move out of the footer required, and it still holds:
`#commitGraph` is an overlay pinned at the content top while its dot math
starts at the table header, so `renderGraph()` re-pins the canvas `top` to
the table's `offsetTop` on every render, and show/hide and count changes
self-correct with no observer. Rendering tests assert the slot, its two
siblings in `#topBar`, that neither `#content` nor `#footer` contains the
list, and listeners firing after a re-render.

**The webview body markup is duplicated in `tests/webview/setup.ts`.** Adding
`#stashListSlot` to `webviewHtml.ts` broke three tests until the fixture was
updated to match. Any change to that body structure needs both.

Verification: `pnpm run typecheck` clean; focused vitest (`rendering`,
`tableStyles`: 99 passed); strict Biome over `src/webview/main.ts` and both
touched test files (clean).

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).
