---
summary: >-
  KB2: after R90, move the finished Blame view register, the popup and
  context-menu visual review, and this release section to History, update
  the roadmap and the Near-Term Work Order, fix every reference, and
  regenerate the index — following KB1's pattern for release 1.10.0.
---

# KB2 — Move release 1.11.0's finished sections to History

Status: done — awaiting integration

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

- **Agent / date:** Claude Haiku 5.5 (claude-haiku-5-5), 2026-11-23 18:04 claim; work through the report commit
- **Branch and commits:** `rel-1.11.0/KB2` —
  - `a63a3a42` G docs(kb): claim slice KB2 (History moves for 1.11.0)
  - `1c367ae3` G docs(kb): move the Blame view to History (KB2)
  - `570ee1fe` G docs(kb): move the popup and context-menu visual review to History (KB2)
  - `aed49035` G docs(kb): move release 1.11.0 "Looking Back" to History (KB2)
  - `ba27fadc` G docs(kb): fix references to the moved sections and regenerate the index (KB2)
  - `5bd0fae4` G docs(kb): mark the Blame view, the Reflog tab and the popup review done in 1.11.0 (KB2)
  - the report commit (this section and the status line), see `git log`
- **Files changed:** 31 files in `83e0235b..5bd0fae4` (91 insertions, 93 deletions, rename-aware; the reference commit `ba27fadc` alone touches 26 files): the three moves (blame register and its 9 slice files, popup review, release 1.11.0 overview with the 13 files of its directory, including this one), `docs/kb/README.md` (regenerated), the roadmap and the Near-Term Work Order, and the references in the other files under `docs/kb/` (the webview styling guide, the Git Graph+ plan and its Blame note, and the moved files' own cross-references). `AGENTS.md`, `README.md`, `CHANGELOG.md`, `package.json` and all code are untouched.
- **Tests added or changed:** none (documentation only). Test counts: not run.
- **Gates:** `pnpm run kb:index` (regenerated the index, the only README change); `pnpm run kb:check` exit 0; `node ./docs/kb/housekeeping.mjs --check` exit 0; `grep -rnE "110-blame-view|090-popup-and-context-menu|140-release-1-11-0" docs/kb AGENTS.md README.md` finds nothing; every commit shows `G`. Biome and l10n were not run (no touched .ts/.mjs/.json, no user-visible strings). Sonar: integrator.
- **Acceptance:**
  1. Blame view moved with `git mv` (file and directory) to `070-history/240-blame-view.md` and `240-blame-view/`: met.
  2. Popup review moved to `070-history/250-popup-and-context-menu-visual-review.md`: met (its own status line already says every item V1–V11 is done).
  3. Release 1.11.0 overview moved to `070-history/260-release-1-11-0-looking-back.md` and `260-release-1-11-0-looking-back/`: met. Its content is unchanged, and its own status line still says `in progress`; the integrator owns that line.
  4. Every reference fixed (68 matching lines before the fix, across the moved files, the index and the other files), grep finds nothing, index regenerated, kb checks pass: met.
  5. Roadmap rows added for the Reflog tab and the Blame view as `Done in v1.11.0` (prepared `2026-11-23`, release commit `74ff94fe`, not yet tagged), pointing at the History records; Near-Term Work Order's Now paragraph, Blame paragraph and popup paragraph changed as the slice says: met.
- **Deviations from the slice:**
  - The slice's Touch list is `docs/kb/**`, so the historical Report lines inside moved files that name old paths (for example a commit's file list) were rewritten to the new paths, as KB1 did. Those lines describe the same files at their new location.
  - The Blame register's own status line still says `in progress (2026-11-23), for release 1.11.0`, and the release overview's says `in progress`. The slice calls both finished work; I left their text unchanged and did not edit them, because the slice and the overview's own rules leave that to the integrator. The roadmap and work-order rows say `Done in v1.11.0`.
  - The Near-Term Work Order's Blame paragraph says F4-01 to F4-08 are integrated, with F4-09 deferred. The Blame register's table confirms this; the register's own text was not edited.
  - No new Reflog or Blame row IDs were invented; the rows are named by their Git Graph+ feature (Feature 1 for the Reflog tab, Feature 4 for the Blame view).
- **Open questions / follow-ups:** For the integrator: decide the release overview's status line (`in progress` vs released) and the Blame register's status line at the tag, and whether the roadmap's Phase 18 row (which still says popup polish continues in 1.11.0 (P1)) should be reworded now that P1 and P1b are done. Nothing was pushed; the branch `rel-1.11.0/KB2` is local.
