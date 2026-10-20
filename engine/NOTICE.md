# NOTICE — the Git engine

## What this is

A Rust Git engine that reads a repository's object database, refs and index
directly and in process, through [gix], and exposes them to a Node host as a
Node-API addon. It never shells out to `git`, and it knows nothing about
Visual Studio Code.

Two crates:

- `native/core` (`git-graph-core`) — the engine. `native/core/src/api.rs` is
  its contract; the per-topic modules behind it are the implementation.
- `native/node` (`git-graph-node`) — the Node-API bindings.

## Provenance

This directory was imported from
[neophack/vscode-git-graph-rs](https://github.com/neophack/vscode-git-graph-rs),
whose history at the time of import ran from commit `611a8fa` (2026-08-22) to
`f93e8b2` (2026-09-21) across 154 commits. The 49 of those that carried
engine content are preserved here as real commits with their original authors
and dates; everything else was filtered out.

Those commits keep the upstream directory layout (`Cargo.toml` at the top,
crates under `native/`) precisely so that any one of them can be diffed
against the upstream repository to verify what was taken. The commit that adds
this file is the one that re-homed the whole tree under `engine/`.

The commits were rewritten to set the committer to this repository's
maintainer and to sign every one of them; **the author name, author email and
author date of each commit are unchanged**. The engine's authors are:

    penghongxia   <penghongxia@yftech.com>
    neophack      <pep3309531@163.com>
    unusuallman   <84268283+unusuallman@users.noreply.github.com>

### Fixes adapted after the import

Upstream kept fixing the engine after `f93e8b2`. Its commit `ff4aafe`
(neophack, 2026-09-23, "the engine and the CLI backend answer as git
answers") bundles many separate corrections, some to code this project does
not use, so it was not merged. The corrections that change what this
project's reads return were adapted by hand instead. Each one landed in its
own commit naming `ff4aafe`, with a `Co-authored-by: neophack` trailer.
Comments that described upstream's own extension-host backend were reworded
in terms of git, since that layer is not incorporated. The parts taken:

- `log::all_tips` skips tags that name a tree or a blob, which `git log --all`
  passes over, instead of letting them end the walk early.
- `repository::Shallow` reports a shallow clone's boundary commits without
  parents, as git does. The graph walk, commit details, diffs and line counts
  read parents through it, and so does this project's own `search_commits`.
- `status::count_changes` counts what `git status --porcelain` prints: a
  `git add -N` path, both lines of a path removed from the index but kept on
  disk, and both halves of a staged rename when `status.renames` (or
  `diff.renames`) is off.
- `Repo::uses_replace_refs` and `decline_replace_refs`, which handed every
  history read to the CLI whenever `refs/replace/*` existed because gix applied
  `core.useReplaceRefs` the opposite way to git, are gone: the gix fix
  (`1b6d8da7a`, in the pinned gitoxide commit `0a49d46f6a0b`) replaced them.
  `git_parity.rs` pins that the engine matches git under replacements with the
  setting on and off.

`native/core/tests/git_parity.rs` adapts the matching tests from the same
commit. Everything else in `ff4aafe` was left out: single-file diff headers,
tag details for non-commit tags, mailmap in the statistics, and the
comparison-with-working-tree layering, none of which this project wires.

## License

The upstream engine is MIT licensed; this project's changes to it are
AGPL-3.0-or-later, so the engine here is declared
`AGPL-3.0-or-later AND MIT` (decision X10, `2026-10-19`). The upstream
workspace declares `license = "MIT"`,
and the upstream `LICENSE` names "the Rust native engine (./native/)" among
its "Original Contributions". That file's copyright line and permission
notice are preserved here verbatim, as the MIT license requires:

> Copyright (c) 2026 penghongxia
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

The MIT grant of permission to sublicense is what allows this material into a
copyleft-licensed whole. It continues to cover the engine.

## VS Code's diff algorithm — Phase 17 (legal groundwork only)

The planned Rust translation in `native/diff` comes from
[microsoft/vscode](https://github.com/microsoft/vscode/tree/28a562309973a386b2bdefae78127788a4742fe8/src/vs/editor/common/diff),
commit `28a562309973a386b2bdefae78127788a4742fe8`, MIT. Files under
`src/vs/editor/common/diff/` are
`defaultLinesDiffComputer/{defaultLinesDiffComputer,heuristicSequenceOptimizations,linesSliceCharSequence,lineSequence,computeMovedLines,utils}.ts`,
its `algorithms/{diffAlgorithm,myersDiffAlgorithm,dynamicProgrammingDiffing}.ts`,
`rangeMapping.ts`, `linesDiffComputer.ts`, and range types in
`src/vs/editor/common/core/`. The 58 fixtures will come from
`src/vs/editor/test/node/diffing/fixtures/` at the same commit and license.
D1 (`2026-10-19`): AGPL-3.0-or-later for the port, retaining Microsoft's MIT
notice for the original. D2: internal only, no separate publication.
Rust headers, fixtures README and crate license metadata arrive with those slices.
`@vscode/diff` `0.0.2-87` is a development-only MIT oracle, excluded from the VSIX.
This engine notice is not packaged; root `LICENSE.mit` and `NOTICE.md` ship instead.
VS Code's source notice is preserved here verbatim:

> Copyright (c) 2015 - present Microsoft Corporation
> Copyright (c) Microsoft Corporation. All rights reserved.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## V8's `Math.log` (`native/diff/src/v8_math.rs`)

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

## What was deliberately not imported

The upstream project is a Visual Studio Code extension whose webview and
extension-host layers — `src/`, `web/`, and the compiled `media/` and `out/` —
are, by its own `LICENSE`, ported from Git Graph by mhutchie and governed by
`licenses/LICENSE_GIT_GRAPH`. That license states:

> Permission is NOT GRANTED to publish, distribute, sublicense, and/or sell
> derivative works of the Software.

None of it is here, and none of it may be brought here. Excluded in full:
`src/`, `web/`, `media/`, `out/`, `resources/`, `tests/`, `package.json` and
`package.nls*.json`, `README.md`, `GAPS.md`, `.github/`, `docs/BACKENDS.md`,
`docs/architecture.*`, the upstream root `LICENSE`, and the whole
`licenses/` directory — which held the five license files describing that
layer (`LICENSE_GIT_GRAPH`, `LICENSE_MICROSOFT`, `LICENSE_OCTICONS`,
`LICENSE_VSCODE_ICONS`, `LICENSE_ICONS8`) alongside a third-party table
mapping `src/`, `web/` and `resources/`.

**One file inside the engine was excluded for the same reason.**
`native/core/src/gerrit.rs`, and its test, carried this in their own module
documentation:

> The classification below is a faithful port of the parser that ran on the
> extension host (see `src/gerrit.ts`), case for case

`src/gerrit.ts` belongs to the restricted layer above, so that file was
derived work regardless of the workspace's MIT declaration, and it is absent
from every commit in this history. The plumbing that referenced it — the
module declaration, the Gerrit types, the change-ref graph injection, two
Node-API exports — was removed in the commit that records that removal.

The upstream `LICENSE` and `licenses/` directory are absent from **every**
commit of this history, not merely from its tip. Both documented the tree
above rather than the engine: the `LICENSE` grants rights over the webview,
the extension host, the Askpass implementation and several icon sets, and
`licenses/` carried the notices for those. Keeping either would have
described software this repository does not contain. The only parts that
still apply — the copyright line and permission notice quoted above, and the
Rust crate attribution below — are reproduced in this file instead.

## Obligation that survives

The addon statically links roughly 175 Rust crates, overwhelmingly
`MIT OR Apache-2.0`, plus `zlib-rs` (Zlib) and `encoding_rs` (which carries a
BSD-3-Clause component). All are compatible with a copyleft-licensed
distribution, but **shipping a compiled `git-graph.node` requires attributing
them**, including the Apache-2.0 §4(d) notice requirement for binary
redistribution. The authoritative version list is `Cargo.lock` at the commit
the binary was built from; regenerate the inventory with:

```sh
cargo install cargo-about
cargo about generate about.hbs > THIRD-PARTY-RUST.html
```

That inventory is not in this repository yet, because no binary is
distributed from it yet. It must exist before one is.

[gix]: https://github.com/GitoxideLabs/gitoxide
