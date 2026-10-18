---
summary: >-
  Intro to the stash/graph UI slices. Standing rules: the stash list sits in
  `#topBar` `#stashListSlot`, folds away on scroll, and calls
  `publishTopBarHeight()` synchronously after slot changes.
---

# Graph and stash UI slices (`2026-09-09`)

Maintainer-prioritized work, taken in slice order: checkbox appearance,
remote sub-label restyle, stash-list move out of the footer, then
stashes as graph rows (closing Phase 7's remaining item). Two follow-ups
landed on top: a per-repo choice of where stashes appear, and a
create-branch checkout default. Behavioral write-ups were approved by the
maintainer before code was written, with both the `#stashList` panel and the
graph stash rows staying (neither surface replaces the other).

**The stash-list placement moved twice, and its scroll behavior was settled
separately.** It sits inside `#topBar`, in a `#stashListSlot` between the
status strip and the toolbar. It was first put at the top of `#content`
specifically to dodge the sticky-offset cost, and the maintainer rejected
that: the list belongs with the window chrome, not floating above the table
headers.

**It folds away on scroll rather than holding position** (`#topBar.scrolled
#stashListSlot`), mirroring the readiness strip. The rule to carry forward is
which chrome earns permanent space: the **toolbar** and the table's **column
headers** must stay reachable at any scroll position, while the stash list is
reference rather than navigation and yields its band as soon as the user
scrolls. An intermediate version kept it pinned; that was rejected. Note
`overflow: hidden` is load-bearing in the fold — without it the panel's own
margins survive `height: 0` and leave a live ~12px band behind.

That cost is now paid deliberately, and it is the thing to preserve.
`#topBar` is measured by the `ResizeObserver` in `observeTopBarHeight()` and
published as `--ngg-sticky-top`, which `media/table.css` consumes for the
sticky header's `top` and for `scroll-margin-top`. The observer only reacts a
frame later — long enough for the header to visibly detach — so
`renderStashSection()` and `clearStashSection()` both call
`publishTopBarHeight()` synchronously after touching the slot, the same fix
the find widget needed on `2026-07-03` (Phase 12). `#stashListSlot:empty` is
`display: none` for the same reason: residual padding in an empty slot would
push the sticky header down by that much.

Two parts of this record still bind later work and are kept elsewhere:
its license review under Licensing, and the headless way to verify
webview visuals under Webview UI Styling Guide.
