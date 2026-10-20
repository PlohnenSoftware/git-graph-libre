---
summary: >-
  D65G · ready · notices + data + changelog · ~15 lines: Thomas KT Chan
  (`cktgh`) wrote PRs #22–#25, merged `2026-10-16` into 1.8.0, but no roster
  or changelog credits them, so D65's Contributors tab can't either. Add them
  to `NOTICE.md`'s AGPL roster, to the tab's data, and to `[1.8.0]`.
---

# D65G — Credit Thomas KT Chan

Status: done — awaiting integration
Needs: D65
Decisions: — (the maintainer asked for every contributor to be listed;
`NOTICE.md` compiles its roster from the git author records, and this author
was missed)
Kind: notices + data + changelog · Size budget: ~15 changed lines outside tests
Source: D65's report

## Facts (checked `2026-10-20`)

- Git author `Thomas KT Chan`, four commits on `2026-10-15`, GitHub `cktgh`:
  - #22, `b594cd1`: scroll a context menu that is taller than the window;
  - #23, `9d55b78`: quick toggling in multi-select dropdowns;
  - #24, `cdd0743`: a `--no-commit` dialog option for revert, pull and
    cherry-pick;
  - #25, `9bba81e`: Enter confirms dialog boxes.

  All four were merged on `2026-10-16` and released in 1.8.0. Their 1.8.0
  changelog entries exist but credit no one.
- `NOTICE.md`: "Contributions arriving by pull request are credited by name
  in CHANGELOG.md for the release that carries them."

## Steps

1. `NOTICE.md`, "Contributors to the AGPL-licensed work": add
   `Thomas KT Chan (cktgh)` with `2026-10-15`, aligned like the other rows,
   in date order.
2. `src/webview/contributors.ts`: the same display name in the Git Graph
   Libre era, in the same order as the roster.
3. `CHANGELOG.md` `[1.8.0]`: credit "Thomas KT Chan (@cktgh)" on each of the
   four entries, or once in a short line under that release that names the
   four features and links the PRs. Change no other wording.

## Touch

`NOTICE.md` (that roster only), `src/webview/contributors.ts`, `CHANGELOG.md`
(`[1.8.0]` only), `tests/webview/contributors.test.ts` only if its
expectations hard-code the roster length

## Acceptance

- D65's roster-parity test still passes, now with the new name.
- No email address added anywhere.
- Strict Biome on touched `.ts`, typecheck, `pnpm run test` counts,
  `kb:check`, `Sonar: integrator`.

## Report

- **Agent / date:** Claude Haiku 5.5 (D65G slice agent), 2026-10-20 18:44
- **Branch and commits:** `diff-1.9.0/d65g` —
  - `8b3605b` G docs(release): claim slice D65G (D65G)
  - `ab2ad4a` G docs(notice): credit Thomas KT Chan in the AGPL roster (D65G)
  - `637fd48` G feat(settings): list Thomas KT Chan in the Contributors tab (D65G)
  - `a2648b6` G docs(changelog): credit Thomas KT Chan for #22–#25 in 1.8.0 (D65G)
- **Files changed:** `NOTICE.md` (+1/−0); `src/webview/contributors.ts` (+2/−1);
  `CHANGELOG.md` (+11/−0, `[1.8.0]` only); this slice file (Status line and
  Report only, +2/−1 at the claim and status). No test file changed.
- **Tests added or changed:** none. Roster-parity tests in
  `tests/webview/contributors.test.ts` (6 tests) pass with the new name; the
  test file's roster-count assertions are lower bounds, so nothing hard-codes
  the length.
- **Gates:** biome `npx biome check --config-path biome.strict.jsonc
  --error-on-warnings src/webview/contributors.ts` clean; typecheck clean;
  test backend 1109 passed, 60 skipped, of 1169 (91 files); webview 790 passed
  of 790 (64 files); l10n n/a (no user-visible string); kb:check exit 0; Rust
  arm n/a; Sonar: integrator
- **Acceptance:** D65's roster-parity test still passes with the new name: met
  (6/6 in `contributors.test.ts`, full webview project green). No email address
  added anywhere: met (the new row and the tab entry carry only the name and
  the GitHub handle `cktgh`). Strict Biome, typecheck, test counts, kb:check:
  met as listed above.
- **Deviations from the slice:** the changelog credit is the second option
  of Step 3 (one line under `[1.8.0]` naming the four PRs with links), laid out
  as a short bulleted list, so each line stays within 80 characters. No other
  wording changed.
- **Open questions / follow-ups:** none. Note the D65 report's open question
  about Thomas KT Chan's missing roster entry is now resolved by this slice's
  NOTICE row; the LICENSE.mit roster is untouched, as the slice requires.
