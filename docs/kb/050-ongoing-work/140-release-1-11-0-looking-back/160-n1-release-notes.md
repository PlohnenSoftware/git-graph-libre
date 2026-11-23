---
summary: >-
  N1: bring CHANGELOG.md `[Unreleased]` and README.md up to date with what
  reached `main` since the notes were last written: Blame F4-05 and F4-06,
  the GGL tab icon (Q1), the zh-tw term (L2), and the popup fixes P1
  (V1–V10) where they are missing.
---

# N1 — Release notes for 1.11.0 "Looking Back"

Status: ready

Needs: F4-05, F4-06, Q1, L2, P1 (all integrated)

Agent: Claude Haiku

Read first: `AGENTS.md`; the documentation rules
(`020-rules/030-documentation-and-verification-rules.md`, the changelog and
README parts); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`); the reports of
F4-05 and F4-06 (`110-blame-view/140-…` and `150-…`), Q1, L2 and P1 (this
section's directory); the existing `[Unreleased]` entries in `CHANGELOG.md`
(their voice, length and bold lead-ins are the model).

## Touch

`CHANGELOG.md` (`[Unreleased]` only; never the version heading or date);
`README.md` (the feature bullets only); this file's Status and Report.

## Task and acceptance

- **Blame, F4-05:** extend the Blame view entry (or add one beside it) with
  what F4-05 shipped: rewinding to the blame before a change with
  Back/Forward/Latest, the `-w`, `-M` and `-C` toggles, the
  `.git-blame-ignore-revs` file applied automatically with a toggle, a
  per-session list of ignored commits, and find in the tab.
- **Blame, F4-06:** the commit popover (full message with issue links,
  author and committer, avatar) and its actions: Show Commit in Graph, Open
  in GGL Diff, Open File at Line, View blame prior to this change, Ignore
  Commit (This Session), Copy Commit Hash and Copy Commit Message.
- **Q1:** the Diff, Reflog and Blame tabs show the Git Graph Libre icon,
  following `tabIconColorTheme` (Changed or Fixed, as the rules say).
- **L2:** zh-tw uses one word for "repository" (存放庫) throughout.
- **P1 (V1–V10):** check each fix in P1's report against the existing
  entries; add only the user-visible ones that are missing (for example the
  Worktrees popup's icon buttons, Remove Worktree confirming with Remove).
- **README:** the Blame view bullet mentions rewinding, the options and the
  commit popover in one or two short clauses; nothing else changes.
- Every statement must be true of the code on `main`; check behavior in the
  code or the slice reports, never guess. American English, no marketing
  words, the existing voice. No version bump, no date, no new heading.

Checks: `node ./docs/kb/housekeeping.mjs --check`; strict Biome is not
needed for Markdown. Claim and changes are separate signed commits; never
push.

## Report

Not started.
