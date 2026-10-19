---
summary: >-
  D30c PR draft text for gitoxide (not posted): document that
  `Rewrites::default()` `track_empty: false` differs from Git's default, and
  ask whether flipping the default is preferred. The maintainer posts it.
---

# D30c PR draft — `track_empty` default documentation

Draft for the maintainer to post upstream. Nothing here has been posted.
Branch: `fix/gix-diff-rewrites-track-empty-default` in the
`PlohnenSoftware/gix` fork (worktree `../gix-d30c`), based on `7540f69bf`.
This prepares the smaller, documentation-only change because which fix is
right is an upstream judgment call; the question is recorded in the draft
and in the slice report.

---

**Proposed PR title:** Document that `Rewrites::default()` `track_empty` differs from Git

**Proposed PR body:**

> I am Muse Code (muse-wonder-full-1.0), an AI agent. I prepared this
> change and this text; I speak only for myself. The account holder has not
> reviewed, tested, or approved this work — any such statement is theirs to
> make.
>
> ## Problem
>
> `Rewrites::default()` is documented as "the default settings for rewrites
> according to the git configuration defaults", but it sets
> `track_empty: false`. Git uses empty blobs as rename sources by default:
> renaming an empty file is reported as `R100` by `git diff -M` (observed
> with Git 2.56), and only `--no-rename-empty` turns that off. Git has no
> `diff.renameEmpty`-style configuration for it.
>
> So a reader who trusts the "git configuration defaults" sentence gets
> rename results for empty files that differ from Git's, with no hint why.
>
> ## Change
>
> Documentation only, no behavior change:
>
> - `gix-diff/src/rewrites/mod.rs`: the `Default` impl now notes that
>   `track_empty` deliberately differs from Git and how to match Git;
> - `gix-diff/src/lib.rs`: the `track_empty` field doc says the same.
>
> I kept `false` because the field documentation ("empty files don't have
> a unique-enough identity") and `gix-merge` ("empty blobs should not be
> tracked for best results") both suggest the divergence is deliberate.
>
> ## Question for maintainers
>
> Would you rather align the default with Git (`track_empty: true`)? That
> would change behavior for everyone relying on `Rewrites::default()`,
> including the config-derived rewrites in `gix`
> (`gix::diff::utils::new_rewrites_inner`), so it looks like a breaking
> change that needs your call. I am happy to prepare that variant instead
> of, or in addition to, this documentation fix.
>
> ## Tests
>
> No behavior changed. Checks I ran (`just` and `cargo-nextest` are not
> installed on this machine, so I used `cargo` directly):
>
> - `cargo test -p gix-diff` — 102 passed;
> - `cargo clippy -p gix-diff --all-targets -- -D warnings` — clean;
> - `cargo fmt --all -- --check` — clean.
>
> I did not run the full `just test` recipe or the journey tests.
