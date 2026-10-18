---
summary: >-
  PR #8 merged: `commit.gpgsign false` in the `fetchTags` fixture; why the
  signature tests stay valid (`git mktag`, `hash-object`). Open follow-up: use
  `makeRepo()` instead.
---

# PR #8 — `commit.gpgsign` in the fetch-tags fixture

One line, correct, merged. The `fetchTags` test in
`tests/webview/messageHandler.test.ts` hand-rolls its own repository with
`cp.execFileSync("git", ["init", …])` instead of using `makeRepo()`, and set
only `tag.gpgsign false`. With the maintainer's global `commit.gpgsign true`,
its `git commit -m init` waits on a pinentry prompt.

**It does not weaken signature coverage, and the reason is worth knowing
before anyone else asks the same question.** The tests that exercise signing
never consult git's signing configuration at all — they synthesize signed
objects directly:

- `tests/backend/queries/loadCommits/signedTags.test.ts` writes a
  signature-bearing tag object with `git mktag` and points a ref at it with
  `update-ref`.
- `tests/backend/queries/loadCommits/unverifiedSignatures.test.ts` writes a
  commit carrying a `gpgsig -----BEGIN SSH SIGNATURE-----` header through
  `git hash-object -t commit -w --stdin`.
- `tests/backend/actions/tag/add.test.ts` sets `tag.gpgsign **true**` on its
  own repository on purpose, to prove BUG-3's `--no-sign`.

So no fixture's signing configuration can make a signature test pass
vacuously, and `git config` without `--global` cannot reach outside the one
`mkdtemp` directory it is run in. Follow-up not taken: that fixture should use
`makeRepo()` (`tests/backend/helpers.ts`), which sets both keys, rather than
hand-rolling a repository.
