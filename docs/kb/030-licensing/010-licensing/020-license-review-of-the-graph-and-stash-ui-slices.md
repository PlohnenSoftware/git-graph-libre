---
summary: >-
  Clean-room review (`2026-09-09`): a borrowed stash-node shape removed and
  identifiers renamed. Standing rules: derive constants from this project's
  own geometry; pair token scans with an identifier census.
always_read: true
---

# License review of the graph and stash UI slices (`2026-09-09`)

The whole stack was reviewed against a maintainer-supplied comparison build
before any of it was pushed, at token level and by identifier. The review
found and removed one genuine problem, and it is recorded here because the
*way* it arrived is the reusable lesson: an intermediate commit rewrote this
project's own independently-written stash node — a stroked ring at
`NODE_RADIUS + 1.5` with a filled dot — into a shape carrying two class names
and two radii that were not ours. Our own construction was restored, and the
node's two identifiers were renamed into this project's vocabulary
(`isStashRow`/`setStashRow`, and `sourceHash` on `GitStash`). The commits were
rewritten rather than fixed forward, so none of it reached published history.

Two durable points:

- **A visual target and a code target are different things.** Matching how a
  feature *looks* is fine; arriving at the same identifiers and the same
  magic numbers is not, and expressing a borrowed constant as arithmetic on
  one of ours (`NODE_RADIUS + 0.5` for `4.5`) disguises it without changing
  it. Derive constants from this project's own geometry and say in a comment
  why that derivation is the right one.
- **Token-run scanning alone is not enough.** A renamed transliteration
  breaks every token run below the detection threshold, so the scan stayed
  silent on the one real finding; it surfaced only from reading the two
  routines side by side, and from an identifier census that asked which names
  are new here *and* present there. Run both, and treat generic English and
  API-mandated names (git flags, `--vscode-*` tokens, CSS syntax, assertion
  boilerplate) as expected overlap rather than signal.
