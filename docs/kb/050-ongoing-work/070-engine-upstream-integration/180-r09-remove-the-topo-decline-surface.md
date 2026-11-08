---
summary: >-
  R09: remove the topo decline surface. R03 made the engine serve topological
  order, so the `topoOrdering` decline id can no longer occur. Remove it from
  `GraphLoadDecline`, the status popup's route text, the webview l10n
  wiring, all five l10n bundles and its test row, as the rule on obsolete
  surfaces requires.
---

# R09 — Remove the topo decline surface

Status: claimed by Claude Haiku on 2026-11-08 23:55

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

Not started.
