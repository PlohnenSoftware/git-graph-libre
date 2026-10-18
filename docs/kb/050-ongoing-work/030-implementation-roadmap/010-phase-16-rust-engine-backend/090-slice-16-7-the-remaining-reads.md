---
summary: >-
  Done (`2026-09-23`): only `config_list` wired (user identity in repo info);
  the other reads declined, each with its reason; `search_history` superseded
  by the engine's `search_commits`, then deleted.
---

# Slice 16.7 — The remaining reads

`search_history`, `load_tag_details`, `load_commit_bodies`,
`load_commit_subject`, `load_commit_summaries`, `count_commits_before`,
`current_branch_upstream`, `current_branch_name`, `remote_names`,
`submodules`, `load_config`/`config_list`, `repo_root`.

Individually small; take them in one slice with one parity table. Note
`count_commits_before` declines reflog tips and `--glob=` patterns, and
`config_list` declines a file carrying `include`/`includeIf` directives.

Implementation record (`2026-09-23`, four subslice commits, all signed):

- 16.7a the one viable wiring: the seam gains `configList` and the
  repoInfo composition serves user identity from `config_list` (local
  plus global). A declined, failed, or malformed fill — or a
  resolvable-but-absent file on either scope, where the CLI errors and
  the engine answers empty — rolls the composition back to the whole CLI
  read, never a mixed half-engine shape (the parity table caught the
  first revision mixing a CLI fill in and misattributing the served
  flag). Path resolution mirrors the engine's global order and follows
  `gitdir:` link files without a regex (the first scan caught an S8786
  there, fixed and rescanned).
- 16.7b parity table (against the built addon, `1.0.24`, the global
  file controlled through `GIT_CONFIG_GLOBAL` on both sides): plain
  repositories served from the engine, local and global include
  directives declined to the CLI which resolves them, and a missing
  global file staying CLI with the CLI's own error shape.
- Declines, each with its reason — no code, no behavior change:
  `search_history` (the engine matches message regex while the CLI
  searches fixed strings plus author, hash, positions and ref filters)
  — **superseded and then removed on `2026-09-23`**: rather than wire the
  mismatched function, the engine gained a `search_commits` that
  reproduces this project's semantics, and the search now routes through
  it. `search_history` itself was deleted. See "Search in the engine" and
  "The engine surface: what is wired, what was removed, what is kept";
  `load_tag_details` (the engine reports signatures present but
  unverified; verification is a permanent non-goal); `current_branch_*`
  and `remote_names` (their consumers are `kind: "action"` write flows,
  and every write stays on `runGitRaw`); `load_commit_subject` (its only
  consumer is the amend action); `submodules` (the hand-written
  `.gitmodules` parse carries documented quirks the engine would
  change); `repo_root` (bare repositories diverge: `--show-toplevel`
  fails where discovery succeeds); `load_config` (singular),
  `load_commit_bodies`, `load_commit_summaries`, `count_commits_before`
  (no TypeScript consumers at all — no `rev-list`, no batch message
  reads anywhere in `src/`).
- Gate: numbers in the 16.7c commit.
