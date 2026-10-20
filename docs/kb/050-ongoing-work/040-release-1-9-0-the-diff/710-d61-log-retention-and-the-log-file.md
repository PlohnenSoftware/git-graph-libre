---
summary: >-
  D61 · ready · TypeScript + manifest · ~250 lines: issue #31, part 2 and log
  item 5. Keep the last 2,000 log lines in memory, mirror the log to a file in
  the extension's `logUri` folder, and add "Open Log File" and "Copy Recent
  Log" commands, reachable from the Command Palette, the startup screen and
  the Hidden menu.
---

# D61 — Log retention and the log file

Status: ready
Needs: —
Decisions: — (the maintainer's own proposal in issue #31; the orchestrator
chose the file mirror, see Facts)
Kind: TypeScript (extension host, webview buttons) + manifest + l10n · Size budget: ~250 changed lines outside tests
Source: [issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31) ("Open/Copy Log", and "In-memory retention"), added to release 1.9.0 at the maintainer's request (`2026-10-20`)

## Goal

A user can open the current window's Git Graph Libre log file, or copy its
recent lines, from inside the editor, without hunting for a per-window,
per-editor-flavor log directory on disk.

## Read first

- [The agent protocol](010-agent-protocol.md)
- Issue #31 in full (`gh issue view 31 --repo PlohnenSoftware/git-graph-libre`)
- `src/extension/utils/logger.ts` (`createLogger`, the only writer to the
  output channel) and `src/backend/utils/operationLog.ts` (its sink is
  `logger.log`, wired in `src/extension.ts` about line 39)
- `src/extension/commandManager.ts`: `register`, `showDiagnostics`
- `src/extension/utils/clipboard.ts`: `copyToClipboard`
- The startup screen's **Show diagnostics** button:
  `src/extension/webviewStartupScreen.ts` (about line 19),
  `src/webview/startup.ts` (about line 141), the host handler in
  `src/extension/repositoryRecovery.ts` (about line 161)
- The Hidden menu: `buildHiddenMenu` in `src/webview/main.ts` (about line
  3062), whose "Show diagnostics" entry sends `showOutput`
- Telemetry rules under Reference: new commands are counted through the
  existing `register` chokepoint like every other command; add nothing else

## Facts (checked `2026-10-20` on `the-diff`)

- The plain `OutputChannel` gives the extension no way to learn its file's
  path or read back what it wrote, and the file lives in a per-session
  `output_logging_*` folder.
- `ExtensionContext.logUri` is a per-window folder for this extension that
  the extension may write to; nothing writes there yet.
- **Orchestrator's choice:** mirror every logger line, in exactly the format
  the channel gets, to `git-graph-libre.log` in `context.logUri`, through
  one append stream (no synchronous write per line; create the folder
  first). Don't switch to a `LogOutputChannel`: that would change every
  line's format. A failure to open or write the file disables the mirror
  for the session and logs one warning to the channel; it never throws into
  callers.

## Steps

1. Logger: keep the last 2,000 lines in a ring buffer, exposed as
   `recentLines(n)`, and write the file mirror. Both cover every line
   written through `log`, `warn` and `error`, so the operation log is
   included. Dispose the stream with the extension.
2. Commands, following `git-graph-libre.*` naming:
   - `git-graph-libre.openLogFile`, "Open Log File": opens the mirror file
     in an editor; if the mirror is disabled, says so and shows the channel.
   - `git-graph-libre.copyRecentLog`, "Copy Recent Log": copies the last
     200 lines to the clipboard and confirms how many lines were copied.
   Titles and messages go through `package.nls*.json` and the l10n bundles.
3. Surfaces: both commands in the Command Palette; beside **Show
   diagnostics** on the startup screen; and in the Hidden menu beside its
   "Show diagnostics" entry (that menu is English by design). Use new
   webview messages modelled on `showOutput`.

## Touch

`src/extension/utils/logger.ts`, `src/extension.ts` (passing `logUri` to the
logger), `src/extension/commandManager.ts`, `package.json` (two commands),
`package.nls*.json`, `l10n/bundle.l10n*.json`, `src/types.ts` (the new
message variants), `src/extension/webviewStartupScreen.ts`,
`src/webview/startup.ts`, `src/extension/repositoryRecovery.ts`,
`src/extension/messageHandler.ts` (the graph's handlers),
`src/extension/webviewL10n.ts`, `src/webview/main.ts` (`buildHiddenMenu`
only), their tests

## Tests

- Ring buffer: keeps exactly the last 2,000 lines, `recentLines(n)` returns
  the newest `n` in order, levels included.
- Mirror: lines land in the file in channel format (temp `logUri`); a write
  failure disables the mirror with one warning and no throw.
- Commands: registration, open-file and copy behavior with the window and
  clipboard faked; the startup-screen button and Hidden-menu entry send
  their messages.

## Acceptance

- Issue #31's second checkbox: the log file opens, and its tail can be
  copied, from the Command Palette, a failure screen and the Hidden menu.
  (The status popup comes with D63.)
- No telemetry change beyond the two commands' existing-chokepoint counts.
- Focused checks per the protocol, `l10n:check` 100%, `Sonar: integrator`.

## Report

_(not started)_
