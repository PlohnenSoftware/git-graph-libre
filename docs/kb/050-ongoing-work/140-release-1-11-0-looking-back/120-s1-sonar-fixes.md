---
summary: >-
  S1: fix the SonarQube new-code findings of the early release-gate scan on
  `main` (`2026-11-23`, 15 issues, gate ERROR): S1a the twelve mechanical
  ones (shadowing, `codePointAt`, optional chain, needless assertion, nested
  ternary, concatenation, two suppression comments replaced by code), S1b
  the two cognitive-complexity refactors in `src/backend/queries/blame.ts`,
  S1c the one in `src/webview/reflogTab/view.ts` after F1-06 and F1-07.
---

# S1 — SonarQube new-code fixes (early scan)

Status: S1a integrated `e342ce2c` · S1b integrated `0cfaa6c5` · S1c ready (F1-06 and F1-07 integrated)