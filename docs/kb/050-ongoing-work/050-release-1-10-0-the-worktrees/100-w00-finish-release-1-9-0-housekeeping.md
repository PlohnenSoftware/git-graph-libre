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

Status: claimed by Claude Haiku 5.5 on 2026-11-05 18:00
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

Not started.
