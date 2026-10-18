---
summary: >-
  Mission and core licensing rules: `AGPL-3.0-or-later` since 1.0.0 over the
  MIT lineage (`NOTICE.md`, `LICENSE.mit`); the license flows one way; the
  upstream-review marker grep must return `0`; the clean-room reimplementation
  rule.
always_read: true
---

# Mission

Git Graph Libre descends from the MIT lineage of Git Graph: the original
mhutchie repository up to its last MIT commit, continued through the
`asispts/neo-git-graph` MIT fork. From version 1.0.0 the project as a whole is
licensed under `AGPL-3.0-or-later`. The incorporated MIT material, its boundary
commit, and its per-era contributor rosters are recorded in `NOTICE.md` and
`LICENSE.mit`; the MIT grant of sublicensing permission is what allows that
material into the AGPL whole, so those notices must stay intact. If upstream
MIT commits are ever merged in, extend the boundary commit and the roster in
the same change.

**The licence flows one way, and every upstream review must confirm it still
does.** MIT code may come into this AGPL project; AGPL code may not go out into
an MIT one without the copyleft coming with it. Upstream is a sibling MIT fork
of the same ancestor, which makes accidental — or deliberate — reuse of this
project's post-fork work plausible and easy to miss, and redistributing it
under MIT would strip the copyleft that is the whole point of the relicensing.
So on every upstream review, before reading their commits for ideas, check
their tree for code that exists only here. Grep for identifiers introduced
after the fork rather than for shared ancestry, since everything inherited
from the MIT lineage is expected to match:

```bash
git fetch upstream --prune
for marker in truncateRefName startRevealHighlight parseGpgsigPresence \
  isMissingRemoteRefError hexToOklch createBundleTranslator \
  createViewFeatureReporter ngg-reveal-highlight git-graph-libre; do
  printf '%-32s %s\n' "$marker" "$(git grep -l "$marker" upstream/main | wc -l)"
done
```

Every count must be `0`. A non-zero one is not proof of wrongdoing on its own —
check whether the name was theirs first — but it is the point at which to stop
and tell the maintainer rather than carry on reviewing. Extend the marker list
as this project grows distinctive surfaces; the ones above are all post-fork.

The rule for this branch is:

- Use this repository's own code and public API behavior as the implementation
  base. Everything written here is AGPL-3.0-or-later.
- Reimplement behavior from first principles using Git CLI documentation, VS Code
  extension APIs, and this repo's existing patterns.
- Keep implementation notes and comparisons in docs so later contributors can
  see which ideas were considered and how the clean-room boundary was handled.
