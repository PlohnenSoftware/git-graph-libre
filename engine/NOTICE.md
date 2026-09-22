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

## License

The engine is MIT licensed. The upstream workspace declares `license = "MIT"`,
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
