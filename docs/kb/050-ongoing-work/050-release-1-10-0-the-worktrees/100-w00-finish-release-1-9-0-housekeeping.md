---
summary: >-
  W00 · wave A · ready · docs · knowledge base only: D90's open step 7. Move
  the Release 1.9.0 section and its directory to History with `git mv`, update
  the Phase 8, 10, 16 and 17 status lines and their roadmap rows, so Ongoing
  work holds only release 1.10.0. Optionally (decision Y15), promote the
  release agent protocol and integrator procedure into standing Rules
  sections.
---

# W00 — Finish release 1.9.0's housekeeping

Status: integrated `79e2ecc` (`2026-11-05`)
Needs: —
Decisions: Y15 (promote the protocol into Rules, or not)
Kind: docs (knowledge base only) · Size budget: moves plus ~60 changed lines
Source: D90 — Release 1.9.0, step 7; Order of this document

## Goal

Ongoing work should show only what is in progress. Release 1.9.0 shipped on
`2026-10-20`, and its section still sits there.

## Steps

1. `git mv` the section `050-ongoing-work/040-release-1-9-0-the-diff.md` and
   its directory to the end of History, at the next free prefix (`170` after
   Closed GitHub issues and their threads). Update its status paragraph to
   "released `2026-10-20`".
2. Update the `Status:` lines of Phase 8 (complete; move it to History's
   completed phases if nothing is left), Phase 10, Phase 16 and Phase 17,
   and their rows in Implementation Roadmap, together, as that section
   requires.
3. Under Y15 (b): create `020-rules/040-multi-agent-releases.md` from the
   lasting parts of the 1.9.0 agent protocol and integrator procedure, leave
   the 1.9.0 copies as history, and have 1.10.0's protocol point to the new
   Rules section.
4. Run `pnpm run kb:index`, `pnpm run kb:check` and `pnpm run kb:graph`.

## Touch

`docs/kb/**` only

## Acceptance

`kb:check` passes, and no link or title reference to the moved sections is
broken. Search for each moved title.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:03
- **Branch and commits:** `wt-1.10.0/W00`, base `9e303da`:
  - `a2aec28 G docs(kb): claim W00, finish release 1.9.0 housekeeping (W00)`
  - `63483e4 G docs(kb): move the release 1.9.0 section to History (W00)`
  - `8123fc4 G docs(kb): move Phase 8 to History and bring the status lines up to date (W00)`
  - plus the commit that adds this report (every line `G`; the hash is in `git log`).
- **Files changed:** 69 files, +145/−139 (`git diff --stat -M 9e303da`, before the report commit). 64 are renames: the 1.9.0 section and its 62 directory members (61 at 100%, with link-only edits in the rest), and the Phase 8 file. The other 5 are modified: this slice file (claim and report), the Implementation Roadmap (Phase 8 row), Phase 16 and Phase 17 section headers, and the generated `docs/kb/README.md` index (66 lines). The moved overview also has its summary and status paragraph edited.
- **Tests added or changed:** none (knowledge base only). Count before and after: not applicable.
- **Gates:** biome not run (no `.ts`, `.mjs` or `.json` touched); typecheck not run (docs only); tests not run (docs only); l10n n/a; `pnpm run kb:check` exit 0, run after the final `pnpm run kb:index`; Rust arm n/a; Sonar: integrator. Ad hoc relative-link checker over `docs/kb`: 370 links, 0 broken, before and after the moves.
- **Acceptance:**
  - Step 1 (move the 1.9.0 section, status paragraph to released `2026-10-20`): met. The section is at `070-history/170-release-1-9-0-the-diff.md` with its directory; its summary and status now say released and moved.
  - Step 2 (Phase 8, 10, 16, 17 and their roadmap rows): met. Phase 8 is complete and its section is at `070-history/020-roadmap-completed-phases/120-phase-8-commit-comparison-and-multi-select.md`. Phase 16's header was stale (in progress as of `2026-10-16`, "nothing in the extension reads it yet") and is now `2026-10-20`. Phase 17 said "unpublished" and now says released as `v1.9.0`. Phase 10 already matched its roadmap row, so it is unchanged.
  - Step 4 (`kb:index`, `kb:check`): met. `kb:graph` not run, per the integrator's instruction.
  - `kb:check` passes: met (exit 0). No broken link or title reference: met. A grep for the old path finds only this slice file's own text and one historical line in `070-history/170-release-1-9-0-the-diff/236-d13g-swap-icon.md` (its "Files changed" note, left as written). Titles are unchanged.
- **Deviations from the slice:**
  - Step 3 skipped, per the integrator (decision Y15 is open). `kb:graph` not run, per the integrator.
  - Beyond the listed steps: the Phase 16 header (stale status and a false sentence about the engine), the Phase 17 "unpublished" wording, and the 1.9.0 overview's summary ("Next release" to "Released") were corrected, all status text.
  - One mistake, caught before any commit: a second run of the link rewriter re-applied its mapping to links it had already rewritten, breaking 57 links in the moved overview and one in its agent protocol. The link check caught it. I restored both files from the committed state in `63483e4`, reapplied the two overview text edits, and re-checked: 0 broken. No broken link was committed.
- **Open questions / follow-ups:**
  - `050-ongoing-work/020-near-term-work-order.md` still lists "D90 step 7" as remaining (around line 80) and Phase 8's comparison as remaining (around line 175). Both are stale now. I did not edit it, since it is not one of the steps the slice names. The integrator should decide.
  - The release overview and its W00 row are integrator-owned, and I did not touch them. The overview still says "D90 — Release 1.9.0, step 7" in its goals table.
  - The W00 summary in the index still says "ready". That comes from this slice file's front matter, which I left alone (the protocol allows only the Status line and the Report).
