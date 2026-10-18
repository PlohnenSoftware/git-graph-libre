---
summary: >-
  Partial. Done: split renderer, collapse/expand, tree/list and compact
  folders, resizable height, safe linkification, file actions. Open: the
  docked-bottom commit-details mode.
---

# Phase 2: Commit Details UX

**Status: partially complete** — split renderer, collapse/expand, tree/list and compact-folder modes, resizable height, safe linkification, and file actions are done. Remaining: the docked-bottom commit-details mode.

Goal: make inspecting a commit feel usable before adding comparison/review
features.

Implementation plan:

- Split commit details into summary and file-list components.
- Add collapse/expand controls for summary and file changes.
- Add file tree/list mode and compact-folder option.
- Add resizable inline details height before experimenting with docked layouts.
- Add docked-bottom details mode after inline details remains stable.
- Add clickable URLs in commit body using a safe linkifier.
- Add copy file path and open current file actions from the file list.

Acceptance:

- Current diff opening still works.
- Long messages and long paths remain readable and do not break layout.
- Details can be closed, collapsed, and resized with mouse and keyboard.
- Tests cover tree/list rendering, URL escaping/linking, and action messages.
