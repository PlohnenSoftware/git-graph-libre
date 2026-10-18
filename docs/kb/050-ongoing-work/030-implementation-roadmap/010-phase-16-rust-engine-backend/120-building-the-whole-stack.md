---
summary: >-
  Rule: `pnpm run build` builds the release addon, runs `engine:smoke`, then
  `package`; `pnpm run package` and `vsce package` build only the TypeScript,
  never the addon.
---

# Building the whole stack (`2026-09-23`)

`pnpm run build` is the only command that builds both halves:

```
engine:build:release   ->  the addon for the host platform, --release
engine:smoke           ->  it loads, and engineVersion() matches Cargo
package                ->  typecheck, whole-tree lint, production bundle
```

Roughly 35 seconds from cold on this machine. **`pnpm run package` builds
only the TypeScript half** — that is what it has always done, and it is
the command `vsce package` reaches through `vscode:prepublish`, so
neither of them ever rebuilds or validates the addon. Use `build` before
packaging anything you intend to install or measure; use `package` when
only TypeScript changed.
