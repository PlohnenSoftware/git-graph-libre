---
summary: >-
  W06F · wave A · ready · CSS + webview · ~120 lines: Y13 re-answered by the
  maintainer (`2026-11-05`). Clicking anywhere on a checkbox's row toggles it
  in every popup, not only modal dialogs, through one shared row pattern
  that every popup uses: the dialogs, the Settings popup's boolean editors
  (bare inputs today) and any other popup checkbox row. W06's dialog rule
  moves onto that shared pattern.
---

# W06F — Whole-row checkboxes in every popup

Status: done — awaiting integration
Needs: W06 (integrated `af7ff04`)
Decisions: Y13, re-answered `2026-11-05`: every popup, implemented once at
the shared popup level
Kind: CSS and webview · Size budget: ~120 changed lines outside tests
Source: issue #41; the maintainer, `2026-11-05`: "please make sure its
implemented generally in all popups (ideally in popup class level) not only
in popup mentioned as example"

## Goal

The whole row of any checkbox in any popup is its click target. It is
built once, as a shared row pattern (a class with its CSS, and native
`<label>` semantics), that every popup's checkbox row uses. It is not a
per-popup patch.

## Facts (checked `2026-11-05`, `the-worktrees` at `864b6c0`)

- **Dialogs.** Every dialog checkbox comes from `renderDialogCheckboxInput()`
  (`src/webview/main.ts`), as `<span class="dialogFormCheckbox"><label><input
  type="checkbox">text</label></span>`.
  - W06 (`media/dialogs.css:201`–`:212`) made the label full width only
    for rows spanning both columns: `td[colspan="2"]`, under
    `#dialog table.dialogForm`.
  - Locked checkboxes refuse in `bindLockedDialogInputs()`, and grouped
    remote rows use `.dialogFormCheckbox.grouped`.
- **The Settings popup's Extension tab.** A boolean setting is a bare
  `<input class="settingsExtensionInput" type="checkbox">`
  (`renderBooleanEditor()`, `src/webview/settingsWidget.ts:467`–`:470`),
  with no `<label>`. Only the box reacts, not the setting's name or the
  rest of its row.
  - Check the Repository tab's per-repository view toggles the same way.
- **Other checkbox rows.** The toolbar's Show Remote Branches checkbox
  (`#showRemoteBranchesCheckbox`, `.toolbarCheckbox` in `media/toolbar.css`)
  is not in a popup. The context menu's checkbox items
  (`#contextMenu li.contextMenuItemCheckbox`) and the multi-select
  dropdown's options are whole-row list items already. Check each, and
  list in the report every popup checkbox row you found and what you did
  with it.
- **Checkbox styles.** `media/checkbox.css` styles dialog checkboxes and
  `#showRemoteBranchesCheckbox` by selector, not by a shared class.

## Steps

1. Define one shared checkbox-row pattern, a class name of your choosing
   (for example `checkRow`), in `media/checkbox.css` or `media/base.css`.
   - The row is a `<label>`, or contains one, spanning the full row width,
     with `cursor: pointer`.
   - A locked row keeps its own cursor and hint, and still refuses.
   - A disabled input gets no pointer.
   - Use theme tokens or OKLCH fallbacks for any color. No hover tint,
     since Y13 asked for none.
2. Dialogs: have `renderDialogCheckboxInput()` emit the shared pattern, and
   replace W06's `td[colspan="2"]` special case with it. Keep every
   behavior W06 pinned, its regression test still passing or updated to
   the shared class: locked rows, grouped remote rows with no layout
   shift, and single-input dialogs.
3. The Settings popup: render each boolean setting's row as the shared
   pattern, its name and description inside the label, so a click
   anywhere on the row toggles it. The change event and the settings
   echo must still fire exactly once per toggle. Do the same for the
   Repository tab's toggles, if they are checkboxes.
4. Any other popup checkbox row found in step 0 uses the same pattern.
5. Tests:
   - a CSS regression test for the shared class;
   - DOM tests that a click on the row text toggles the box: in a
     dialog, and on a Settings boolean, where it fires one change;
   - a locked or disabled row does not toggle.

   Render the dialog and Settings popup headlessly, light and dark
   (Verifying webview visuals without a browser). Don't install
   packages; images go to `/tmp/claude-1000/w06f-renders/`.
6. `CHANGELOG.md`: widen W06's `[Unreleased]` entry from "In the dialogs"
   to every popup, crediting `@rbalet` (#41). Keep it one entry.

## Touch

`media/checkbox.css`, `media/dialogs.css`, `media/settings.css`,
`media/base.css` (only if the class lives there), `src/webview/main.ts`
(`renderDialogCheckboxInput` and the Repository tab's toggles only),
`src/webview/settingsWidget.ts` (`renderBooleanEditor` and its row), tests,
`CHANGELOG.md`

## Acceptance

- In every popup that has checkboxes, a click anywhere on a checkbox's row
  toggles it once.
- Locked and disabled rows refuse.
- There is one shared class, and no per-popup copies of the rule.
- No layout shift in grouped rows.
- The Settings echo fires once per toggle.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:41
- **Branch and commits:** `wt-1.10.0/W06F`
  - `debb51f` G docs(release): claim W06F whole-row checkboxes in every popup (W06F)
  - `bae929c` G fix(dialogs): one shared checkRow label for every dialog checkbox (W06F)
  - `e1bcd06` G fix(settings): a boolean setting's whole row toggles it (W06F)
  - `f2ae96e` G docs(changelog): widen the whole-row checkbox entry to every popup (W06F)
  - this report commit: see `git log -1` on the branch
- **Popup checkbox rows found, and what each does:**
  1. Dialog checkboxes, all from `renderDialogCheckboxInput()` (push, fetch, pull, merge, rebase, cherry-pick, revert, tag, stash, branch, remote and user-details dialogs, and the grouped remote rows). Now one shared `.checkRow` label. W06's `td[colspan="2"]` rules are gone.
  2. Locked dialog checkbox ("Check out the branch after creating it", Create Branch from Stash). Same `.checkRow` label with `.checkRow.locked`. The refusing handler in `bindLockedDialogInputs()` is unchanged.
  3. Settings popup, Extension tab, boolean settings (`renderBooleanEditor()` and its row in `renderExtensionSettingRow()`). Was a bare input. The whole row is now a `<label class="settingsExtensionRow checkRow">`.
  4. Settings popup, Repository tab. Its per-repository toggles are `<select class="settingsOverrideSelect">` (`renderOverrideSelect()`), not checkboxes, so nothing changed.
  5. Context-menu checkbox items (`li.contextMenuItemCheckbox`). Already whole-row: the `li` carries the click listener (`addListenerToClass("contextMenuItem", "click")`). Unchanged.
  6. Dropdown multi-select options (`.dropdownOption`). Already whole-row: the click resolves the option with `closest(".dropdownOption")`. Unchanged.
  7. Toolbar "Show Remote Branches" (`#showRemoteBranchesControl`, `label.toolbarCheckbox`). Not a popup. Unchanged, see open questions.
- **Files changed** (`git diff --stat 73f6cd0..HEAD`, excluding this slice file): `CHANGELOG.md` +6 −5; `media/checkbox.css` +23 −1; `media/dialogs.css` +13 −21; `media/settings.css` +1; `src/webview/main.ts` +2 −2; `src/webview/settingsWidget.ts` +21 −6; `tests/webview/dialogStyles.test.ts` (rewritten block, +37 −24 net); `tests/webview/rendering.test.ts` +25; `tests/webview/settingsWidgetActions.test.ts` +33. Total 9 files, 154 insertions and 66 deletions with the slice file excluded.
- **Shared pattern:** `.checkRow` in `media/checkbox.css`. It is `inline-flex`, full width, `cursor: pointer`. `.checkRow.locked` takes `cursor: help`. `.checkRow:has(> input:disabled)` takes `cursor: default`. There is no hover rule on the row. The box has no cursor of its own; it inherits its row's. `#showRemoteBranchesCheckbox` keeps its own `cursor: pointer`, since it is not in a `.checkRow`. Dialogs keep the inline-level `.dialogFormCheckbox` wrapper with `> .checkRow` for align, gap and line-height, as in W06. Settings toggles keep `.settingsExtensionRow` as a grid, which wins over `.checkRow`'s `inline-flex` because `settings.css` loads after `checkbox.css`.
- **Tests added or changed:**
  - `tests/webview/dialogStyles.test.ts`: W06's "makes a whole checkbox row the hit area, keeping locked rows locked" is rewritten as "makes a whole checkbox row the hit area through one shared row pattern". It asserts the shared class, the wrapper and label without a cursor, the locked and disabled cursors, no row hover, the box inheriting its cursor, and the settings grid. The locked-label assertion in the lock test now targets `.checkRow.locked`.
  - `tests/webview/rendering.test.ts`, inside the existing stash test: a click on the locked row's label leaves the box checked. A click on the Pop Stash row's label toggles the box once, and the confirm sends `reinstateIndex: true`. No new `it`.
  - `tests/webview/settingsWidgetActions.test.ts`: new `it` "toggles a boolean setting once from anywhere on its row". A click on the row's text sends one `updateExtensionSetting` (`false`). A click on the box then sends one more (`true`).
  - Counts: before this slice, webview 836 (one `it` added). Backend 1303 of 1303 passed (100 files). Webview 837 of 837 passed (67 files). No test removed.
- **Gates:**
  - `pnpm exec biome check --config-path biome.strict.jsonc --error-on-warnings` on the five touched `.ts` files: pass. One formatting fix in the new settings test, then clean. The notice that `biome.strict.jsonc`'s `$schema` is 2.5.13 while the CLI is 2.6.3 predates this slice; that file is not touched.
  - `pnpm run typecheck`: pass (`tsc` for `src`, `src/webview` and `tests`).
  - `pnpm run test`: backend 1303 of 1303 passed; webview 837 of 837 passed. No "Unhandled Errors".
  - `pnpm run kb:check`: pass (exit 0).
  - `l10n:check`: n/a, no user-visible string changed. Rust arm: n/a. Sonar: integrator.
- **Headless render:** PyQt6 QtWebEngine under `xvfb-run`, the real `media/*.css` in `webviewHtml` link order, Dark Modern and Light Modern token values injected. Markup from the tests' own DOM (temporary dump lines, reverted, not committed). Images are in `/tmp/claude-1000/w06f-renders/`: `after-pop-single-dark.png`, `after-push-grouped-{dark,light}.png` with `before-` pairs, `after-locked-{dark,light}.png` with `before-` pairs, `after-locked-hint-dark.png` (hint forced visible), `after-settings-extension-{dark,light}.png`. The `*.json` beside each one holds the measurements.
  - Grouped remote rows: heights are identical before and after in both themes (`[20, 24, 24, 36]`; checkbox spans 16px). No layout shift. Hit-testing at the row's right edge moved from `LABEL` to `LABEL.checkRow`. The baseline is the W06 state, which is `73f6cd0`.
  - Locked row: heights `[32, 24]` unchanged. Hint and help cursor shown.
  - Settings boolean row: the true baseline (old markup and `73f6cd0` CSS) measures 54px, the same as now. The name, scope and description positions match. The right edge hits `SPAN.settingsExtensionEditor`, inside the label.
- **Acceptance:**
  - Click anywhere on a checkbox row toggles it once, every popup: met for dialogs and boolean settings, by the DOM tests and the render's hit-test. The render used `elementFromPoint`, not a real mouse click.
  - Locked and disabled refuse: locked met (DOM test and CSS). Disabled met in CSS only, since no popup has a disabled checkbox today.
  - One shared class, no per-popup copy: met, `.checkRow`.
  - No layout shift in grouped rows: met (heights above).
  - Settings echo once per toggle: met (DOM test, one `updateExtensionSetting` per click, from the label or the box).
- **Deviations from the slice:**
  - The shared class lives in `media/checkbox.css`, not `base.css`. `base.css` is untouched.
  - `locked` is on the label as well as the wrapper span. The span keeps it for the hint's `:hover` and `:focus-within` rules.
  - The locked label's own `cursor: help` moved into `.checkRow.locked`. The wrapper no longer sets a cursor.
  - The box's `cursor: pointer` moved out of the shared box rule into the toolbar's rule, so the dialog and settings boxes inherit their row's cursor.
  - Settings boolean rows are `<label>` elements with span children, since a label takes phrasing content only. Non-boolean rows keep their divs. `.settingsDescription` became a span with `display: block`.
- **Open questions / follow-ups:**
  1. The toolbar's "Show Remote Branches" is not in a popup, and its label covers only its text, so a click right of the text does nothing. I left it alone. Should it be a W06F follow-up?
  2. No real mouse-click test: the DOM tests dispatch clicks and the render hit-tests. A real click would need an interactive harness.
  3. The styling guide's checkbox section and the issue #41 KB subsection are outside this slice's Touch list. The integrator should add a `.checkRow` line to the styling guide.
  4. No checkbox in any popup is disabled today, so the disabled rule has no live case.
- **Sonar:** integrator.

