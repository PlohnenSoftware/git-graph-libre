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
| X1 | How should a merge commit's file list look? | (a) **first parent**: what the engine computes and what `viewDiff`'s `<hash>^` side already shows, with a "compared with first parent" note; (b) keep `-m` (one section per parent; currently broken); (c) combined diff (`--cc`, conflict resolutions only) | (a) | D06 | *open* |
| X2 | How should a type change (file ↔ symlink ↔ submodule) appear? | (a) as `M`, with a localized "type changed" tooltip; (b) a new `T` status with its own icon | (a): no new status anywhere in the UI | D04 | *open* |
| X3 | With two commits selected, which is the base? | (a) the older, by graph row, so the diff reads old → new; (b) the one selected first | (a) | D10, D12–D14 | *open* |
| X4 | Ship "Open in external diff tool" (`git difftool --dir-diff`) in 1.9.0? | (a) yes, shown only when `diff.tool` or `diff.guitool` is configured; (b) defer | (a) if time allows, otherwise (b) | D15 | *open* |
| X5 | How much of Phase 17 goes in 1.9.0? | (a) 17.0 and 17.1 only (legal groundwork and the oracle suite); (b) as much of the port as is done and gated, as a stretch; (c) none | (a), with (b) allowed | D20–D22 | *open* |
| X6 | Integration branch, and may agents push slice branches? | branch name; push yes or no | branch `release/1.9.0` from `main`; **no pushing** | every slice | *open* |
| X7 | Where do display diffs come from? | (a) a port of VS Code's algorithm (Phase 17), with gix staying Git-compatible and the two never mixed; (b) built on gix-imara-diff | (a) | D22, D30 | **(a), `2026-10-18`**: the maintainer chose to keep the original plan, so that neither side has to be untangled later |
| P17-D1, D2, D3, D5 | Phase 17's decisions (license of the port, crate name, pinned `@vscode/diff` version, how CI gets the WebAssembly build) | see the Phase 17 section under Future work | see there | D20–D22 | *open* |
| P17-D4 | Phase 17's display surface | G1 inline hunks, G2 patch document, G3 both, G4 a "GGL Diff" tab built on (a) Monaco, (b) a renderer of our own, or (c) our own renderer with VS Code's diff editor styles and collapse logic copied in | G4 (c) | D40–D48 | **G4 (c), `2026-10-19`**: the maintainer chose a light tab of our own, opened from Source Control and commit details, over the 2.7 MB Monaco bundle |

**How to answer:** replace *open* with the choice, the date and any
condition, for example `(a), 2026-10-20`. Then flip the gated slices to
`Status: ready` in their own files, or ask the integrator to.
