---
summary: >-
  T1b: wire T1's approved open-and-outcome telemetry into the Blame tab
  (`tab.blame`) through the `reportBlameOpened` hook F4-03 left, following
  the recipe in `src/telemetry/tabOpen.ts`; `telemetry.json` and the README
  disclosure updated.
---

# T1b — Blame tab open-and-outcome telemetry

Status: done — awaiting integration

Needs: T1 (integrated), F4-03 (integrated)

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`070-history/260-release-1-11-0-looking-back.md`, its Telemetry
answer); T1's slice file and report
(`260-release-1-11-0-looking-back/100-t1-open-telemetry.md`); the header of
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

- **Agent / date:** Claude Haiku (Haiku 5.5), 2026-11-23 12:42
- **Branch and commits:** `rel-1.11.0/T1b`
  - `2287ba6b G docs(kb): claim slice T1b (T1b)`
  - `1ed055cf G feat(telemetry): report Blame tab opens and failed routes (T1b)`
  - `49466d66 G test(telemetry): cover the Blame tab open signal (T1b)`
  - `355ca947 G docs(telemetry): declare the Blame tab open signal (T1b)`
  - plus this report's commit.
- **Files changed** (`git diff --stat 9ba29a9c..HEAD`, before this report): 10 files, +156/−41.
  `src/telemetry/tabOpen.ts` (adds `TAB_FEATURE_BLAME = "tab.blame"` to `TAB_FEATURE_IDS`);
  `src/extension/blameTab/blameTabPanel.ts` (the `reportBlameOpened` hook replaced by a
  `telemetry` dep; one `createTabOpenReporter` call); `src/extension/commandManager.ts` (`reportBlameOpen`,
  `false` on the three `showBlame` early returns, `telemetry` passed to the panel); `telemetry.json`
  and `README.md` (Telemetry section only); tests: `tests/backend/telemetry/tabOpen.test.ts`,
  `tests/webview/blameTabPanel.test.ts` (+99/−, 10 cases before, 18 after),
  `tests/webview/commandManager.test.ts` (+9), `tests/webview/telemetryReporter.test.ts` (+14/−).
- **Tests added or changed:** `blameTabPanel`: 3 new `it` plus one `it.each` over five states (8 new
  cases); the failed-load case now asserts the event. `telemetryReporter`: one `it.each` (unset and
  disabled) for `tab.blame`. `commandManager`: the no-editor and not-in-a-repository cases assert
  `tab.blame` ok false beside the command event. `tabOpen`: the id list and the declaration test
  include `tab.blame`. Counts: backend telemetry 98 passed (8 files) and webview 90 passed (3 files)
  after the change; before the change those suites were not re-counted.
- **Gates:**
  - Strict Biome (`--config-path biome.strict.jsonc --error-on-warnings`) on every touched `.ts` and
    `.json`: clean (the config-schema version notice is pre-existing).
  - `pnpm run typecheck`: pass.
  - `npx vitest run --project backend tests/backend/telemetry`: 98 passed.
  - `npx vitest run --project webview tests/webview/blameTabPanel.test.ts tests/webview/commandManager.test.ts tests/webview/telemetryReporter.test.ts`: 90 passed.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Not run: the full `pnpm run test`, `l10n:check` (no user-visible string changed), coverage and Sonar (integrator).
  - Sonar: integrator.
- **Acceptance:**
  - `tab.blame` id added beside `tab.reflog` and `tab.diff`, in `TAB_FEATURE_IDS`, matching the ingest pattern (asserted): met.
  - The panel reports once, when the open's first load settles; a load error is `ok: false`; binary, too-large, empty, untracked and unborn count as opened (tested for each state): met.
  - Routes that never reach the panel report `ok: false`: no active editor and no Git repository for the file, both tested: met.
  - Refresh and later loads stay silent (tested): met.
  - Only the id and `ok` are sent; the test checks the key list and the open's path is never in the event: met.
  - Nothing sent with consent unset or disabled (telemetryReporter test): met.
  - `telemetry.json` and README updated in step, with the same meaning (the README now names the Blame tab and "no repository or file"): met.
  - Ingest checked read-only: `/home/zam/Desktop/prog/_GGL/git-graph-libre-telemetry` has no allowlist beyond the id pattern; nothing changed there.
  - Helper for Statistics: the module header in `tabOpen.ts` still describes how a tab joins; no new helper was needed.
- **Deviations from the slice:**
  - `tests/webview/telemetryReporter.test.ts` is not named in the Touch list; I changed it to add the consent case for `tab.blame`. It is a telemetry test file, which the protocol keeps always allowed, so I treated it as in scope.
  - The panel counts "the open" with an `opening` flag, not the request-id test the reflog pattern uses. The first load that is current after an open settles it. So a refresh that supersedes the open's first load and settles first reports it, once, and the superseded load stays silent. An open retargeted before it settles reports nothing for the old target; the new open reports. Both are one event per open attempt.
  - Two commit messages (`1ed055cf`, `49466d66`) carry a body line `Refs Git Graph Libre release 1.11.0 slice T1b`. It names no issue and is not a closing keyword, but it is not a real `Refs <owner>/<repo>#<n>` line either. Commits are not amended under the rules, so the integrator may ignore it.
- **Open questions / follow-ups:**
  - A panel closed before its first load settles reports no open (same as Reflog and GGL Diff), deliberately.
  - Commit order: `tab.blame` is declared in `telemetry.json` only by `355ca947`, so the backend declaration test in `tests/backend/telemetry/tabOpen.test.ts` fails at `49466d66` and passes from `355ca947` on. Integrate the branch as a whole; the final state is green.
