---
summary: >-
  Feature record: submodule discovery from `.gitmodules` `path` entries, with
  validation, nested submodules and an indented dropdown, written clean-room;
  `.gitmodules` is not watched live.
---

# Submodule discovery (`2026-08-21`)

Repository discovery reads declared `path` entries from `.gitmodules`, validates
that each path stays inside its parent and is a Git repository, and supports
nested submodules plus parents restored from extension state. The repository
dropdown keeps names clean while structured metadata indents submodules and CSS
draws their branch connectors. The implementation uses this repository's
abstractions and Git/VS Code APIs, with no code copied from the original Git
Graph project or the comparison upstream PR.

`.gitmodules` is not watched live; changes appear on the next repository scan,
such as after reloading the extension. Filesystem watching and stale-submodule
removal remain intentionally out of scope.
