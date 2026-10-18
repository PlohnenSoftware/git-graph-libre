---
summary: >-
  Record: the engine's `search_commits` (literal message, author and hash
  matches in one walk, 7.9x) replaces `search_history`; the parity table
  exposed a CLI `--author` `escapeRegExp` bug, fixed with `--fixed-strings`.
---

# Search in the engine, and a CLI bug it exposed (`2026-09-23`)

Slice 16.7 declined `search_history` because the engine's search and this
project's search answer different questions. That decline was correct and the
conclusion drawn from it was not: the fix is not to wire the mismatched
function, and not to leave search on four `git` processes, but to give the
engine a search with *these* semantics. `search_commits` is that function, new
in `engine/native/core/src/search.rs`. `search_history` was then removed
outright — see the surface audit below.

What had to be reproduced, and what the engine's own search does instead:

| | this project | `log::search_history` |
| --- | --- | --- |
| message match | literal substring, case-insensitive | regular expression |
| author match | yes | no |
| hash match | yes, abbreviated resolves | no |
| refs searched | the ones the view shows | every ref, always |
| author filter | honoured | ignored |
| ordering | position in the graph's walk | commit date |

The CLI answers with four `git log` runs at once — `--fixed-strings --grep`,
`--author`, a hash lookup, and one unbounded walk that numbers every commit.
That numbering is the `loadCount` each result carries, and it is also a
*filter*: a hit with no position is dropped, which is why a hash that resolves
to an unreachable commit is not a result. The engine does the same three
matches in a single walk, which is where the speed comes from.

Verified deliberately at the boundaries the two disagree on, in the parity
table (`engine/CLI parity: searchCommits`, eight cases, plus twelve engine-side
tests): a literal dot that a regex would widen, a query that is not valid
regex at all, case folding, a body-only term that `--grep` reaches and `%s`
does not show, an author-only match, an abbreviated hash, a hash that resolves
but is unreachable, and a `--glob=` ref pattern that still declines to the CLI.

**The CLI bug the parity table found.** The `(` case failed — not because the
engine was wrong, but because **git was rejecting the search outright**:

```
fatal: header, '\(': Unmatched ( or \(
```

`searchCommits` escaped the query for its `--author` run with a
JavaScript-style `escapeRegExp`, turning `(` into `\(`. But `--author` takes a
*basic* regular expression, in which `\(` **opens a group** rather than
escaping a parenthesis — so the escaping inverted the meaning, and because the
four runs share a `Promise.all`, any query containing an unbalanced `(` or `[`
failed the entire Find dialogue. A literal match was always the intent;
`--fixed-strings` is how git spells it, and it matches name and email
substrings case-insensitively exactly as before. Verified against git directly
before changing anything.

This is worth recording as a pattern, not just a fix: the parity table earns
its keep by failing on the *CLI* side. Two implementations that must agree
catch bugs in whichever one is wrong.

| | git CLI | engine | |
| --- | ---: | ---: | ---: |
| search (message term), 1,036 commits | `62.0 ms` | **`7.8 ms`** | `7.9x` |

Second only to `loadRepoInfo` among the wired reads, because four processes
collapse to one walk.
