---
summary: >-
  PR #9: `checkIsRepo()` accepted subdirectories; the raw `--show-toplevel`
  comparison broke on symlinks and Windows drive case; fixed by
  `canonicalizePath()` (`e1668f9`). Rule: no quantifier-before-anchor regex on
  user paths (`S8786`).
---

# PR #9 — repository discovery, right diagnosis and a broken comparison

The defect it reports is real, and was confirmed before anything was changed:
`checkIsRepo()` with no argument falls through to
`["rev-parse", "--is-inside-work-tree"]` in `node_modules/simple-git`, and a
probe against unmodified `main` showed a subdirectory of a repository
answering `true`. Discovery masks this because the top-down scan stops at the
first hit, but the workspace watcher calls the search directly on whatever
directory it just saw created.

The fix compared `git rev-parse --show-toplevel` against the queried path as
**raw strings**, and that is wrong in three ways that have nothing to do with
being different directories:

- **Symlinks.** `--show-toplevel` prints the *physical* path. Reproduced
  against git `2.55.0`: a repository opened through a symlink answered
  `false`, where the `checkIsRepo()` being replaced answered `true`. This
  project performs no `realpath` normalization anywhere — `grep -rn realpath
  src/` returns nothing — so there was no second line of defence.
- **Drive-letter case.** `getPathFromUri` is
  `uri.fsPath.replaceAll("\\", "/")`, and `Uri.fsPath` lower-cases the drive
  letter while git prints it as the filesystem stores it. `"C:/…" === "c:/…"`
  is false, so **every** repository on Windows would have failed the check.
- **Trailing separators**, for a path that arrived through `path.join` rather
  than `getPathFromUri`.

**Answering `false` here is not a harmless miss.** `isGitRepository()` backs
three call sites — `repoSearch.ts` (discovery), the not-a-repository answer in
`loadBranches`, and `repoManager`'s periodic "does this repository still
exist" validation — so a false negative removes the repository from the
dropdown *and* keeps it out.

Fixed in `e1668f9` with `canonicalizePath()`, applied to both sides.
It is exported rather than private because the Windows shapes are pure string
normalization and can only be covered from a Linux or macOS run by driving
them directly. Note also that the branch's own new tests would have **failed
on macOS**: `os.tmpdir()` lives under `/var`, itself a symlink to
`/private/var`.

**`typescript:S8786` caught a ReDoS in the fix itself, and this is its third
appearance.** The first version trimmed trailing separators with `/\/+$/`; a
`+` against an end anchor backtracks super-linearly, and these paths come from
whatever workspace the user opened. The gate came back **ERROR** on
`software_quality_reliability_issues` `1`. Replaced with a linear scan that
also keeps the filesystem root as `/`. The rule to carry forward: **no
quantifier-before-anchor regex on a path or a config line that came from the
user's disk** — it flagged the `.gitmodules` reader when PR #1 was merged
(`1.4.2`) and it flagged this.

Verification (`2026-09-22`), all three trees:

| Tree | strict Biome | `test` | Sonar task | `ZAM` | `new_coverage` |
| --- | --- | --- | --- | --- | --- |
| PR #8 as pushed | clean | 479 / 500 | `f6501c34` | `OK` | `100.0` |
| PR #9 as pushed | **FAIL** | 481 / 500 | `f3848b99` | `OK` | `100.0` |
| PR #9 + fix | clean | 488 / 500 | `12096efb` | `OK` | `100.0` |

`new_violations` `0`, duplication `0.0` and all four project-wide conditions
`0` on the first and third; the middle scan is the one whose gate passed while
the branch was broken. Windows `PREVIOUS_VERSION` `1.6.0` throughout, new
security hotspots to review `0`. `package`, `l10n:check` (100%, all four
locales) and fresh `test:coverage` (109 files / 988 tests on the fixed tree)
all passed.

The new coverage was confirmed by mutation: restoring the raw comparison fails
the symlink and trailing-separator cases.

**The strict-Biome failure on PR #9 was pre-existing on `main`** — the import
block of `tests/backend/utils/isGitRepository.test.ts` was already unsorted
and the branch added `node:path` into it. Whole-tree `pnpm run lint` passes
either way, because the migration config carries no import-order assist; that
is the `2026-09-07` note repeating. Fixed in the same push under the
touched-files rule.
