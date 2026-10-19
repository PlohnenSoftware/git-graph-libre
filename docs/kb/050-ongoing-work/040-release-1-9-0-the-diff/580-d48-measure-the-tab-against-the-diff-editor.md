---
summary: >-
  D48 · wave D · needs D46, D47 · measurement and docs · ≤120 lines: time
  "click to colored hunks" for the GGL Diff tab and for VS Code's diff
  editor, on a small file and on one over 10,000 lines, with a release
  engine build, and record the numbers in Phase 17. The display half is
  the maintainer's.
---

# D48 — Measure the tab against the diff editor

Status: claimed by Muse Code (agent half only; display half: maintainer) on 2026-10-19 16:51
Needs: D46, D47
Decisions: —
Kind: measurement and docs · Size budget: ≤ 120 changed lines
Source: Phase 17, "A GGL Diff tab, measured" ("Where it can be faster, and where it can't")

## Goal

Find out with numbers whether the tab is faster than the diff editor, and
where. A webview tab has to start cold, while the diff editor is already
loaded, so small files may favor the diff editor.

## Read first

- [The agent protocol](010-agent-protocol.md)
- The Phase 17 record named under *Source*
- "Benchmarking the two backends" under Phase 16: measure only
  `engine:build:release`, never a debug build

## Steps

1. **Pick two file changes** from this repository's history: a small
   change to a file of under 200 lines, and a change to a file of over
   10,000 lines (a large `pnpm-lock.yaml` change works). Record the commit
   and path of each.
2. **The tab's own timings.** With `pnpm run engine:build:release`, open
   each change in the GGL Diff tab ten times. Measure two cases apart:
   **cold** (no GGL Diff tab open; close it between runs) and **warm**
   (the tab already open in the background, D44's retained panel).
   From the log, collect D45's `read=` and `diff=` and D44's `painted
   ms=`. Report the median and the worst.
3. **Click to colored hunks, both ways.** The diff editor gives an
   extension no timing, so use a 60 fps screen recording of each open,
   from the click to the first frame with colored hunks, for the tab cold,
   the tab warm, and `vscode.diff`. Count frames, then convert to milliseconds. This step
   needs a display; if you have none, write "maintainer" in its place.
4. **Record the results** as a table in the Phase 17 record, under "A
   GGL Diff tab, measured". Give the machine, the VS Code version, the
   engine version and the numbers, and one sentence on where the tab
   wins and where it doesn't.

## Touch

The Phase 17 record "No way to route a computed diff into the editor"
only

## Acceptance

- `kb:check` passes.
- Every number in the table names how it was measured.

## Report

_(not started)_
