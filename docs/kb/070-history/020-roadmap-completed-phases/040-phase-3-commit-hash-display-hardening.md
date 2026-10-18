---
summary: >-
  Complete: `shortHashLength` setting via `abbrevCommit()`, with full hashes
  kept in `data-hash` and in actions; `2026-07-02` slice record with
  verification commands and Sonar result (its machine paths are dead).
---

# Phase 3: Commit Hash Display Hardening

**Status: complete.**

Why here: the repo already has almost all underlying data, so this remains a
low-risk data/UI slice after the visual shell is improved.

Implementation plan:

- Add a `shortHashLength` setting with a conservative default such as `8` or keep
  the current `abbrevCommit()` length if existing behavior should remain stable.
- Add a small helper that derives display hashes from the full hash.
- Consider adding `displayHash` to `GitCommitNode` only if multiple render paths
  need it; otherwise keep the model simple and derive in the webview.
- Ensure row `data-hash`, title text, context actions, copy actions, and backend
  requests keep using full hashes.
- Add tests for short hash derivation and rendering behavior.
- Update `package.nls*.json`, `l10n/*.json`, and README configuration docs if a
  new setting is added.

Acceptance:

- Users can see a predictable short hash.
- Full hash remains available through title/data attributes and all actions.
- Changing short length triggers a consistent refresh or rerender.

Slice progress:

- `2026-07-02`: Completed the Phase 3 configurable short-hash display slice.
  Added `neo-git-graph.shortHashLength` with bounded package metadata and
  English, Polish, zh-CN, and zh-TW package descriptions. The shared
  `abbrevCommit()` helper now clamps display lengths and is used by the webview
  and diff-title path; row `data-hash`, commit-cell title attributes,
  copy-to-clipboard payloads, backend action requests, and diff document
  revisions continue to use the full hash. README now documents the setting.
  Verified with:
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/backend/config.test.ts tests/backend/manifest.test.ts tests/backend/utils/string.test.ts --project backend`
  - `pnpm exec vitest run tests/webview/webviewHtml.test.ts tests/webview/rendering.test.ts tests/webview/messageHandler.test.ts tests/webview/commitDetailsListMode.test.ts tests/webview/graph.test.ts --project webview`
  - `pnpm run l10n:check`
  - `pnpm run package`
  - `pnpm run test`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched TypeScript files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `7804a9c8-4a0a-454e-b7c1-779bd33b512d`; SonarQube quality
    gate `OK`, new coverage `85.4%`, new violations `0`.
