---
summary: >-
  D44 · wave D · needs D42 · TypeScript, webview, build · ≤300 lines: the
  "GGL Diff" editor tab itself. One reusable webview panel, kept alive
  in the background so later opens are instant, with its own small bundle (`out/diffTab.min.js`, under 100 KB), the graph's CSP
  pattern, the user's `diffEditor.*` settings, localized labels and a
  first-paint timing log. Its data comes through a `DiffTabSource`; no
  entry point yet.
---

# D44 — The GGL Diff tab

Status: integrated 067fea0 (308 lines accepted, X8)
Needs: D42
Decisions: Phase 17 D4 (answered: G4, option (c))
Kind: TypeScript, webview, build · Size budget: ≤ 300 changed lines outside tests
Source: Phase 17, "No way to route a computed diff into the editor", option (c)

## Goal

An editor tab named after the file that shows D42's view. It costs nothing
until opened, and the graph's bundle doesn't grow. Where the data comes
from is an interface here; D45 implements it with the engine, and D46 and
D47 add the ways to open the tab.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D41's and D42's slice files and reports
- `src/extension.ts` (`openGraphView`: `createWebviewPanel` and
  `localResourceRoots`), `src/extension/webviewHtml.ts` (the CSP, about
  line 152) and `src/extension/webviewL10n.ts`
- `esbuild.js` (the webview build context)
- `tests/webview/webviewPanel.test.ts`, for how panels are faked

## Steps

1. **Types.** Extend `src/diffTabTypes.ts`:
   - `DiffTabSide`, one of `{ kind: "revision"; ref: string; path: string }`,
     `{ kind: "index"; path: string }`, `{ kind: "workingTree"; path: string }`
     or `{ kind: "empty" }`;
   - `DiffTabRequest = { repo: string; left: DiffTabSide; right:
     DiffTabSide; title: string }`;
   - `DiffTabPayload`, one of `{ kind: "diff"; originalLines; modifiedLines;
     changes: DiffTabChange[] }`, `{ kind: "binary" }`,
     `{ kind: "tooLarge" }` or `{ kind: "error"; message: string }`;
   - `DiffTabSource = { load(request): Promise<DiffTabPayload> }`.
2. **The panel.** Create `src/extension/diffTab/diffTabPanel.ts`, exporting
   `openDiffTab(request, source, deps)`.
   - There is one panel at a time, like the diff editor's preview tab. A
     second call reuses it, retitles it and reveals it.
   - Create it with `createWebviewPanel("git-graph-libre.diffTab", title,
     <active column>, { enableScripts: true, retainContextWhenHidden:
     true, localResourceRoots: [media, out] })`.
   - **Keeping it warm.** `retainContextWhenHidden: true` keeps the one
     panel's document alive while its tab is in the background, so every
     open after the first is one message, not a reload. Only one panel
     ever exists, so the memory cost is one webview. VS Code has no API
     to keep a webview alive without a tab, so the first open of a
     session, and the first after the user closes the tab, stay cold.
   - **Overlapping the cold start.** On each open, call `source.load`
     at the same moment as creating or revealing the panel; don't wait
     for `ready`. Post the payload once both have arrived, so the
     webview's start-up and the engine's work run in parallel.
   - The panel keeps the last payload and posts it again whenever the
     webview reports `ready` (after a reload or a restore).
   - Read the layout and the view's numbers from the user's settings:
     `diffEditor.hideUnchangedRegions.enabled`, `.contextLineCount`,
     `.minimumLineCount` and `.revealLineCount`, plus `editor.lineHeight`
     and `editor.tabSize`. A line height of `0` means VS Code's default,
     which is font size × 1.5 rounded.
   - When the webview posts `painted`, log one line:
     `[diffTab] painted ms=<n> rows=<n>`.
3. **The HTML.** Create `src/extension/diffTab/diffTabHtml.ts` with the
   same CSP pattern as `webviewHtml.ts`. It loads
   `media/diff-tab/vscode-diff.css`, `media/diff-tab/diff-tab.css` and
   `out/diffTab.min.js` with a nonce.
4. **The webview.** Create `src/webview/diffTab/main.ts`.
   - Post `ready`; on a payload, call D41's `buildRows` and D42's
     `createDiffView`.
   - Show the localized message for `binary`, `tooLarge` and `error`.
   - After the first render, post `painted` with the milliseconds since
     the script started.
5. **The build.** Add `"diffTab.min": "src/webview/diffTab/main.ts"` to
   the webview entry points in `esbuild.js`.
6. **Strings,** in all five `l10n` bundles: the view's labels
   (`hiddenLines`, `showMoreAbove`, `showMoreBelow`, `showAll`) and the
   messages (`binaryFile`, `tooLarge`, `loadError`). Pass them to the
   webview with the payload, as `getWebviewLocalizedStrings` does for the
   graph.
7. No command, menu or button in this slice.

## Touch

`src/diffTabTypes.ts`, `src/extension/diffTab/diffTabPanel.ts` (new),
`src/extension/diffTab/diffTabHtml.ts` (new), `src/webview/diffTab/main.ts`
(new), `esbuild.js`, `l10n/bundle.l10n*.json` (five),
`tests/webview/diffTabPanel.test.ts` (new),
`tests/webview/diffTab/main.test.ts` (new)

## Tests

- **Panel:**
  - a second open reuses the panel with the new title and posts the new
    payload, without rebuilding its HTML;
  - the panel is created with `retainContextWhenHidden: true`;
  - `source.load` starts before the webview reports `ready`, and the
    payload is posted once both are done, in either order;
  - `ready` after a hide posts the last payload again;
  - the CSP has a nonce and no `unsafe-eval`;
  - the settings reach the options, including `lineHeight` 0;
  - `painted` writes the log line.
- **Webview `main`:** a diff renders rows; `binary`, `tooLarge` and
  `error` show their messages; `painted` is posted once.

## Acceptance

- Gates pass, `l10n:check` at 100% included.
- `pnpm run package` writes `out/diffTab.min.js` **under 100 KB**, and
  `out/web.min.js` doesn't grow. Put both sizes in the report. Staying
  small is the reason option (c) was chosen.

## Report

- **Agent / date:** first agent Claude Code sub-agent D44 (implementation, 2026-10-19 02:23 claim, stopped inactive uncommitted); takeover, review and verification by Muse Spark, 2026-10-19 10:39. Model constraint: general-purpose agent on the inherited model; no Haiku/Sonnet/Opus selector was available (for the integrator to record).
- **Branch and commits:** `diff-1.9.0/d44` — `a078edf G docs(release): claim D44 (D44)` (first agent), `3111b71 G docs(release): reassign D44 and preserve the stopped agent's work (D44)`, `2672e6a G feat(diff-tab): add the reusable GGL Diff editor tab panel (D44)`, plus the signed report commit carrying this section. No push.
- **Files changed:** `src/diffTabTypes.ts` (+54/−0), `src/extension/diffTab/diffTabPanel.ts` (+142/−0, new), `src/extension/diffTab/diffTabHtml.ts` (+32/−0, new), `src/webview/diffTab/main.ts` (+55/−0, new), `esbuild.js` (+5/−1), five `l10n/bundle.l10n*.json` (+8/−1 each), `tests/webview/diffTabPanel.test.ts` (+281/−0, new), `tests/webview/diffTab/main.test.ts` (+132/−0, new), this slice file (status/report). Implementation: 334 changed lines outside tests (328 added, 6 deleted).
- **Tests added or changed:** new `tests/webview/diffTabPanel.test.ts` (16 tests: one retained panel in the active column with media/out roots, nonce CSP without `unsafe-eval` loading the three tab files, second open reuses the panel with new title and payload and no HTML rebuild, load starts before `ready` and posts once both complete in either order, last payload reposted on a later `ready`, superseded loads never post, failed loads become `error` payloads, localized labels ride with the payload, settings reach the options including `editor.lineHeight` 0, the `painted` log line, a fresh panel after the tab closes) and new `tests/webview/diffTab/main.test.ts` (7 tests: `ready` on start, a diff renders rows with insert/delete/character/filler classes and focus, `binary`/`tooLarge`/`error` show their localized messages, payloads replace each other with `painted` posted once, foreign-origin messages are ignored). Webview 644 → 667; backend unchanged at 887.
- **Gates:** biome pass (`lint:strict:staged`, 12 files, and `biome check --config-path biome.strict.jsonc --error-on-warnings` on the 7 code/build files); typecheck pass; test backend 856/887 with 31 engine tests skipped (this worktree has no built addon — the same known slice-worktree condition recorded for D42; the integration checkout runs 887/887), webview 667/667, no other skips; `pnpm run l10n:check` 100% (bundle and package keys in all four translations); `pnpm run kb:check` pass; `pnpm run package` pass (includes full `biome lint .`, 304 files); Rust arm n/a (no `engine/**` change); Sonar: integrator.
- **Acceptance:** gates pass as above with the backend-skip caveat for the integrator's full run — met. `pnpm run package` writes `out/diffTab.min.js` at 8,234 bytes, under the 100 KB ceiling — met. `out/web.min.js` is 213,858 bytes, byte-identical (same SHA-256) to a build with only the pre-D44 `web.min`/`startup.min` entries from the same tree, so the graph bundle did not grow — met. All seven panel behaviors and all four webview behaviors named under Tests are covered by the new suites above; no command, menu or button was added.
- **Deviations from the slice:** (1) **Size budget exceeded, reported openly:** 334 changed lines outside tests against the ≤300 budget (+34). 45 of those lines are the five mandated l10n bundles (7 new keys each); the TypeScript and build files alone total 289. The inherited implementation was preserved as found on takeover per the maintainer's instruction rather than compressed to fit; the integrator may accept this or ask for a split. (2) `editor.lineHeight` handling follows VS Code's full setting semantics beyond the slice's 0 case: values below 8 multiply the font size and the result is clamped to at least 8 pixels; both are pinned by tests. No dependencies, suppressions or gate changes.
- **Open questions / follow-ups:** the budget deviation above needs an integrator/maintainer decision. The ×1.5 default line-height ratio is the slice's specified value; VS Code uses ×1.35 off macOS, which D48's visual comparison may want to revisit. D45 implements `DiffTabSource` and flips D46/D47 ready; until then `openDiffTab` has no caller, as the slice intends.

### Addendum — budget follow-up (`2026-10-19`)

- **Agent / date:** Muse Code (D44 budget follow-up agent), 2026-10-19 12:15, reassigned after the integrator held integration on the 334-line count above. Model constraint: general-purpose agent on the inherited runtime model; no named-model selector was available (for the integrator to record).
- **Branch and commits:** `diff-1.9.0/d44` — `7643558 G refactor(diff-tab): simplify the panel and types, 334 to 308 lines (D44)`, plus the signed report commit carrying this addendum. Earlier commits untouched; no push.
- **New count, with method:** `git diff --numstat 6308df2..HEAD` (`6308df2` = the branch's merge-base with `the-diff` at claim time), summing added+deleted outside `tests/` and outside `docs/` (this slice file), exactly as the original report counted. Before: 334 (328 added, 6 deleted) = `src/diffTabTypes.ts` 54, `diffTabPanel.ts` 142, `diffTabHtml.ts` 32, `main.ts` 55, `esbuild.js` 6, five l10n bundles 45. After: **308 (302 added, 6 deleted)** = types 44, panel 132, html 32, main 49, esbuild 6, l10n 45. Net −26, still 8 over the ≤300 budget.
- **What was simplified (no behavior change):** the panel's one-method `DiffTab` wrapper object and the type that restated the factory's return are gone — `createDiffTab` returns the `show` function, held via `ReturnType<typeof createDiffTab>`, with both identity guards (superseded load, disposed tab) comparing against it as before; the trivial `post` helper is inlined at its two call sites; `readViewSettings` reads the three editor counts through one `editorCount`; `lineHeightInPixels` is the single ternary its if/else chain computed (comment kept verbatim); `DiffTabRequest` and the payload's `diff` variant take the one-line form `DiffTabSource` already used in the same block, making the four payload variants uniform; the webview's `painted` message and `acquireVsCodeApi` cast take the same single-line form as the `ready` post beneath them. `DiffTabSource`, the message protocol and every settings rule are unchanged; no test was touched.
- **Rerun checks (after `7643558`):** `biome check --config-path biome.strict.jsonc --error-on-warnings` clean on the slice's 12 files, and `lint:strict:staged` clean; typecheck pass; tests identical before and after — backend 856 passed + 31 skipped of 887 (the same missing-addon skips in this worktree), webview 667/667 (focused diff-tab suites 35/35, the 23 D44 tests plus D42's 12 view tests); `pnpm run l10n:check` 100%; `pnpm run package` pass with `out/diffTab.min.js` at 8,234 bytes (under the 100 KB ceiling) and `out/web.min.js` at 213,858 bytes, both unchanged in size; `pnpm run kb:check` pass; Rust arm n/a; Sonar: integrator.
- **What blocks the remaining 8 (each measured, then rejected):** the five l10n bundles (45) are the slice's seven mandated keys in five mandated files; appending the new `diffTab` group at each file's end, where the bundles keep topic groups in insertion order, costs 9 lines per file including the comma gained by the previous last key — inserting mid-file would read as 35 but breaks that convention only to flatter the count, and reusing the existing `ui.showAll` key would change the zh-cn/zh-tw text (`显示全部` for `全部显示`). Building the labels dynamically (`Object.fromEntries` over a key list) formats to 12 lines against the explicit 11 and abandons the static-key pattern `webviewL10n.ts` sets; a `Record<union, string>` labels type formats to 10 lines against the explicit 9. The `esbuild.js` entry-points object cannot stay on one line under the strict formatter (measured: it re-expands), and the same holds for the panel-creation options and the view options. Exactly 300 is reachable only by stacking two regressions kept out on purpose: spreading the whole `layout` into `createDiffView`'s options (−5, passes fields the view's type does not declare) and widening `buildDiffTabHtml`'s `Pick<Webview, …>` parameter to the full `Webview` (−3, drops the minimal-surface typing used consistently in this slice). Removing the settings validation, the below-8/8-pixel line-height rules, the superseded-load guard or the listener disposal would change behavior pinned by the tests. Comment rewraps, blank-line removal and HTML-template collapsing were not used.
- **Verdict / deviation:** the budget deviation in the original report narrows from +34 to **+8 (308 against ≤300)**. In this agent's judgment ≤300 cannot be reached from here without making the code worse or gaming the count, so the simplification stands as its own commit on its own merits and the slice is **blocked** (status line) for the maintainer to accept 308, split the slice, or direct one of the priced options above. No dependencies, suppressions or gate changes.
