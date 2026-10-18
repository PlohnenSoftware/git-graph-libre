---
summary: >-
  Standing invariants for every engine slice: map to project types, CLI stays
  the default, cross-backend parity tests, no user-visible change, close
  handles, telemetry only at the documented chokepoints.
---

# Design rules — invariants every slice must keep

1. **This project's types, never the engine's wire shapes.** `engine/native/
   core/src/types.rs` says its structs serialise "to exactly the shape the
   existing webview already consumes" — that is *their* webview. Map at the
   seam into `GitCommitNode`, `GitRef`, `GitStash` and friends. Two reasons:
   it keeps this project independent of their type evolution, and it keeps the
   licence boundary clean (see the evaluation section on `types.rs`).
2. **The CLI is the default and the engine is the optimization.** Every read
   keeps a working CLI implementation. A platform with no prebuilt binary, a
   failed `require()`, a version-skewed addon, or a user who switched the
   setting off must all land on exactly the behavior of 1.6.2.
3. **Two implementations, proven to agree.** Every read wired to the engine
   gains a cross-backend parity test that drives both against the same real
   repository and asserts identical output. A divergence is an engine bug, not
   a test to relax.
4. **No slice changes user-visible behavior.** If a slice would, it is the
   wrong slice: split the behavior change out and take it on its own merits.
5. **Handles are resources.** `open_repository` keeps pack indexes and an
   object cache resident for the session — that is where the speed comes from
   and also where a leak would come from. Every path that removes a repository
   from the workspace must call `close_repository`.
6. **Telemetry stays at the three documented chokepoints.** Which backend
   served is a *shown* property, so it belongs in
   `createViewFeatureReporter()`, once per session, as a fixed id — never a
   path, never a per-load count.
