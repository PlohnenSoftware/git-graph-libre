---
summary: >-
  Standing verdict (maintainer, `2026-11-23`, decision G0): Git Graph+ is
  Apache-2.0 and may be read for its behavior, for research only; no code is
  copied, and implementation comes from Git's documentation, VS Code APIs and
  this project's own patterns. The SourceGit-derived graph-layout file is out
  of bounds unless its MIT notice is carried. Applies to the Reflog tab,
  interactive rebase, the history and statistics work, and any future
  Git Graph+-inspired work.
always_read: true
---

# Git Graph+ licensing verdict (`2026-11-23`)

## Standing verdict (maintainer, `2026-11-23`, decision G0)

Git Graph+ (`the0807/git-graph-plus`, `main` at `c6c2a9a`) is licensed under
**Apache-2.0** (`LICENSE`, and `"license": "Apache-2.0"` in `package.json`).

- **Reading is allowed, for research only.** Its behavior may be read to
  learn how its features work.
- **Clean room by default.** No plan copies code, CSS, strings or literals
  from Git Graph+; anything that ever does follows the Apache-2.0 bullet
  below, decided by the maintainer first.
- **Implementation comes from elsewhere.** It is written from Git's
  documentation, VS Code APIs and this project's own patterns, working from
  observed behavior rather than from Git Graph+ code.
- **Apache-2.0 code may come in one way only.** Apache-2.0 code may enter this
  AGPL-3.0-or-later project with its license text, any `NOTICE` it carries
  (there is none), its copyright line (`Copyright 2026 the0807, bkk21`) and a
  notice of changes. It is then recorded in `NOTICE.md`, as the engine is.
- **Out of bounds: `src/git/git-graph-builder.ts`.** Its first two lines say
  its graph layout was ported from SourceGit (MIT, "SourceGit contributors").
  That file is out of bounds unless its MIT notice is carried. No plan uses it.
- **Other boundaries.** Visual targets are fine, but do not reuse Git Graph+'s
  color values, class names, exact CSS grouping, identifiers or magic
  constants. Derive constants from this project's own geometry, and run an
  identifier census on each diff, as the clean-room review requires.

## Why

The research found no Git Graph (mhutchie) lineage in Git Graph+. Its
architecture is unrelated to Git Graph's, no mhutchie identifier appears in
its source, and its README says no code from Git Graph is used and credits
only "UI/UX ideas" from Git Graph, Fork and SourceGit. Its one foreign notice
is the SourceGit file above. Apache-2.0 is compatible with AGPL-3.0 in the
one direction this section allows.

## Applies to

- The Reflog tab (F1).
- Interactive rebase (F2).
- History and statistics (F3, the timeline work).
- Any future Git Graph+-inspired work.
- The Blame view (F4) is inspired by GitHub's blame view, not by Git Graph+;
  this verdict binds it only where a Git Graph+ idea is used.
