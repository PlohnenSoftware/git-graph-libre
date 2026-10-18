---
summary: >-
  Slice 4, closes Phase 7: stash graph rows injected on the backend above
  their base commit (`src/backend/queries/stashes.ts`); the `stashRing`
  halo-exemption CSS trap, marker geometry, `view.stashRows` telemetry.
---

# Slice 4 — Stashes as graph rows

**A `stroke` set from `graph.ts` loses to CSS, and it hid the stash ring
entirely.** `setAttribute("stroke", color)` produces a *presentation
attribute*, which ranks below every CSS declaration, and
`#commitGraph circle:not(.current)` in `media/table.css` paints every node's
stroke in `--vscode-editor-background` as a halo. The stash ring's stroke *is*
the marker, so it was being repainted background-on-background: only the inner
dot ever rendered, which is what "the ring and dot doesn't look properly"
turned out to be. The ring now carries a `stashRing` class, the halo rule
excludes it (`:not(.current):not(.stashRing)`), and a CSS regression test
pins both halves — the exemption and the absence of any `stroke` of its own
in that rule. **The class and the exemption must travel together.** The same
trap applies to any future node that needs its own stroke color.

The marker's proportions were then set from what survives at the default row
height rather than by eye in isolation: ring radius `NODE_RADIUS`, band `2`,
dot radius `NODE_RADIUS - 2`, so the outer edge lands at 5 and the marker is
only slightly wider than a commit dot. Two rejected attempts are worth
knowing: a `1.5` band smeared band, gap, and dot into one shape (each landed
on roughly one device pixel), and a `NODE_RADIUS + 1` ring left the dot
floating in too large a hole. Candidates were rasterized at 1:1 and compared
against a plain commit dot before choosing — a zoomed rendering flatters a
10px marker and will mislead you.

Closes Phase 7's remaining item (Phase 7 `Status:` and the overview table
both move to Complete in this slice). Both stash surfaces stay on purpose:
the `#stashList` panel is the compact action surface (every stash in one
place, keyboard-operable list), while graph rows show each stash in context
beside the commit it was taken from. Either surface alone would lose
something — the panel has no base-commit context, the rows only appear when
their base is on the page.

Data flow (backend injection, not webview merge): the stash query moved into
a shared `src/backend/queries/stashes.ts` used by both `loadRepoInfo` and
`loadCommits`. The query format gained `%P`, so each `GitStash` carries
`sourceHash` (parent 0) at no extra git cost; a repository with no stash
answers exit 0 with an empty list. `loadCommits` takes an opt-in
`showStashes` (absent means off, so existing callers are unchanged),
plumbed from the webview's per-repo toggle through the `loadCommits`
message — no new setting, no settings-plumbing change. Injection runs after
paging: one synthetic `GitCommitNode` (`stash: { ref }` marker, empty
author/email, base-or-stash date, `signature: null`) spliced directly above
its base commit, linking parent 0 only. Above, not below: the layout walker
only follows parents forward (children above parents), so a stash placed
after its base never resolves its parent and the layout loops forever. The index and untracked parents are
deliberately excluded — linking them would draw phantom lines per stash and
promote internal commits to ordinary rows. Stashes whose base is filtered
out or paged off are skipped, and stash rows never consume the commit
budget. A stash-query failure degrades to no rows rather than a failed
graph. Rows and their selectors come from the same backend load, so the
selector in `data-stash-ref` is always fresh — nothing caches `stash@{n}`
across refreshes.

Webview: `renderStashGraphRow()` emits `tr.stashGraphRow` (never the
`commit` class) with badge, message, date, hash, and an unsigned signature
cell. Click/Enter/Space opens the read-only commit details through the
existing panel path (inheriting the one-panel constraint); right-click
reuses `buildStashContextMenu()`. Find matches selector, message, and hash
(`commitFind` gains the selector field; full-history search is unchanged —
it operates on git log history, which never contains stashes). ArrowUp/Down
details stepping, reveal, and details restore reach stash rows via
`findAnyRowByHash()`; range selection skips them and they can never enter
the selection set, so multi-select and compare are untouched. The layout
engine draws each row as a ring-and-dot pendant in the branch color
(`Vertex.setStash()`); row hover, focus, details-open tint, find highlight,
blink, mute, and scroll-margin selectors cover the new class with the same
BUG-4 scoping (message span only, no `color` on ref selectors, no
font-weight, oklab mixes only). No new user-facing strings, so l10n is
untouched. Telemetry: `view.stashRows` reported once per session from the
commit-load chokepoint only when a load actually contains a stash row;
`telemetry.json` and the README disclosure updated in the same slice.

Git facts, all reproduced against real scratch repositories (kept outside
the repo): default `git log` (HEAD/branches) excludes stash commits while
`--all` includes them; a `-u` stash has three parents (base, index,
untracked) and a plain stash two; empty `git stash list` exits 0; dropping
`stash@{1}` renumbered the old `stash@{2}` hash to `stash@{1}`, confirming
selectors must be re-resolved per refresh.

Verification: backend `stashRows` (4 passed, real repositories: injection
above base with base-only parents, no index/untracked phantoms, opt-in
gating, base-off-page skip, drop-and-renumber re-resolution),
`loadRepoInfo/get` (6 passed), `viewFeatures` (stash signal + id pattern);
webview `rendering` (75), `tableStyles` (25), `dialogStyles`,
`commitFind`, `graph` (ring-and-dot) — 129 passed across the five files;
`pnpm run typecheck` clean; `pnpm run l10n:check` 100% (no new strings);
strict Biome over all touched files (clean after two format-only fixes).

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).
