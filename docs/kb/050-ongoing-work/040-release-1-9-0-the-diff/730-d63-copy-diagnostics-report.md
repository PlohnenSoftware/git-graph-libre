---
summary: >-
  D63 · waiting, needs D61, D62 · TypeScript + manifest · ~300 lines: issue #31's
  "Copy Diagnostics Report". A `vscode`-free builder assembles a report
  shaped like the bug template from facts the extension already has,
  redacted, with the recent log; a command offers it on the clipboard, as an
  untitled document or as a prefilled GitHub issue; `showDiagnostics` prints
  it; the status popup links to it and to the log.
---

# D63 — Copy Diagnostics Report

Status: waiting — needs D61 and D62 integrated
Needs: D61, D62
Decisions: — (the maintainer's own proposal in issue #31, "Commands" 1 and 3,
and its privacy guardrails)
Kind: TypeScript (extension host, webview popup) + manifest + l10n · Size budget: ~300 changed lines outside tests
Source: [issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31), added to release 1.9.0 at the maintainer's request (`2026-10-20`)

## Goal

From the Command Palette, a user produces a complete, template-shaped
diagnostics report and pastes it into a GitHub issue, without a terminal
or a file manager, and it contains nothing secret.

## Read first

- [The agent protocol](010-agent-protocol.md), and the D61 and D62 reports
- Issue #31 in full, especially "Commands" and "Privacy guardrails"
- `.github/ISSUE_TEMPLATE/bug_report.md`: the report's shape
- `src/extension/componentStatus.ts` (`probeGit`, `buildComponentStatus`,
  `describeEngineStatus`) and `lastGraphLoadRoute` in
  `src/backend/engine/index.ts`
- The telemetry code that computes changed setting names once per session,
  and the Git command recorder's credential sanitization (find both with
  graphify; reuse them, don't copy them)
- `src/extension/commandManager.ts`: `showDiagnostics`
- `src/webview/componentStatus.ts`: the status popup
- D61's `recentLines(n)`

## Steps

1. `src/extension/diagnosticsReport.ts`, free of `vscode` like
   `componentStatus.ts`: takes injected facts and returns Markdown with the
   bug template's Environment fields filled (editor and app name,
   extension, OS, arch, Git path and version, engine state, version,
   platform and unavailable reason, last graph-load route, backend
   setting), the changed setting names (never values), the repositories
   (count; per repository its path, remote names with redacted URLs, and
   the last `[result]` summary if D62 keeps one), environment facts (global
   config file present or not, whether `GIT_CONFIG_GLOBAL` and
   `GIT_CONFIG_NOSYSTEM` are set, names only, workspace trust), and the last
   200 log lines in a `<details>` block. A missing fact reads `(unknown)`.
2. `git-graph-libre.copyDiagnostics`, "Copy Diagnostics Report": a quick
   pick of
   - Copy to clipboard (the report notes that repository paths are
     included);
   - Open as an untitled Markdown document, with full paths;
   - Open as an untitled Markdown document, folder names only;
   - Open a prefilled GitHub issue (`vscode.env.openExternal` on the new-issue
     URL with the report as its body; above a safe URL length, copy to the
     clipboard instead and say so).
   Nothing is sent by the extension itself.
3. `showDiagnostics` writes the full report to the channel instead of its
   seven lines.
4. The status popup gains links to Copy Diagnostics Report and to D61's
   Open Log File.

## Touch

`src/extension/diagnosticsReport.ts` (new), `src/extension/commandManager.ts`,
`src/extension.ts` (wiring only), `package.json` (one command),
`package.nls*.json`, `l10n/bundle.l10n*.json`, `src/types.ts` (new message
variants), `src/webview/componentStatus.ts`, `src/extension/messageHandler.ts`,
`src/extension/repositoryRecovery.ts` (if the popup also shows on the
startup screen), `src/extension/webviewL10n.ts`, their tests

## Tests

- Builder: every section present; a URL with userinfo or a token, a setting
  value and config contents never appear; absent facts read `(unknown)`;
  folder-names-only mode drops parent paths.
- Command: each quick-pick branch with the window, clipboard and
  `openExternal` faked, including the long-URL fallback.
- `showDiagnostics` writes the report.
- The popup links send their messages.

## Acceptance

- Issue #31's first, fourth and fifth checkboxes: a complete report from
  the Command Palette; redaction covered by tests; no telemetry change.
- Focused checks per the protocol, `l10n:check` 100%, `Sonar: integrator`.

## Report

_(not started)_
