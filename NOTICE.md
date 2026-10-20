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

## Contributors to the AGPL-licensed work

Everyone below wrote code directly for this project on or after the
relicensing of 2026-07-01, first released as version 1.0.0. Each holds
copyright in their own contributions, which are licensed as part of the
AGPL-3.0-or-later whole, and together they are the "Git Graph Libre
contributors" named in the copyright line above. Compiled from the author
records in this repository's git history (automated dependency-bot commits
omitted; a contributor's earlier work in the MIT lineage is recorded in the
rosters in [LICENSE.mit](LICENSE.mit) instead):

  Krzysztof Zabłocki (Zamkorus, PlohnenSoftware)   2026-07-01 to present
  Kristjan ESPERANTO                               2026-08-22
  Arezimt (Arezim)                                 2026-09-22
  Thomas KT Chan (cktgh)                           2026-10-15

Deliberately **not** recorded in [LICENSE.mit](LICENSE.mit): that file
preserves the MIT notices and the rosters of the MIT-licensed material this
project incorporated, and listing an AGPL contribution there would
misrepresent it as MIT-licensed and available for reuse under those terms. The
licence flows one way — MIT material may come in, AGPL work does not go out
without the copyleft. A contributor's name belongs in that roster only if
their code arrived from the MIT lineage.

Contributions arriving by pull request are credited by name in
[CHANGELOG.md](CHANGELOG.md) for the release that carries them, so that credit
travels with the published extension and not only with the git history.

## Incorporated MIT-licensed material

### The Git Graph lineage

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
  - `08318d3` — rendering the checked-out branch label in bold. Reimplemented
    here as a CSS rule on the existing `.active` ref class; the behavior came
    from upstream. The bold weight was removed again by maintainer decision on
    2026-08-25 — bolding is scoped to the commit description, never to branch
    or tag labels — so nothing of this commit remains in the tree. The entry is
    kept as the record of what was incorporated while it was.
  - `4607cdf` — handling commit context-menu actions on root (zero-parent)
    commits. Reimplemented here in a different webview architecture; the
    diagnosis and the `< 2` dispatch rule come from upstream.
  - `0bf8812`, `0c8f1da` — retaining the webview panel when hidden
    (`retainContextWhenHidden`) for instant tab restore, without
    re-initializing the retained panel on re-show. Reimplemented here against
    our panel lifecycle; the behavior and the retained-restore diagnosis come
    from upstream.
  - `e7d1f8a` — a dedicated view for repositories with no commits, including
    hiding meaningless branch-selection controls. Reimplemented here in our
    table/toolbar architecture; the behavior, the view's content, and the l10n
    copy meaning come from upstream.
  - `750f96f` — publishing the extension with the official `vsce` CLI instead
    of the third-party `HaaLeo/publish-vscode-extension` action. Reimplemented
    here inside our own release workflow, which packages, creates the GitHub
    release, and gates the publish on token presence; the decision to drop the
    third-party action, the `vsce publish --packagePath --skip-duplicate`
    invocation, and the `VSCE_PAT` wiring come from upstream. Upstream's
    companion Open VSX publish step was initially **not** taken; on
    `2026-09-17` the maintainer restored Open VSX as a publish target, which
    this project had carried under its own `OPEN_VSX_TOKEN` secret before
    dropping it, so the release workflow now runs `ovsx publish` as well —
    gated on token presence and against the same VSIX, in this project's own
    form.
  - `ef9114f`, `37671b6` — re-running the repository scan when the Git
    binary setting changes, naming the binary in scan log lines, and
    leveled output-channel logging. Reimplemented here on our own logger,
    bridge, and repository search; the behaviors come from upstream, no
    upstream code is included.

The MIT license grants permission to sublicense, which allows this material to
be incorporated into the AGPL-licensed whole. As the MIT license requires, its
copyright notice and permission notice are preserved in full in
[LICENSE.mit](LICENSE.mit), together with per-era contributor rosters compiled
from this repository's git history, and they continue to cover the
incorporated material.

### The Git engine (`engine/`)

Separately from the lineage above, and not descended from it, this project
incorporates the Rust Git engine of
[neophack/vscode-git-graph-rs](https://github.com/neophack/vscode-git-graph-rs)
— the `native/core` and `native/node` crates, which read a repository's object
database, refs and index in process rather than by spawning `git`. It is
MIT-licensed: that repository's workspace declares `license = "MIT"` and its
`LICENSE` names "the Rust native engine (./native/)" among its original
contributions, Copyright (c) 2026 penghongxia. The engine's history is
preserved here, with its original authors and dates, from the commits spanning
`611a8fa` (2026-08-22) to `f93e8b2` (2026-09-21). Selected fixes from the
later upstream commit `ff4aafe` (2026-09-23) were adapted by hand afterwards,
each in a commit that names it and credits its author; `engine/NOTICE.md`
lists them.

[engine/NOTICE.md](engine/NOTICE.md) carries the rest: the verbatim copyright
line and permission notice the MIT license requires be included in all copies,
the provenance of the import and its authorship, and the attribution owed for
the Rust crates the engine links.

**Changes made to the engine in this project are AGPL-3.0-or-later**, like
every other change made here. The MIT notice above covers the engine *as
incorporated* and continues to do so; it does not extend to work done on it
afterwards. The boundary is the import recorded above — anything in the
imported history, and the parts of `ff4aafe` adapted since, is the
MIT-licensed original; anything else committed to `engine/` since is part of
the AGPL whole. This is the same one-way rule the
lineage section states, applied to a second incorporated work.

**What was deliberately not incorporated, and may not be.** That project is
also a Visual Studio Code extension, and by its own `LICENSE` its webview and
extension-host layers (`src/`, `web/`, and the compiled `media/` and `out/`)
are ported from Git Graph by mhutchie under a license reading *"Permission is
NOT GRANTED to publish, distribute, sublicense, and/or sell derivative works
of the Software."* None of that is here. One file inside the engine itself was
excluded for the same reason: `native/core/src/gerrit.rs` documented itself as
"a faithful port of the parser that ran on the extension host (see
`src/gerrit.ts`)", so it was derived from the restricted layer regardless of
the workspace's MIT declaration. It is absent from every commit of the
imported history, as are that project's own `LICENSE` and `licenses/`
directory, which described the tree that was not taken.

### VS Code's diff editor styles (`media/diff-tab/vscode-diff.css`)

The GGL Diff tab's stylesheet is copied from
[microsoft/vscode](https://github.com/microsoft/vscode),
`src/vs/editor/browser/widget/diffEditor/style.css` at commit
`1356222d342e6a7b2dd5603107bcdb60a6d0653b`, MIT-licensed, Copyright (c)
Microsoft Corporation. The file was trimmed to the rules the tab uses and
re-rooted under `.ggl-diff`, with its declarations otherwise verbatim; the
icon-font rules were dropped because the webview draws its signs as text.
Changes made here are AGPL-3.0-or-later. The copyright and permission notices
are preserved in [LICENSE.mit](LICENSE.mit).

### VS Code's diff algorithm (`engine/native/diff/`)

Phase 17 plans a Rust translation from [microsoft/vscode](https://github.com/microsoft/vscode/tree/28a562309973a386b2bdefae78127788a4742fe8/src/vs/editor/common/diff)
at commit `28a562309973a386b2bdefae78127788a4742fe8`:
`defaultLinesDiffComputer/{defaultLinesDiffComputer,heuristicSequenceOptimizations,linesSliceCharSequence,lineSequence,computeMovedLines,utils}.ts`,
its `algorithms/{diffAlgorithm,myersDiffAlgorithm,dynamicProgrammingDiffing}.ts`,
`rangeMapping.ts`, `linesDiffComputer.ts`, and range types in
`src/vs/editor/common/core/`. Its 58 golden-test fixtures come from
`src/vs/editor/test/node/diffing/fixtures/` at the same commit. All are MIT;
Microsoft's copyright and permission notices are preserved in [LICENSE.mit](LICENSE.mit).
The port is AGPL-3.0-or-later with those original notices kept (D1,
`2026-10-19`), internal to this repository, with no separate publication (D2).
D20 adds legal groundwork only; later slices add the port and fixtures.

`@vscode/diff` (exact devDependency `0.0.2-87`, MIT, Copyright (c) Microsoft
Corporation) is a development test oracle, excluded from the distributed VSIX.

### V8's `Math.log` (`engine/native/diff/src/v8_math.rs`)

The diff's alignment score has to equal VS Code's bit for bit, and VS Code
takes it with V8's `Math.log`. Neither Rust's `ln` nor the `libm` crate
matches V8, so `v8_math.rs` translates V8's `ieee754::log`
(`src/base/ieee754.cc`), which is fdlibm's `e_log.c`, into Rust (X18,
`2026-10-19`). The translation is AGPL-3.0-or-later, and these original
notices are kept.

fdlibm's notice, from `e_log.c`:

> Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
>
> Developed at SunSoft, a Sun Microsystems, Inc. business.
> Permission to use, copy, modify, and distribute this
> software is freely granted, provided that this notice
> is preserved.

V8's license, BSD-3-Clause:

> Copyright 2014, the V8 project authors. All rights reserved.
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are
> met:
>
>     * Redistributions of source code must retain the above copyright
>       notice, this list of conditions and the following disclaimer.
>     * Redistributions in binary form must reproduce the above
>       copyright notice, this list of conditions and the following
>       disclaimer in the documentation and/or other materials provided
>       with the distribution.
>     * Neither the name of Google Inc. nor the names of its
>       contributors may be used to endorse or promote products derived
>       from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
> "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
> LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
> A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
> OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
> SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
> LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
> DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
> THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
> (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
> OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The upstream projects above remain available under the MIT license from their
own repositories. The modifications and additions made in this fork are
available only under the AGPL-3.0-or-later.
