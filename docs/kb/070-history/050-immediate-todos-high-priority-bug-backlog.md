---
summary: >-
  Dated `2026-08-25` backlog of six bugs reported against `v1.3.0`, ranked
  above the roadmap. Rules: don't re-derive diagnoses, update `Status:` lines
  in place; the BUG-3/4/5 maintainer decisions.
---

# Immediate TODOs — High-Priority Bug Backlog (`2026-08-25`)

**These bugs outrank every remaining phase item in the roadmap.** The maintainer
reported them against `v1.3.0` (`04b0578`); each was root-caused in the same
session against this working tree, and every "Reproduced" line below is a real
command run against a real repository, not an inference. Do not re-derive the
diagnosis — go straight to the fix, and update the `Status:` line of an entry
when it closes instead of deleting the entry.

Two of these (BUG-1 and BUG-3) make the affected feature fail outright for any
user whose setup differs from the maintainer's earliest test repo, so they are
the first two slices.

**Maintainer decisions of `2026-08-25` are already folded into the entries
below.** Where an entry carries a "Maintainer decision" paragraph, that
paragraph is settled scope — implement it as written rather than re-opening the
trade-off. In short: lightweight tags are unsigned by git's design and the UI
must say so (BUG-3); merge dimming becomes an opt-in setting defaulting to off
(BUG-4); and the status bar eye is restored by putting `onStartupFinished` back
(BUG-5).
