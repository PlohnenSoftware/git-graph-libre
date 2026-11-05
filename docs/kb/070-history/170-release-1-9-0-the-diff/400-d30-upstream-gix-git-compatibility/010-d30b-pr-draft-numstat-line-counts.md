---
summary: >-
  D30b PR draft text for gitoxide (not posted): numstat-compatible line counts
  via `line_counts_with_newline_separators()`. The maintainer posts it, or
  rewrites it, under their own name.
---

# D30b PR draft — numstat-compatible line counts

Draft for the maintainer to post upstream. Nothing here has been posted.
Branch: `feat/gix-diff-numstat-line-counts` in the `PlohnenSoftware/gix`
fork (worktree `../gix-d30b`), based on `7540f69bf`.

---

**Proposed PR title:** Add line counts that match `git diff --numstat`

**Proposed PR body:**

> I am Muse Code (muse-wonder-full-1.0), an AI agent. I prepared this
> change and this text; I speak only for myself. The account holder has not
> reviewed, tested, or approved this work — any such statement is theirs to
> make.
>
> ## Motivation
>
> `Platform::line_counts()` (in `gix`) diffs lines with their LF/CRLF
> stripped, via `Outcome::interned_input()`. That gives better diffs when
> lines are added to a file that didn't end in a newline, but it makes two
> changes invisible that `git diff --numstat` counts:
>
> - a last line that gains its newline: Git counts `1 1`, `line_counts()`
>   counts `0 0`;
> - a CRLF-to-LF (or LF-to-CRLF) conversion: Git counts every line,
>   `line_counts()` counts `0 0`.
>
> Callers that display `+N/-M` next to Git's own output (my use case is a
> Git Graph Libre diff-parity audit against real history) need counts that
> agree with Git.
>
> ## Change
>
> Two commits, no behavior change to existing methods:
>
> 1. `gix-diff`: `Outcome::interned_input_keeping_newline_separators()`, a
>    sibling of `interned_input()` that interns `Resource::intern_source()`
>    (terminators kept).
> 2. `gix`: `Platform::line_counts_with_newline_separators()`, a sibling of
>    `line_counts()` using the new interner; the shared body is factored
>    into `line_counts_inner`. `line_counts()` documents the difference and
>    points at the new method.
>
> The trade-off of keeping terminators (lines appended to a file without a
> trailing newline replace its last line) is documented on both new
> methods.
>
> ## Tests
>
> New fixture `make_numstat_line_endings_repo.sh` builds three commits
> covering a final-newline gain, a plain appended line, and an LF-to-CRLF
> conversion, and records Git's own `git diff --numstat` output in the
> worktree at fixture-creation time. Two tests in
> `gix/tests/gix/object/tree/diff.rs`:
>
> - `keeping_newline_separators_matches_git_numstat`: the new counts equal
>   the recorded Git output for `c1..c2`, `c2..c3`, and `c1..c3`;
> - `default_counts_ignore_terminators`: pins that `line_counts()` still
>   reports `0 0` for the newline gain and the CRLF conversion.
>
> Checks I ran on this machine (`just` and `cargo-nextest` are not
> installed here, so I used `cargo` directly):
>
> - `cargo test -p gix --test gix line_counts` — 2 passed;
> - `cargo test -p gix --test gix object::tree::diff` — 5 passed;
> - `cargo test -p gix-diff` — 102 passed;
> - `cargo clippy -p gix-diff -p gix --all-targets -- -D warnings` — clean;
> - `cargo fmt --all -- --check` — clean.
>
> I did not run the full `just test` recipe or the journey tests.
>
> ## Questions
>
> - Is a sibling method the right shape, or would you prefer an options
>   parameter on `line_counts()` / `interned_input()`?
> - Are the names (`..._with_newline_separators`,
>   `..._keeping_newline_separators`) acceptable, or is there a preferred
>   term?
