---
summary: >-
  Done (taken over mid-flight, gated `OK`): the CLI-only `commitSignatures`
  query lifts the signature-column decline; the Hidden menu's `forced` reload;
  reader failure/decline flags feeding `view.engineUnavailable.<reason>`,
  `view.engineFailed`, `view.engineDeclined`, `view.forceCliReload`; the
  `backend: "git-cli"` setting already existed.
---

# Signatures leave the graph load; a one-off CLI reload and engine-failure telemetry (`2026-10-16`)

Three maintainer asks landed together, plus the change that makes two of
them matter less often.

**The signature column is read after the page renders.** `%G?` runs GPG (or
SSH verification) once per signed commit, while everything else about a
page is a cheap read — so the visible column both slowed every CLI load
and, since 16.5, declined the engine outright; with Author Date it was one
of the two declines in the maintainer's own default settings. The graph
load now never asks for signatures on either backend (`showSignature` is
gone from the query, the reader and the messages). The new CLI-only
`commitSignatures` query (`src/backend/queries/commitSignatures.ts`) reads
exactly the hashes the webview shows — `git log --no-walk=unsorted` in
chunks of 200, full object names only, since the hashes arrive over the
bridge and become command-line arguments — and the `1.2.0` `gpgsig` probe
moved there with it, so verification stays a permanent engine non-goal,
unchanged. The webview caches answers per repository (the toolbar refresh
empties the cache, so newly trusted keys are picked up on request), fills
cells in place, and leaves them pending with a strip error when the read
fails. The `signatureColumn` decline, route and strings are removed
everywhere; the remaining declines are `topoOrdering`, `reflog`,
`unreachableCommits` and `globPattern`.

**Forcing the CLI: the setting already existed; the one-off did not.**
`git-graph-libre.backend: "git-cli"` (16.3) already never loads the addon
— every reader path checks the preference first — and is read live per
load, so no second setting was added. New is the Hidden menu's **Reload
once with Git CLI**: `forceCliOnce` in the webview marks the next
`loadRepoInfo` and `loadCommits` requests `forceCli` and clears when the
commit load is asked for, so exactly one reload is affected and the
setting is untouched. In the reader `forceCli` behaves exactly as
`git-cli` (the provider is never called) but records its own graph-load
route, `forced`, which the status popup names in all five locales.
"Once" means the reload: commit details, comparison and search afterwards
use the configured backend again.

**How often the engine fails is now measurable.** The reader keeps three
session flags beside `didEngineServeRead()`: every engine throw is
classified by `noteEngineThrow()` — a fallback error (`NotARepository` /
`Unsupported`) is a *decline* (the CLI served the read), anything else a
*failure*, as is every payload the strict guards refuse. The `loadCommits`
route — the existing telemetry chokepoint, no new call sites — feeds them
to the view reporter as once-per-session signals: `view.engineUnavailable.<reason>`
(the fixed five-member reason union completes the id; `git-cli` reads as
null because it never tries, and no path, platform string or error text is
ever part of it), `view.engineFailed`, `view.engineDeclined` and
`view.forceCliReload`. Like every signal here they measure the share of
sessions in which it happened, read against the `activate` denominator
and the `common.os` / `common.nodearch` each event carries — which is how
a platform binary that cannot load becomes visible at all, since such an
install otherwise just looks slow. The README list and the
`telemetry.json` declaration were extended in the same change.

This work was left staged but unfinished by a Claude Code session that hit
its limit, and was taken over, audited and gated in Muse the same day:
the audit removed three dead `showSignature` properties the type removal
had stranded in tests behind `as` casts, and added the README, changelog
and this record.

Gate (`2026-10-16`): staged format and strict Biome clean (34 files; one
formatter fix in `hiddenMenu.test.ts`), `pnpm run package` clean (264 files
linted), `pnpm run test` green (`70`/`740` backend plus `50`/`545`
webview), `l10n:check` `100%` for all four locales, fresh
`test:coverage` `120` files / `1285` tests at `93.3%` lines (`6870/7366`).
The Rust arm was skipped under its own rule: no `engine/**` file changed.
The first Sonar scan (task `10e0c345-c59e-42f8-823d-d50f445128b9`, analysis
`8284db07-89d2-4d82-bfe4-6ac4ea6fcc6c`, window `PREVIOUS_VERSION 1.8.0`)
was `ERROR` on one condition, `new_software_quality_high_issues = 1`: an
`S3776` cognitive-complexity finding on `recordCommitLoad` (16 over the
allowed 15 — the four new conditionals), plus an `S6582` optional-chain
finding in the new signature fill. The engine signals moved into a
`reportEngineSignals()` helper and the chain was applied; the whole gate
reran in order and the rescan returned **`OK` on all seven conditions**
(task `3d71e650-8e4e-44cb-bcf8-0326e15ae348`, analysis
`168329c8-2972-4a1c-9f51-8ecba0bd8ac2`): `new_coverage` `94.4`,
`new_violations` `0`, duplication `0.0`, high, reliability and security
issues `0`, maintainability rating `1`, and no `TO_REVIEW` hotspots in new
code. One polling note: the proxy in front of the SonarQube instance
answers Python's `urllib` with `403` even on the public status endpoint,
while `curl` with the same token succeeds — poll with `curl`.
