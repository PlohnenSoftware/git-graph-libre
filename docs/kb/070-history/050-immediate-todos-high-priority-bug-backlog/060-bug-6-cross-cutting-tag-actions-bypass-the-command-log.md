---
summary: >-
  BUG-6, fixed `2026-08-25`: `addTag` and `pushTag` moved to `runGitRaw` with
  `recordGitCommand`, so all three tag actions reach the git-command log.
---

# BUG-6 — Cross-cutting: tag actions bypass the command log

**Status: fixed (`2026-08-25`). Priority: medium. Area: backend actions + messageHandler.**

Rolled up from BUG-1 and BUG-3 because it is one mechanical change and should
land with whichever of them goes first: `addTag` and `pushTag`
(`src/backend/actions/tag.ts:9`, `:39`) still call `simple-git`'s `git.tag()`
and `git.push()`, and `src/extension/messageHandler.ts:354` and `:356` do not
pass `recordGitCommand`. `deleteTag` was migrated to `runGitRaw` in Phase 15;
these two were left behind. Until they move, the git-command log silently omits
every tag creation and every tag push, which is also why this class of bug was
invisible in earlier debugging. Phase 0.5 already sets the direction: new work
uses explicit raw git commands through `gitRunner` and reduces high-level
`simple-git` parser usage in code it touches.

Resolution record (`2026-08-25`): `addTag` moved to `runGitRaw` with
`recordGitCommand` in the BUG-3 slice; `pushTag` followed in the BUG-1 slice.
All three tag actions (`addTag`, `pushTag`, `deleteTag`) now run through
`runGitRaw` and reach the git-command log; the messageHandler routes pass
`recordGitCommand` for each. Verified by the `tag.addTag`/`tag.pushTag`
record-line assertions in the backend action and webview messageHandler tests.
