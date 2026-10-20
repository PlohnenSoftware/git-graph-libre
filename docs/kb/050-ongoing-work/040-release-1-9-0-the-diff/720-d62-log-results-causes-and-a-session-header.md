---
summary: >-
  D62 · ready (D60, D61 integrated) · TypeScript · ~250 lines: issue #31's log entries.
  A session header at activation, a `[result]` line with counts and error
  for the main reads, the specific cause behind each engine decline or
  reroute, and a host-side record of an error response or failure screen
  reaching the webview, so a log alone explains a failure like #30.
---

# D62 — Log results, decline causes and a session header

Status: claimed by Claude Sonnet 5.5 on 2026-10-20 12:00
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

_(not started)_
