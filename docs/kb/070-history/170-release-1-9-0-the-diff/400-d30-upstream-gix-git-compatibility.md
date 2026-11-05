---
summary: >-
  D30 · wave U · maintainer-led · gix fork: hand Git-compatibility work to
  gitoxide. Open the prepared Myers xdiff-parity PR, then prepare
  numstat-compatible line counts and the `track_empty` default as small
  upstream branches. Agents prepare and test only; the maintainer posts.
---

# D30 — Upstream gix contributions for Git compatibility

Status: done — preparation complete, awaiting maintainer posting (2026-10-19)
Needs: —
Decisions: — (X7: gix carries Git compatibility, the engine carries VS Code's display diff)
Kind: Rust in the `../gix` fork · Size budget: per item, under gitoxide's ~500-line discussion threshold
Source: the "Diff parity against real history" record under Phase 16; gitoxide's `CONTRIBUTING.md` and `AGENTS.md`

**Rules on top of the agent protocol:**
- Work in a worktree of `../gix` (`origin` is the `PlohnenSoftware/gix`
  fork). Follow gitoxide's `AGENTS.md`: no `unwrap`, the `gix_testtools`
  isolation, the commit style.
- Never push, never open a PR, issue or discussion: the maintainer does.
- Every PR draft names the agent, as gitoxide requires, and never claims
  that the maintainer reviewed or tested anything.

| Item | What | State |
| --- | --- | --- |
| 30a | Myers xdiff parity: branch `fix/imara-myers-whole-file-occurrences`, two signed commits rebased on `7540f69bf`, the full `just test` equivalent run (see the diff-parity record) | **merged upstream** (checked `2026-10-20` on GitHub): the maintainer opened [gitoxide#3069](https://github.com/GitoxideLabs/gitoxide/pull/3069); Byron took its two commits (`bf62edd59`, `abdfc45db`, authorship kept) into [#3074](https://github.com/GitoxideLabs/gitoxide/pull/3074) with a review commit and two performance commits, merged on `2026-10-19` as `ad129e12f2`. Not yet in a gix release: crates.io's newest is `0.89.0`. |
| 30b | Numstat-compatible `line_counts`: an option, or a sibling method, that keeps line endings (`intern_source`), with tests against `git diff --numstat` for a final newline gained and a CRLF conversion | prepare the branch and a PR draft; D05 keeps its local shim until this ships |
| 30c | `Rewrites::default()` says "git configuration defaults" but sets `track_empty: false`, while Git's `diff_setup` has `rename_empty = 1`. Fix the default or the doc | prepare the branch and a draft |
| 30d | Git-compatible rename similarity (Git scores by hashed byte chunks, gix by a line diff) | a discussion draft only. Describe the behavior from Git's documentation and observed outputs; never port GPL code. |

**Report:** per item, the branch, the commits with `%G?`, gitoxide's test
results, and the path of the draft text.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), general-purpose inherited runtime model (no Haiku/Sonnet/Opus selector; integrator records the constraint), 2026-10-19. Posting anything upstream remains the maintainer's alone: nothing was pushed, and no PR, issue, or discussion was opened. 30a was not touched. `just` and `cargo-nextest` are not installed on this machine, so gitoxide's checks were run with `cargo` directly, as recorded per item; the full `just test` recipe and journey tests were not run.
- **30b — numstat-compatible `line_counts`:** branch `feat/gix-diff-numstat-line-counts` (worktree `../gix-d30b`, base `7540f69bf`). Commits, both `G`: `07abe3f438142102f5278f9668e3f2a3d2039a12 G feat(gix-diff): add Outcome::interned_input_keeping_newline_separators()`; `0fa7e82df3cd88b2470646b2b024037eff67767c G feat(gix): add Platform::line_counts_with_newline_separators() matching git diff --numstat`. The previous agent's uncommitted work was preserved and reviewed, then formatted (`cargo fmt`) and one clippy `collapsible_if` in the new test was fixed; no reset or clean. Diff: 4 files, +159/−1 (under gitoxide's ~500-line threshold). Tests: `cargo test -p gix --test gix line_counts` 2 passed (new counts equal the fixture-recorded `git diff --numstat` for a final-newline gain and an LF-to-CRLF conversion; default counts pinned at `0 0` for both); `cargo test -p gix --test gix object::tree::diff` 5 passed; `cargo test -p gix-diff` 102 passed; `cargo clippy -p gix-diff -p gix --all-targets -- -D warnings` clean; `cargo fmt --all -- --check` clean. Independently corroborated with Git 2.56 in a throwaway repository: final-newline gain `1 1`, CRLF conversion `3 3`. A per-crate `cargo doc` attempt failed on pre-existing feature-combination errors outside the touched code and was not pursued. Draft: [010-d30b-pr-draft-numstat-line-counts.md](400-d30-upstream-gix-git-compatibility/010-d30b-pr-draft-numstat-line-counts.md).
- **30c — `Rewrites::default()` `track_empty`:** branch `fix/gix-diff-rewrites-track-empty-default` (worktree `../gix-d30c`, base `7540f69bf`). Commit: `b75d6f419d7813c309b2a58017ac262e0c346943 G document that Rewrites::default() track_empty differs from Git` (2 files, +9/−1, documentation only). Observed with Git 2.56: renaming an empty file is `R100` under `git diff -M` by default and `A`+`D` with `--no-rename-empty`, confirming Git's default tracks empty blobs while gix's default does not. Because the field doc and `gix-merge` both give a quality rationale for `false`, whether to flip the default (a behavior change for all `Rewrites::default()` users, including config-derived rewrites in `gix`) is a maintainer/upstream judgment call, so the smaller doc fix was prepared and the question is recorded in the commit message and the draft. Tests: `cargo test -p gix-diff` 102 passed; `cargo clippy -p gix-diff --all-targets -- -D warnings` clean; `cargo fmt --all -- --check` clean. Draft: [020-d30c-pr-draft-track-empty-doc.md](400-d30-upstream-gix-git-compatibility/020-d30c-pr-draft-track-empty-doc.md).
- **30d — Git-compatible rename similarity:** discussion draft only, no code and no branch. Described solely from Git's documentation (similarity index wording in `git diff --help`) and observed output: with Git 2.56, swapping the two halves of a 40-line file during a rename yields `R100` while `--numstat` reports `20 20`, showing order-insensitive scoring unlike a sequential line diff; plus the `248186c` case from the Phase 16 diff-parity record (Git 65% vs a line-diff score of about 45.7%). No GPL-licensed Git source was read or ported. Draft: [030-d30d-discussion-draft-rename-similarity.md](400-d30-upstream-gix-git-compatibility/030-d30d-discussion-draft-rename-similarity.md).
- **Files changed in this worktree:** this slice file (Status and this Report), the three draft files above, and `docs/kb/README.md` regenerated by `node docs/kb/housekeeping.mjs` (the `pnpm run kb:index` script without installing dependencies); `node docs/kb/housekeeping.mjs --check` passes. The drafts live as subsections beside this file because `kb:check` requires every knowledge-base file to follow the section layout.
- **Deviations from the slice:** 30c prepares the doc fix instead of flipping the default, for the judgment-call reason above. Each PR/discussion draft names the agent and claims no maintainer review, testing, or approval, per gitoxide's `CONTRIBUTING.md`.
- **Open questions / follow-ups:** for the maintainer — post 30a first as planned, then 30b/30c (or rewrite the drafts); decide on 30c whether to also flip `track_empty` upstream; decide whether to open the 30d discussion. For upstream (in the drafts) — sibling method vs options parameter for 30b, and naming. D05 keeps its local shim until 30b ships in a gix release (then D07).
