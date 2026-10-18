---
summary: >-
  Historical slice order for the bug backlog (BUG-3, BUG-1+6, BUG-5, BUG-4,
  BUG-2), plus the per-slice gate order ending with an `OK` `ZAM` Sonar gate
  before committing.
---

# Suggested slice order

1. **BUG-3** — one flag (`--no-sign`) removes a blocking, editor-popping
   failure; do it first and ship it.
2. **BUG-1 + BUG-6** — same file, same types, same tests; one slice.
3. **BUG-5** — manifest one-liner plus a test reversal; the maintainer has
   decided (restore `onStartupFinished`), so this is unblocked.
4. **BUG-4** — new setting, so manifest + config + l10n + README + CSS + tests;
   largest of the four.
5. **BUG-2** — the feature work that BUG-1 unblocks.

Each slice follows the standing gate order in this document: strict Biome on
touched files, full typecheck/lint, full tests, `pnpm run l10n:check`, fresh
`pnpm run test:coverage`, then `pnpm run sonar:scan` polled to an `OK` `ZAM`
gate **before** committing. Advance `sonar.projectVersion` when the maintainer
opens a new analysis epoch for this backlog.
