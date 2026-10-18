---
summary: >-
  Session record of seven consent-epoch slices: gate results and three
  packaged-build checks (`unset` sends nothing). Open: delete the
  `probe-machine` row from the production database.
---

# Consent epoch — session record (`2026-09-02`)

Seven slices, each gated in full before its commit (strict Biome on staged
files, `package`, `test`, `l10n:check`, fresh `test:coverage`, `sonar:scan`
polled to an `OK` `ZAM` gate). In order: the sender-seam verification, the OS
common properties, the three-state consent setting, the consent prompt, the
graph notice, the two read-side features, and Dutch. Gate results ran
`new_coverage` `89.3`–`93.7`, `new_violations` `0`, duplication `0.0`, and all
four project-wide conditions `0`. One scan came back with `new_violations` `2`
— both `typescript:S1135` for the word `TODO` in a prose comment of this
slice's own new module — and was fixed and re-gated rather than accepted under
the threshold of `5`.

Verified against a packaged build, in an isolated `--extensions-dir` /
`--user-data-dir` under real code-insiders `1.136.0-insider`, three times:

1. **Before consent existed**: the `activate` event arrived, proving the seam
   (recorded in the section above).
2. **Consent at its `unset` default**: the notification appeared, and the local
   listener received **nothing at all** across a full run and the disposal
   flush that follows window close. The default really is silent, not merely
   unsent-by-accident.
3. **Consent set to `enabled`**: the `activate` event arrived carrying
   `common.os` `linux`, `common.nodearch` `x64` and `common.platformversion`
   `7.2.2` — the `-1-cachyos` suffix stripped as designed — alongside
   `settingsChanged` `1` and `setting.telemetry.enabled` `true`, i.e. the
   snapshot recording *that* the setting was set without its value.

The notification's rendering was also confirmed by eye at (2): **Accept
accented, the refusal secondary**, matching the `secondary: index > 0` reading
of `renderButtons()` with no modality needed. (The refusal was labelled
`Reject` at the time; it became `Reject and Don't Show Again` on `2026-09-03`.)

`pnpm run test:ext` passes with the prompt wired in — a test launch shows the
notification and moves on, so the suite is unaffected.

Left for the maintainer, unchanged from the previous session: the synthetic row
from the `2026-09-02` route probe is still in the production database
(`delete from events where machine_id = 'probe-machine';`). The probes above
never touched production — the endpoint was pointed at `127.0.0.1` for each
one, and restored afterwards.
