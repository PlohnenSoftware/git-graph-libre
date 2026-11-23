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
| Agents | Claude Haiku for easy slices, headless Muse Code (`muse exec --yolo`) for complex ones. |
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
| T1 | Open-and-outcome telemetry for tabs and worktree buttons | — | Muse Code | ready |
| P1 | Popup fixes V1–V11 | — | Muse Code | ready |
| R90 | Release 1.11.0 | every `main` track | orchestrator | waiting |

## Integration log

- `2026-11-23`: section written from the maintainer's answers. Already on
  `main`: U1 (`0a94f150`), F4-01 (`1aac24df`), F1-05 (`f0a51986`). On
  `gg-plus/next`: F2-00, F2-01a, F2-01b, F2-02, F3-00, F3-01. 63 integrated
  local branches deleted under the new branch rule.
