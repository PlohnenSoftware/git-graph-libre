---
summary: >-
  R09: remove the topo decline surface. R03 made the engine serve topological
  order, so the `topoOrdering` decline id can no longer occur. Remove it from
  `GraphLoadDecline`, the status popup's route text, the webview l10n
  wiring, all five l10n bundles and its test row, as the rule on obsolete
  surfaces requires.
---

# R09 — Remove the topo decline surface

Status: done — awaiting integration

Needs: R03

Read first: Engine upstream integration overview, Multi-agent releases,
R03's report (`120-r03-traversal.md`), the rule on removing obsolete
surfaces in Branch and release policy.

## Facts (`2026-11-08`)

`loadCommitsDecline` no longer returns `"topoOrdering"` since R03
(`1d78a2f`). The id remains in:

- `src/types.ts:283` (`GraphLoadDecline`);
- `src/webview/componentStatus.ts:334` (route text);
- `src/extension/webviewL10n.ts:769` (`componentStatusRouteTopoOrdering`);
- `l10n/bundle.l10n*.json:656` (`componentStatus.route.topoOrdering`, five
  bundles);
- `tests/webview/componentStatus.test.ts:290` (its row).

## Touch

src/types.ts; src/webview/componentStatus.ts; src/extension/webviewL10n.ts;
any webview l10n type that declares `componentStatusRouteTopoOrdering`;
l10n/bundle.l10n.json; l10n/bundle.l10n.nl.json; l10n/bundle.l10n.pl.json;
l10n/bundle.l10n.zh-cn.json; l10n/bundle.l10n.zh-tw.json;
tests/webview/componentStatus.test.ts. Not `src/backend/engine/commits.ts`,
which R07 edits.

## Task and acceptance

Remove the id and every surface that exists only for it. Telemetry: if a
declared event or telemetry list names `topoOrdering`, stop and report,
because telemetry declarations are the maintainer's. `git grep
topoOrdering` outside `docs/`, `graphify-out/` and `CHANGELOG.md` returns
nothing. `pnpm run l10n:check` complete, `pnpm run typecheck` clean,
strict Biome on touched TypeScript clean, and the webview and backend tests
for touched files pass. Claim and changes use signed commits; never push.
Report Sonar: integrator.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-08 23:56
- **Branch and commits:** `engine-review/R09`
  - `cf2cc47 G docs(engine): claim R09 for the topo decline removal`
  - `5a4a96b G refactor(engine): remove the topoOrdering decline surface (R09)`
  - `a461a40 G test(webview): drop the topoOrdering route row (R09)`
  - the commit recording this report, which follows these (signed; see `git log`)
- **Files changed** (`git diff --stat eb7a9d8 HEAD`, 10 files, +2 −10):
  `src/types.ts` (+1 −1, `GraphLoadDecline` now `"reflog" | "unreachableCommits" | "globPattern"`),
  `src/webview/componentStatus.ts` (−1), `src/extension/webviewL10n.ts` (−1),
  `l10n/bundle.l10n.json`, `.nl.json`, `.pl.json`, `.zh-cn.json`, `.zh-tw.json` (−1 each),
  `tests/webview/componentStatus.test.ts` (−1), and the slice file's status line
  (claim and this report). The webview l10n strings are a plain inferred return
  object, so no separate type declared the removed key.
- **Tests added or changed:** one `it.each` row removed (`topoOrdering`). Webview
  `componentStatus.test.ts`: 29 passing after the removal (the count before
  the removal was not measured). Backend `commits.test.ts` and
  `reader.test.ts`: 112 passing, unchanged (they never named `topoOrdering`).
- **Telemetry check:** `telemetry.json` and the telemetry sources name no `topoOrdering`, so nothing needed the maintainer.
- **Gates** (focused, run after the edits, before the code commits):
  - `git grep -n topoOrdering -- ':!docs' ':!graphify-out' ':!CHANGELOG.md'`: no matches (exit 1), met.
  - `pnpm run l10n:check`: "All translations are complete"; bundle 100% for nl, pl, zh-cn, zh-tw.
  - `pnpm run typecheck`: exit 0.
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the four touched `.ts` files: "Checked 4 files ... No fixes applied", exit 0. Biome printed a configuration schema-version notice (`biome.strict.jsonc` names schema 2.5.13, the installed CLI is 2.6.5). This is a notice, not a finding, and predates this slice; not changed here.
  - `npx vitest run --project webview tests/webview/componentStatus.test.ts`: 29 passed.
  - `npx vitest run --project backend tests/backend/engine/commits.test.ts tests/backend/engine/reader.test.ts`: 112 passed.
  - Sonar: integrator.
- **Acceptance:**
  - `git grep topoOrdering` outside `docs/`, `graphify-out/`, `CHANGELOG.md`: met (no matches).
  - `pnpm run l10n:check` complete: met.
  - `pnpm run typecheck` clean: met.
  - Strict Biome clean on touched TypeScript: met (see the notice above).
  - Webview componentStatus test and both backend engine test files pass: met.
  - `src/backend/engine/commits.ts` untouched: met.
- **Deviations from the slice:** none. Note: R03's report listed the same leftover ids as deviation (2); this slice removes them.
- **Open questions / follow-ups:** none for R09. The rest of the `topoOrdering` history is in `docs/` and `CHANGELOG.md`, which the slice excludes by design. Biome's schema-version notice may be worth the maintainer's attention as a separate chore; it is not R09's.
