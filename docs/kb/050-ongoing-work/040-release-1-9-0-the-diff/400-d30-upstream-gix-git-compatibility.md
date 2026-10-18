---
summary: >-
  D30 · wave U · maintainer-led · gix fork: hand Git-compatibility work to
  gitoxide. Open the prepared Myers xdiff-parity PR, then prepare
  numstat-compatible line counts and the `track_empty` default as small
  upstream branches. Agents prepare and test only; the maintainer posts.
---

# D30 — Upstream gix contributions for Git compatibility

Status: ready (preparation); posting is maintainer-only
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
| 30a | Myers xdiff parity: branch `fix/imara-myers-whole-file-occurrences`, two signed commits rebased on `7540f69bf`, the full `just test` equivalent run (see the diff-parity record) | **ready to post**: the maintainer opens the PR, writing its text from the two commit messages (the session draft wasn't kept), with the agent named as gitoxide requires. |
| 30b | Numstat-compatible `line_counts`: an option, or a sibling method, that keeps line endings (`intern_source`), with tests against `git diff --numstat` for a final newline gained and a CRLF conversion | prepare the branch and a PR draft; D05 keeps its local shim until this ships |
| 30c | `Rewrites::default()` says "git configuration defaults" but sets `track_empty: false`, while Git's `diff_setup` has `rename_empty = 1`. Fix the default or the doc | prepare the branch and a draft |
| 30d | Git-compatible rename similarity (Git scores by hashed byte chunks, gix by a line diff) | a discussion draft only. Describe the behavior from Git's documentation and observed outputs; never port GPL code. |

**Report:** per item, the branch, the commits with `%G?`, gitoxide's test
results, and the path of the draft text.
