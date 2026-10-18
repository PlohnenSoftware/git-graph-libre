---
summary: >-
  Phase 16 risks: ordering within a window (resolved in 16.5),
  devcontainer/Alpine CLI fallback, refusing `engineVersion()` skew, the
  unresolved `penghongxia`/`neophack` identity question.
---

# Risks to decide before 16.5, not during

- **Ordering within a window.** The engine orders exactly within a window that
  is a multiple of the page, not over the whole history. On a branchy
  repository this can differ from `git log`. If it does, `loadCommits` may
  have to stay CLI and the phase loses most of its value — so measure this
  early, in 16.4 or a spike, rather than discovering it in 16.5.
  **Resolved in 16.5:** measured late but decisively — date and author-date
  agree byte for byte on a 433-commit branchy history past the 256-commit
  window floor, so the window never materialized. Topo diverges for a
  different reason (depth-first lines versus git's date-interleaved lines)
  and stays CLI by decline, which moots the window question for it too.
- **Devcontainers and remote.** This project advertises "Works in remote and
  container environments". The addon must match the *remote* platform, which
  per-platform VSIXs handle for the targets that are built and nothing else.
  Alpine-based devcontainers fall back to the CLI and must be tested doing so.
- **`engineVersion()` skew.** A `.node` from a different build than the
  TypeScript expects must be detected and refused into the CLI path, not
  trusted.
- **Two identities in the engine's history.** Whether `penghongxia` and
  `neophack` are one person is unresolved; it affects nothing technical but
  the rosters record both as the history has them.
