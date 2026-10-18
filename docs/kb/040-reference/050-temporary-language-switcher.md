---
summary: >-
  Standing rules for the hidden double-right-click language menu: always
  English, the override kept only in the `webviewPanel.ts` closure, switching
  by document rebuild, locale validated before `createBundleTranslator()`.
---

# Temporary language switcher (`2026-09-03`)

A double right-click on the version in the status strip opens a small menu
headed **Hidden menu**, listing every shipped locale; picking one re-renders
the graph in that language. Since `2026-10-16` the menu also carries
**Reload once with Git CLI** (see the Phase 16 record of that date): English
for the same reason as everything else in the menu, and its one-shot flag
lives only in the webview instance, never in settings or saved state. Since
`2026-10-17` it also carries **Show diagnostics**, the startup screen's
button of the same name (`showOutput`, handled by `repositoryRecovery.ts`
on the panel's bridge, so it works from either document): it opens the
extension's output channel without taking focus from the tab (gated
`OK`: tests `827`/`589`, coverage `1416` tests at `93.8%`, Sonar task
`f8eb8d92-2e5a-4372-b4b0-dfac60dbb7e7` `OK` on all seven conditions). Four
properties are deliberate and should survive any refactor:

- **It is English, always.** `HIDDEN_MENU_HEADER` and the language labels in
  `webviewLanguages.ts` are hardcoded English rather than localized. The menu
  exists to be usable when the interface is in a language the reader cannot
  navigate; translating it would put the escape hatch behind the very door it
  opens. Do not "fix" this by running the labels through `l10n.t()`.
- **The override lives in the panel closure and nowhere else.**
  `temporaryLanguage` in `webviewPanel.ts` is not persisted to settings or
  workspace state, so closing the graph tab ends it. Anyone can switch the
  language on someone else's editor without leaving it changed.
- **Switching is a document rebuild, not a message.** Every string is baked in
  at build time — toolbar, status strip, table headers — so `update()` is the
  only honest way to apply a new language. That is also why the switcher is
  worth having as a rebuild rather than a live re-render: correctness over
  keeping graph state across a deliberate, momentary switch.
- **The requested locale is validated against the shipped list** before it
  reaches `createBundleTranslator()`. Anything arriving over the bridge is
  webview input, and an unchecked locale would become a filename to read.

`getWebviewLocalizedStrings()` takes a `translate` function for this, defaulting
to `l10n.t`; `createBundleTranslator()` reads the requested bundle and falls
back to English, then to the key, which is the same order `l10n.t()` degrades
in — a switched webview never looks more broken than an unswitched one.
