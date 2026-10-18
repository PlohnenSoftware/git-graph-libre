---
summary: >-
  Record: 33 upstream commits classified and ported as per-feature branches
  off `AI-dev`; upstream's `vsce` publish applied (Open VSX later restored);
  bold-branch rejected; adds `boldCheckedOutCommit`, `fetchTagsByDefault`;
  skip list.
---

# Upstream review, second pass (`2026-08-25`)

After the bug backlog closed, `upstream/main` was re-reviewed from the merge
base `28300bd` through `750f96f` (33 commits; the `2026-07-29` pass had covered
only the first three past `origin/main`). Every commit was classified. The
useful, missing behavior was implemented as **feature branches off `AI-dev`,
one per feature, gated and pushed, for the maintainer to pick from**:

| Branch | Ports | What it does | State |
| --- | --- | --- | --- |
| `upstream/root-commit-actions` | `4607cdf` | Root (zero-parent) commits take the plain cherry-pick/revert confirmation instead of a zero-option parent-select dialog; Drop exclusion documented (`rebase --onto <root>^` is invalid) | `159e55c`, pushed, ZAM `OK` (task `ec0745b0`, `new_violations` 0) |
| `upstream/bold-current-branch` | `08318d3` | Checked-out branch label renders semibold (`.gitRef.active { font-weight: 600 }`); aliases/tags unaffected | `f7b190a`, pushed, ZAM `OK` (task `b1a0962b`, `new_violations` 0) |
| `upstream/retain-panel` | `0bf8812` + `0c8f1da` | `retainContextWhenHidden` on the graph panel; re-show posts `loadRepos`+`refresh` over the bridge instead of reassigning `webview.html` (which would drop the retained document) | `ce1b143`, pushed, ZAM `OK` (task `cec3c2c3`, `new_violations` 0) |
| `upstream/no-commits-view` | `e7d1f8a` | Dedicated zero-commit view (icon + heading + create-first-commit hint; signal `commits empty && commitHead null && branches empty` so filters cannot fake it) and hidden branch/tag/author/remote-branch controls while it shows | `105a6ec`, pushed, ZAM `OK` (task `986e261d`, analysis `92deacb2`, `new_violations` 0). Landed after a ~35 min Sonar outage on `2026-08-25`; per the no-server rule the commit waited for a healthy gate — fresh coverage was regenerated and the scan re-run after recovery. |
| _(no branch — applied directly)_ | `750f96f` | Release workflow publishes with the official `vsce` CLI (`vsce publish --packagePath --skip-duplicate`, `VSCE_PAT`) instead of the third-party `HaaLeo/publish-vscode-extension` action; sub-actions pinned to exact releases | Applied on `2026-08-25` at maintainer request. **Open VSX deliberately not taken** — upstream's companion `ovsx publish` step and its `ovsx` dependency are excluded; this project publishes to the VS Marketplace only. **Reversed on `2026-09-17`; see "Open VSX restored as a publish target" below.** `pnpm-workspace.yaml` was left alone: upstream's `allowBuilds` rewrite is a pnpm-config change, and our `onlyBuiltDependencies` list already covers the live `@vscode/vsce-sign`/`keytar`/`esbuild` builds. |

**CI note (`2026-08-25`).** The publish step no longer uses a third-party
action. Two properties of the surrounding workflow are load-bearing and must
survive future edits: the `Check marketplace token` step exists because the
`secrets` context is not available to a step-level `if`, and the VSIX is
discovered by glob and carried through `steps.package.outputs.vsix` so the
GitHub release asset keeps its versioned filename rather than upstream's flat
`extension.vsix`. `--skip-duplicate` makes a re-run for an already-published
version a no-op instead of a failure.

**Maintainer reversal of `2026-08-25`: `upstream/bold-current-branch` is
rejected.** Bolding must apply to the commit **description** only, never to
branch or tag labels, so the `font-weight: 600` that `f7b190a` added to
`.gitRef.active` was removed; the rule keeps `border-color:
var(--git-graph-color)`, and the checked-out branch is distinguished by that
colored border alone. The ref-level `active` class and the tests asserting
which ref carries it are unaffected — only the CSS weight went away. Nothing of
`08318d3` remains in the tree as a result; its `NOTICE.md` bullet was **kept**
(attributions are never stripped as a side effect of a behavior change) and its
wording amended to record the removal. `LICENSE.mit` was not touched: the roster
is a historical record of what was incorporated, not of what still ships.

In the same change the maintainer made checked-out-commit emphasis opt-in and
added a fetch default, both wired through the standard eight-hop setting
plumbing (manifest, four `package.nls*.json`, `src/config.ts`, `src/types.ts`,
`webviewHtml.ts`, `global.d.ts`, the webview config switch plus constructor
literal, README):

- `git-graph-libre.repository.boldCheckedOutCommit` (boolean, default `false`).
  `renderCommitRow()` used to bold the current row's message unconditionally; it
  is now gated on this flag. The `<span class="commitMessage">` wrapper is
  emitted in **all** cases — the mute styling keys off it.
- `git-graph-libre.repository.fetchTagsByDefault` (boolean, default `true`)
  pre-checks "Fetch all tags" in the **toolbar** Fetch popup (`showFetchDialog()`).
  Deliberately scoped there only: the per-remote fetch dialog and the dedicated
  Fetch Tags dialog keep their own unchecked defaults, because those are
  explicit per-invocation choices rather than the blanket toolbar fetch.

Licensing pattern for these branches: each branch appends its upstream-commit
bullet to `NOTICE.md`'s "incorporated in part" list and makes the **identical**
two edits to `LICENSE.mit` (roster date range → `2026-08-24`; "all four" →
"all"), so the shared `LICENSE.mit` hunks merge cleanly across branches; only
the appended `NOTICE.md` bullets can textually collide, trivially.

Skipped, with reasons (do not re-propose without new evidence):

- Already implemented independently here: `48f494c` (context-menu
  `preventDefault` — `showContextMenu` line 1), `8402626`
  (`Intl.RelativeTimeFormat` in `src/webview/utils/date.ts`), `d6ebf81`
  (watcher unmute in `finally` — Phase 0.5), `8a63e39` (long-name display —
  Phase 12 is deeper), `e7d1f8a`'s relative-date neighbors, `b4c215f`,
  `deba9af`/`4afcb69`/`951ab64` (already borrowed earlier).
- Rejected earlier (`2026-07-29` pass): `437ee6c`/`8a62dd9` (nix), `9349069`
  (oxlint vs our Biome), `867eddc` (tsconfig split — still a rewrite, our
  tsconfigs diverged further since).
- Not wanted: `e7efada` (preact migration — huge rewrite of a webview we keep
  plain-TS by design), `b4a8e82` (l10n rearchitecture; our key-based bundles +
  checker work), `2c8599c` (removing Locate HEAD conflicts with our Phase 14
  reveal design), `705848d`/`c66c236` (superseded by our Phase 1 redesign),
  dependency/CI/readme chores (`9ad07df`, `4f3f8de`, `2b23693`, `9cccf91`,
  `750f96f`, `5b9f02b`, `9f9a2e9`, `3d34503`, `538fff1`, `4e29e94`, etc.).
- Flagged for the maintainer as decisions, not code: `7b74415` (status bar on
  the right side — ours is Left, cosmetic/design call), `0dd368f` (deprecating
  `fetchAvatars` — product decision; our README still documents the setting).
