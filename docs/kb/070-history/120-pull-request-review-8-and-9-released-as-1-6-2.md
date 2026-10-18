---
summary: >-
  Record of reviewing outside contributor Arezim's PRs #8 and #9, both green
  on `ZAM` though #9 was broken. Lesson: the gate misses untested paths, so
  read the feature.
---

# Pull request review — #8 and #9, released as `1.6.2` (`2026-09-22`)

Two pull requests from the same outside contributor (Arezim,
`Arezimt <arezimt@gmail.com>`), both branched on `main` and both green
on the `ZAM` gate as pushed. **One of them was still broken**, which is the
`2026-09-05` lesson repeating: the gate cannot see a comparison that is wrong
for paths no test exercises. Read the feature, not just the result.
