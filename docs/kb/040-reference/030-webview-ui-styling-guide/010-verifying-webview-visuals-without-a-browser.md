---
summary: >-
  Standing rule: before calling a webview visual change done, render it
  headlessly with `PyQt6` QtWebEngine and `xvfb-run` using the real
  `media/*.css`; VS Code's bundled Electron can't be used for this.
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
