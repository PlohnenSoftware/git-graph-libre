---
summary: >-
  T1b: wire T1's approved open-and-outcome telemetry into the Blame tab
  (`tab.blame`) through the `reportBlameOpened` hook F4-03 left, following
  the recipe in `src/telemetry/tabOpen.ts`; `telemetry.json` and the README
  disclosure updated.
---

# T1b — Blame tab open-and-outcome telemetry

Status: claimed by Claude Haiku on 2026-11-23 12:42

Needs: T1 (integrated), F4-03 (integrated)

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`, its Telemetry
answer); T1's slice file and report
(`140-release-1-11-0-looking-back/100-t1-open-telemetry.md`); the header of
`src/telemetry/tabOpen.ts`; Telemetry (Reference).

## Touch

`src/telemetry/tabOpen.ts` (add the `tab.blame` id); `src/extension/blameTab/blameTabPanel.ts`
(accept `telemetry` in its deps, report once when the open's first load
settles); `src/extension/commandManager.ts` (`reportBlameOpened` /
`openBlame`: report `false` from routes that never reach the panel, pass the
reporter); `telemetry.json`; `README.md`'s Telemetry section only; tests for
those (`tests/backend/telemetry/tabOpen.test.ts`,
`tests/webview/blameTabPanel.test.ts`, `tests/webview/commandManager.test.ts`);
this file's Status and Report.

## Task and acceptance

Exactly T1's pattern for `tab.reflog`: one `feature` event `tab.blame` per open
attempt with only `ok`, sent when the first load settles (a load error is
`ok: false`; binary, too-large, empty, untracked and unborn states count as
opened), `ok: false` from any route that never reaches the panel (no editor,
no known repository), nothing on refresh, nothing else ever sent. Tests prove
the id, the single event, the outcome, and that no path or content leaks.
`telemetry.json` and the README name the new signal in plain words.

## Report

Not started.
