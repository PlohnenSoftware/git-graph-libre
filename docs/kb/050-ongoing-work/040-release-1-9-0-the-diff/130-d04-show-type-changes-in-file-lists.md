---
summary: >-
  D04 · revised scope approved 2026-10-19 for X2 (b): new T status and
  arrow-switch icon, in D04a (transport/counts) and D04b (presentation/actions).
---

# D04 — Show type changes in file lists

Status: waiting on D04a and D04b — revised scope approved by the maintainer 2026-10-19
Needs: D04a, D04b
Decisions: X2 (b); split, budgets, icon and action policy approved in the release-orchestration conversation 2026-10-19

## Approved scope

Replace the original M/tooltip proposal with a real T status on both
history backends, Git-compatible counts, a dedicated arrow-switch Octicon
and localized Type changed text. Do not claim this umbrella; claim one
ready sub-slice under the agent protocol.

1. [D04a — Type-change transport and counts](132-d04a-type-change-transport-and-counts.md): at most 250 changed lines outside tests.
2. [D04b — Type-change presentation and actions](134-d04b-type-change-presentation-and-actions.md): at most 180 outside tests, including generated icons; after D04a.

T follows existing M-style actions: both historical sides exist, explicit
comparison refs remain intact and ordinary two-revision titles apply.
Synthetic gitlink content and object-kind-specific hiding of Open actions
are outside this scope. Existing worktree classifiers/staging behavior
remain unchanged. No new dependency.

The expanded scope covers the third history filter in stashDetails.ts,
the exhaustive Rust status match, icon generation and shared rendering,
and all six directed file/symlink/gitlink transitions. Isolated temp
fixtures show a three-line file to symlink or gitlink counts +1/-3,
the reverse +3/-1, symlink/gitlink 1/1, identical-byte file/symlink 0/0,
and binary null/null. D05's ordinary gitlink helper alone would give
incorrect 1/1 counts for a file/gitlink transition.

## Acceptance

D04 is complete only when both sub-slices integrate with all acceptance
items met. The approved full draft is retained at /tmp/ggl-d04-revised-brief.md.

## Report

_(awaiting sub-slices)_
