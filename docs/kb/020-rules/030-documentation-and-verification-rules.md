---
summary: >-
  Standing rules: tests ship with behavior changes; touched code meets
  `biome.strict.jsonc`; Biome and SonarQube gate `OK` before commit; fix
  touched-file issues; no `var`; small commits; record the checks run.
always_read: true
---

# Documentation and Verification Rules

- Keep README as the entry point and link deeper docs from it.
- Update this file when adding or reordering feature phases.
- Add or update tests in the same slice as behavior changes.
- Keep all new code and code touched in a slice compatible with
  `biome.strict.jsonc`; do not use the migration-friendly baseline as the quality
  target for fresh work.
- Delegated multi-agent slices and sub-slices use focused checks and small,
  frequent signed commits; they do not require the full gate before committing
  (maintainer instruction, `2026-10-19`). Record exact checks and gaps.
  The full gate, including fresh coverage and SonarQube `OK`, applies at
  integration and to work without multi-agent delegation. See Branch and
  release policy for its order. Strict Biome and all other quality rules
  remain in force; never weaken a check to make a slice pass.
- While touching a file in an agile cycle, fix existing local code issues in
  that file when they are reasonable to address in the slice, including findings
  reported by Biome, SonarQube, typechecking, and obvious maintainability
  problems. Do not hide behind legacy debt in touched files, but keep unrelated
  whole-tree cleanup in a separate slice.
- Treat `var` as forbidden in fresh and touched code. Prefer `const` by default,
  use `let` only for reassignment, and document the rare case where `var`
  function scoping is intentionally required.
- Prefer small commits by feature slice.
- Before calling a feature complete, record the exact checks run and any known
  gaps in the commit or handoff note.
