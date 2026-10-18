---
summary: >-
  Standing rule: permanently excluded from the engine are all writes,
  `includeReflog`, `includeUnreachableCommits`, signature verification and
  `customBranchGlobPatterns`; each is a decline routed to the CLI and pinned
  by a test.
---

# Non-goals, permanently

No slice should try to move these. They are not deferred, they are excluded:

- **Every write.** All 41 operations stay on `runGitRaw`. gix implements no
  `push`, so a literal 100% is not reachable and chasing it is not the point.
- **`repository.includeReflog`.** The engine declines reflog tips with
  `Unsupported`.
- **`repository.includeUnreachableCommits`.** `git fsck --unreachable` has no
  engine equivalent at all.
- **Signature verification.** The engine reports signature *presence* and
  leaves status `E`. This project's `1.2.0` work — `%G?` plus the batched
  `git cat-file --batch` `gpgsig` probe that separates genuinely unsigned from
  SSH-signed-but-unverifiable — has no counterpart and must not regress.
- **`customBranchGlobPatterns`.** `--glob=` is not understood by the engine's
  tip resolution.

Each of these is a *decline*, not a bug: the backend wrapper routes them to
the CLI automatically, and a test pins that it does.
