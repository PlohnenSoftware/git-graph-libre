---
summary: >-
  Standing verdict: the `src/` and `web/` layers of `vscode-git-graph-rs`
  forbid redistribution, so never read or copy them; `native/` is MIT and
  usable except `native/core/src/gerrit.rs`; any future sync is a manual
  license audit.
always_read: true
---

# `vscode-git-graph-rs` licensing verdict (`2026-09-22`)

**`src/` and `web/` are unusable — 41,543 lines under a licence that forbids
redistribution.** That project's own `LICENSE` says the webview and
extension-host layers are ported from Git Graph by mhutchie and governed by
`licenses/LICENSE_GIT_GRAPH`, whose text reads *"Permission is NOT GRANTED to
publish, distribute, sublicense, and/or sell derivative works of the
Software."* Every post-MIT surface is present (`pullRequests.ts`,
`askpass/*`, code review, worktrees, `openExternalDirDiff`). Treat that tree
the way the Mission section treats any non-MIT material: do not read it for
implementation, do not copy from it, do not merge it.

Two details worth carrying:

- Their `package.json` declares `"license": "MIT"` for the whole extension and
  they publish to both registries. The package metadata is not evidence of
  anything.
- Their initial commit is titled *"…the Gerrit integration removed"* and a
  later one *"re-port the Gerrit integration"*, but mhutchie's Git Graph has
  no Gerrit support. What they ported was a Gerrit-carrying derivative they
  attribute to mhutchie, so the provenance chain is murkier than their
  `LICENSE` states.

**`native/` is MIT and may come in — with one carve-out.** The workspace
declares `license = "MIT"` and the root `LICENSE` names "the Rust native
engine (./native/)" among its Original Contributions, Copyright (c) 2026
penghongxia. MIT into AGPL is the direction the Mission section allows.
However **`native/core/src/gerrit.rs` is not clean**, by its own module
documentation: *"The classification below is a faithful port of the parser
that ran on the extension host (see `src/gerrit.ts`), case for case"* — and
`src/gerrit.ts` is inside the restricted tree. It arrived in `d625ec3`,
**later** than the initial import, which is the pattern to expect: their
engine absorbs code from the restricted layer over time. Any future sync is a
manual licence audit, not a merge.

`native/core/src/types.rs` is a second, much milder case: it states that every
struct "serialises to exactly the shape the existing webview already consumes
(see the shared types in `src/types` in the original extension)". That is
interface compatibility rather than copied expression, and most of the names
(`GitCommit`, `GitRef`, `GitStash`, `UNCOMMITTED`) predate the MIT boundary
anyway — but the free fix is to define this project's own serde shapes against
`GitCommitNode`/`GitRef` and not carry theirs across.

**`neophack/git-graph-studio`**: everything committed to that repository is
original (a Tauri 2 desktop workbench) and MIT, but its *built products* embed
the restricted webview from the `vscode-git-graph-rs` submodule. Nothing in it
is useful to a VS Code extension. Its only relevance is as proof that
`native/core`'s `api::Engine` works as a standalone library.
