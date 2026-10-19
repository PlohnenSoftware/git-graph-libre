---
summary: >-
  D13G · ready · webview · ≤5 lines: switch the comparison header's Swap
  button from the `sync` octicon to `arrow-switch`, which D04b made
  available, as the maintainer accepted under X11.
---

# D13G — Swap icon

Status: ready
Needs: D13, D04b (both integrated)
Decisions: X11 (a)
Kind: webview · Size budget: ≤ 5 changed lines outside tests
Source: D04b's report follow-up, accepted by the maintainer under X11 (`2026-10-19`)

## Goal

The Swap button in a comparison's header shows the `arrow-switch` icon
instead of `sync`.

## Facts (checked `2026-10-19`)

- `src/webview/commitDetailsView.ts` about line 172:
  `${octicon("sync", "commitDetailsComparisonSwapIcon")}`.
- D04b added `arrow-switch` to the generated octicons (`src/octicons.ts`,
  `src/webview/utils/icons.ts`); it is already used for type changes.
- `tests/webview/commitDetailsView.test.ts` about line 196 checks the
  icon's class, not which icon it is.

## Steps

1. Replace `"sync"` with `"arrow-switch"` on that line. Change nothing
   else.
2. In `commitDetailsView.test.ts`, assert that the Swap button renders the
   `arrow-switch` icon, in the way the existing octicon tests identify an
   icon.

## Touch

`src/webview/commitDetailsView.ts`, `tests/webview/commitDetailsView.test.ts`

## Acceptance

- Strict Biome clean on the two files, typecheck green,
  `pnpm exec vitest run --project webview tests/webview/commitDetailsView.test.ts`
  green. The new assertion fails before the change.

## Report

_(not started)_
