---
summary: >-
  Record of merging the filtered engine under `engine/` on `rusty`: 52
  re-signed commits, `gerrit.rs` and licenses excluded, `engine/NOTICE.md`,
  `LICENSE.mit` roster, crate attribution.
---

# The filtered engine repository, merged onto `rusty` (`2026-09-22`)

The engine was extracted to `../git-graph-engine` and, once `1.6.2` shipped,
merged into this repository on the **`rusty`** branch with
`git merge --allow-unrelated-histories`. It lands entirely under `engine/`, so
the merge touched no existing path — verified before merging by intersecting
both trees, which returned nothing. Nothing in the extension reads it yet:
this is the history and the source arriving, not an integration.

What the imported history is, so nobody has to re-derive it:

- **52 commits**, filtered from the 154 of `611a8fa`…`f93e8b2`
  (`2026-08-22`…`2026-09-21`). The 49 that carried engine content keep their
  original authors and author dates — penghongxia (31), neophack (14),
  unusuallman (4); the other three are the maintainer's.
- **Every commit is signed and the committer is the maintainer.** Signing was
  done with `git filter-branch --commit-filter 'git commit-tree -S "$@"'`
  rather than a rebase, so the two merge commits survive.
- **Excluded from every commit, not merely from the tip**: the whole
  TypeScript extension layer, `native/core/src/gerrit.rs` and its test, the
  upstream root `LICENSE`, and the entire `licenses/` directory. Audited by
  walking every tree of every commit.
- **The imported commits keep the upstream directory layout**, deliberately,
  so any one of them can be diffed against `neophack/vscode-git-graph-rs` to
  verify exactly what was taken — confirmed by hashing `log.rs`, `status.rs`,
  `node/src/lib.rs` and `Cargo.lock` against their upstream counterparts. A
  single later commit re-homes the tree under `engine/`; `git log` on a moved
  file therefore needs `--follow` to reach back past it.
- **`engine/NOTICE.md`** carries what the removed licence files legitimately
  held: penghongxia's verbatim MIT copyright line and permission notice (which
  MIT requires be included in all copies), the provenance and authorship, the
  exclusion list with the Gerrit reasoning, and the crate-attribution
  obligation.
- Verified with the toolchain above: `cargo check --workspace --all-targets`
  clean with **zero warnings**, `cargo test --workspace` **101 passed, 0
  failed**.

**The licence paperwork landed in the merge commit itself**, not after it,
because the Mission section requires the roster and the boundary to move in
the same change as the material. `LICENSE.mit` gained penghongxia's copyright
notice verbatim, a paragraph stating that this last notice belongs to a
separate MIT work rather than to the Git Graph lineage, and a roster of the
three engine authors with their date ranges. `NOTICE.md` gained a
`### The Git engine (engine/)` subsection under the incorporated-MIT heading —
deliberately a sibling of `### The Git Graph lineage` rather than an item
inside it, since the engine does not descend from that lineage — recording the
boundary commits, pointing at `engine/NOTICE.md`, and stating what was
excluded and why. `package.json`'s `contributors` gained all three; only
`neophack` and `unusuallman` carry URLs, because `penghongxia`'s git identity
is a work email with no handle to link. **Whether `penghongxia` and `neophack`
are the same person is unresolved** — the former is the name on the upstream
`LICENSE`, the latter owns the repository — so both are recorded exactly as
the git history has them rather than merged on a guess.

No `CHANGELOG.md` entry: the engine ships nothing to users yet, and
`.vscodeignore` is deny-all plus a whitelist, so `engine/` is already excluded
from the VSIX. `sonar.sources` names `src,scripts,esbuild.js` as an explicit
list, so `engine/` stays outside analysis without a new exclusion, and Biome's
`includes` is likewise an allowlist that does not reach it. **The Rust side is
therefore covered by no gate in this repository** — `cargo check` and
`cargo test` have to be run by hand until a CI arm exists for them.

Shipping a compiled `git-graph.node` additionally requires
attributing the ~175 statically linked crates (`MIT OR Apache-2.0`, plus
`zlib-rs` under Zlib and a BSD-3-Clause component in `encoding_rs`), including
the Apache-2.0 §4(d) notice for binary redistribution; `cargo about generate`
produces that inventory.

**Layout decision, if it is merged**: under `engine/`, not at the repository
root. Beyond keeping the licence boundary a directory rather than a file list,
there is a concrete gate reason — `sonar.sources=src,scripts,esbuild.js` names
`scripts` as a directory, so a root-level merge would put the engine's
418-line `build-addon.mjs` (which calls `spawnSync(…, { shell: true })`, a
security hotspot) into analysis, where it would count against the gate on
whatever unrelated slice was scanned next.
