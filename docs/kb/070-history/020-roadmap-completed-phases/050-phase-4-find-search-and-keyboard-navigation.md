---
summary: >-
  Complete: loaded-commit find widget (Ctrl/Cmd+F, F3), the
  `keyboardShortcuts.ts` key map, the full-history `searchCommits` command;
  `2026-07-02` slice records, including a Sonar cleanup and hotspot review.
---

# Phase 4: Find, Search, and Keyboard Navigation

**Status: complete** — loaded-commit find widget, graph keyboard map, and the full-history `searchCommits` command are all implemented.

Goal: let users move around history quickly without visually scanning the whole
table.

Implementation plan:

- Add a find widget for loaded commits: message, author, email, hash, branch
  names, and tag names.
- Add next/previous match navigation and row highlighting.
- Add jump-to-HEAD as a first-class command/button if the head commit is loaded.
- Add keyboard shortcuts for find, refresh, jump-to-HEAD, close, and commit
  details up/down navigation.
- Add a full-history search command that runs a Git query beyond loaded commits.

Acceptance:

- Search does not mutate loaded graph data.
- Empty/no-results states are clear.
- Short and full hashes both match.
- Keyboard behavior does not interfere with text inputs/dialogs.

Slice progress:

- `2026-07-02`: Added the first loaded-commit find widget slice. The toolbar now
  exposes a compact find control with localized labels, match counts,
  previous/next navigation, clear behavior, and Ctrl/Cmd+F plus F3 keyboard
  handling that avoids text inputs and active dialogs. Matching is client-side
  over already loaded commits only, covering subject, author, email, full hash,
  configured short hash, branch names, and tag names without mutating commit
  data or sending new load requests. Find matches are highlighted with VS Code
  theme tokens and OKLCH fallbacks, while the active match is preserved by hash
  across commit reloads. While touching `src/webview/main.ts`, fixed local
  Sonar findings for constructor-only fields, nested ternary flow, negated match
  count logic, and the existing uncommitted-count regex call. Verified with:
  - `pnpm exec vitest run tests/webview/commitFind.test.ts tests/webview/webviewToolbar.test.ts tests/webview/rendering.test.ts tests/webview/tableStyles.test.ts --project webview`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run package`
  - `pnpm run l10n:check`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `ed41da47-6e25-46f3-abb3-3089a23ff3e3`; SonarQube quality
    gate `OK`, new coverage `85.2%`, new duplicated-lines density `0.16713`,
    new violations `0`.
- `2026-07-02`: Added graph keyboard navigation as a small resolver module plus
  webview wiring. `src/webview/keyboardShortcuts.ts` maps keydown events to
  typed actions with guards for dialogs, the context menu, and editable
  targets; `Ctrl/Cmd+R` refreshes, `Ctrl/Cmd+H` jumps to HEAD (scroll and
  blink, now shared with the locate-HEAD button), `Escape` closes the find
  widget before commit details, and plain `ArrowUp`/`ArrowDown` step through
  open commit details across loaded commits, skipping the uncommitted-changes
  row and keeping row focus. Escape/`Ctrl+F` handling now also stays inert
  while the context menu is open instead of racing its keyup close path.
  README documents the shortcut map. While running the tree-wide gate, fixed
  a pre-existing `src/webview/graph.ts` formatting drift against the default
  Biome config (format-only hunk). Verified with:
  - `pnpm exec vitest run --project webview tests/webview/keyboardShortcuts.test.ts tests/webview/keyboardNavigation.test.ts`
  - `pnpm run typecheck`
  - `pnpm exec biome format --write --config-path biome.strict.jsonc <touched files>`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run format`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run package`
  - `pnpm run l10n:check`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task; SonarQube quality gate `OK`, new coverage `87.5%`, new
    duplicated-lines density `0.1467`, new violations `0` (an initial scan
    flagged `S3776` cognitive complexity in the resolver; it was split into
    focused helpers and rescanned to `OK`).
- `2026-07-02`: Added full-history commit search as the final Phase 4 search
  slice. `src/backend/queries/searchCommits.ts` uses explicit Git CLI log
  queries through `gitRunner`, NUL-separated pretty-format parsing,
  fixed-string message search, escaped author/email search, optional hash-prefix
  lookup, and a same-order all-refs position map that tells the webview how many
  commits must be loaded to reveal a selected result. The toolbar find control
  now has a localized "Search full history" button, the command palette exposes
  `neo-git-graph.searchCommits`, and selected results switch to all-branches
  view, load enough history, scroll to the commit, focus the row, and blink it.
  Empty and failure states are surfaced through the existing dialog/status-strip
  patterns. An initial Sonar scan flagged five touched-file findings
  (`.at(-1)`, `Number.parseInt`, `String.raw`, `startsWith`, and `for-of`);
  each was fixed before the final scan. Verified with:
  - `pnpm exec vitest run --project backend tests/backend/queries/searchCommits.test.ts tests/backend/manifest.test.ts`
  - `pnpm exec vitest run --project webview tests/webview/webviewToolbar.test.ts tests/webview/commandManager.test.ts tests/webview/messageHandler.test.ts tests/webview/rendering.test.ts`
  - `pnpm exec biome check --write --config-path biome.strict.jsonc <touched files>`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run typecheck`
  - `pnpm run l10n:check`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run package`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `bae7e1b6-2536-4a89-a9e5-2289d95e5d2e`; SonarQube quality
    gate `OK`, new coverage `87.6%`, new duplicated-lines density `0.11867`,
    new violations `0`.
- `2026-07-02`: Ran `sonar list issues -p neo-git-graph` and cleaned all
  unresolved medium-or-higher Sonar issues in touched files across backend,
  extension host, scripts, and webview code. Refactored complex parsing,
  rendering, watcher, and dropdown handlers into focused helpers; removed
  remaining `var`-style and legacy JS API findings; added webview message origin
  validation and coverage for dialog/context-menu flows. Security hotspots were
  reviewed explicitly: CSP nonces now use `crypto.randomBytes`, regex hotspots in
  l10n placeholder scanning, git credential redaction, and repo watcher path
  filtering were replaced with deterministic scans/prefix checks, the local
  avatar cache filename hash was moved to SHA-256, the shipped GitLab
  `Private-Token` header was removed, and the remaining Gravatar MD5 hotspot was
  marked `REVIEWED`/`SAFE` in SonarQube with a comment explaining that it is
  required by the Gravatar lookup protocol and is not used for passwords,
  integrity, signatures, random generation, or authorization.
  Verified with:
  - `pnpm exec vitest run --project backend tests/backend/utils/gitRunner.test.ts tests/backend/utils/nonce.test.ts`
  - `pnpm exec vitest run --project webview tests/webview/rendering.test.ts tests/webview/repoFileWatcher.test.ts`
  - `node ./scripts/check-l10n.js`
  - `pnpm exec biome format --write <touched files>`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings <touched files>`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run compile-tests`
  - `pnpm run package`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `6c04bdb2-73fa-436e-8852-f9adbb9fcdb9`; current
    SonarQube project quality gate `OK`, new coverage `80.7%`, reviewed
    hotspots `100%`, new duplicated-lines density `0.0`, new violations `0`,
    and unresolved medium-or-higher issues `0`.
