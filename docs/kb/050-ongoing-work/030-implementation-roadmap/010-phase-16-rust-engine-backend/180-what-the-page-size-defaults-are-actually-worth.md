---
summary: >-
  Record (`2026-09-23`): `initialLoadCommits` `300` → `250`, `loadMoreCommits`
  `100` → `750`; the full `renderTable` rebuild is the real cost (open); keep
  manifest, accessor, README and test defaults in step.
---

# What the page-size defaults are actually worth (`2026-09-23`)

Asked why `initialLoadCommits` is `300` when 1,000 costs only milliseconds
more. Three separate costs were measured, and the answer is that two of them
are now negligible and the third was never measured here.

**Where the number came from.** It is inherited, not chosen:
`git show upstream/main:package.json` gives `initialLoadCommits: 300`, and the
only commits that ever touched it in this fork are `3ba4217 Initial
implementation of Git Graph` and an i18n pass. It is mhutchie's number, picked
when every read was a `git` spawn.

| | 300 | 1,000 | 10,000 |
| --- | ---: | ---: | ---: |
| backend read (CLI) | `11.5 ms` | `17.1 ms` | — |
| backend read (engine) | `7.7 ms` | `13.6 ms` | — |
| graph layout (jsdom) | `0.2 ms` | `0.4 ms` | `1.1 ms` |

700 extra commits cost about `6 ms` of git and essentially nothing to lay out.

**The render is the real cost, and it scales with the whole table.**
`renderTable` builds one HTML string over `this.commits` — *all* of them, not
the new page — and assigns it to `tableElem.innerHTML`. So every "load more"
rebuilds the entire table, and the cost of reaching N commits is the sum of
every rebuild along the way. Driving the real load-more flow through the
webview harness:

| table size | full rebuild (jsdom) |
| ---: | ---: |
| 1,000 rows | `921 ms` |
| 2,000 rows | `2,783 ms` |

**Those are jsdom numbers and must not be quoted as browser numbers** — jsdom
parses HTML far slower than a browser and does no layout or paint at all. What
they do establish is the *shape*: the rebuild is at least linear in total rows
and the constant is not small.

The consequence decides the page sizes. Because the whole table is rebuilt
each time, a larger `loadMoreCommits` means strictly *less* total work, not
more: reaching 3,000 commits costs about 27 rebuilds of a growing table at a
step of 100, and about 4 at a step of 750. The trade is fewer, larger
stalls instead of many smaller ones — and since `autoLoadMoreCommitsOnScroll`
fires whenever the viewport comes within 96 px of the bottom, the small-step
version stalls repeatedly during ordinary scrolling.

**Set on `2026-09-23` at the maintainer's direction**: `initialLoadCommits`
`300` -> `250`, `loadMoreCommits` `100` -> `750`. The first page is the
latency-critical paint and is trimmed slightly; the follow-on page is the one
that was costing repeated stalls and is raised well clear of them. Both sit
below the round numbers this section measured, which is the conservative
direction given that the render figures below are jsdom's and not a
browser's.

**The real fix, not done here.** The rebuild is `O(total)` per load when it
could be `O(step)` — appending the new rows instead of regenerating the table
would make page size nearly free and remove the stalls entirely. That is a
separate change to `renderTable` and its callers, and it is the thing to do if
these stalls are ever felt.

**A defaults drift found while answering.** `loadMoreCommits` was declared
`100` in the manifest and documented as `100` in the README, but
`src/config.ts` fell back to `75`, and `tests/backend/config.test.ts` pinned
the `75` — a wrong value frozen by the test meant to protect it. The fallback
never fires in a real install, because VS Code returns the manifest default for
an unset key, so nothing user-visible was wrong. All four now read `1000`. The
accessor table in that test mirrors manifest defaults by hand, so it can drift
again; keep the manifest, the accessor, the README table and that test in step.
