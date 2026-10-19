---
summary: >-
  Standing verdict (`2026-10-19`): VS Code's MIT `advanced` diff algorithm
  may be translated into the engine under AGPL-3.0-or-later with Microsoft's
  MIT notices (D1), internal only (D2); exact development oracle
  `@vscode/diff` `0.0.2-87` (D3), excluded from the VSIX.
always_read: true
---

# VS Code diff-algorithm licensing verdict (`2026-10-19`)

**Allowed:** the MIT algorithm and fixtures from [microsoft/vscode](https://github.com/microsoft/vscode/tree/28a562309973a386b2bdefae78127788a4742fe8/src/vs/editor/common/diff),
commit `28a562309973a386b2bdefae78127788a4742fe8`. Source paths and filenames
are recorded in `NOTICE.md` and `engine/NOTICE.md`. Verified against that
commit's `LICENSE.txt`, algorithm file header, and fixture tree on `2026-10-19`:
"Copyright (c) 2015 - present Microsoft Corporation" and
"Copyright (c) Microsoft Corporation. All rights reserved."
This is a direct translation with permission, not a clean-room reimplementation.

**Decisions (`2026-10-19`):** D1 makes the Rust derivative AGPL-3.0-or-later,
with Microsoft's MIT notice kept for the original; no MIT-only exception.
D2 keeps it internal, without a crates.io release or separate package.
D3 pins the development test oracle `@vscode/diff` exactly at `0.0.2-87`.
Its npm tarball is MIT, Copyright (c) Microsoft Corporation, with no runtime
dependencies or install lifecycle scripts. It is excluded from the VSIX.
X5 requires the whole port in 1.9.0; D5 defers CI WebAssembly wiring and
keeps comparison local for now. D20 itself contains no port or fixtures.

**Placements (Phase 17 Legal plan):** (1) extend D40's existing Microsoft
section in `LICENSE.mit`, keeping both copyright lines and the full MIT text;
(2) root `NOTICE.md` records the source, translation, fixtures and boundary;
(3) `engine/NOTICE.md` repeats provenance and the verbatim notice;
(7) this always-read verdict; (8) packaged listing evidence in D20's report.
The first two ship in the VSIX; `engine/NOTICE.md` does not.
Deferred with the actual files: (4) source/commit and copyright headers on
every ported Rust file, original MIT plus AGPL changes; (5) fixture README
with source/commit and MIT license; (6) new crate license metadata, if a
separate crate is used. No crate-local release license is needed under D2.
The engine workspace's existing `license = "MIT"` conflicts with the root
notice's AGPL changes; the maintainer must settle it with the port, outside D20.

**Limits:** use only public MIT VS Code source or the package's embedded
TypeScript, recording commit/version. Never decompile its `.wasm`, copy the
separately licensed product build, or read the restricted `vscode-git-graph-rs`
`src/` or `web/`. Re-syncs update both notices and every source header.
