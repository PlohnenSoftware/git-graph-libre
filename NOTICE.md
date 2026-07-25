# NOTICE

## Git Graph Libre — license and provenance

Copyright (C) 2026 Zamkorus (PlohnenSoftware) and Git Graph Libre contributors

From version 1.0.0 onward, this program as a whole is free software: you can
redistribute it and/or modify it under the terms of the GNU Affero General
Public License as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version
(SPDX: `AGPL-3.0-or-later`).

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

You should have received a copy of the GNU Affero General Public License along
with this program (see [LICENSE](LICENSE)). If not, see
<https://www.gnu.org/licenses/>.

## Incorporated MIT-licensed material

This project descends from the MIT-licensed lineage of Git Graph:

- [Git Graph](https://github.com/mhutchie/vscode-git-graph) by Michael
  Hutchison (mhutchie): incorporated up to and including
  [commit 4af8583](https://github.com/mhutchie/vscode-git-graph/commit/4af8583a42082b2c230d2c0187d4eaff4b69c665)
  (2019-05-09), the last MIT commit before the May 2019 license change; no
  later, non-MIT code is included.
- [asispts/neo-git-graph](https://github.com/asispts/neo-git-graph) by Asis
  Pattisahusiwa (asispts), the MIT fork of that lineage, incorporated up to
  and including commit `28300bd64b5793e4ed9540004655f29b673c6d8b` (2026-05-14).
  The branches diverge after that commit, and the later upstream history is
  **not** incorporated wholesale. These individual later commits are, however,
  incorporated in part:
  - `8402626` — relative date formatting built on `Intl.RelativeTimeFormat`,
    adopted into `src/webview/utils/date.ts` largely as written upstream.
  - `b4c215f` — centralized output-channel logging. Reimplemented here, but the
    design and the timestamp format come from upstream.
  - `4afcb69`, `deba9af` — keeping the status bar item visible with no
    repository, with icons and a watching state. Reimplemented here against a
    different localization layer; the behavior, the icon choices, and the
    tooltip wording come from upstream.

The MIT license grants permission to sublicense, which allows this material to
be incorporated into the AGPL-licensed whole. As the MIT license requires, its
copyright notice and permission notice are preserved in full in
[LICENSE.mit](LICENSE.mit), together with per-era contributor rosters compiled
from this repository's git history, and they continue to cover the
incorporated material.

The upstream projects above remain available under the MIT license from their
own repositories. The modifications and additions made in this fork are
available only under the AGPL-3.0-or-later.
