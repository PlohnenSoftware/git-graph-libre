---
summary: >-
  Partial: multi-select squash/drop (`15a1967`) and compare-with-HEAD
  (`8fc95ef`) done. Open: comparing any two loaded commits, ref-to-ref
  comparison, external directory diff.
---

# Phase 8: Commit Comparison and Multi-Select

**Status: partially complete** — multi-commit selection with squash/drop (`15a1967`) and compare-with-HEAD (`8fc95ef`) are done. Remaining: arbitrary two-loaded-commit and ref-to-ref comparison, and external directory diff. All three are scheduled in release 1.9.0 (D10–D13, D15; [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26)).

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
