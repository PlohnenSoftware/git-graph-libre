---
summary: >-
  Status table for every phase (audited `2026-07-03`, kept in sync with each
  phase's `Status:` line), then Phase 16, the active phase; open and completed
  phases have their own sections.
always_read: true
---

# Implementation Roadmap

Phase status overview (audited `2026-07-03` after Phase 14 verification;
per-phase `Status:` lines below carry the same verdicts — update both
together):

| Phase | Status |
| --- | --- |
| 0 Guardrails and baseline | Complete |
| 0.5 Backend robustness | Complete |
| 1 UI/UX foundation refresh | Complete |
| 2 Commit details UX | Partial — docked-bottom details mode remains |
| 3 Commit hash display | Complete |
| 4 Find, search, keyboard navigation | Complete |
| 5 Branch, tag, and author filters | Complete |
| 6 Repo settings and view options | Mostly complete — initial-branches-on-load remains |
| 7 Stash management | Complete — actions, stash list panel, and graph stash rows done |
| 8 Comparison and multi-select | Partial — compare-with-HEAD and multi-select done; arbitrary two-commit/ref comparison and external directory diff remain |
| 9 Repository and remote management | Mostly complete — repository dropdown ordering preference remains |
| 10 Advanced history, text, integrations | Partial — issue links, config export, archive, commit and tag signature status done (tag signatures in Phase 15); text rendering, mailmap, code review, encoding remain |
| 12 Toolbar dropdown name truncation and find row | Complete |
| 13 Settings hub: tabbed widget, color editor, settings export | Complete |
| 14 Reveal highlight: persistent blink and configurable color | Complete |
| 15 Tag surfaces: signed-tag distinction and remote tag deletion | Complete |
| 16 Rust engine backend | In progress (`2026-10-16`) — 16.1–16.9 done, shipped in `v1.8.0`; Author Date and the status indicator in `1.8.1`; upstream candidates 1–4 and 8 landed, signatures left the graph load with a one-off CLI reload and engine-failure telemetry; topo, numstat, encoding, remote-ref cases open |
| 17 VS Code's diff algorithm in the engine | Port complete in 1.9.0 (`2026-10-19`) — 17.0–17.8 via D20–D22 (22a–22j) and the GGL Diff tab D40–D47; 58/58 fixtures exact incl. moves, five-arm parity recorded at 17.6; open: the gitoxide sweep, D5's CI wiring, D48's display half |
| Immediate TODOs bug backlog (BUG-1 … BUG-6, `2026-08-25`) | Complete (`2026-08-25`; see the per-entry implementation records) |
