---
summary: >-
  D63 · integrated · TypeScript + manifest · ~300 lines: issue #31's
  "Copy Diagnostics Report". A `vscode`-free builder assembles a report
  shaped like the bug template from facts the extension already has,
  redacted, with the recent log; a command offers it on the clipboard, as an
  untitled document or as a prefilled GitHub issue; `showDiagnostics` prints
  it; the status popup links to it and to the log.
---

# D63 — Copy Diagnostics Report

Status: integrated 93d2982
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

- **Agent / date:** Claude Sonnet 5.5, 2026-10-20 20:30
- **Branch and commits:** `diff-1.9.0/d63`
  - `dc85293 G docs(release): claim D63`
  - `eaac1b8 G feat(diagnostics): add the redacting diagnostics report builder (D63)`
  - `6c580d7 G feat(commands): add Copy Diagnostics Report and a full showDiagnostics (D63)`
  - `462b0a5 G feat(status): link the status popup to the report and the log (D63)`
  - `e99b735 G docs(release): report D63 as done (D63)`
  - integrator-requested: `fix(diagnostics): fit the prefilled issue by dropping the log tail first (D63)` (hash in `git log f182aea..HEAD`), then this report update
- **Files changed:** 22 files, +1089/−23 before this report (`git diff --stat dc85293..HEAD`): `diagnosticsReport.ts` +373 (new), `commandManager.ts` +132/−, `componentStatus.ts` (webview) +36/−, `repositoryRecovery.ts` +3, `webviewL10n.ts` +2, `types.ts` +1, `extension.ts` +1, `package.json` +5, five `package.nls*.json` +1 each, five `l10n/bundle*.json` +10 each; tests: `diagnosticsReport.test.ts` +313 (new), `commandManager.test.ts` +152/−, `componentStatus.test.ts` +38, `repositoryRecovery.test.ts` +1. About 550 source lines (over the ~300 budget, a hint only).
- **Tests added or changed:** backend 1089 to 1109 passed (+20: 19 in the new `diagnosticsReport.test.ts`, 1 `copyDiagnostics` row in `repositoryRecovery.test.ts`); webview 770 to 781 (+11: 9 Copy Diagnostics Report cases and 2 popup link cases). Changed fixtures: the two registered-command lists, the `showDiagnostics` assertions (now the full report), the harness's window API and config.
- **Gates:** biome strict clean on 22 touched .ts/.json files; typecheck clean; test backend 1109/1169 (60 skipped), webview 781/781; l10n 100% in all four other bundles; kb:check passed; Rust arm n/a; Sonar: integrator
- **Acceptance:** Issue #31 first checkbox (complete template-shaped report from the Command Palette, no terminal): met (command in `package.json`, five quick-pick branches tested; native/Flatpak/Snap not exercised by hand). Fourth (no tokens, URL credentials, setting values or config contents; redaction tested): met (token, userinfo and query token in remotes and in log lines; setting names only; config file with a name and email asserted absent along with its path). Fifth (no telemetry change): met (the command is counted only by the existing `register`, asserted in a test; `src/telemetry/**` untouched; `explicitExtensionSettings` is reused for the setting names). Popup links send their messages: met. `showDiagnostics` writes the report: met. Quick pick with clipboard (notes paths included), untitled document (full paths, folder names only) and prefilled issue with long-URL clipboard fallback: met.
- **Deviations from the slice:**
  (1) The report has no per-repository last `[result]` summary, because `[result]` lines carry no repository (D62 logs no names). Instead a "Last read results" section holds the newest `[result]` line per command.
  (2) The prefilled issue (integrator fix: it now degrades in steps, whole report, then the builder option `includeLogTail: false` replacing the tail with one pointer line to Copy Recent Log, then the clipboard; tested for all three). The prefilled issue uses folder names only (it goes to a public page) and prepends the bug template's headings, because GitHub ignores the template when a body is given. 
  (3) The popup links are anchors (`href="#"`, `role="button"`) rather than styled buttons, because `media/toolbar.css` is outside the Touch list; they get VS Code's default link style. `src/webview/main.ts` is untouched: `componentStatus.ts` posts through the shared `utils/vscode` module, and its test hoists a stand-in `acquireVsCodeApi`.
  (4) `showDiagnostics` output changed from the seven `key=value` lines to the full report (as the slice asks), so the old assertions changed.
  (5) The report is English, not l10n'd, as it goes to a GitHub issue. All UI strings (quick pick, messages, popup links, command title) are l10n'd; the nl, pl, zh-cn and zh-tw translations are mine, not reviewed by a native speaker.
  (6) Folder-names mode also replaces the home directory with `~` and repository paths with folder names in the log tail; full mode leaves the log as written (credentials still redacted).
  (7) `git remote -v` is run per known repository (capped listing at 25) through `runGitRaw`, so each run also appears in the Git command log.
- **Open questions / follow-ups:** The report's remote-URL redaction also masks any query string, which is stricter than `redactText`. Paths Git echoed inside log lines are only anonymized in folder-names mode. The startup screen's component details do not show the new links (it already has the log buttons; a Copy Diagnostics Report button there is not in this slice).

Excerpt of a generated report from a test fixture (full-path mode; the remotes held `https://alice:ghp_SECRETTOKEN0123456789@github.com/acme/repo.git` and `https://ghp_SECRETTOKEN0123456789@example.com/acme/repo.git?access_token=ghp_SECRETTOKEN0123456789`, the log held `url=https://bob:hunter2@host/x.git`):

```text
## Repositories

Count: 1

Repository paths are included. Edit them out before sharing if needed.

- /home/alice/work/secret-project
  - Remote `origin`: https://<redacted>@github.com/acme/repo.git
  - Remote `mirror`: https://<redacted>@example.com/acme/repo.git?<redacted>
...
[2026-10-20 10:00:01.000] [git:query] cwd=/home/alice/work/secret-project url=https://<redacted>@host/x.git
```
