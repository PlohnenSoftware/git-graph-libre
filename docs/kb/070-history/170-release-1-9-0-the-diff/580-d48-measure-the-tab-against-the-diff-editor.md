---
summary: >-
  D48 · wave D · needs D46, D47 · measurement and docs · ≤120 lines: time
  "click to colored hunks" for the GGL Diff tab and for VS Code's diff
  editor, on a small file and on one over 10,000 lines, with a release
  engine build, and record the numbers in Phase 17. The display half is
  the maintainer's.
---

# D48 — Measure the tab against the diff editor

Status: agent half integrated a9956df (display half: maintainer)
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

- **Agent / date:** Muse Code (muse-wonder-full-1.0, general-purpose, inherited runtime model; no named-model selector in this runtime — the integrator records it), 2026-10-19 17:05 Europe/Warsaw. Agent half only: no VS Code window was opened, no display automation, no screenshots.
- **Branch and commits:** `diff-1.9.0/d48` from `47dad60`, all `G`, no push — `6a2d49f G docs(release): claim D48 agent half (D48)`; `3107adb G docs(phase17): record D48 agent-half tab measurements (D48)`; plus the signed report commit carrying this section.
- **Files changed:** the Phase 17 record "No way to route a computed diff into the editor" (+92/−0: the "D48 agent-half measurements" subsection under "A GGL Diff tab, measured" — environment, pre-stated method, the two cases, both tables, and the one sentence on where the tab wins and where it doesn't), this slice file (claim, status, report). No product code, tests, dependencies or gate files touched. Measurement scripts (`measure.ts`, `proxy.mjs`, `vscode-stub.cjs`, `build.mjs`, `analyze.py`) and raw JSONL live outside the repo at `/tmp/d48-measure/`; the esbuild bundle and `out/` they generated under `node_modules/.cache/` were deleted, and the tree is clean.
- **Tests added or changed:** none (measurement and docs slice). Counts unchanged.
- **Gates:** `pnpm run kb:check` pass (the slice's only named gate; no section added/removed/renamed and no front matter changed, so no `kb:index` run was needed); `pnpm run engine:build:release` + `engine:smoke` OK at engine 1.0.26 before measuring (never the debug addon); `node esbuild.js --production` for the bundle size (8,388 bytes). Biome, typecheck, test suite, l10n: not run — no code, strings or tests changed. Rust arm n/a (no `engine/**` change). Sonar: integrator.
- **Acceptance:** "`kb:check` passes" — met. "Every number in the table names how it was measured" — met: each row says its instrument (route-line integers, own `performance.now()` timing, seam float, or labeled `@vscode/diff` proxy), with n=10, median and worst throughout, warmups (2 per in-process series) excluded and stated, and machine, Node, engine build/version and bundle size recorded. Headline numbers: small case (`ae6ddf6`, `src/contextMenuVisibility.ts`, 119→120 lines) whole `load()` median 1.87 ms across 10 fresh processes, 0.75 ms warm (`read=` 1/0, `diff=` 1/1); large case (`683d60a`, `graphify-out/graph.json`, 181,604→208,191 lines) `diff=` median 5114/5086.5 ms with `hitTimeout=1` in all 20 route lines, whole `load()` 5170.6/5134.8 ms. Proxies on the large texts: `@vscode/diff` TypeScript backend 5131.8 ms median, also timed out at 1 change; its WebAssembly backend 2579.7 ms, completing 1,879 changes. Engine read of both large sides: 17.3 ms at the seam.
- **Deviations from the slice:** (1) **Step 3 is "maintainer", exactly as the slice provides:** no display in this session, so click-to-colored-hunks (tab cold, tab warm, `vscode.diff`) was not measured in any form, and D44's `painted ms=` could not be collected headlessly; the record says so in its first paragraph. The headless "cold" series is ten fresh Node processes, labeled process-cold everywhere — it is not a cold webview open. (2) **The large case is `graphify-out/graph.json`, not `pnpm-lock.yaml`:** the lockfile's history peaks at 7,126 lines, so the slice's example cannot meet its own over-10,000-lines criterion in this repository; the chosen pair is the most recent change to the only file modified at over 10,000 lines on both sides, and the record explains this. (3) **Step 2's "open each change in the tab ten times"** was done through the tab's real data path (`load()` on D47-shaped requests) rather than by opening tabs, which needs an editor; `read=`/`diff=`/`hitTimeout` are the genuine logged fields, cold/warm apart, ten each, median and worst reported. (4) The editor side is represented only by `@vscode/diff` 0.0.2-87 compute proxies, labeled as proxies in every row; VS Code Insiders 1.143.0-insider (`a0c6520`) is installed on this machine (version string read, never launched), so the maintainer's half can record its editor version from their own run. (5) Two harness smoke runs (one cold-small load, a partial proxy-small run) verified the harness before the formal series and are excluded from every statistic; within the formal series nothing was repeated, dropped or re-picked. Size: 93 changed lines before this report against the ~120 guide.
- **Open questions / follow-ups:** the display half is the maintainer's, concretely: step 3's 60 fps click-to-colored-hunks for tab cold / tab warm / `vscode.diff` on these same two cases (`ae6ddf6` `src/contextMenuVisibility.ts`; `683d60a` `graphify-out/graph.json`), collecting `read=`/`diff=`/`painted ms=` from the real log, and recording the editor version used. Worth the maintainer's eye when doing it: on the large case the tab will sit at the 5 s computation cap and show one whole-file change (as `vscode.diff` with `advanced` would, per the TypeScript proxy; `advanced-wasm` would not, per the WebAssembly proxy at 2.58 s) — whether the port's timeout behavior on very large files wants its own follow-up slice is a maintainer/integrator call, not made here. The large-case `buildRows` numbers time that degenerate timeout payload (208,192 rows, nothing collapsible); a completed large diff's row cost remains unmeasured because no completed engine diff of this pair exists under the default cap.
