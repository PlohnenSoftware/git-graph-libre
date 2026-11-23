---
summary: >-
  F1-03: The Reflog tab: its own editor-tab panel and webview bundle, modeled
  on the GGL Diff tab, opened by a command and a graph toolbar button, showing
  the reflog read-only with loading, empty and error states and paging.
---

# F1-03 — Reflog tab (read-only)

Status: integrated `6a66083e`

Needs: F1-02

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

New `src/extension/reflogTab/*` (panel, HTML builder, message handling with
request ids); new `src/webview/reflogTab/*` (bundle); new `media/reflog-tab/*`
(styles); `esbuild.js` (one entry point); `package.json` and `package.nls*.json`
(the command and its menu contributions); `src/extension/commandManager.ts`
(registration); the graph toolbar button (`src/extension/webviewToolbar.ts`
and the matching webview code); `src/extension/webviewL10n.ts` or a
reflog-specific strings module; `l10n/bundle.l10n*.json`; tests under
`tests/extension/`, `tests/webview/reflogTab/` and a CSS regression test; the
slice file's Status and Report. Integrator-approved expansion at integration
(`2026-11-09`, after the agent disclosed it in its Report): `src/types.ts` and
`src/extension/messageHandler.ts` — every graph-webview message funnels
through them, so the toolbar button cannot work without them (the D47
precedent).

## Task and acceptance

- Command "Git Graph Libre: Show Reflog" and a toolbar button on the graph
  open (or reveal and reuse) a Reflog tab for the selected repository.
- Columns: index, action, sub-action, message, short hash, relative time with
  the full date on hover, and the F1-02 state ("Only in the reflog", "Object
  no longer exists"). The ref shown is HEAD for now; F1-05 adds the picker.
- States: loading; empty, explaining that Git keeps no reflog when
  `core.logAllRefUpdates` is off and that old entries expire; error, distinct
  from empty. "Load more" fetches only the next page of 200 (a constant).
- Replies carry request ids so a slow old reply never overwrites a newer one.
  The panel follows the repository's refresh (`repoFileWatcher`) without a
  full reload.
- Styles use theme tokens with `--ngg-*` OKLCH fallbacks, no raw colors; a
  CSS regression test guards that. Render the tab headlessly in light and
  dark themes as the styling guide requires, and record where the images are.
- Tests: webview rendering, states, paging and the request-id race; the
  command and panel reveal and reuse; the handler.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0) subagent, 2026-11-09 03:11. The slice names Claude Sonnet; the integrator dispatched Muse Code instead, as for F1-02.
- **Branch and commits:** `reflog/F1-03`
  - `13a248d1 G docs(kb): claim slice F1-03 (F1-03)`
  - `961dd146 G feat(reflog): shared reflog tab types and page loader (F1-03)`
  - `42d912aa G feat(reflog): reflog tab strings in all five languages (F1-03)`
  - `714f900b G feat(reflog): reflog editor-tab panel with request-id replies (F1-03)`
  - `3b74a188 G feat(reflog): loading notice ahead of each page (F1-03)`
  - `ac042f55 G feat(reflog): reflog tab webview bundle and styles (F1-03)`
  - `4dfd5df4 G feat(reflog): Show Reflog command and graph toolbar button (F1-03)`
  - `493a2b6f G test(reflog): row model paging, race and badge rules (F1-03)`
  - `526b8b0c G test(reflog): webview rendering, states and CSS rules (F1-03)`
  - `17c18008 G test(reflog): drop unused fixture imports (F1-03)`
  - `35a874be G test(reflog): panel reveal, reuse, paging and watcher refresh (F1-03)`
  - `082da5dc G test(reflog): page loader against real Git (F1-03)`
  - `54fe8516 G test(reflog): command resolution and toolbar handler routes (F1-03)`
  - `28cd0cca G test(reflog): graph toolbar carries the Show Reflog button (F1-03)`
  - the report commit that follows this text
- **Files changed:** 37 files, +1964/−13 against `22acb08` before this report. New: `src/reflogTabTypes.ts` (+102, shared types mirroring `src/diffTabTypes.ts`), `src/extension/reflogTab/{reflogData,reflogTabHtml,reflogTabPanel}.ts` (+73/+31/+178), `src/webview/reflogTab/{main,rowModel,view}.ts` (+35/+141/+152), `media/reflog-tab/reflog-tab.css` (+94), tests (+910 across 9 files). Edited: `esbuild.js` (one entry, `reflogTab.min`), `package.json` + `package.nls*.json` (the command), `l10n/bundle.l10n*.json` (17 keys × 5), `src/extension/commandManager.ts` (+69), `src/extension/messageHandler.ts` (+37, deviation below), `src/extension/webviewToolbar.ts` + `src/extension/webviewL10n.ts` (+1 each), `src/types.ts` (+6, deviation below), `src/webview/main.ts` (+5), this slice file.
- **Tests added or changed:** 46 new tests (webview project 1,014 → 1,060): `tests/webview/reflogTab/{rowModel 10, view 8, main 4, reflogTabCss 2, reflogData 6 real-Git}.test.ts`, `tests/webview/reflogTabPanel.test.ts` (9), command resolution (5) and the command-surface list in `commandManager.test.ts`, the bridge route (2) in `messageHandler.test.ts`, the toolbar button in `webviewToolbar.test.ts`. Fixtures are temporary directories only.
- **Gates:**
  - `npx vitest run --project webview` (whole project): 82 files, 1,060 passed.
  - Focused runs while building: rowModel 10, view/main/CSS 24, panel 9, reflogData (real Git) 6, commandManager + messageHandler 111, webviewToolbar 3 — all passed.
  - `pnpm run typecheck`: clean (all three `tsc` projects), re-run after the last change.
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` over all 35 touched `.ts/.js/.json/.css` files: clean (Biome's includes cover 35 of them; the schema-version note against CLI 2.6.5 is informational, as in F1-01/F1-02).
  - `pnpm run l10n:check`: 100% for nl, pl, zh-cn, zh-tw in both file sets.
  - `node docs/kb/housekeeping.mjs --check`: exit 0.
  - `node esbuild.js` and `node esbuild.js --production`: build `out/reflogTab.min.js` (5.2 KB minified).
  - Headless renders per the styling guide (PyQt6 QtWebEngine under `xvfb-run`, the real `media/tokens.css` + `media/reflog-tab/reflog-tab.css` and the built bundle fed sample pages): `/tmp/ggl-reflog-f1-03-renders/reflog-{dark-entries,light-entries,dark-empty,light-error,dark-loading}.png` with the harness (`preview.html`, `shot.py`) beside them. This environment has no image-viewing tool, so I verified them by the rendered DOM dump from Chromium (all seven columns, badges, tooltips) and by pixel analysis: dark background `#1f1f1f`, light `#ffffff`, badge and Load More button areas present in both themes, error red only in the error shot. The integrator should still eyeball the PNGs.
  - The backend project was not re-run: no backend file changed (the loader's real-Git tests run in the webview project, where the panel's vscode mock lives).
  - Sonar: integrator
- **Acceptance:**
  - Command "Git Graph Libre: Show Reflog" (`git-graph-libre.showReflog`) and a graph toolbar button (`reflogBtn`, octicon `history`) open, or reveal and retarget, the one Reflog tab for the selected repository: met. Resolution: a named known repository, else the last active one, else the only known one, else a picker; none known says so and opens nothing.
  - Columns index, action, sub-action (`classifyReflogMessage` kind/sub, dash when none), message (raw, as Git wrote it), short hash (full on hover), relative time (the graph's `formatRelativeDate`) with the full date on hover, and the F1-02 badge ("Only in the reflog", "Object no longer exists"; reachable and unknown draw nothing): met. The ref shown is `HEAD`; no picker (F1-05), no action colors (F1-04).
  - Loading (a localized notice ahead of each non-append load); empty/`none` wording explaining `core.logAllRefUpdates` off and expiry; error distinct from empty through F1-01's `state`/`error` split: met. "Load more" fetches only the next page of `DEFAULT_REFLOG_PAGE_SIZE` (200) by `offset` and appends: met, pinned by the panel test's recorded calls.
  - Replies carry request ids; the panel posts only its newest load and the webview drops older ids (and a replayed append): met, pinned at both ends. The panel runs its own `RepoFileWatcher` on the shown repository and refreshes as data over the retained document (one HTML write): met.
  - Every user-visible string in all five bundles, `l10n:check` 100%: met. The nl/pl/zh-cn/zh-tw texts are my translations, following each bundle's existing words for reflog and repository — a native review would help, none is copied English.
  - Telemetry: registering the command through `commandManager.register()` counts it under the already-declared `feature` event (`telemetry.json` declares `feature` as "a fixed identifier from the extension's own command list"), so no new event or declaration was needed and none was made; `telemetry.json` and the README are untouched. Tests pin both routes: the palette command emits exactly `{feature: "git-graph-libre.showReflog", ok: true}` (id and outcome only), and the toolbar's bridge route — a plain `bridge.onMessage` like `openDiffTab`, not `registerAction` — emits nothing. The reflog panel's own messages are postMessage between its webview and panel and touch no chokepoint.
  - Styles use VS Code theme tokens with `--ngg-*` OKLCH fallbacks, no raw literals, guarded by `reflogTabCss.test.ts`: met. Renders recorded above.
  - The handler passes the resolved binary: `createReflogSource` takes `gitPath` (`config.gitPath`, read live) and hands it to `loadReflogEntryStates`, as the `commitSignatures` handler does; the real-Git test proves the states resolve through it and stay unknown without it. Each page reads through a fresh Git instance rooted at the tab's repository, so a graph repo switch cannot redirect the retained tab's reads.
- **Deviations from the slice:**
  - Two glue files outside the Touch list, both needed to make the toolbar button work at all (every graph-webview message funnels through them; the D47 diff route set the precedent of assembling in the handler when `extension.ts` is out of reach): `src/types.ts` (+6: `RequestShowReflog` and its union entry) and `src/extension/messageHandler.ts` (+37: an injectable `openReflogTab` dep with a default assembly like `openDiffTab`, and the `showReflog` bridge route that opens only a known repository). `src/extension.ts` is untouched; the palette command's default assembly lives in `commandManager.ts` (in Touch), resolving the install path from a new optional `extensionPath` dep or `vscode.extensions.getExtension("PlohnenSoftware.git-graph-libre")`. The integrator may prefer hoisting one assembly into `extension.ts` at integration.
  - The shared message types sit in `src/reflogTabTypes.ts`, mirroring `src/diffTabTypes.ts`, rather than inside either new directory.
  - A watcher refresh reloads from offset 0 with the already-loaded row count (clamped to one bounded read of 1,000); rows past that from repeated "Load more" clicks are re-fetched by paging again. The watcher's triggers are the graph's (HEAD, index, refs), so a bare `git reflog expire` does not refresh the tab until something else moves.
  - The message column shows Git's raw subject (the action prefix repeats there); splitting it for display is F1-04/F1-05 territory and was left alone.
  - Short hashes are a fixed 7 characters (Git's default), not the `shortHashLength` setting.
- **Open questions / follow-ups:**
  - F1-04 will want the hooks already in place: `data-kind` on the action span, `.reflog-badge-{reflogOnly,missing}` classes, and the label set. F1-05's picker needs the loader's hardcoded `HEAD` (`reflogData.ts`) opened up and a ref field on the webview's load messages. F1-08: the panel keeps its repository until retargeted or closed — it does not yet follow graph repo switches or close when its repository is removed.
  - The renders want a human look (see Gates); the maintainer's visual check of the real tab in VS Code is still the deciding one.
