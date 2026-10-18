---
summary: >-
  Record of the `1.6.1` release gate: no extension change, only the first Open
  VSX publish; test counts, `sonar:scan` `ZAM` `OK` with task ids,
  `sonar.projectVersion` bump.
---

# Release gate for `1.6.1` (`2026-09-17`)

A patch release with **no change to the extension itself** — its whole purpose
is to put 1.6.0's feature set on the second registry, so the first Open VSX
version is one the Marketplace already carries rather than a fork-specific
build. `1.6.0` was live on the Marketplace at `194` installs when this started
and Open VSX had nothing.

Run in the documented order over the completed tree: strict Biome on the
touched JSON configs (clean), `pnpm run package`, `pnpm run test` (backend `61`
files / `479` tests, webview `48` / `500`), `pnpm run l10n:check` `100%` for
all four locales, `pnpm run test:ext` (both launches, `58` + `1`, exit `0`),
fresh `pnpm run test:coverage` (`109` files / `979` tests), then
`pnpm run sonar:scan` — task `3876e0c3-5df3-4b76-a254-95d630442a95`, analysis
`95f16d0c-d671-4322-a3cc-219bbdff8709`: `ZAM` gate **`OK`** on all seven
reported conditions — `new_coverage` `100.0`, `new_violations` `0`,
`new_duplicated_lines_density` `0.0`, `new_software_quality_high_issues` `0`,
maintainability rating `1`, reliability and security issues `0`. The eighth
condition was not reported because
`/api/hotspots/search?inNewCodePeriod=true&status=TO_REVIEW` returns `0`.

`sonar.projectVersion` advanced `1.6.0` → `1.6.1` with the package version, so
this analysis measures the whole delta since the last analyzed version.
