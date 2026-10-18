---
summary: >-
  Historical list of the inputs reviewed when this document began:
  `README.md`, `agents.md`, `package.json`, key `src/` files, `tests/**`, and
  the parent `../FEATURE_*.md` recommendation briefs.
---

# Local Inputs Reviewed

Project inputs:

- `README.md`: states the MIT fork purpose, current features, configuration, and
  license position.
- `agents.md`: original generic continuation guidance. Its durable rules have
  been centralized in this document; the file should now stay pointer-only.
- `package.json`: extension manifest, commands, settings, scripts, and toolchain.
- `src/extension.ts`: activation, webview panel setup, repo discovery, watchers,
  state, and command registration.
- `src/extension/messageHandler.ts`: central webview request/action dispatcher.
- `src/types.ts` and `src/backend/types/*`: message contracts and git data types.
- `src/backend/queries/*`: commit, branch, and commit-detail query surfaces.
- `src/backend/actions/*`: branch, tag, merge, and commit actions.
- `src/webview/main.ts`: webview state, toolbar controls, commit table rendering,
  context menus, and request flow.
- `src/webview/graph.ts`: graph layout and SVG rendering.
- `tests/**`: current unit coverage pattern for backend, extension, and webview
  behavior.

Parent recommendation briefs:

- `../FEATURE_HASHES_DISPLAY.md`
- `../FEATURE_FILTER_BY_BRANCH_TAG_AUTHOR.md`
- `../FEATURE_STASHES_MANAGEMENT.md`
- `../FEATURE_REPO_SETTINGS_MENU.md`
