---
summary: >-
  Release 1.11.0 "Looking Back" (`2026-11-23`): everything on `main` since
  v1.10.0 plus the finished Reflog tab and the finished Blame view; popup
  fixes optional; Git Graph+ rebase and history work stays on
  `gg-plus/next`. Holds the maintainer's answers of `2026-11-23` for a long
  autonomous run (publish scope, name, Blame entry points, translations,
  Sonar, escalation, parallelism, worktrees, binaries, telemetry, renders,
  stop rule), the tracks, and slices T1 (open telemetry), P1 (popup fixes)
  and R90 (the release).
---

# Release 1.11.0 — "Looking Back" (`2026-11-23`)

Status: in progress. Integrator: the orchestrating Claude session
(Opus 5.5). Integration branch: `main`, local and unpushed. Multi-agent
releases (Rules) applies, with the answers below.

## Scope (maintainer, `2026-11-23`)

- **In:** everything already on `main` since `v1.10.0` (worktree menu
  polish, topological order on the engine, the engine upstream integration
  R01–R09, the GGL Diff tab fixes, the Reflog tab F1-01–F1-05 and
  F1-09/F1-09F, the unreachable-commits fix U1); the **finished Reflog
  tab** (F1-08, F1-06, F1-07, in that order); the **finished Blame view**
  (F4-02–F4-08; F4-09 deferred on BQ8 profiling).
- **Optional:** the popup fixes V1–V11 (slice P1), and any other useful,
  gated work; "it can be polished later". Work that is not usable yet stays
  on `gg-plus/next`.
- **Out:** interactive rebase (F2) and history/statistics (F3), which
  continue on `gg-plus/next` (registers "Interactive rebase" and "History
  and statistics view") and are rebased onto `main` after this release is
  prepared. Their backend-only foundations stay there too.

## Maintainer answers (`2026-11-23`), binding for this run

| Topic | Answer |
| --- | --- |
| Publish | **Prepare only**: the gated release commit on local `main`; no tag, no push. The maintainer tags and publishes. |
| Name | **"Looking Back"** (Blame and the Reflog tab both look back in history). |
| Popup VQ1 | **Icon buttons, Remove included**, for the Worktrees popup's upkeep actions (V2). |
| Blame entry points | **No editor title-bar icon.** Command Palette plus the editor, Explorer, Source Control and Commit Details context menus only (overrides F4-07's `editor/title` item). |
| Translations | **Agents translate** nl, pl, zh-cn and zh-tw themselves; reports say a native review would help. |
| SonarQube red | **Fix until `OK`**; release prep waits for `OK`, dispatching fix slices as needed. |
| Escalation | A failed or blocked slice is **re-dispatched to Muse Code once** in the same worktree with the failure analysis; if it fails again, **the orchestrator finishes it**. |
| Parallelism | **No limit**: run as many independent tracks as there are tasks. |
| Shared files | **Tracks may overlap** on `l10n/bundle.l10n*.json`, `package.json`, `src/extension/messageHandler.ts`, `src/types.ts` and `src/webview/main.ts`; the integrator rebases and resolves the textual conflicts. Within one track, slices stay serial. This overrides the Blame overview's serialization rule for this run. Each track adds l10n keys in its own block (Reflog inside the `reflog.*` block, Blame appended at the end, others in their own named block). |
| Worktrees | Under `/home/zam/Desktop/prog/_GGL/.ggl-wt/` (now a standing rule in Multi-agent releases). |
| Agents | Claude Haiku for easy slices, headless Muse Code (`muse exec --yolo`) for complex ones; **also the `agy` CLI with Gemini 4 Argon and Gemini 4 Neon** (maintainer, `2026-11-23`: "they have separate quota"), run headless as `agy -p "<prompt>" --model gemini-4-argon-high\|gemini-4-neon-high --dangerously-skip-permissions --print-timeout 0` inside the slice worktree (`prompts/run-agy.sh`). |
| Binaries | **Build every platform locally** (`pnpm run engine:build:all`, `engine:smoke`); the GitHub `verify-vsix.yml` run is the maintainer's after the push. |
| Telemetry | **Approved (slice T1):** measure whether each tab was opened (the person clicked its button or ran its command) and whether that went without errors, and the same for the worktree buttons. Nothing about what was looked at or how options were used. |
| Renders | **Local files only**: headless PNGs on disk, paths listed in reports and the final summary. |
| Stop rule | **Keep going**: prepare 1.11.0, then keep advancing `gg-plus/next` until nothing workable is left or a decision is truly blocked; summarize at the end. |
| Branches | The integrator deletes integrated local branches (standing rule, Multi-agent releases). |

## Tracks

| Track | Slices (serial within the track) | Integration branch |
| --- | --- | --- |
| Blame | F4-02 → F4-03 → F4-04 → F4-05 → F4-06 → F4-07 → F4-08 | `main` |
| Reflog | F1-08 → F1-06 → F1-07 | `main` |
| Telemetry | T1 (then the Blame and Statistics tabs follow its pattern) | `main` |
| Popups | P1 (V1, V3–V11, then V2) | `main` |
| Rebase | F2-03 → F2-04 → F2-05 → F2-07 … | `gg-plus/next` |
| History | F3-02 → F3-03 → F3-04, F3-05; then file history F3-07 → F3-08 | `gg-plus/next` |
| Release | R90 after every `main` track is integrated | `main` |

## Slices

| ID | Work | Needs | Agent | Status |
| --- | --- | --- | --- | --- |
| T1 | Open-and-outcome telemetry for tabs and worktree buttons | — | Muse Code | integrated `70f2b583` |
| P1 | Popup fixes V1–V10 | — | Muse Code → Gemini 4 Neon | integrated `9a61b9e9` |
| P1b | Popup fix V11 (Create Worktree on a branch another worktree holds) | maintainer decision | — | **blocked** (see below) |
| T1b | Blame tab open-and-outcome telemetry (`tab.blame`) | T1, F4-03 | Claude Haiku | integrated `7ed42e61` |
| R90 | Release 1.11.0 | every `main` track | orchestrator | waiting |

## Blocked — waiting for the maintainer

The maintainer is away (`2026-11-23`, from about 12:40 local) and asked that
anything unsolvable within reason be marked here while the rest continues.

- **P1b — popup fix V11.** In the menu of a branch held by another worktree,
  "Create Worktree…" opens the Open Worktree dialog that "Open Worktree…" two
  rows above already offers. The review leaves the choice to the maintainer:
  (a) drop the item from that menu, or (b) open Create Worktree with the two
  modes Git still allows there (a new branch from it, a detached HEAD).
  Behavior, not appearance; no recommendation was recorded, so no agent
  picks. Not needed for 1.11.0 (V1–V10 shipped without it).

## Integration log

- `2026-11-23`: section written from the maintainer's answers. Already on
  `main`: U1 (`0a94f150`), F4-01 (`1aac24df`), F1-05 (`f0a51986`). On
  `gg-plus/next`: F2-00, F2-01a, F2-01b, F2-02, F3-00, F3-01. 63 integrated
  local branches deleted under the new branch rule.
- `2026-11-23`: T1 (Muse Code) integrated at `70f2b583` by fast-forward:
  `src/telemetry/tabOpen.ts` (`createTabOpenReporter`, feature ids
  `tab.reflog` and `tab.diff`): one `feature` event per open attempt with
  only `ok`, sent when the open's first load settles, and `ok: false` from
  routes that never reach a panel (no repository, a refused toolbar open, a
  GGL Diff fallback). The worktree Copy Path button now reports
  `copyWorktreePath` with its outcome; every other worktree button already
  reported once with its outcome through `registerAction()`. The ingest
  validates feature ids by pattern only, so nothing changes there.
  `telemetry.json` and the README's Telemetry section are updated. Open:
  Open in New Window / Open Here / Switch Graph / Add to Workspace / Reveal
  report twice per click (action plus delegated command), as before this
  slice. The Blame tab (F4-03 onward) and the Statistics tab (F3-02, on
  `gg-plus/next`) add `tab.blame` / `tab.statistics` the same way. Gates on
  `70f2b583`: strict Biome on 16 files, typecheck, KB check, backend 1,575 passed
  (60 skipped in the worktree) and webview 1,130 passed.
- `2026-11-23 11:20Z`: **Muse Code quota exhausted** (HTTP 429, "Subscription
  quota exhausted", window resets `16:00:06Z`; `muse-ember-1.0` answered a
  one-word probe but failed real runs). Cut off mid-slice, with their signed
  commits on the slice branches and uncommitted edits left in the worktrees:
  F4-03 (6 commits), F1-08 (2), P1 (9), F2-03 (6), F3-07 (0) and F3-03 (the
  Muse continuation of Haiku's blocked first attempt). A detached script,
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/prompts/resume-at-reset.sh`,
  relaunches all six at `16:01:30Z` with a continuation note
  (`prompts/continue.note`): read the branch's commits and the uncommitted
  diff, keep what is correct, finish the slice. Until then only easy Haiku
  work runs (release-notes groundwork), to spare the Claude quota.
- `2026-11-23 ~12:00Z`: the maintainer added the `agy` CLI (Gemini 4 Argon
  and Neon, separate quota). Both answered a headless probe. The muse resume
  script was stopped and the six cut-off slices relaunched on `agy` with the
  same continuation prompts: F4-03, F1-08 and F2-03 on
  `gemini-4-argon-high`; P1, F3-07 and F3-03 on `gemini-4-neon-high`.
- `2026-11-23 ~12:00Z`: **gix `main` (`00e62ee`, gix 0.91) breaks the engine
  build — API changes, not a packaging problem.** The maintainer moved the
  workspace to `gix = { git = …, branch = "main" }` (staged in the main
  checkout, uncommitted). Five compile errors from three deliberate upstream
  breaking changes: `7aa36be` removed `gix::sec::trust::Mapping` and
  `b91fe7b` made `ThreadSafeRepository::discover_opts` take a callback
  `(open::Options, Trust) -> open::Options` (it receives
  `Options::default_for_level(trust)`, so `|o, _| o.bail_if_untrusted(true)`
  is exact); `1d94b9d` made `prepare_diff::Operation::InternalDiff` carry a
  validated `TextChange` (`intern_source()` is gone; a new `NeitherExists`
  variant) and `Platform::set_resource` take `Option<ObjectId>`. Upstream's
  `line_counts()` still tokenizes with terminators stripped
  (`TextChange::patch_input()`), so the numstat shim (D30b) stays: it now
  feeds `TextChange::patch_data()` through `sources::byte_lines`, which keeps
  terminators. With those edits (unstaged, in
  `engine/native/core/src/repository.rs` and `diff.rs`): `cargo check
  --all-targets` clean; `engine:fmt`, `engine:lint`, `engine:test` all pass;
  the release addon builds and smokes; `vitest --project backend` 1,635
  passed, engine parity tests included. Whether it ships in 1.11.0 (which
  needs every platform binary rebuilt and an engine version bump) is the
  maintainer's call.
- `2026-11-23 12:33`: the maintainer chose to **ship gix 0.91 in 1.11.0** and
  committed it as `11aec54b` (the workspace on gitoxide `main`, pinned by
  `Cargo.lock` to `00e62ee`, plus the integrator's three adaptations). The
  engine version stays **1.0.32**: by the rule on `EXPECTED_ENGINE_VERSION`
  (`src/backend/engine/addon.ts`) a bump is due only when the TypeScript
  relies on behavior an older binary lacks, and a dependency refresh adds
  none (release 1.10.0's W01 refresh did not bump either); this also keeps
  `gg-plus/next`'s mailmap engine at 1.0.33 without a clash. All six
  platform binaries are rebuilt on gix 0.91 for R90.
- `2026-11-23`: P1 integrated at `9a61b9e9` for V1–V10 (Muse Code landed V1,
  V3, V4, V6–V10 before its quota cutoff; Gemini 4 Neon finished V5, V2, the
  renders and the report): no doubled ellipsis, the Worktrees popup rows in
  one shape with icon buttons for Copy Path, Lock/Unlock, Move and Remove
  (VQ1), a wider Create Worktree folder field, the finish step as one-click
  choices, a shorter Delete Branch dialog with a required removal checkbox,
  dialog lists, the remote checkout prompt's inline error, error text beside
  its icon, "Remove" instead of "Yes", two-line checkbox labels. Glue outside
  Touch, accepted: `webviewL10n.ts` for the new strings and the generated
  octicons (`file-moved`, `lock`, `trash`, `unlock`). Renders under
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/P1/`. V11 is P1b, blocked
  above. Gates on `9a61b9e9`: strict Biome on 17 files, typecheck,
  `l10n:check`, KB check, backend 1,579 passed (60 skipped in the worktree)
  and webview 1,200 passed.
- `2026-11-23`: T1b (Claude Haiku) integrated at `7ed42e61`: `tab.blame` in
  `src/telemetry/tabOpen.ts`; the Blame panel reports once when an open's
  first load settles (a load error is `ok: false`; binary, too large, empty,
  untracked and unborn count as opened), `showBlame`'s early returns (no
  editor, no repository) report `ok: false`, refreshes stay silent;
  `telemetry.json` and the README name the signal. Gates on `7ed42e61`:
  strict Biome on 8 files, typecheck, KB check, backend 1,579 passed (60
  skipped in the worktree) and webview 1,210 passed.
- `2026-11-23`: early SonarQube scan on `main` (version still 1.10.0, so all
  1.11.0 work counts as new code): gate ERROR, 15 new issues; slice S1 holds
  the list. S1a (Claude Haiku) integrated at `e342ce2c`: twelve mechanical
  fixes, among them the two `biome-ignore` control-character regexes
  replaced by a shared `hasControlCharacter` in `src/backend/utils/string.ts`
  (no suppression left). S1b (the two `blame.ts` complexity refactors) runs
  on Gemini 4 Argon; S1c (`reflogTab/view.ts`) waits for F1-06 and F1-07.
  Gates on `e342ce2c`: strict Biome on 11 files, typecheck, KB check,
  backend 1,580 passed (60 skipped in the worktree) and webview 1,232
  passed.
- `2026-11-23`: S1b (Gemini 4 Argon, `agy`) integrated at `0cfaa6c5`:
  `parseBlamePorcelain` and `loadBlame` split into cohesive helpers to bring
  their cognitive complexity under the profile's limit, behavior unchanged
  (the 41 blame tests pass unedited). Gates on `0cfaa6c5`: strict Biome,
  typecheck, KB check, backend 1,580 passed (60 skipped in the worktree) and
  webview 1,232 passed. The next Sonar scan confirms the counts.
- `2026-11-23 12:05Z`: **Gemini 4 Argon quota exhausted** ("Individual quota
  reached", resets in about 167 hours). F2-04 stopped after five commits plus
  uncommitted tests; it is queued for Muse Code at its reset (`16:01:30Z`,
  `prompts/muse-queue-at-reset.sh`, queue `/home/zam/Desktop/prog/_GGL/.ggl-wt/muse-queue.txt`)
  with the continuation note. Gemini 4 Neon still answers; 1.11.0 slices get
  it first, Git Graph+ slices wait for Muse Code.
- `2026-11-23`: L1 (Claude Haiku) integrated at `98abaffb`: a review of the 114
  strings added or changed since v1.10.0 in nl, pl, zh-cn and zh-tw; 14 values
  fixed (the bundles' own terms for fetch and working tree, "bare" not
  "empty" in Polish, full-width colons, a clearer zh "new branch from {0}"),
  the rest unchanged. Notes for a native speaker are in its record
  (`140-release-1-11-0-looking-back/130-l1-translation-review.md`); the zh-tw
  repository word stays the maintainer's choice. Gates on `98abaffb`:
  `l10n:check` complete, strict Biome on the bundles, KB check, backend
  1,592 passed (60 skipped in the worktree) and webview 1,276 passed.
- `2026-11-23 ~12:10Z`: **Gemini 4 Neon quota exhausted** too (resets in about
  four hours). The F4-05 squash merge (F4-05 overlapped F4-08 in 18 files;
  same treatment as F1-06) stopped mid-resolution and is queued first for
  Muse Code at its reset (`16:01:30Z`), then F2-04. Until then only Claude
  Haiku runs, on easy work. Reflog: complete (F1-06 squash `953d4f55`); its
  release notes are in `CHANGELOG.md` and `README.md` (`0c4b4b41`).
