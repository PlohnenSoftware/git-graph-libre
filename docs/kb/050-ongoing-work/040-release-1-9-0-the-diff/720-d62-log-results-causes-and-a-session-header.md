---
summary: >-
  D62 · ready (D60, D61 integrated) · TypeScript · ~250 lines: issue #31's log entries.
  A session header at activation, a `[result]` line with counts and error
  for the main reads, the specific cause behind each engine decline or
  reroute, and a host-side record of an error response or failure screen
  reaching the webview, so a log alone explains a failure like #30.
---

# D62 — Log results, decline causes and a session header

Status: done — awaiting integration
Needs: D60, D61
Decisions: — (the maintainer's own proposal in issue #31, "Log entries to add" 1–4)
Kind: TypeScript (extension host, backend seam) · Size budget: ~250 changed lines outside tests
Source: [issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31), added to release 1.9.0 at the maintainer's request (`2026-10-20`)

## Goal

Reproducing a failure like #30 yields a log from which the whole causal
chain can be read without the source: what the extension ran with, what
each main read returned, why the engine declined, and what the user was
shown.

## Read first

- [The agent protocol](010-agent-protocol.md), and the D60 and D61 reports
- Issue #31, its "Log entries to add" and the motivating #30 excerpts
- `src/backend/utils/operationLog.ts` (`traceRequest`, `logBackendRoute`)
- `src/backend/engine/index.ts`: `rerouteToCli`, the `composeDeclined`
  reroute, `lastGraphLoadRoute`; `src/backend/engine/repoInfo.ts`: the
  `null` returns of the compose fills
- `src/extension/messageHandler.ts`: where `loadRepoInfo` and `loadCommits`
  responses are sent
- `src/extension/componentStatus.ts` (`probeGit`, `describeEngineStatus`),
  the telemetry common-properties code for OS, arch and OS version, and
  `src/extension.ts` activation
- The startup screen categories the telemetry layer names (trust required,
  Git unavailable, repository access failed, graph load failed, no
  workspace, no repository)

## Steps

1. **Session header**, once per activation, through the logger: extension
   version, `vscode.version` and `vscode.env.appName`, platform, arch and
   OS version (reuse the telemetry derivation; add the Linux C library only
   if it is already computed somewhere), the local UTC offset, the log
   file path from D61, the effective `backend` setting, the Git path and
   version once `probeGit` answers, and the engine status line. Don't
   duplicate the existing `[engine]` line; fold it in or reference it.
2. **`[result]` lines** for `loadRepoInfo` and `loadCommits`, one per
   request, with the request context, counts only (remotes, authors, tags,
   stashes; commits and whether more are available), the error message if
   any, and which backend served it, for example
   `[result] request=2 command=loadRepoInfo remotes=1 authors=128 tags=14 stashes=0 error=none servedBy=engine`.
   No names, paths beyond what the log already carries, or values.
3. **Decline causes**: the engine compose fills return a reason instead of
   a bare `null`, and the `[route] … reason=composeDeclined` line gains a
   `cause=` naming the fill and why (`configFill:unresolvablePath`,
   `configFill:includeDirective`, `configFill:malformedPayload`, …). Keep
   the existing `reason=` values unchanged.
4. **Application record**: when the host sends a response that carries an
   error, or shows a startup or failure screen, log one line with the
   command and the fixed category name, so the hop from "backend answered"
   to "user saw" is in the log.

## Touch

`src/backend/utils/operationLog.ts`, `src/backend/engine/index.ts`,
`src/backend/engine/repoInfo.ts`, `src/extension/messageHandler.ts`,
`src/extension.ts`, `src/extension/componentStatus.ts`,
`src/extension/webviewPanel.ts`, `src/extension/repositoryRecovery.ts`, a
small new module under `src/extension/` for the header if it keeps
`extension.ts` lean, their tests

## Tests

- The header's fields and format, with the environment faked.
- `[result]` line format for both reads, including an error case and both
  `servedBy` values; no names or values leak (assert on a fixture with
  branch, tag and author names).
- Each compose-fill decline yields its `cause=`; the old `reason=` stays.
- An error response and a failure screen each log one application line.

## Acceptance

- Issue #31's third checkbox: a test that drives the #30 shape (a sub-query
  error on `loadRepoInfo`) shows the chain in the log lines it writes.
- No telemetry change. Focused checks per the protocol, `Sonar: integrator`.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-10-20 18:00
- **Branch and commits:** `diff-1.9.0/d62`
  - `2467898 G docs(release): claim D62`
  - `d455594 G feat(log): add [result] lines and decline causes to the backend seam`
  - `a6d9507 G feat(log): write a session header at activation`
  - `c21f67f G feat(log): log read results and error responses in the message handler`
  - `bf696e4 G feat(log): log the failure screen the user was shown`
  - `fix(log): redact credentials in result lines (D62)` (integrator-requested)
  - then two signed fixes: never throw describing a result without repository info; cover the header at activation (hashes in `git log b705fdc..HEAD`)
- **Files changed:** about +733/−56 over 14 files before this report (`git diff --stat b705fdc`): `operationLog.ts` +75, `engine/index.ts` +27, `engine/repoInfo.ts` +86/−, `sessionHeader.ts` +90 (new), `extension.ts` +18, `messageHandler.ts` +10, `repositoryRecovery.ts` +3; tests: `readResults.test.ts` +193 (new), `sessionHeader.test.ts` +79 (new), `messageHandler.test.ts` +83, `repoInfo.test.ts` +87, `gitPathRescan.test.ts` +17, `repositoryRecovery.test.ts` +19. About 310 source lines.
- **Tests added or changed:** new `readResults.test.ts` (9), `sessionHeader.test.ts` (9 incl. offsets), two `messageHandler.test.ts` cases (the #30 chain; loadCommits result plus an action error), one `repositoryRecovery.test.ts` case, one activation case in `gitPathRescan.test.ts`; `repoInfo.test.ts` adapted to the new outcome shape (`{ok,value}`/`{ok:false,cause}`) with new cause cases. Counts: backend 1063 (D61 report) to 1089 passed (1149 with 60 skipped); webview 767 (D61 report) to 770.
- **Gates:** biome strict clean on 13 touched .ts; typecheck clean; test backend 1089/1149 (60 skipped), webview 770/770; l10n 100% (no text changed); kb:check passed; Rust arm n/a; Sonar: integrator
- **Acceptance:** Session header once per activation (extension, host, app, platform, arch, reduced OS version, UTC offset, log file, backend, Git version, engine line): met. `[result]` lines for both reads with counts, error and `servedBy` (engine and cli both tested), no names (fixture with branch, tag, author, remote names asserted absent): met. Decline causes with old `reason=` unchanged: met. Application lines for error responses and failure screens: met. #30 shape test (erroring global config on `loadRepoInfo`) shows request, result and application lines in order: met. No telemetry change: met.
- **Deviations from the slice:** (1) `loadEngineConfig` and `composeEngineRepoInfo` now return `{ok:true,value}|{ok:false,cause}`, so existing repoInfo tests were adapted. (2) No Linux C library line (not computed anywhere). (3) The header's `[session] engine` line is written after `git --version` answers, so the engine addon is now loaded at activation under `auto`, not at first graph open; the later `[engine]` line is unchanged. (4) Application lines cover error responses of `loadRepoInfo`, `loadCommits`, `loadBranches` and every `registerAction` action, plus the six failure screens; `webviewPanel.ts` untouched. (5) Integrator-authorized: `redactText` is now exported from `src/backend/utils/gitRunner.ts` (export only) and applied to the `[result]` error field. (6) `[application]` uses `response=<command>` because the request context already carries `command=`.
- **Open questions / follow-ups:** The `[result]` error field carries the first line of the message Git printed, credential-redacted; it can still include a path Git echoed. `servedBy` for a failed engine read says `engine`.
