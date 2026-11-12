---
summary: >-
  Standing rule: before calling a webview visual change done, render it
  headlessly with `PyQt6` QtWebEngine and `xvfb-run` using the real
  `media/*.css`; VS Code's bundled Electron can't be used for this. Since
  `2026-11-12` also the recipe for rendering the real webview bundle with
  the editor's real theme variables, and `QT_QPA_PLATFORM=xcb` on Wayland.
---

# Verifying webview visuals without a browser (`2026-09-10`)

Two visual defects shipped in a row because they were reasoned about instead
of looked at: an accent-filled checkbox the maintainer rejected, and a dialog
label wrapped one word per line. There **is** a way to see the result on this
machine, and it should be used before calling any visual change done:

`PyQt6.QtWebEngineWidgets` is installed (a real Chromium) and `Xvfb` is
available, so a page built from the actual `media/*.css` can be rendered and
screenshotted headlessly:

```bash
xvfb-run -a python3 shot.py preview.html out.png   # QWebEngineView + grab()
```

The scratchpad harness that produced the dialog screenshots builds a page from
the real stylesheet list, injects Dark Modern token values so the theme
fallbacks resolve the way they do in the editor, and forces hover-only
elements visible. Do the same for future visual work: render it, read the
image, then fix what the image shows. Note VS Code's bundled Electron
(`.vscode-test/*/code`) is **not** usable for this — it starts VS Code rather
than accepting a URL — and no standalone Chromium or Firefox is installed.

## Rendering the real webview (`2026-11-12`)

The popup and context-menu review (Ongoing work) rendered the real view
rather than a hand-built page, which found defects a preview page hides.
The harness was scratch and is not in the repository; this is its recipe.

- **The page.** Wrap the body as `buildWebviewHtml()` does, from the
  repository's own builders: bundle `getWebviewLocalizedStrings()`,
  `buildWebviewToolbar()` and `buildWebviewStatusStrip()` with esbuild
  (`@/` aliased to `src/`, `vscode` to a stub whose `l10n.t` returns its
  key, and `createBundleTranslator()` for the language), and bundle
  `src/webview/main.ts` from the working tree, never the possibly stale
  `out/`. Link the real `media/*.css` in the order `webviewHtml.ts` does.
- **The host.** Define `acquireVsCodeApi()` before the bundle loads. Its
  `postMessage` answers `loadRepoInfo`, `loadBranches` and `loadCommits`
  (and `worktreeStatus`, `branchPushDefaults`, `remoteTags`,
  `componentStatus`) from a fixture, as the webview tests do with
  `receive()`. Open a menu by dispatching `contextmenu` on the real element
  and a dialog by clicking the real menu item.
- **The theme.** Approximate token values mislead. Read the real ones:
  start VS Code with `--remote-debugging-port` and a scratch
  `--user-data-dir` whose settings name the theme, then collect every
  `--vscode-*` declaration from the workbench page's style sheets over the
  DevTools protocol (wait for the `vscode-theme-…` class, or the built-in
  base colors are read instead). Put them on `<html>` as inline style, add
  the `vscode-dark` or `vscode-light` body class and the webview's default
  style sheet. One example of what this changes: in Dark Modern
  `--vscode-button-secondaryBackground` is transparent and
  `--vscode-button-border` is a faint line, so secondary buttons are
  outlines, not filled boxes.
- **Wayland.** On a Wayland session Qt opens a real window on the desktop
  even under `xvfb-run`, at the compositor's size. Set
  `QT_QPA_PLATFORM=xcb` and unset `WAYLAND_DISPLAY` before creating the
  `QApplication`. Whether the VS Code started for the theme read does the
  same was not checked.
- **Hover and size.** `QT_SCALE_FACTOR=2` gives images readable at small
  sizes. A real pointer position (a `QMouseEvent` sent to the view's
  `focusProxy()`) renders `:hover`; scripting cannot.
