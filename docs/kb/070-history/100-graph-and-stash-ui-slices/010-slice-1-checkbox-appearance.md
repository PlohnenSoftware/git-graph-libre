---
summary: >-
  Slice 1: one shared `media/checkbox.css` restyle with VS Code checkbox
  tokens, a neutral box, a `clip-path` tick and `:indeterminate`; accent fill
  rejected. Lesson: check styling records against the actual CSS.
---

# Slice 1 — Checkbox appearance

One shared rule set in `media/checkbox.css` (wired into `webviewHtml.ts` and
the CSS test helper alongside the other links) covers every checkbox in the
webview — dialog forms, settings hub, toolbar — so the box, tick, and states
stay identical everywhere. Each site keeps its native
`input[type="checkbox"]`, restyled with `appearance: none` plus a themed box
(`--vscode-checkbox-background` / `--vscode-checkbox-border` with `--ngg-*`
OKLCH fallbacks, 3px radius): a neutral box whether set or unset, a clipped
`::after` check mark in `--vscode-button-foreground`, hover feedback,
`:focus-visible` ring on `--vscode-focusBorder` at `outline-offset: 2px`,
`:disabled` dimming, and `forced-colors` / `prefers-reduced-motion`
counterparts. Only the box size lives outside the shared selectors (dialog
alignment/margin, toolbar 14px; dialog and settings share the 16px box). The
Webview UI Styling Guide checkbox line was rewritten to describe this
pattern. CSS regression coverage in `tests/webview/dialogStyles.test.ts` and
`tests/webview/tableStyles.test.ts`.

**Two defects were found in this slice after it was first written, and both
are worth not repeating.** The maintainer reported the result as looking
strange, and the cause was not subtle once the CSS was read against the
rendered control:

- **The record and the stylesheet disagreed.** The paragraph above originally
  described an accent fill on `:checked` that the stylesheet never carried —
  there was no `:checked` rule at all, only `:checked::after` for the tick.
  Treat a styling record as a claim to verify, not as evidence. The fix,
  though, was **not** to add the fill: an accent-filled box was implemented,
  shown to the maintainer, and rejected as far too loud at this size. The box
  is neutral by design and the tick carries the state; what actually needed
  fixing was the tick's shape and contrast.
- **The resting box ignored VS Code's checkbox tokens**, using the repo's
  generic grey overlays directly, so it looked foreign beside native
  controls. The tokens are now the primary source with the OKLCH neutrals as
  fallbacks, per the styling guide's own token-first rule.

The tick was also rebuilt: it is one `::after` shape clipped with
`clip-path: polygon(...)` in percentages rather than a rotated border. The
percentage clip scales with the box, which deleted the toolbar's separate
tick metrics — the compact variant previously carried its own hand-tuned
`left`/`top`/`width`/`height`, a second set of numbers that could drift from
the first. `:indeterminate` was added in the same pass and shares the set-box
fill with a bar-shaped clip. A regression test pins that no per-site tick
override exists.

Verification: focused vitest (`dialogStyles`, `tableStyles`: 44 passed),
strict Biome over the touched files (clean after one formatting fix). The
tick polygon was additionally rasterized off-tree and inspected by eye before
committing, since the defect being fixed was one that only shows up rendered.

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).
