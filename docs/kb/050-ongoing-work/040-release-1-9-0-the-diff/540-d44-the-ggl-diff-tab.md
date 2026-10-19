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

Status: claimed by Claude Code sub-agent D44 on 2026-10-19 02:23; reassigned to Muse Spark (inherited model, no Haiku/Sonnet/Opus selector) on 2026-10-19 10:38 after the first agent stopped inactive with the implementation uncommitted — work preserved and continued
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

_(not started)_
