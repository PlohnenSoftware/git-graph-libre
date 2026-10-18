---
summary: >-
  Slice 2: the `.gitRefGroup > .gitRefAlias` divider in `media/refs.css`
  restyled to badge foreground at 30% via `color-mix(in oklab)`; AA contrast
  re-verified; CSS regression tests forbid `in srgb`.
---

# Slice 2 — Remote sub-label restyle

Appearance only; `groupCommitRefs()` already emits one abbreviated segment per
remote with the full ref in the tooltip, so no grouping-logic change was
needed. In `media/refs.css` the `.gitRefGroup > .gitRefAlias` divider changed
from the neutral heavy border to the badge foreground at 30% via
`color-mix(in oklab, …)`; fill, text, hidden icon, tooltips, and the
border-only active distinction are untouched. Contrast re-verified with an
independent script (kept outside the repo): Light Modern 6.98:1, 2026 Light
5.39:1, Light+ default 7.24:1 — all ≥ AA, reproducing the BUG-4 numbers
exactly since the fill/text pair did not move. New CSS regression tests pin
the badge token chain, the oklab-only divider, the hidden alias icon, no
`color` on `.gitRef`/`.gitRefGroup`, no `font-weight` on the active rules,
and no `in srgb` mix anywhere in the webview bundle; the existing
`rendering.test.ts` group test already pins abbreviated labels, full-ref
titles, and per-alias actions.

Verification: focused vitest (`dialogStyles`, `tableStyles`, `refLabels`,
`rendering`: 121 passed), strict Biome over the touched test file (clean;
CSS is not counted by the strict config).

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).
