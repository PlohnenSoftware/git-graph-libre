---
summary: >-
  D65G · ready · notices + data + changelog · ~15 lines: Thomas KT Chan
  (`cktgh`) wrote PRs #22–#25, merged `2026-10-16` into 1.8.0, but no roster
  or changelog credits them, so D65's Contributors tab can't either. Add them
  to `NOTICE.md`'s AGPL roster, to the tab's data, and to `[1.8.0]`.
---

# D65G — Credit Thomas KT Chan

Status: ready
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

_(not started)_
