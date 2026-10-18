---
summary: >-
  Standing UI rules: VS Code theme tokens with `--ngg-*` OKLCH fallbacks;
  conventions for dialogs, checkboxes, locked controls (`lock: { reason }`),
  dropdowns, `octicon()` icons, selection tint, graph palette and status strip
  states; CSS regression tests.
---

# Webview UI Styling Guide

Durable guidance for agents doing UI work in the webview. The goal is a
native-feeling VS Code surface: theme tokens first, OKLCH fallbacks second,
no raw color literals in repo-owned styles.

Token families by surface (all with `--ngg-*` OKLCH fallbacks where a theme
may not define the token):

- Dialog panel: `--vscode-editorWidget-background/-foreground/-border`,
  `--vscode-widget-shadow`; content is left-aligned; actions right-aligned in
  a `.dialogActions` flex row.
- **A run of related checkboxes gets a `group` heading *and* marked members.**
  A heading alone marks only where a group starts, so the rows after it still
  read as part of it — the first attempt left "Set upstream" looking like one
  of the remote checkboxes, which is the exact confusion the grouping existed
  to remove. Members carry `grouped: true`, and the left rule lives on the
  **cell** (`td:has(> .dialogFormCheckbox.grouped)`) because cells of adjacent
  rows meet under `border-collapse: collapse`, while a per-span border is cut
  into dashes by the row padding.

  **Why this grouping exists:** cloning a fork with the `gh` CLI writes a
  remote literally named `upstream` — `gh` does it unasked, where plain
  `git clone` only ever creates `origin` — so a push dialog shows "Push to
  upstream" beside "Set upstream". Those are different concepts pointing at
  different repositories: the first is a remote, the second is
  `git push --set-upstream`, which sets the branch's upstream *branch*
  (`@{u}`). Labelling the group is what tells them apart. Use
  "upstream branch" for the `-u` sense, "the `upstream` remote" for the fork
  sense, and avoid "tracking branch" entirely — people use it for both that
  and `origin/main`.

  **A value-less row shifts every input index, so never count positions by
  hand.** `parsePushDialogValues()` read remotes as `values[index]` and took
  an `optionsOffset` counted at each call site; adding the heading would have
  silently pushed to the wrong remote. It now derives positions from the input
  *types* — remotes are the leading checkboxes, bypass-hooks is the last, the
  mode is the only select — which is stable against any number of headings or
  notes. Two rendering tests drive a two-remote dialog, so a misroute fails
  the suite instead of reaching a user.
- **A checkbox names itself: its text goes in the `<label>` beside the box, on
  a row spanning the whole form.** Never in the form's label column. This is
  not a style preference — a `100%`-width input in the neighbouring column
  squeezes the label column to its narrowest word, so
  "Check out the branch after creating it" stacks one word per line. That
  shipped once and looked broken. `renderDialogInputRow()` gives every
  checkbox `colspan="2"`, and the label column stays `white-space: nowrap`
  for short field names only. Two matching rules: an *empty* label cell drops
  its gutter padding (`:empty`), or an unlabelled control is inset from the
  flush-left rows around it; and a row containing a `textarea` top-aligns its
  label, since a label centered against a tall control floats away from the
  text it names.
- **Every dialog opens with a `.dialogTitle` and shares one width floor.**
  All five content builders (`showConfirmationDialog`, `showFormDialog` via
  `renderDialogForm`, `showErrorDialog`, `showActionRunningDialog`, and the tag
  details popup) go through `dialogTitleHtml()`, so the size step and the space
  below it cannot drift apart between popups. The bottom margin is
  `:not(:last-child)`, so a message-only dialog carries no trailing gap above
  its buttons. Hierarchy comes from **size only** — not weight, not caps, not
  an accent on one word, all of which fight the emphasis the messages already
  put on ref names.

  The width floor lives on `#dialog.active`, **not** on `table.dialogForm`.
  It was on the table first, which left form dialogs stable while a
  confirmation sat ~300px and an error ~215px beside a 375px form, so opening
  two dialogs in a row resized the panel under the pointer. `.dialogForm`
  keeps `width: 100%` and relies on that floor: `#dialog.active` is
  `width: max-content`, so a percentage-width table contributes no intrinsic
  width and a form would otherwise shrink to its title line.
- **Dialog forms obey the same control metric as the toolbar** — 28px tall,
  4px radius — and their rows are laid on one 8px rhythm with cells
  **middle-aligned**. They were top-aligned with only a `padding-top`, which
  put every label above the vertical center of its control and is what made
  the forms look misassembled. The label column is a fixed 12px gutter with a
  `max-width` and `white-space: normal`, so a long label wraps instead of
  forcing the dialog past its width cap. Focus rings take
  `outline-offset: 1px` so they clear the input's own border rather than
  drawing on top of it, and buttons are equal-width (`min-width: 78px`) with
  centered text and their own `:focus-visible` ring.
- Dialog markup contract (`showDialog()` in `src/webview/main.ts`): content in
  `.dialogContent`, buttons are `.dialogBtn` divs, the primary action carries
  `dialogBtnPrimary`, and a dismiss-only dialog promotes dismiss to primary.
  Keep ids `dialogAction`/`dialogDismiss` stable; tests and disabled-state CSS
  key off them.
- Text fields and selects: `--vscode-input-*` (`-background`, `-foreground`,
  `-border`, `-placeholderForeground`), focus ring `--vscode-focusBorder`,
  invalid state `--vscode-inputValidation-errorBackground/-errorBorder`;
  selects prefer `--vscode-dropdown-*`. Control metric: 28px height, 4px
  radius, matching `.toolbarFindInput` and `.toolbarIconButton`.
- Buttons: `--vscode-button-background/-foreground/-hoverBackground` for
  primary, `--vscode-button-secondary*` for secondary, 2px radius like native
  VS Code buttons.
- Context menus: `--vscode-menu-*` (`-background`, `-foreground`, `-border`,
  `-selectionBackground/-selectionForeground`, `-separatorBackground`), 5px
  menu radius, 3px item radius, 4px menu padding.
- Dropdown widget: control on `--vscode-dropdown-*`, option list on
  `--vscode-dropdown-listBackground` plus `--vscode-list-*` hover/selection
  tokens, filter input on the input tokens above. The open menu is a flex
  column in which the filter row — the input plus, in multi-selects, the
  invert-selection button — is a fixed header (`flex: none`) and only
  `.dropdownOptions` scrolls; never put `overflow-y: auto` back on
  `.dropdownMenu`, which scrolls the header away together with the list
  (maintainer fix, `2026-10-16`; pinned in `dialogStyles.test.ts`).
- **Forced settings use a locked control, never prose and never a missing
  control.** When the git command behind a dialog does not let the user choose
  a value, show the **same control in the same place**, in its forced state,
  and explain it there. Concretely: keep the real `input`, keep it `checked`
  (or whatever the forced value is) so the submitted payload is honest, mark
  it `aria-disabled="true"` with `aria-describedby` pointing at the reason,
  give the row `cursor: help` and a `?` marker, and reveal a
  `.dialogLockHint` bubble on `:hover` and `:focus-within`. Add
  `lock: { reason }` to the `DialogInput` rather than inventing a variant.

  Three things are deliberate and should not be "simplified":

  - **Not `disabled`.** A disabled control leaves the tab order and greys
    out the very value the user is trying to read, exactly when they most
    want to know why it will not move. It stays enabled and refuses the
    change instead.
  - **Not a `note`.** A paragraph explaining that a checkbox would have been
    pointless is worse than the checkbox: the user loses the row they were
    looking for and has to read prose to find out what the setting is. The
    `note` input still exists for genuine asides (lightweight tags), not for
    this.
  - **The value is re-asserted on a microtask**, not inside the click
    handler. A checkbox is toggled by the pre-click activation steps *before*
    listeners run and reverted *after* them, so an assignment in the handler
    is overwritten; `queueMicrotask` lands after the activation steps finish
    and holds whatever an engine does in between. `preventDefault()` is what
    refuses the toggle in a real browser and stays.

  The first use is the Create Branch from Stash dialog: `git stash branch`
  always checks the branch out (verified against git `2.55.0`), so its
  "Check out" checkbox is locked on. Apply the same treatment to any future
  forced option.
- Checkboxes: keep the native `input[type="checkbox"]` and restyle it with
  `appearance: none` plus a themed box (`--vscode-checkbox-background` /
  `--vscode-checkbox-border` with `--ngg-*` OKLCH fallbacks, 3px radius in the
  existing 3–4px family). The box stays **neutral whether set or unset** — the
  tick alone marks the state, and the tick takes
  `--vscode-checkbox-foreground` with `currentColor` behind it. An accent fill
  on `:checked` was tried and **rejected by the maintainer**: at 16px, beside
  the toolbar's other neutral controls, a saturated square pulls far more
  attention than the setting it represents. Do not reintroduce it; a CSS
  regression test scans every checkbox box rule for the button tokens. The
  tick is an `::after` shape
  clipped with `clip-path: polygon(...)` in **percentages**, never pasted SVG
  paths (`octicon()` is unavailable from CSS) and never a rotated border — a
  percentage clip scales with the box, so a compact variant needs no tick
  metrics of its own, while a rotated border needs hand-tuned `left`/`top` per
  size and leaves blunt ends where the two arms meet. `:focus-visible` rings
  `--vscode-focusBorder` at `outline-offset: 2px`, `:disabled` dims, and every
  checkbox rule set carries `@media (forced-colors: active)` and
  `@media (prefers-reduced-motion: reduce)` counterparts.
- Icons: render icons through `octicon(name, className?)` from the generated
  `src/octicons.ts` module (16px octicons, MIT). Add names to
  `scripts/generate-octicons.js` and regenerate with `pnpm run icons:generate`;
  never hand-edit the generated file or paste raw SVG paths. Icons inherit
  color from the surrounding element via `fill="currentColor"` and can be
  recolored with CSS `fill` rules. The webview-facing catalog stays in
  `src/webview/utils/icons.ts` (`svgIcons`); octicons has no spinner, so
  `svgIcons.loading` reuses the `sync` octicon with the CSS rotation
  animation.
- Selection identity: commit rows expose their graph color through
  `--git-graph-color` (published per `data-color` index by
  `src/extension/webviewHtml.ts`). The selected row background is
  `color-mix(in oklab, var(--git-graph-color) 18%, var(--ngg-transparent))`
  (26% on hover) plus a 3px inset left accent bar, so selection matches the
  commit dot hue instead of a flat list color. Reuse this pattern for future
  per-commit emphasis instead of introducing new solid selection colors.
  Interpolate `color-mix()` in `oklab`, never `srgb`: every mix here runs
  toward the transparent token, and only the rectangular space keeps the tint
  hue-stable unconditionally (no reliance on the polar powerless-component
  rule). `oklch` is out for the same reason — obvious beats subtle.
- Graph palette: defaults are OKLCH with uniform lightness and chroma and
  hue-only variation (`oklch(59% 0.21 <hue>)`, 12 hues). Keep any palette
  change uniform in L/C unless the maintainer asks otherwise; users may still
  configure HEX/RGB/OKLCH values. The defaults live in two places that must
  stay identical: the manifest default for `git-graph-libre.graphColors` and
  `DEFAULT_GRAPH_COLORS` in `src/config.ts`. Earlier lightness values quoted in
  the dated slice notes below are historical.
- **Status strip states.** `data-state` (ready, loading, action, error) and
  `data-engine` (active, off, unavailable) are independent.
  Ready-and-unavailable is amber and shows the "Rust engine unavailable"
  note; ready-and-off shows the Ready green as a hollow ring with a
  "Rust off" note — lit versus unlit, never amber, so an accidental
  `git-cli` is discoverable without reading as a fault (maintainer reversal
  of the stays-green decision, `2026-10-16`; each note's reveal names its
  own span id so the two never show together). Busy and error keep their
  own look. Anything that pops out of the
  strip must be parented on `body` with `position: fixed`, because the strip
  clips its overflow so it can collapse while the graph scrolls. The
  component popup uses the editor hover tokens, like `.dialogLockHint`.
- CSS regression coverage lives in `tests/webview/dialogStyles.test.ts` and
  `tests/webview/tableStyles.test.ts`; extend those when adding UI styles.
