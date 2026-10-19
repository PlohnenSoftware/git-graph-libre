---
summary: >-
  D13G · ready · webview · ≤5 lines: switch the comparison header's Swap
  button from the `sync` octicon to `arrow-switch`, which D04b made
  available, as the maintainer accepted under X11.
---

# D13G — Swap icon

Status: integrated 6ade64e
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

- **Agent / date:** Claude Haiku D13G, 2026-10-19 14:46
- **Branch and commits:** `diff-1.9.0/d13g` — `f67e8f7 G fix(compare): use the arrow-switch icon for Swap (D13G)`; the report commit `docs(release): report D13G done, awaiting integration (D13G)` (its hash is not recorded here, it is this commit)
- **Files changed:** `src/webview/commitDetailsView.ts` +1/−1; `tests/webview/commitDetailsView.test.ts` +1/−0; `docs/kb/050-ongoing-work/040-release-1-9-0-the-diff/236-d13g-swap-icon.md` (status and report only)
- **Tests added or changed:** `commit details view rendering > renders the comparison header only for comparisons, above the summary` gained one assertion, `swap?.querySelector("svg.octicon-arrow-switch")` not null. No test added or removed. Count before and after: 26 in the file.
- **Gates:** biome exit 0 (strict, `--error-on-warnings`, 2 files); typecheck exit 0; test backend not run (focused change); webview 26/26 in `commitDetailsView.test.ts` (focused run); l10n n/a; kb:check exit 0; Rust arm n/a; Sonar: integrator
- **Acceptance:** met. Strict Biome clean on both files; typecheck green; the webview run of `commitDetailsView.test.ts` is green (26/26). The new assertion fails with `"sync"` (1 failed, `AssertionError: expected null not to be null`) and passes with `"arrow-switch"`.
- **Deviations from the slice:** none. Scratch check used `/tmp/x` for a temporary copy of the source file, removed afterwards.
- **Open questions / follow-ups:** none for this slice. Only the always-read KB sections I read were the index, the commit-signing and branch-policy sections, and the styling guide; the remaining always-read sections were not read in full, as they do not bear on an icon swap.
