---
summary: >-
  KB2: after R90, move the finished Blame view register, the popup and
  context-menu visual review, and this release section to History, update
  the roadmap and the Near-Term Work Order, fix every reference, and
  regenerate the index — following KB1's pattern for release 1.10.0.
---

# KB2 — Move release 1.11.0's finished sections to History

Status: claimed by Claude Haiku on 2026-11-23 18:04

Needs: R90 (done)

Agent: Claude Haiku

Read first: `AGENTS.md`; `docs/kb/README.md` (the index and its rules for
sections); Multi-agent releases (Rules); KB1's five commits as the model:
`git log --format='%h %s' 4c291ec9~1..dba5d3e6` and `git show` each (moves
with `git mv`, then one commit fixing references and regenerating the index,
then the roadmap row).

## Touch

`docs/kb/**` only (moves with `git mv`, reference fixes, the roadmap and the
Near-Term Work Order, `docs/kb/README.md` via `pnpm run kb:index`); this
file's Status and Report (it moves with its directory in step 3, which is
fine — update it at its new path).

## Task and acceptance

1. `git mv` `docs/kb/070-history/240-blame-view.md` and its directory
   `240-blame-view/` to `docs/kb/070-history/240-blame-view.md` and
   `240-blame-view/`. One commit.
2. `git mv` `docs/kb/070-history/250-popup-and-context-menu-visual-review.md`
   to `docs/kb/070-history/250-popup-and-context-menu-visual-review.md`
   (every item V1–V11 is done). One commit.
3. `git mv` `docs/kb/070-history/260-release-1-11-0-looking-back.md` and
   its directory to `docs/kb/070-history/260-release-1-11-0-looking-back.md`
   and `260-release-1-11-0-looking-back/`. One commit.
4. Fix every reference to the old paths anywhere under `docs/kb/` (and in
   `AGENTS.md` / `README.md` if any point there): `grep -rn` for each old
   file name and directory name must find nothing afterwards. Regenerate
   the index (`pnpm run kb:index`); `pnpm run kb:check` and
   `node ./docs/kb/housekeeping.mjs --check` must pass. One commit.
5. Roadmap (`docs/kb/050-ongoing-work/030-implementation-roadmap.md`): add
   or update the rows for the Blame view and the Reflog tab as **Done in
   `v1.11.0`** (prepared `2026-11-23`, release commit `74ff94fe`, not yet
   tagged), pointing at the History records, in the style of the
   "18 Git worktree support … Done in `v1.10.0`" row. If no row exists for
   them, add one per feature in the table's style. Near-Term Work Order
   (`020-near-term-work-order.md`): the "Now" paragraph becomes "Prepared
   (`2026-11-23`): release 1.11.0 'Looking Back' — awaiting the
   maintainer's tag and push", the Blame "Planned" and popup "Also open"
   paragraphs are marked done with a pointer to History; nothing else
   changes. One commit.

Every sentence you write must be true; take facts from the moved sections.
American English.

Checks: `pnpm run kb:index`, `pnpm run kb:check`,
`node ./docs/kb/housekeeping.mjs --check`, the grep from step 4. Claim and
changes are separate signed commits; never push.

## Report

Not started.
