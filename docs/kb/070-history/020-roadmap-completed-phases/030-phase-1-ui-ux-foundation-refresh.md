---
summary: >-
  Complete: toolbar icon buttons, status strip, sticky headers with column
  show/hide, font-size and row-height density settings, theme-native dialogs
  and menus; original plan and acceptance criteria.
---

# Phase 1: UI/UX Foundation Refresh

**Status: complete** — toolbar, status strip, sticky headers with column show/hide, density settings, theme-native dialogs/menus/dropdowns, and selection styling all landed.

Why early: the user-facing surface is currently the weakest part of the MIT fork.
After the Phase 0.5 robustness baseline, visible UX work should come before
adding advanced Git features so the product does not become more complicated
without feeling better.

Implementation plan:

- Extract toolbar rendering from `buildWebviewHtml()` into a small, testable
  webview layout surface.
- Replace text-only `roundedBtn` controls with compact icon+tooltip buttons for
  refresh, jump-to-HEAD, search, repo settings, and future fetch actions.
- Add a persistent action/status strip for loading, refreshing, and running Git
  actions.
- Add sticky table headers and clear focus/hover/selected states using VS Code
  theme variables.
- Add configurable `graph.fontSize` and `graph.rowHeight` equivalents under the
  `neo-git-graph` namespace.
- Keep the first pass visually restrained and work-focused: dense, readable,
  theme-native, no decorative hero/card layout.

Acceptance:

- Existing commit loading, branch selection, remote toggle, refresh, and locate
  HEAD still work.
- Text does not overlap at narrow webview widths.
- Toolbar buttons have accessible labels/tooltips.
- Focus, hover, loading, and disabled states are visible.
- Webview rendering tests cover the new toolbar structure.
