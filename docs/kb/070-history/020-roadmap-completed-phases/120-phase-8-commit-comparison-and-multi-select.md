---
summary: >-
  Complete in 1.9.0 (`2026-10-20`): multi-select squash/drop (`15a1967`),
  compare-with-HEAD (`8fc95ef`), arbitrary two-commit and ref-to-ref comparison
  (issue #26, D10–D13), working-tree comparison (D14), and external directory
  diff (D15) done.
---

# Phase 8: Commit Comparison and Multi-Select

**Status: complete in `1.9.0` (`2026-10-20`)** — multi-commit selection with squash/drop (`15a1967`), compare-with-HEAD (`8fc95ef`), arbitrary two-loaded-commit and ref-to-ref comparison (D10–D13; [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26)), working-tree comparison (D14), and external directory diff (D15) are all shipped in `v1.9.0`. The phase is complete, so its section moved to History on `2026-11-05` (W00).

Goal: compare two commits without importing non-MIT behavior.

Implementation plan:

- Add explicit selection state in the webview.
- Add a backend query for changed files between two commit hashes using Git diff
  commands.
- Reuse the existing `DiffDocProvider` path for per-file diffs.
- Start with two-commit comparison only; leave broader multi-select actions for a
  later slice.

Acceptance:

- Selecting two commits shows a comparison view.
- File diffs open through the existing diff provider.
- Tests cover query parsing and selection-state transitions.
