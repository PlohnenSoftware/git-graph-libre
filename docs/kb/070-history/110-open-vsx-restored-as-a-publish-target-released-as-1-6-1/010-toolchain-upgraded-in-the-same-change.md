---
summary: >-
  Record of the `pnpm up --latest` upgrade (Vitest 5, `vsce` 4). Rules: pin
  `@types/vscode` `~1.98.0` to `engines.vscode`; avoid `pnpm add`; known
  format drift and a `vitest.config.ts` warning.
---

# Toolchain upgraded in the same change (`2026-09-17`)

`pnpm up --latest` on the maintainer's request. `@biomejs/biome` `2.5.5` →
`2.5.13`, `@primer/octicons` `19.31.0` → `19.36.0`, `@types/node` `26.1.1` →
`26.6.1`, `@vitest/coverage-v8` and `vitest` `4.1.10` → `5.0.1`,
`@vscode/vsce` `3.9.2` → `4.0.0`, `esbuild` `0.28.1` → `0.28.2`, `jsdom`
`29.1.1` → `30.0.1`, `tsc-alias` `1.9.1` → `1.9.5`. Three findings worth
keeping:

- **`@types/vscode` must not be upgraded past `engines.vscode`.** `pnpm up
  --latest` raised it to `~1.137.0` against `engines.vscode` `^1.98.0`, and
  `vsce package` refuses that outright: `@types/vscode ~1.137.0 greater than
  engines.vscode ^1.98.0`. That is the release workflow's first step, so the
  upgrade would have broken every release. It is pinned back to `~1.98.0`;
  raising it is only correct as half of a deliberate decision to raise the
  minimum supported VS Code, which drops users below that version.
- **`pnpm add <pkg>` upgrades every other dependency too** under pnpm 12.3.4 —
  it rewrote all nine specifiers in `package.json` while adding `ovsx`. Add a
  dependency by editing `package.json` and running `pnpm install
  --lockfile-only` when the intent is to add one thing. Running `pnpm` at all
  in this tree also drops the `@pnpm/exe` entries from the lockfile's
  package-manager document; they were restored by hand so the diff stays the
  dependency change.
- **The Biome config schema versions were stale** (`2.5.5` in `biome.jsonc`,
  `2.5.2` in `biome.strict.jsonc`) and are now both `2.5.13`, which clears the
  schema-version info that every `pnpm run lint` had been printing since
  `2026-07-27`.

Verification of the upgraded tree: `pnpm run typecheck` clean;
`pnpm run lint` clean (`243` files, no diagnostics at all now);
`pnpm run test` backend `61` files / `479` tests and webview `48` files / `500`
tests; `pnpm run l10n:check` `100%` for `nl`, `pl`, `zh-cn`, `zh-tw`;
`pnpm run package` clean; `pnpm run test:coverage` `109` files / `979` tests;
`pnpm run test:ext` both launches green (`58` + `1`, exit `0`);
`pnpm install --frozen-lockfile` — the release workflow's own install step —
passes; `pnpm exec vsce package --no-dependencies` produces a `263.58 KB`
VSIX under `vsce` `4.0.0`; and `pnpm exec ovsx publish --packagePath <vsix>
--skip-duplicate` was run without a token, which resolved the namespace and
stopped at the credential prompt, proving the invocation rather than
publishing anything.

Two knowns, neither caused by the upgrade:

- **`pnpm run format` still reports drift in ten untouched files** — the eight
  of the `2026-09-07` list plus `tests/webview/tableColumnResize.test.ts` and
  `tests/webview/webviewHtml.test.ts`. Verified identical under Biome `2.5.5`
  and `2.5.13`, so the upgrade added none of it, and whole-tree strict Biome
  reports the same `7` warnings under both versions.
- **Vitest 5 prints a Vite warning about `vitest.config.ts`**: ESM syntax in a
  file loaded as CommonJS, unsupported by the `configLoader: 'native'` that a
  future Vite major will default to. Renaming it to `.mts` is the documented
  fix but the file uses `__dirname`, which does not exist in ESM, so the
  rename has to come with an `import.meta.dirname` rewrite. Left as noise for
  a slice that can test it.
