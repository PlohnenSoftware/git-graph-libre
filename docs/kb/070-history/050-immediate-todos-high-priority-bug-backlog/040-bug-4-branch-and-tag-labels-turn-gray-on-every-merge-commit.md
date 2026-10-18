---
summary: >-
  BUG-4, fixed `2026-08-25`: merge-commit dimming grayed ref labels; now
  opt-in via `repository.muteMergeCommits` (default `false`) and scoped to the
  `.commitMessage` span. Maintainer re-check pending.
---

# BUG-4 — Branch and tag labels turn gray on every merge commit

**Status: fixed (`2026-08-25`). Priority: high. Area: webview rendering + CSS.**

This is the maintainer's "sometimes it gets gray", and it has a precise trigger:
**the commit is a merge commit.** The dimming *effect* is worth keeping and
becomes an opt-in feature (see the decision below); what is a bug is that it is
unconditional, unconfigurable, undocumented, and reaches past the commit message
into the branch and tag labels.

Fault, two halves that meet in the Description column:

`src/webview/main.ts:4147-4148` —

```ts
if (commit.parentHashes.length > 1) rowClasses.push("mergeCommit");
if (commit.parentHashes.length > 1 || mutedByHeadAncestry) rowClasses.push("mutedCommit");
```

`media/main.css:301-305` —

```css
#commitTable tr.commit.mergeCommit td:nth-child(2),
#commitTable tr.commit.mutedCommit td:nth-child(2) {
  color: var(--vscode-descriptionForeground, var(--ngg-neutral-icon));
}
```

`td:nth-child(2)` is the Description cell, and `renderCommitRow()`
(`src/webview/main.ts:4085-4088`) emits `renderCommitRefs(commit)` **into that
same cell** ahead of the message text. `.gitRef` and `.gitRefGroup`
(`media/main.css:622-651`) set a background and a border but never a `color`, so
the label text inherits the cell's — and the cell's is
`--vscode-descriptionForeground`, a muted gray in every theme, on any merge
commit.

Two consequences, both wrong:

1. **Merge-commit muting is unconditional and unconfigurable.** The
   `repository.muteCommitsNotAncestorsOfHead` setting (`src/config.ts:140`,
   default `false`) gates only the `mutedByHeadAncestry` half. The merge half
   has no setting, no README entry, and no way to turn it off. There is no
   `muteMergeCommits` key anywhere in the manifest.
2. **The muting leaks out of the message and into the ref labels.** Muting a
   merge commit's *message* is a defensible reading aid; graying the branch and
   tag names attached to it is not — those labels are identity, and a branch tip
   that happens to be a merge is exactly where the label matters most.

**Maintainer decision (`2026-08-25`) — keep the behavior, make it opt-in.**
Merge-commit dimming is a legitimate reading aid, so it stays — as a real,
documented, switchable feature rather than a hardcoded surprise. The new setting
defaults to **off**, which is a deliberate behavior change: after this slice
merge commits render at full contrast unless the user turns dimming on.

Fix:

- Contribute `git-graph-libre.repository.muteMergeCommits` (boolean, **default
  `false`**), wired through `src/config.ts`, `GitGraphViewState` in
  `src/types.ts`, `src/extension/webviewHtml.ts`, the webview config-change
  route at `src/webview/main.ts:1502`, the README configuration table, and
  `package.nls*.json` in all four languages. Note the default flip in the
  changelog — existing users will notice merge rows getting brighter.
- Gate the `mergeCommit`-driven mute on that setting. While there, drop the
  redundant double-classing: `mergeCommit` and `mutedCommit` currently both land
  on every merge commit and the CSS lists both selectors for one rule. Keep the
  `mergeCommit` class itself — the graph layout and tests rely on identifying
  merges — and let only the mute styling become conditional.
- Stop the mute from reaching ref labels, for **both** mute sources (the new
  merge setting and the existing `muteCommitsNotAncestorsOfHead`). Dimming a
  commit's *message* is the feature; dimming the branch and tag names attached
  to it is not — those labels are identity, and a branch tip that happens to be
  a merge is exactly where the label matters most. Wrap the message text in its
  own `<span class="commitMessage">` inside the Description cell and move the
  `color:` rule onto that span, so `.gitRef`/`.gitRefGroup` keep full-contrast
  text. Do **not** fix this by hanging an explicit `color` override on
  `.gitRef` — that would fight the cascade instead of scoping it.
- Tests: `tests/webview/tableStyles.test.ts` for the scoped selector,
  `tests/webview/rendering.test.ts` for the class gating (both settings on and
  off), and `tests/backend/manifest.test.ts` + `tests/backend/config.test.ts`
  for the new setting and its `false` default.

Implementation record (`2026-08-25`):

- `git-graph-libre.repository.muteMergeCommits` (boolean, default `false`) is
  wired end-to-end exactly like `muteCommitsNotAncestorsOfHead`: manifest,
  `src/config.ts` accessor, `GitGraphViewState` + webview `Config`,
  `webviewHtml.ts` pass-through, a `repository.muteMergeCommits` case in the
  webview config-change route, README configuration table, `package.nls*.json`
  ×4, and a `CHANGELOG.md` `[Unreleased]` entry calling out the default flip
  (merge rows render brighter unless the user opts in).
- `renderCommitRowAttributes()` now pushes `mergeCommit` for every merge and
  `mutedCommit` only when a mute source is active
  (`isMergeCommit && config.muteMergeCommits || mutedByHeadAncestry`); the
  double-classing is gone. The message text is wrapped in
  `<span class="commitMessage">` inside the Description cell (refs render
  before it, outside the span), and the mute rule became
  `#commitTable tr.commit.mutedCommit td:nth-child(2) .commitMessage` — same
  token chain, span-scoped. `.gitRef`/`.gitRefGroup` keep no `color` of their
  own and inherit the full-contrast page foreground.
- Verified: independent verifier drove a fresh esbuild bundle of the webview in
  jsdom (repo untouched) with a merge commit carrying branch + remote-alias +
  tag labels: default → no `mutedCommit` on the merge; setting on → muted with
  zero refs inside the span; ancestry-mute rows muted in both scenarios and
  their labels outside the span. Cascade enumeration found no remaining rule
  that can gray ref text. The BUG-4 secondary check passed: `.gitRefAlias`
  badge-foreground contrast in the harness VS Code's light themes is
  Light Modern `#3B3B3B`/`#CCCCCC` = 6.98:1, 2026 Light `#FFFFFF`/`#0069CC` =
  5.39:1, Light+ default `#333`/`#C4C4C4` = 7.24:1 — all ≥ AA. Signed-tag pill
  tint (path 3) intentionally untouched.
- **Maintainer re-check pending:** per the action item above, the maintainer
  should re-check the tag-graying impression now that path 1 is scoped. If
  tags still read as gray, the remaining candidate is the intended Phase 15
  signed-vs-unsigned pill tint — a design question to bring back, not a bug.
- Full gate green before commit: strict Biome, typecheck, lint, `test`
  (backend 46/332, webview 34/307), `l10n:check` 100% (53 nls keys),
  `package`, fresh coverage (80 files / 639 tests, 92.1% lines),
  `sonar:scan` task `6cb91cbc-9caa-46a3-81b3-33cdbe52748a`, analysis
  `6ebfe56c-5412-4a91-b158-149478d56e90`: `ZAM` gate **`OK`** —
  `new_coverage` `94.3%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (slice added 0), reliability and security `0`.
