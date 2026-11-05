---
summary: >-
  On hold in the backlog (maintainer, `2026-11-04`: a matter of taste);
  `rbalet`, `2026-10-28`: lighter, less bulky ref badge icons, like "Git Branch
  & Tag Graph" (`Gxl.git-graph-3`). Verified: that
  extension is a mhutchie-lineage fork whose license forbids derivative works,
  so it is a visual target only; the difference shown is glyph weight, not
  badge layout. Recommended: ask what reads as bulky; if pursued, an opt-in
  light style of our own, contrast-checked for any `graphColors`.
---

# Issue #42: lighter ref badge icons

**Open.** [Issue #42](https://github.com/PlohnenSoftware/git-graph-libre/issues/42),
"design(icon): lighter", opened `2026-10-28` by `rbalet`, label
`enhancement`. No roadmap phase; it is webview styling under the Webview UI
Styling Guide. **Decision (`2026-11-04`): on hold, in the backlog.** The
maintainer parked it as a matter of taste. The assessment and options below are
kept for when it is picked up again.

## The request

"I'd like a lighter icon set, instead of the bulky one we have." The problem
it solves: "Help the eye focus on what matter." The proposed solution: "Like
the git branch tag graph library", linking to the Marketplace extension
`Gxl.git-graph-3`. Its screenshot shows ref badges (`develop` with
`origin`, `origin/HEAD`, `v18.1.0`, `v18.1.0-rc.4`).

## The thread

No comments yet.

## Checked facts (`c47207e`, `2026-11-04`)

- **Today's badge** (`media/refs.css:4`–`:69`): each ref's octicon
  (`octicon()`, `src/octicons.ts:134`, 16-unit paths) is knocked out in
  `--vscode-editor-background` from a solid square of the branch color
  (`width`/`height` 14px plus 2px padding). It sits on a translucent gray body
  (`--ngg-neutral-overlay-muted`, `oklch(60% 0 0 / 0.15)`) with a heavy
  border (`--ngg-neutral-border-heavy`, `oklch(60% 0 0 / 0.75)`). The
  checked-out ref's border takes the branch color (`.gitRef.active`).
- **What the screenshot shows.** At full size, beside the reporter's own Git
  Graph Libre 1.9.0 screenshots from issues #39 and #45, it has the same badge
  layout but visibly thinner glyph strokes and a lighter blue. So it is the
  model extension's look, and the difference is the weight of the icons, not
  the shape of the badge. (A downscaled thumbnail in issue #38 looks fully
  filled; at full size it is today's badge.)
- **The model extension's license.** The Marketplace lists it as "Git Branch &
  Tag Graph", `Gxl.git-graph-3` `1.37.19`, source
  `git-hub-tig/vscode-git-graph`, continuing mhutchie's version numbers. The
  license text in its package reads "Copyright (c) 2019-2021, mhutchie /
  Copyright (c) 2022-2025, hansu / Copyright (c) 2025-present, gxl …
  Permission is NOT GRANTED to publish, distribute, sublicense, and/or sell
  derivative works of the Software." Treat it like `vscode-git-graph-rs`'s
  `src/` and `web/`: never read or copy its CSS, SVGs or code. Matching a look
  is allowed; arriving at its identifiers or constants is not (License review
  of the graph and stash UI slices).

## Proposals and assessment

| Option | By | Assessment |
| --- | --- | --- |
| A lighter icon set, like the model extension | `rbalet` | A matter of taste, with a partial point: on rows with many refs, the solid colored squares are the heaviest element in the description column. The current design has one strength worth keeping, though. The glyph sits in the editor background color on the branch color, so it stays legible for any color a user sets in `graphColors`. |
| Keep today's badge | agent | Valid. It is the inherited MIT look and matches the graph's colored nodes. |
| An opt-in light style of our own | agent | Recommended if pursued, for example a setting like `refLabelStyle`, with values `solid` and `light`. The light style draws the glyph in the branch color on the badge body with no filled square, and can use a lighter border and thinner glyphs: a smaller octicon size, or VS Code's codicons, whose license must be checked and attributed before use. The colored glyph on the gray body must meet 3:1 non-text contrast for every color a user may set, so it needs a fallback (an outline, or the solid square) when contrast is too low. |
| Change the default look | agent | Only as the maintainer's taste call, since it changes every user's graph. |

Verification for any variant: CSS regression tests, and a headless render in
light and dark themes (Verifying webview visuals without a browser).

## Open questions, for when it is picked up again

- Pursue it at all? If so, as an opt-in style or as a new default?
- Ask the reporter first which part reads as bulky: the fill, the size, the
  border or the glyph weight?
