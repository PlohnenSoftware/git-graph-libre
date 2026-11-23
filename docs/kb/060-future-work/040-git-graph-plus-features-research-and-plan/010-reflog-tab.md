---
summary: >-
  Research (`2026-11-08`) into the Reflog tab of Git Graph+ at `c6c2a9a`: its
  behavior, Git commands and gaps (its "dangling" means a missing object, so
  its recovery claim does not hold), what Git Graph Libre has today, slices
  F1-01 to F1-09 and decisions RQ1 to RQ10. Written by a research agent;
  items marked [verify] were not run against Git.
---

# Research: the Reflog tab of Git Graph+ and a slice plan for Git Graph Libre

Read-only research. Git Graph+ at `c6c2a9a` (`/home/zam/Desktop/prog/_GGL/git-graph-plus`, Apache-2.0, publisher the0807, version 0.7.3). Nothing was copied. Behavior and design below are described in my own words; identifiers and Git command lines are quoted only as short references.

Verification caveat: I tried to confirm a few Git behaviors in a throwaway repository, but a shell hook blocked the commands (it flagged `reset`/`rm`). Items marked **[verify]** are from my knowledge of Git, not from a run. The first slice (F1-01) must pin them with real-Git fixtures.

## 0. Licensing notes (prominent)

- Provenance of the files read: `package.json` says `"license": "Apache-2.0"`, publisher `the0807`. README (lines 232-233) says no code from Git Graph (mhutchie) is used and all code was written from scratch. No `mhutchie` string appears in `src` or `webview-ui/src`; only README credits.
- **One notice outside the Reflog path, not read for design but found by grep:** `src/git/git-graph-builder.ts` lines 1-2 at `c6c2a9a`:
  `// Graph layout algorithm ported from SourceGit (https://github.com/sourcegit-scm/sourcegit)`
  `// Copyright (c) SourceGit contributors, licensed under MIT License.`
  This is the graph layout code, unrelated to the Reflog tab. I did not read it beyond those two lines and nothing in this plan depends on it. MIT code in an Apache-2.0 project is fine for them, but it means that file is not "the0807 only". Do not use it as a reference for our graph work.
- The Reflog files themselves (`Reflog.svelte`, its test, `getReflog` in `git-service.ts`, the `MainPanel.ts` case, `message-bus.ts`, i18n) carry no header and no ported-from comment.
- I never touched `vscode-git-graph-rs/src`, `/web` or `illegal_forks`.
- Clean-room advice for the implementer: work from the behavior list in section 1 and Git's own documentation (`git-reflog(1)`, `git-log(1)` "reflog" placeholders), not from the Svelte source. Do not reuse their color values, class names or the exact CSS grouping. Their sub-action names are Git's own words (Git writes them), so naming them is not copying.

## 1. User-facing behavior of the Git Graph+ Reflog tab

Citations are `path:line` at `c6c2a9a`.

### Entry points
- A toolbar button labelled "Reflog" (`webview-ui/src/components/layout/Toolbar.svelte:221`, string `toolbar.log` in `webview-ui/src/lib/i18n/en.ts:4`) switches the whole main area between three views: Graph, Reflog, Statistics. The state is `uiStore.viewMode` (`'graph' | 'log' | 'stats'`) in `webview-ui/src/lib/stores/ui.svelte.ts:16`, set by `setViewMode` (`:156`).
- Keyboard: Ctrl+1 Graph, Ctrl+2 Reflog, Ctrl+3 Stats (`webview-ui/src/App.svelte:248-250`).
- `App.svelte:505-508` renders `<Reflog active={...}>` inside `.log-container` only while the mode is `log`. The component is unmounted on leaving the tab, so filters, search text and the paging limit reset every time. It reloads on every activation.
- It is not a separate editor tab or panel; it replaces the graph in the same webview.

### Rows
Columns (`Reflog.svelte:348-355`, rows `:357-391`): index (`#`, the number inside `@{N}`), Action (colored dot plus type word), Sub-action (small tag or "-"), Description (message text after the first colon, linkified through commit-message link rules, with a warning icon when "dangling"), SHA (short, full hash in tooltip), Elapsed (relative time such as `5m ago`; full local date in tooltip). The header is sticky.
- Rows are keyed by the synthetic selector.
- Right-click menu (`:207-220`): "Reset to <selector>", "Checkout commit", "Copy SHA". No left-click details, no navigate-to-graph, no "create branch here", no cherry-pick.

### Action classification and sub-actions
- Action type: the first of nine known keywords that the message starts with (`ACTION_MAP`, `Reflog.svelte:86-96`, `parseActionType :98-103`): commit, checkout, rebase, reset, merge, revert, pull, cherry-pick, stash. Anything else falls back to the text before the first colon (so `branch`, `clone`, `fetch`, `update by push` become their own type word with a grey dot).
- Sub-action: the text inside the first parentheses of the message (regex `^[^(:]+\(([^)]+)\)`, `:105-116`). It comes from Git's own reflog subjects: `commit (amend)`, `commit (initial)`, `commit (merge)`, `rebase (start|pick|squash|fixup|reword|edit|continue|abort|finish)`. "amend" gets a localized label (`reflog.amend`); everything else is shown raw.
- Sub-action colors (CSS `:904-970`) are five intent groups: Edit (amend, reword, edit), Combine (squash, fixup), Integrate (merge, cherry-pick, revert), Flow (initial, resume, pick, start, finish, continue), Abort (abort). Unknown sub-actions get a neutral badge. Colors are hex literals (`#4caf50`, ...) and `color-mix` over hex; this would violate our OKLCH rule.
- Display message: everything after the first `: ` (`getDisplayMessage :118-121`). A message with no colon is shown whole. `checkout: moving from a to b` shows `moving from a to b`.

### Search, filters, per-branch view
- Search box: client-side substring match on short hash plus message, lowercase (`:62-76`). It only searches the entries already loaded (default 200). Count text `N matches`, `N / total` for filters, or "No results".
- Ref dropdown: `HEAD` plus every local branch (from `branchStore.localBranches`). Changing it resets the limit to 200 and requests a fresh list. No remote branches, tags, or `stash`.
- Action dropdown: multi-select over the nine keywords plus "All" (client-side). The `stash` option can never match for `HEAD`, because stash updates live in the `refs/stash` reflog, not HEAD's.
- "Dangling only" toggle (warning icon button).
- Escape closes dropdowns, then clears the query, then blurs.

### "Dangling" detection and recovery (what the feature really does)
- Detection (`src/git/git-service.ts:297-322`): after listing entries, one `git cat-file --batch-check` with all unique hashes on stdin; a hash is "dangling" only if the output says `missing`. So "dangling" means "the object no longer exists in the object database", which is NOT the same as "unreachable from every branch".
- Consequence: their tooltip text (`reflog.danglingTooltip`, `en.ts:315`) says "not reachable from any branch. Right-click → Reset to recover it." That is inaccurate: a missing object cannot be reset to; and a reachable-from-reflog-only commit (the real recoverable case, such as after `reset --hard` or an abandoned branch) is NOT flagged because its object exists. In practice the flag fires rarely (only after the object was pruned while the reflog entry survived).
- Recovery is not a dedicated feature. The README claim "dangling commit detection and recovery" (`README.md:31,145`) amounts to the generic context-menu actions: Reset (modal with soft/mixed/hard, default hard, `Reflog.svelte:419-432`; backend `git reset --<mode> <hash>`, `git-service.ts:1719-1722`) and Checkout Commit (shared modal with stash/force options, `MainPanel.ts:533-545`). There is no `git fsck --lost-found`, no "create branch from this entry", no fsck scan, no confirmation specific to dangling rows.
- Reset after the action: `MainPanel.ts:993-998` posts `operationComplete`, shows an information toast (localized `resetComplete`), refreshes everything.

### Settings
No setting for the Reflog tab itself. The only reflog-related setting is the shared `commitMessageLinks` (`package.json:514`), which also affects this tab. Page size 200 is a constant in the component.

### Empty, error, loading
- Loading: spinner plus "Loading reflog" (`:340-341`), shown only while no entries are loaded.
- Empty: "No reflog entries found"; filtered empty: "No matching entries" (`:342-345`).
- Error: there is no error state. `getReflog` catches every failure, writes a warning to the activity log, and returns an empty list (`git-service.ts:326-329`), so a failed read looks like an empty reflog.

### Paging and limits
- Request `-n limit+1`; if `limit+1` came back, `hasMore` is true and the last row is dropped (`git-service.ts:270-290`). A "Load more entries" button raises the limit by 200 and re-requests the whole list from the start (`:155-159`), so each page costs O(total) and re-runs the `cat-file` probe. Filters apply only to loaded rows.
- Refresh: on `repoChanged` or `operationComplete`, if the tab is active, it reloads (`:175-177`).

## 2. Implementation details

### Message flow
- Webview to extension: `{ type: 'getReflog', payload?: { ref?, limit? } }` (`src/utils/message-bus.ts:86`).
- Extension to webview: `{ type: 'reflogData', payload: { entries: [{hash, shortHash, selector, message, date, dangling}], hasMore } }` (`message-bus.ts:142`).
- Handler: `src/panels/MainPanel.ts:1202-1205` calls `gitService.getReflog(limit ?? 200, ref ?? 'HEAD')` and posts the result. No request id, so responses can race (their test checks that the component does not double-fire, `Reflog.test.ts:60`; the component deliberately uses `untrack` for it, `:161-165`).
- The ref is not run through `assertSafeRef` (compare `git-service.ts:159-166`) although other methods are. A ref starting with `-` could be read as an option. We must validate.

### Git commands (`git-service.ts:259-330`)
- Listing: `git reflog show <ref> --format=%H<US>%h<US>%gd<US>%gs --date=iso -n <limit+1>` (US = unit separator `\x1f`). Silent execution.
- Field parsing: split on US; `%gd` with `--date=iso` yields `HEAD@{2026-05-02 10:00:00 +0900}`, and the date is cut out of the braces. They then replace the selector with a synthetic `<ref>@{<line index>}` (`refs/heads/` and `refs/remotes/` prefixes stripped).
- Dangling probe: `git cat-file --batch-check` with the unique hashes on stdin (replaces an earlier 5000-commit walk that gave false positives, per the comment `:297-302`).
- No `fsck`, no `--lost-found`, no `git log -g`, no `git reflog expire`, no `git reflog delete`.
- Parse errors: lines are split naively; a message containing a newline (reflog subjects normally cannot) or the US char would break, but Git writes subjects single-line.

### Performance
200 per page, reload from the top each page, no streaming, no cache, the full hash list probed each time. For large reflogs (thousands) paging gets slower as the user pages deeper; search and filters only see loaded rows.

### Tests
- Webview unit tests: `webview-ui/src/components/common/__tests__/Reflog.test.ts` (502 lines, about 30 cases with fake `reflogData`): load on mount, no double fire, empty state, Load more adds 200, repoChanged reload, search, Escape handling, action filter, dangling-only, ref dropdown, relative-time buckets (minute through year, invalid, empty), action and sub-action rendering (`commit (amend)`), dangling icon, index label, context menu items, Reset and Checkout modals, Copy SHA, dropdown backdrops. `App.test.ts:436` checks that `viewMode=log` renders Reflog.
- Backend: only two integration cases in `src/git/__tests__/integration/basic.integration.test.ts:219-243` (entries exist with 40-hex hashes and the newest is a checkout; limit respected). No test for dangling detection, sub-action parsing against real Git output, worktrees, bare repos, or other refs.

### i18n
Strings `reflog.*` in `webview-ui/src/lib/i18n/{en,ko,zh}.ts` (en keys at `en.ts:305-331`): title, loading, empty, refresh, action, elapsed, subAction, resetTo, dangling, danglingTooltip, searchPlaceholder, matchCount, noMatches, filter, filterRef, filterAction, filterAll, filterDanglingOnly, loadMore, amend, and six relative-time templates. A few (`title`, `refresh`, `filter`, `dangling`) appear unused in the component.

## 3. Edge cases and safety

What Git Graph+ does or ignores:
- **Worktrees:** not handled. It runs in the selected repo's folder, so `HEAD` is whichever worktree it was opened in. The `HEAD` reflog is per-worktree (**[verify]** it is `logs/HEAD` in that worktree's private git dir); branch reflogs (`refs/heads/*`) are shared in the common git dir. Therefore a linked worktree's HEAD reflog is not visible from the main worktree's HEAD reflog, but a branch's reflog is seen from both. Our product already has worktree discovery (W-series), so the tab should say which worktree's HEAD it shows.
- **`core.logAllRefUpdates`:** not handled. It defaults on for non-bare repositories and off for bare ones; set to `false` or absent, no reflog exists, which Git Graph+ shows as an "empty" list. Bare repos: no HEAD reflog by default **[verify]**. Detached HEAD: `HEAD` reflog still works; the "checkout: moving from X to <hash>" lines exist.
- **Expired entries:** `gc.reflogExpire` (default 90 days) and `gc.reflogExpireUnreachable` (30 days); older entries are gone and cannot be shown. Objects are removed after `gc.pruneExpire` (2 weeks default) once nothing references them, which is why the real "recoverable until gc" window is bounded. The tab should say so (a short hint in the empty state and in the dangling help).
- **Localized messages:** reflog subjects are written by Git as fixed English strings (`commit:`, `checkout: moving from`, `rebase (finish):`) and are not run through gettext **[verify with `LANG=de_DE.UTF-8` in a fixture]**; messages produced by other tools (IDE Git extensions, scripts that set `GIT_REFLOG_ACTION`, `git pull` wrappers) are arbitrary text. So classification must be tolerant: known prefixes get a type, everything else is "other" with the raw text. Older Git writes `rebase -i (pick)`; newer writes `rebase (pick)`, so patterns need an optional `-i`. `pull --rebase` writes `pull --rebase (start)` style subjects **[verify]**. `git-reflog` in Git 2.46+ also has `git reflog list`.
- **Recovery without data loss (what Git Graph+ lacks):** their Reset default is `hard`, which discards uncommitted work and moves the branch; the only protection is the modal. A safer model: recover by creating a branch (or tag) at the entry's commit, which never moves anything and removes the "will gc" risk; offer checkout (detached, with the same dirty-tree handling already in our product) and reset only with the existing Reset dialog and its confirmations.
- **Hash validity:** an entry whose object is missing cannot be recovered; disable the actions on it and say why.

## 4. Git Graph Libre today

### Settings that surface reflog-only and unreachable commits
- `git-graph-libre.repository.includeReflog` (`package.json:507-511`) adds `--reflog` to the `git log` tip set (`src/backend/queries/loadCommits.ts:273`), so commits reachable only through a reflog appear in the graph.
- `git-graph-libre.repository.includeUnreachableCommits` (`package.json:512-516`) runs `git fsck --unreachable --no-reflogs --no-progress --connectivity-only` and feeds the dangling/unreachable commit hashes to `git log` as extra tips (`loadCommits.ts:324-346`, parser `:300ff`). Only for unfiltered loads (`refs === null`).
- Both are repo-level view toggles in the settings popup (`src/webview/settingsWidget.ts:21-22, 131-132`; `src/webview/main.ts:122-123, 1559-1560, 1996-2036, 2143-2147, 6835-6894`) and are passed with the load request. The engine declines both (`src/backend/engine/index.ts:464-465` passes them through to the decline check; KB non-goals file).
- Note the gap: these settings put those commits in the graph with no hint of why they are there, no list of reflog entries, and no per-entry date or action. A Reflog view would explain them.

### Views and tabs
- The main graph is a single webview (`src/webview/main.ts`, class `GitGraphView`, ~8000 lines) with a settings popup that has tabs (`settingsWidgetTab`: repository / extension / contributors, `main.ts:584, 1985-1989`). It has no Graph/Reflog/Stats view switcher.
- Secondary views today: the GGL Diff tab, a separate `WebviewPanel` in an editor column (`src/extension/diffTab/diffTabPanel.ts:47`, view type `git-graph-libre.diffTab`, `retainContextWhenHidden: true`), with its own webview bundle under `src/webview/diffTab/` and its own HTML builder (`diffTabHtml.ts`). Also `src/webview/worktreeList.ts`, a worktree list that reads from the same view.
- This is the closest existing pattern for a Reflog surface: a separate panel with its own small bundle, opened from the graph.

### Message handler and backend layout
- Messages: `src/extension/messageHandler.ts` registers `bridge.onMessage("<command>", ...)` (for example `loadCommits` at `:951`, `loadRepoInfo` at `:1063`) and posts replies through `bridge.post({ command, requestId, ...result })`, so replies carry a request id (better than Git Graph+).
- Queries: one file per read in `src/backend/queries/` (`worktrees.ts`, `loadCommits.ts`, `stashes.ts`, ...) using `runGitRaw` (`src/backend/utils/gitRunner.ts`) and a result shape of `{ value, error }` with `toGitQueryError` (see `worktrees.ts` head). Types in `src/backend/types/queries.types.ts`. Actions (writes) in `src/backend/actions/*.ts`.
- Tests: `tests/backend/queries/`, `tests/backend/actions/`, `tests/webview/`, `tests/extension/`; fixtures built with temporary real repositories (see the worktree slices' "temporary fixtures only" rule).
- l10n: five bundles `l10n/bundle.l10n.{json,nl,pl,zh-cn,zh-tw}.json` (`l10n:check` at 100%), webview strings via `src/extension/webviewL10n.ts`; `package.nls*` for contributes.

### Could the Rust engine serve a reflog read later?
- The engine is built on gix (`engine/native/core/src/*.rs`), and gix can read reflogs (`gix::Reference::log_iter`, reverse iteration, no process spawn). A reflog read is technically possible.
- The KB non-goal is narrow: the engine declines `repository.includeReflog` reflog TIPS in `loadCommits` and `includeUnreachableCommits`. A separate Reflog list is a new read (a new query), not a change to those two settings, so it does not collide with the non-goal text. It must still obey the design rules: (1) map into this project's types, (2) CLI is the default with the engine as an optimization, (3) a cross-backend parity test per read, (4) no user-visible change when the engine is turned on.
- Recommendation: ship the CLI implementation first (the reflog is small, `-n` bounded, so the speed gain is low), and open an engine slice only if profiling shows a need. Say so in the KB so nobody reads "includeReflog is declined" as "reflog is forbidden in the engine". If a read is later added, `git cat-file --batch-check` becomes an object-existence lookup in gix. Open question: gix's reflog parsing of malformed lines vs Git's; parity tests would have to cover that.

## 5. Slice plan for Git Graph Libre (temporary IDs F1-01 ...)

Common rules for every slice (from the KB): tests with the behavior; strict Biome; colors in OKLCH through `--ngg-*` tokens with VS Code theme tokens first; American English; l10n keys in all five bundles with `l10n:check` at 100%; every write on the Git CLI (`runGitRaw`); the CLI is the default and any engine read needs a parity test; the KB updated as the work lands (`pnpm run kb:index`); the integrator procedure applies.

Dependence summary: F1-01 -> F1-02 -> F1-03 -> (F1-04, F1-05, F1-06 can run in parallel) -> F1-07; F1-08 is an independent branch after F1-01; F1-09 optional.

### F1-01 Reflog read query on the CLI (backend only)
- **Goal:** one read-only query that lists a ref's reflog entries, bounded and typed, plus a pure parser for message classification.
- **Behavior:** none visible yet.
- **Touch:** new `src/backend/queries/reflog.ts` (query and `classifyReflogMessage`), `src/backend/types/queries.types.ts` (types `GitReflogEntry`, `GitReflogResult`), `src/backend/queries/index` exports, `tests/backend/queries/reflog.test.ts`, KB section.
- **Git:** `git reflog show <ref> --format=<%H, %gd, %gs, %gn?, %ct> -z --end-of-options` is not valid for reflog show **[verify]**, so use `git log -g --format=... -z -n <limit+1> <ref> --`; hash, selector index (from `%gd` without `--date`, giving `HEAD@{N}`), UNIX time through `%ct` (committer time of the commit is NOT the reflog time; the reflog timestamp comes from `%gd` with `--date=unix` or `%gt`/`--date=unix` **[verify exact placeholder]**). Parse `-z` NUL records, not newlines. Validate the ref (reject a leading `-`; verify it resolves with `git rev-parse --verify --quiet`). Use `git reflog exists` to tell "no reflog" from "empty". Reads `core.logAllRefUpdates` only to word the empty state.
- **Message classification:** a pure function returning `{ kind, sub, raw }` with an open set of kinds (commit, checkout, reset, rebase, merge, pull, fetch, cherry-pick, revert, branch, stash, clone, other). Tolerates `rebase -i (pick)` and unknown text, never throws.
- **Tests:** unit tests of the classifier with a table of real Git subjects (captured by running Git in a fixture, not typed from memory); real-Git fixture repos for: plain commits, amend, rebase pick/squash/abort, merge ff and no-ff, checkout, reset, cherry-pick, revert, detached HEAD, a linked worktree (HEAD reflog is per worktree, branch reflog shared), `core.logAllRefUpdates=false` (no reflog), a bare repo, an expired entry (`git reflog expire --expire=now` in the fixture), `LANG=de_DE.UTF-8` run (subjects stay English), a ref starting with `-` rejected.
- **l10n:** none.
- **Depends:** none.
- **Size:** about 300 lines plus tests (about 300).
- **Risks:** exact placeholders for reflog timestamps; the format of subjects across Git versions (supported minimum Git version must be checked); a malicious ref name (option injection).

### F1-02 Object existence and "recoverable" state
- **Goal:** tell for each entry whether its commit still exists and whether it is reachable from a branch/tag/remote, so the view can mark "only in the reflog" rows and disable impossible actions.
- **Behavior:** none visible yet (data only).
- **Touch:** extend `reflog.ts` (second function `classifyReflogReachability`), types, tests.
- **Git:** `git cat-file --batch-check` on stdin (missing / type), and reachability through one `git rev-list --no-walk` is not enough; use `git for-each-ref --contains <hash>` per hash only for visible rows (bounded to the page), or one `git rev-list <hashes> --not --branches --tags --remotes` to list commits not reachable from refs **[verify semantics]**. Keep it page-bounded.
- **Tests:** fixture: `reset --hard` leaves a commit that is only in the reflog (state "reflog only"); `branch -D` the same; a gc'd commit (`reflog expire`, `gc --prune=now`) is "missing"; a reachable commit is "reachable".
- **l10n:** none.
- **Depends:** F1-01. **Size:** about 150 lines plus tests.
- **Risks:** cost on big repos; stay bounded to one page and measure.

### F1-03 The Reflog surface (read-only view)
- **Goal:** a place to see the reflog. Surface choice is RQ1; the plan below assumes the recommended option (a dedicated editor-tab panel like the GGL Diff tab).
- **Behavior:** command "Git Graph Libre: Show Reflog" and a toolbar button on the graph open a Reflog tab for the selected repository. Columns: #, action (colored dot plus label), sub-action tag, message, short hash, relative time (tooltip with full date). Loading, empty ("No reflog. Git does not keep one when `core.logAllRefUpdates` is off, and old entries expire"), and error states (a real error, distinct from empty). Paging by "Load more" that requests only the next slice (offset-based) instead of reloading from the top.
- **Touch:** `src/extension/reflogTab/*` (panel and HTML, modeled on `diffTab/diffTabPanel.ts`), `src/webview/reflogTab/*` (small bundle), `package.json` (command, contributes), `package.nls*`, `src/extension/messageHandler.ts` or a dedicated panel handler (request id replies), `src/extension/webviewToolbar.ts` (button), esbuild/bundle config, l10n bundles, styles using `--ngg-*` tokens, CSS regression test per the styling guide.
- **Git:** F1-01 and F1-02 queries; offset paging through `--skip` **[verify with -g]**.
- **Tests:** webview tests (rendering, states, paging, request-id race), extension test (command registered, panel reveal and reuse), backend handler test, CSS token test; no hard-coded colors.
- **l10n:** about 25 keys in all five bundles.
- **Depends:** F1-01, F1-02. **Size:** about 450 lines outside tests (the biggest slice; split by F1-03a read-only panel shell and F1-03b columns if needed).
- **Risks:** a new webview bundle adds build and CSP surface; keeping the panel in sync with repository changes (file watcher already exists: `repoFileWatcher.ts`).

### F1-04 Color-coded actions and sub-actions
- **Goal:** the semantic coloring, with our own palette.
- **Behavior:** action dot colors per kind; sub-action tags grouped by intent (edit, combine, integrate, flow, abort); unknown values get a neutral tag; colors in OKLCH tokens that read in light, dark and high-contrast themes.
- **Touch:** the reflog webview styles, tokens in the shared styles, a contrast/regression test.
- **Tests:** classifier-to-class mapping table test; CSS test that no raw hex appears; theme-token test.
- **l10n:** labels for each sub-action ("amend", "squash", ...) in five bundles.
- **Depends:** F1-03. **Size:** about 120 lines plus tests.
- **Risks:** color accessibility; localizing words that Git itself writes in English (show the localized label, keep the raw text in the tooltip).

### F1-05 Search and filters
- **Goal:** search text, action filter, ref picker (HEAD, local branches, remote branches, `refs/stash`, tags if they have reflogs), and an "only in reflog" toggle.
- **Behavior:** the ref picker changes the query (server-side). Text and action filters are applied to the whole reflog on the extension side (a filter over the full list is bounded to a configurable cap, say 5000 entries, with a visible "searched the newest N" notice), not just the loaded page as Git Graph+ does.
- **Touch:** reflog query (add `grep` over `%gs`, using `--grep-reflog=<pattern>`, which is a real `git log -g` option **[verify]**, with `-F` and `-i` to avoid regex surprises), the reflog webview, tests.
- **Tests:** fixtures for grep and for filtering across more than one page; stash reflog; special characters in the search text.
- **l10n:** about 10 keys.
- **Depends:** F1-03; F1-02 for the toggle. **Size:** about 250 lines plus tests.
- **Risks:** `--grep-reflog` combined with `-n`; user text must never reach Git as an option.

### F1-06 Entry actions that cannot lose data
- **Goal:** recover from a reflog entry safely (decisions RQ3, RQ4).
- **Behavior (recommended set):** "Create branch here..." (default and first item; never moves HEAD), "Create tag here...", "Checkout (detached)", "Copy hash", "Show in graph" (reveals the commit in the main graph when reachable, or enables `includeReflog` for the view; else says why not), "Reset current branch to this..." (reuses the existing reset dialog, soft and mixed first, hard needs the existing second confirmation naming what is lost). Missing objects disable every action with an explanation.
- **Touch:** `src/backend/actions/branch.ts` / `tag.ts` reuse, new thin reflog action wiring, `src/extension/messageHandler.ts`, webview menu, existing dialogs, tests.
- **Git:** `git branch <name> <hash>`, `git tag <name> <hash>`, `git checkout --detach <hash>`, `git reset --soft|--mixed|--hard <hash>`; no new writes beyond those already in the product.
- **Tests:** real-Git fixtures that make a commit unreachable (hard reset) and recover it through each action; a dirty working tree with checkout; the missing-object case; assertions that no recovery action changes refs except the intended one.
- **l10n:** about 15 keys.
- **Depends:** F1-03; F1-02 for the disabled state. **Size:** about 300 lines plus tests.
- **Risks:** this is where data loss could happen; reset must keep today's confirmations; "show in graph" must not force a heavy reload.

### F1-07 Unreachable-commit scan (fsck, opt-in)
- **Goal:** find commits that are in no reflog and no ref (true dangling), which the reflog cannot show, and offer recovery.
- **Behavior:** a "Scan for lost commits..." button that runs the same read-only scan the graph setting uses, lists dangling commits with subject and date, and offers "Create branch here". Clear wording that these disappear on gc.
- **Git:** `git fsck --unreachable --no-reflogs --no-progress --connectivity-only` (already in `loadCommits.ts:333-338`); then `git show -s --format=...` per hash. Never `--lost-found` (it writes into `.git/lost-found`), never `git gc` or `prune`.
- **Touch:** reuse `parseUnreachableCommitHashes`, a new query, the reflog webview, tests with a fixture holding a dropped stash and an abandoned commit.
- **l10n:** about 10 keys.
- **Depends:** F1-03, F1-06. **Size:** about 250 lines plus tests.
- **Risks:** `fsck` cost on large repositories (needs a progress indicator, cancel and a timeout); stash drop commits appear here.

### F1-08 Worktree and repository awareness
- **Goal:** make the view correct for worktrees, bare repositories and a repository change.
- **Behavior:** the header names the worktree whose HEAD is shown; a picker for the other worktrees' HEAD reflogs (uses `git -C <path> log -g ...`); bare repositories show branch reflogs and a note; when the selected repository changes or closes the panel follows or closes; handles for the engine do not leak (design rule 5).
- **Touch:** reflog query context, `src/extension/worktreeDiscovery.ts` reuse, repo manager hooks, tests.
- **Tests:** a fixture with a main and a linked worktree whose HEAD reflogs differ; a locked or stale worktree; bare repo fixture.
- **l10n:** about 8 keys.
- **Depends:** F1-03. **Size:** about 200 lines plus tests.
- **Risks:** the per-worktree reflog location differs between Git versions **[verify]**; stale worktree entries.

### F1-09 Optional: serve the reflog read from the engine
- **Goal:** read reflog entries with gix when the engine is active.
- **Behavior:** none visible; CLI remains the default.
- **Touch:** `engine/native/core` (new reflog read), `src/backend/engine/*`, parity test.
- **Tests:** cross-backend parity over every fixture of F1-01 (identical entries, classifier input and order), plus the missing-object and expired cases.
- **Depends:** F1-01, F1-02; only after profiling shows value. **Size:** about 300 lines Rust plus 150 TypeScript.
- **Risks:** gix parse differences; adds to the engine surface; skip unless needed (RQ6).

### Not planned (and why)
- A Statistics tab or a Graph/Reflog/Stats switcher: out of scope; the Reflog surface decision (RQ1) does not need one.
- Settings for the Reflog tab: none needed at first; the page size and the cap are constants documented in the KB (RQ7).
- `git reflog expire`/`delete` from the UI: destructive and rarely wanted; leave to the terminal.

## 6. Decisions the maintainer must make

**RQ1. Where does the Reflog live?**
- (a) A dedicated editor-tab webview panel like the GGL Diff tab, opened by a command and a toolbar button. Pros: no change to the 8000-line graph view; own bundle; can sit beside the graph; reuses a proven pattern. Cons: another bundle; the graph and reflog are not one switchable area.
- (b) A view mode inside the graph webview (the Git Graph+ way, a toolbar toggle). Pros: familiar; one webview. Cons: `GitGraphView` is huge; the graph's state has to survive the switch.
- (c) A section in the existing repository settings popup or a panel inside the graph. Cons: too cramped for a table.
- **Recommendation: (a).**

**RQ2. Which Git command is the source: `git reflog show` or `git log -g`?**
- `git log -g` with `-z` and an explicit `--format` gives clean NUL-separated records, supports `--grep-reflog` and `--skip`, and is the documented base of `reflog show`.
- **Recommendation: `git log -g -z`, pinned by fixtures against the minimum supported Git.**

**RQ3. Which recovery actions ship?**
- Options: (i) only copy hash and checkout; (ii) add create-branch and create-tag (non-destructive); (iii) add reset; (iv) add fsck scan.
- **Recommendation: (ii) first (F1-06 minus reset), then reset reusing the existing dialog, then the fsck scan as a separate opt-in slice (F1-07).** Create-branch is the primary recovery path.

**RQ4. Is Reset offered from a reflog row, and what is its default mode?**
- Git Graph+ defaults to hard. Options: hard default; mixed default; no default, require choosing; omit.
- **Recommendation: offer it, default mixed (no work discarded), and require the existing second confirmation naming lost changes for hard.**

**RQ5. What does "dangling" mean in our UI?**
- (a) Object missing (their meaning; rarely fires; can't recover). (b) Reachable only through the reflog ("only in reflog", the recoverable case). (c) Both as separate badges.
- **Recommendation: (c), with the wording "Only in the reflog" and "Object no longer exists".** Do not copy the inaccurate "unreachable, right-click Reset to recover" tooltip.

**RQ6. Read through the Rust engine?**
- Options: CLI only; engine later with parity tests; engine at launch.
- It does not collide with the non-goal (which names `includeReflog` tips and `fsck`), but the reflog is small and bounded, so the speed gain is low.
- **Recommendation: CLI only now, record in the KB that a separate reflog read is allowed, revisit only with measurements (F1-09).**

**RQ7. Limits and settings.**
- Page size (200 like Git Graph+, or 100), the search cap (suggest 5000), whether to add settings (`reflog.pageSize`) or keep constants.
- **Recommendation: constants for now (page 200, search cap 5000), no new settings; add one if users ask.**

**RQ8. Which refs can be listed?**
- HEAD and local branches only (Git Graph+); plus remote branches and `refs/stash`; plus other worktrees' HEADs.
- **Recommendation: HEAD, local branches, `refs/stash`, and other worktrees' HEADs; skip remote-tracking reflogs at first (they record fetches, little value).**

**RQ9. Relationship to the `includeReflog` / `includeUnreachableCommits` settings.**
- Options: leave as they are; add a "Show in graph" link from reflog rows; make the tab turn them on automatically.
- **Recommendation: leave them as is; "Show in graph" reveals the commit if the graph already has it, otherwise offers to enable `includeReflog` for the repository (with a visible note), never silently.**

**RQ10. Release placement and naming.**
- Which release (is this 1.11.0 or a later one), whether to keep temporary IDs F1-xx or take W-style IDs, and whether this is the next theme after the worktrees.
- **Recommendation: a themed release after 1.10.0; the integrator assigns final IDs and writes the slice files in the KB register with the decision table (keep triage in the KB, not GitHub labels).**

## 7. Open facts to verify in F1-01 (marked [verify] above)

1. The `%gd`/`%gt`/`%gs` placeholders and `--date=unix` for reflog time under `git log -g -z`, and that `--skip` works with `-g`.
2. `--grep-reflog` behavior with `-F`, `-i` and `-n`.
3. Whether reflog subjects stay English under a non-English `LANG`/`LC_ALL`.
4. Exact subjects for `pull --rebase`, `rebase -i`, `stash`, `update-ref`, `merge --squash`, `cherry-pick` with `-x`, across the minimum supported Git.
5. Per-worktree location of the HEAD reflog and that branch reflogs are shared.
6. Bare repository default for `core.logAllRefUpdates` and what `git reflog exists` returns.
7. The cheapest bounded reachability check for a page of hashes.
