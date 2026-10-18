---
summary: >-
  Complete: AND-combined filter dropdowns for branches (multi-select, glob
  presets), tags and authors (`a1d2bc9`); also keeps the original
  `CommitFilter` plan and acceptance criteria.
---

# Phase 5: Branch, Tag, and Author Filters

**Status: complete** — multi-branch selection with glob presets plus tag and author filter dropdowns combine with AND semantics (`a1d2bc9` and follow-ups).

Goal: narrow the graph with AND-based filters while preserving predictable graph
state.

Implementation plan:

- Add a `CommitFilter` type with optional `branch`, `tag`, and `author` fields.
- Extend `loadCommits` request input to carry filters, or add a separate filter
  state message if the first slice only filters in the webview.
- Prefer Git-side filtering for branch and author on large histories. Keep a
  client-side fallback only when it is simpler and covered by tests.
- Build branch options from existing `loadBranches`.
- Build tag options from `GitRef` entries of type `tag` or a new lightweight ref
  query if needed.
- Build author options from the currently loaded commits at first; later add a
  dedicated author query if large repos need it.
- Normalize author comparisons by trimming and case-folding names/emails.
- Render active filters in the toolbar and keep empty filters as no-ops.
- Debounce text/search inputs if author filtering is free-form.

Acceptance:

- Multiple filters combine with AND semantics.
- Clearing filters restores the unfiltered graph for the selected repo/branch.
- Tests cover branch-only, tag-only, author-only, combined filters, and empty
  filter behavior.
