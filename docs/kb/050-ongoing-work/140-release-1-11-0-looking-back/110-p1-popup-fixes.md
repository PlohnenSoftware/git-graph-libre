---
summary: >-
  P1: the open popup defects V1–V11 from "Popup and context-menu visual
  review" (Ongoing work), with VQ1 answered (`2026-11-23`: icon buttons for
  the Worktrees popup's upkeep actions, Remove included). Optional for
  release 1.11.0.
---

# P1 — Popup fixes V1–V11

Status: claimed by Muse Code on 2026-11-23 12:01

Needs: —

Agent: Muse Code

Read first: `AGENTS.md`; the KB index and every *always read* section;
Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`); "Popup and
context-menu visual review" (`050-ongoing-work/090-popup-and-context-menu-visual-review.md`),
whole: it is this slice's specification (each V item's Shows, Where, Fix
proposed and Keep); the Webview UI Styling Guide (Reference) and its
subsections, including the headless render recipe.

## Decisions

- **VQ1 (maintainer, `2026-11-23`): icon-only buttons are acceptable for the
  upkeep actions, Remove included** — V2 as proposed: Copy Path, Lock or
  Unlock, Move and Remove as compact icon buttons with their label as
  `title` and `aria-label`; the go-to actions stay text buttons.

## Touch

The files each V item names under "Where" (webview TypeScript under
`src/webview/**`, `media/*.css`), their tests (the CSS regression tests in
`tests/webview/dialogStyles.test.ts`, `tests/webview/tableStyles.test.ts`
and the dialogs' own tests), `l10n/bundle.l10n*.json` when a string
changes (new keys in their own block, not at the end of the file and not in
the `reflog.*` block), the review file's Status line and V items' status,
and this slice file's Status and Report.

## Task and acceptance

Fix V1, V3–V11 in the review's suggested order, then V2, each with its test,
rendered headlessly in dark and light (and forced colors where the review
asks) before it is called done, PNGs under
`/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/p1/`. Mark each V item done in
the review file as it lands. Keep every action keyboard-reachable and every
`data-*` attribute tests and handlers use.

## Report

Not started.
