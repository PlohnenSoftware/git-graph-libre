---
summary: >-
  Record: three `upstream/main` commits (nix flake, tsconfig split, oxlint
  `node:` rule) not taken; taking any upstream MIT commit also requires
  updating `NOTICE.md`/`LICENSE.mit`.
---

# Upstream review (`2026-07-29`)

`upstream/main` (`asispts/neo-git-graph`) had three commits newer than
`origin/main` at `ff8b744`: `437ee6c` (nix flake/direnv config), `867eddc`
(split `tsconfig.base.json`, explicit `types` per project), and `9349069`
(enforce the `node:` protocol via `.oxlintrc.json`). None were incorporated:

- The nix config is dead weight here — this fork develops through the
  devcontainer and has no nix users.
- The `node:` protocol rule is a good idea but ships as oxlint config; this fork
  uses Biome, and its sources already use `node:` prefixes throughout.
- The tsconfig split is the only one with real merit and is worth revisiting as
  its own slice; this fork's tsconfigs have already diverged (TypeScript 6,
  local aliases for `tests-ext`), so it is a rewrite rather than a merge.

Incorporating any upstream MIT commit also requires extending the boundary
commit and the contributor roster in `NOTICE.md`/`LICENSE.mit` in the same
change. That cost is not worth paying for chore commits; re-evaluate when
upstream lands user-facing behavior this fork wants.
