---
summary: >-
  Research (`2026-11-08`, read-only, no implementation ordered) into three
  Git Graph+ features the maintainer wants in Git Graph Libre, in order of
  importance: the Reflog tab, interactive rebase, and a "timeline". Git
  Graph+ (`the0807/git-graph-plus`, Apache-2.0, newest `main` `c6c2a9a`)
  has nothing called a timeline; its Statistics view is the likely meaning.
  Holds the preliminary licensing verdict, the main findings, a proposed
  order, and the decisions to discuss; each feature's slices are a
  subsection.
---

# Git Graph+ features: research and slice plan (`2026-11-08`)

Status: research done. On `2026-11-09` the maintainer ordered the reflog
slices F1-01 to F1-09, now in implementation as "Reflog tab" (Ongoing work);
interactive rebase and the timeline wait for later releases. The maintainer
also asked whether Git Graph+ code may be used under this project's AGPL:
Apache-2.0 code may come in one way, with its license text, its copyright
line ("Copyright 2026 the0807, bkk21"; there is no `NOTICE` file) and a
notice of changes, but the reflog slices copy none. G0 stays open.

The maintainer asked, while the engine integration ran: research how Git
Graph+, at its newest `main` commit, implements three features "we want to
integrate in our product", in order of importance: (1) the Reflog tab,
(2) interactive rebase, (3) timeline. "Don't order any implementation work
on it yet, just research, then plan slices, and we will discuss the plan."
Three read-only research agents worked in parallel, one per feature (Claude
Sonnet for the first two, Claude Haiku for the timeline survey). Their notes
are the three subsections, lightly edited (spelling, front matter), so
their wording is theirs.

## Source and licensing (preliminary verdict)

- **Source.** `/home/zam/Desktop/prog/_GGL/git-graph-plus`, `origin`
  `git@github.com:the0807/git-graph-plus.git`, `main` = `origin/main` =
  `c6c2a9a` (`2026-07-01`); a fetch on `2026-11-08` found nothing newer.
  Version 0.7.3, 408 commits since its initial commit `d06b0a8`
  (`2026-03-15`, the0807).
- **License.** Apache-2.0 (`LICENSE`, and `"license": "Apache-2.0"` in
  `package.json`).
- **Provenance checks run before any feature was read.**
  - Its architecture is unrelated to Git Graph's: a Svelte webview under
    `webview-ui/` and kebab-case service modules under `src/git/`,
    `src/services/` and `src/views/`.
  - No Git Graph (mhutchie) identifier appears. The only `askpass` hits are
    VS Code's built-in Git extension.
  - Its README credits only "UI/UX ideas" from Git Graph, Fork and SourceGit.
  - All nine Mission markers count `0` in its `src` and `webview-ui/src`, so
    none of this project's code is in it.
  - One foreign notice: `src/git/git-graph-builder.ts` lines 1–2 say its
    graph layout was ported from SourceGit (MIT, "SourceGit contributors").
    No plan here uses that file.
- **What follows.**
  - Reading Git Graph+ to learn how its features behave is allowed.
  - Apache-2.0 code may come into this AGPL-3.0-or-later project (Apache-2.0
    is compatible with GPLv3 and AGPLv3, one way), but only with its license
    text, any `NOTICE` it carries, and a statement of changes. It would then
    be recorded in `NOTICE.md` as the engine is.
  - The plans below reimplement from observed behavior and Git's
    documentation; none copies code.
  - Decision G0 asks whether to make this a standing Licensing verdict.

## The three features at a glance

| # | Feature | Git Graph+ | Git Graph Libre today | Plan |
| --- | --- | --- | --- | --- |
| 1 | Reflog tab | One of three view modes (Graph, Reflog, Statistics): rows from `git reflog show`, sub-actions such as `commit (amend)` colored by group, search and action filters, a per-branch picker, pages of 200 | `repository.includeReflog` and `includeUnreachableCommits` put reflog-only and unreachable commits in the graph; there is no reflog list | Reflog tab: F1-01 to F1-09, decisions RQ1–RQ10 |
| 2 | Interactive rebase | A todo editor modal (reorder, pick, reword, edit, squash, fixup, drop), autosquash, fixup creation, conflict prediction, drag-to-rebase, and a classic terminal mode | `rebase -i` only in a terminal; drop and squash run as their own commands; no in-progress rebase handling at all | Interactive rebase: F2-01 to F2-10, decisions IQ1–IQ12 |
| 3 | "Timeline" | Nothing is called that. Statistics: contributors and a weekday-by-hour activity heatmap. A File History search was removed from its UI | The engine exports `author_stats` and the activity heatmap, unwired; a Statistics tab is planned (Phase 16 record "The engine surface") | Timeline: F3-01 to F3-08, depending on TQ1 |

## Findings to know before the discussion

- **Git Graph+'s "dangling-commit recovery" overclaims.** Its "dangling"
  means "the object no longer exists", which cannot be recovered. Its
  recovery is a generic Reset, with hard reset as the default. A failed read
  shows as an empty reflog, and the ref it asks for is not validated. Our
  plan separates "only in the reflog" (recoverable) from "object no longer
  exists", and starts recovery with create-branch and create-tag.
- **Its interactive rebase hands Git a prepared todo.**
  - It writes the todo file itself and runs `git rebase -i <base>` with a
    sequence editor that copies that file over Git's.
  - A reword becomes `pick` plus an `exec git commit --amend`.
  - It has no `--rebase-merges`, `--root` or `--update-refs`, and no
    pushed-commit warning.
  - It does not check whether a branch is checked out in another worktree.
  - Its autosquash matches `fixup!` and `squash!` subjects only, while Git
    also matches hash prefixes and `amend!`.
  The rebase research verified the relevant Git behavior with Git 2.56.0
  (edit stops exit 0, conflicts exit 1, merges flatten by default).
- **Our largest gap is the in-progress state.** This project has no
  handling for a paused rebase (continue, skip, abort), and its refresh
  watcher ignores `rebase-merge/`. The plan therefore puts the in-progress
  banner (F2-03) before the editor UI, so an `edit` stop never strands a
  user.
- **"Timeline" is ambiguous.** The survey's recommendation is the
  Statistics view, the only time-ordered view Git Graph+ has, and one this
  project already planned on its engine exports. Two alternatives are
  recorded: per-file history, possibly as a provider for VS Code's own
  Timeline view, and a date-range filter.

## Proposed order, for discussion

1. **Reflog, F1-01 to F1-06** first. It is small, mostly reads, and
   low-risk: a CLI read, entry states, a read-only tab, colors, filters, and
   actions that cannot lose data. F1-07 (an opt-in `fsck` scan), F1-08
   (worktrees and bare repositories) and F1-09 (an optional engine read)
   follow.
2. **Interactive rebase, F2-01 to F2-05** as one unit: the todo model and
   handoff, the range read and preflight, the in-progress controls, the
   editor dialog, then reword, squash, fixup and edit. These are one
   user-visible feature and should ship together. F2-06 to F2-08
   (autosquash and fixup creation, protections, conflict prediction) follow.
   F2-09 and F2-10 are optional.
3. **Timeline** once TQ1 is answered.

The reflog and rebase slices touch mostly different areas (a new panel
against dialogs and actions), so they can run in parallel waves under
Multi-agent releases. Their shared files (`src/extension/messageHandler.ts`,
the l10n bundles, `package.json` commands) mean the slices that change those
run one after another.

## Decisions to discuss

- **G0.** Make the preliminary licensing verdict above a standing section
  under Licensing? Recommended: yes, worded as for `vscode-git-graph-rs`,
  with the SourceGit file named as out of bounds unless its MIT notice is
  carried.
- **G1.** Release placement and IDs: one themed release (for example
  1.11.0) or one per feature; final slice IDs replace F1/F2/F3 when a
  release is planned. Recommended: a themed release with reflog and the
  rebase core, timeline later.
- **Reflog:** RQ1 (where the reflog lives; recommended an editor-tab panel
  like the GGL Diff tab) to RQ10, in the Reflog tab subsection.
- **Interactive rebase:** IQ1 (the editor surface; recommended a dialog) to
  IQ12, in the Interactive rebase subsection. IQ4 (how commit messages reach
  Git) is settled by a spike in F2-01.
- **Timeline:** TQ1 (what "timeline" means) to TQ7, in the Timeline
  subsection.
