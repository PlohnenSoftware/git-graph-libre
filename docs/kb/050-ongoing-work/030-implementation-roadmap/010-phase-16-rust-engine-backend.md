---
summary: >-
  In progress as of `2026-10-16`: slices 16.1–16.9 shipped in `v1.8.0`, Author
  Date and the status indicator in `1.8.1`, upstream candidates open. Wires
  the `engine/` Rust addon into the hot reads with CLI fallback; goal and
  speed numbers.
---

# Phase 16: Rust Engine Backend

**Status: in progress (`2026-10-16`) — slices 16.1–16.9 all done and shipped
in `v1.8.0`; `1.8.1` serves Author Date from the engine and adds the status
indicator popup; the upstream review's candidates 1–4 and 8 landed the same
day, as did signatures leaving the graph load, the Hidden menu's one-off
CLI reload and engine-failure telemetry; topo seeding, numstat, encoding
and the remote-ref special cases remain open.** The engine's source and its
52-commit history live on `rusty` under `engine/`; see "Evaluating the Rust
engine of `vscode-git-graph-rs`" for what it is, what was excluded, and why it
was not adopted wholesale. **Nothing in the extension reads it yet.** This
phase is the wiring, cut so that every slice leaves a shippable extension and
can be abandoned without unwinding the ones before it.

Goal: serve the hot repository reads in process from the engine where it is
available *and* correct to do so, and from the `git` CLI everywhere else, with
no user-visible change except speed. Their measured numbers on a
10,000-commit repository are a `4.5×` view load and one to two orders of
magnitude on single-object reads, because a `git` spawn costs ~40–70 ms on
Windows before it does any work.
