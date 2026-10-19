---
summary: >-
  The choices only the maintainer makes for release 1.9.0, each with options,
  a recommendation and the slices it unblocks: X1 merge presentation, X2 type
  changes, X3 comparison direction, X4 external diff tool, X5 Phase 17 scope,
  X6 integration branch and pushing, plus Phase 17's D1–D5 (D4 answered:
  the GGL Diff tab). Agents read answers here and never fill them in.
---

# Maintainer decisions for release 1.9.0

Agents: read the answers, never write them. A slice gated on an unanswered
decision is not ready.

| ID | Question | Options | Recommendation | Unblocks | Answer |
| --- | --- | --- | --- | --- | --- |
| X1 | How should a merge commit's file list look? | (a) **first parent**: what the engine computes and what `viewDiff`'s `<hash>^` side already shows, with a "compared with first parent" note; (b) keep `-m` (one section per parent; currently broken); (c) combined diff (`--cc`, conflict resolutions only) | (a) | D06 | **(a), `2026-10-18`** (recorded by the integrator at the maintainer's request, `2026-10-19`). The second parent behind a switch in the file tree is a separate follow-up slice, to be drafted after D06 |
| X2 | How should a type change (file ↔ symlink ↔ submodule) appear? | (a) as `M`, with a localized "type changed" tooltip; (b) a new `T` status with its own icon | (a): no new status anywhere in the UI | D04 | **(b), `2026-10-19`**: a new `T` status with its own icon. D04's written steps cover (a) only, so the slice needs a re-scope draft approved by the maintainer before it is ready |
| X3 | With two commits selected, which is the base? | (a) the older, by graph row, so the diff reads old → new; (b) the one selected first | (a) | D10, D12–D14 | **(a), `2026-10-18`** (recorded `2026-10-19`) |
| X4 | Ship "Open in external diff tool" (`git difftool --dir-diff`) in 1.9.0? | (a) yes, shown only when `diff.tool` or `diff.guitool` is configured; (b) defer | (a) if time allows, otherwise (b) | D15 | **(a), `2026-10-19`** |
| X5 | How much of Phase 17 goes in 1.9.0? | (a) 17.0 and 17.1 only (legal groundwork and the oracle suite); (b) as much of the port as is done and gated, as a stretch; (c) none | (a), with (b) allowed | D20–D22 | **(b), `2026-10-19`, stronger than written**: the whole diff-algorithm port is committed 1.9.0 scope, not stretch |
| X6 | Integration branch, and may agents push slice branches? | branch name; push yes or no | branch `release/1.9.0` from `main`; **no pushing** | every slice | **`the-diff` (local), no pushing, `2026-10-18`** (recorded `2026-10-19`). Slice worktrees branch from the local `the-diff` ref, since agents never push |
| X7 | Where do display diffs come from? | (a) a port of VS Code's algorithm (Phase 17), with gix staying Git-compatible and the two never mixed; (b) built on gix-imara-diff | (a) | D22, D30 | **(a), `2026-10-18`**: the maintainer chose to keep the original plan, so that neither side has to be untangled later |
| P17-D1, D2, D3, D5 | Phase 17's decisions (license of the port, crate name, pinned `@vscode/diff` version, how CI gets the WebAssembly build) | see the Phase 17 section under Future work | see there | D20–D22 | **`2026-10-19`**: D1 AGPL-3.0-or-later (Microsoft's MIT notice kept); D2 internal only — it may simply be part of the engine, whichever is easier to create and maintain, and is not packaged outside this repository; D3 pin `@vscode/diff` `0.0.2-87`; D5 deferred — for now the WebAssembly comparison is a local development test (a developer with `@vscode/diff` and Rust installed), with CI wiring decided later |
| P17-D4 | Phase 17's display surface | G1 inline hunks, G2 patch document, G3 both, G4 a "GGL Diff" tab built on (a) Monaco, (b) a renderer of our own, or (c) our own renderer with VS Code's diff editor styles and collapse logic copied in | G4 (c) | D40–D48 | **G4 (c), `2026-10-19`**: the maintainer chose a light tab of our own, opened from Source Control and commit details, over the 2.7 MB Monaco bundle |
| X8 | D44 is 308 changed lines against its ≤300 budget (45 are the mandated l10n bundles) | (a) accept 308; (b) split; (c) the two priced typing regressions | (a) | D44 | **(a), `2026-10-19`** |
| X9 | 22a is 499 production lines against ≤300; D22's budgets predate the license-header and unit-test discipline | (a) accept 22a and re-budget D22 in production lines; (b) re-cut 22a; (c) keep 300 and split further | (a) | D22 | **(a), `2026-10-19`**: D22's table now counts production lines only, with budgets sized from the VS Code sources |
| X10 | The engine workspace declares `license = "MIT"`, while `NOTICE.md` says changes here are AGPL-3.0-or-later | (a) `AGPL-3.0-or-later AND MIT`; (b) leave MIT; (c) decide later | (a) | D22L | **(a), `2026-10-19`**; and `engine/NOTICE.md`'s License section now says the upstream engine is MIT and this project's changes are AGPL-3.0-or-later (maintainer, same day) |
| X11 | The judgment calls recorded in D12–D15's reports, and D13's Swap icon | (a) accept all and switch the icon to `arrow-switch`; (b) maintainer reviews; (c) walk through each | (a) | D13G | **(a), `2026-10-19`**: labels travel as refs; the native `<datalist>` in "Compare with…"; the swapped working-tree side through `git diff -R`; the launch-time configured-tool check and `diff.guitool` precedence; and D14's and D15's other recorded choices, all accepted as recorded |
| X12 | Ported Rust functions over Sonar's cognitive-complexity limit (16) | (a) refactor into helpers in the same file; (b) keep VS Code's structure and accept the findings; (c) a scoped Sonar exclusion | (a) | D22F, 22e–22g | **(a), `2026-10-19`**: split into helpers, oracles still byte-identical; new sub-slices write under 16 from the start |
| X13 | Sonar findings in the oracle generators | (a) fix the valid ones and mark the `charCodeAt` `S7758` false positive; (b) treat the generators as test code; (c) exclude them | (a) | D22F | **(a), `2026-10-19`**: `replaceAll`, `fetch` instead of `gh`; `charCodeAt` stays (UTF-16 code units) |

**How to answer:** replace *open* with the choice, the date and any
condition, for example `(a), 2026-10-20`. Then flip the gated slices to
`Status: ready` in their own files, or ask the integrator to.
