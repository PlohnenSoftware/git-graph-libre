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
- Treat Biome and SonarQube as pre-commit gates for meaningful code slices:
  strict Biome must be clean for touched/staged files, coverage must be generated
  with `pnpm run test:coverage`, and the configured SonarQube quality gate must
  be `OK` before committing. If the gate cannot be run, do not commit; record
  why it is blocked and what risk remains.
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
