---
summary: >-
  Done (`2026-09-22`): `src/backend/engine/addon.ts` loader,
  `createRepoReader` falling back only on `NotARepository`/`Unsupported`, the
  `git-graph-libre.backend` setting, `remoteUrl` wired, parity test,
  `view.engineBackend` telemetry.
---

# Slice 16.3 — The seam, the escape hatch, and one trivial read

The first wiring slice. It proves loader, fallback, setting, parity testing
and telemetry end to end on a read whose result is a single string, so that
nothing about data-shape mapping can obscure a plumbing failure.

1. **`src/backend/engine/addon.ts`** — the only module that knows the engine
   is a `.node` binary. Resolves the path for the host platform, `require()`s
   it inside a `try`, and exports `null` when it is absent or throws. Nothing
   above it may know the file exists.
2. **`src/backend/engine/index.ts`** — `createRepoReader(config)` returning an
   object that satisfies the reader interface, choosing engine-with-CLI-
   fallback or CLI-only. The fallback rule is upstream's and is worth keeping:
   fall back only on "not a repository" and "unsupported"; a genuine Git
   failure (bad revision, corrupt object) must not be retried through the CLI,
   because it will fail again more slowly and hide the real error.
3. **The setting, before any read depends on it.**
   `git-graph-libre.backend` (`"auto"` | `"git-cli"`, default `"auto"`)
   through the standard eight-hop plumbing — manifest, five
   `package.nls*.json`, `src/config.ts`, `src/types.ts`, `webviewHtml.ts`,
   `global.d.ts`, the webview config switch plus constructor literal, and the
   README table. `"git-cli"` must be a total no-op path: the addon is not even
   loaded.
4. **Wire exactly one read: `remoteUrl`** (`remote_url`). One string in, one
   string or null out.
5. **Cross-backend parity test** — `tests/backend/engine/parity.test.ts`,
   built to grow: a table of cases driven against both implementations over
   real scratch repositories, asserting identical results. Skip the engine
   half with a clear message when no addon is built, so the suite passes on a
   machine that has never run `engine:build`.
6. **Telemetry**: `view.engineBackend`, once per session, reported from the
   existing `recordCommitLoad()` call site, true only when the engine actually
   served a read. Update `telemetry.json` and the README disclosure in the
   same slice, as the telemetry rules require.

Acceptance: with no addon built, every existing test passes and behavior is
identical to 1.6.2; with an addon built, `remoteUrl` is served by the engine
and the parity test proves the two agree; setting `backend` to `"git-cli"`
restores the CLI path without a reload of the window.

Implementation record (`2026-09-22`, five subslice commits, all signed):

- 16.3a `git-graph-libre.backend` (`auto` | `git-cli`, default `auto`):
  manifest, five `package.nls*.json`, validated `config.backend()`, the
  `EngineBackend` type, README row. The first pass also carried the full
  webview cascade (view-state field, Config field, echo case) per the hop
  list — removed again in 16.3e: the setting is consumed only on the host
  (like `tabIconColorTheme`, which has no webview surface at all), the hub
  echo safely ignores unknown keys without reloading, and the case was
  unobservable and therefore uncoverable dead code. The fourteen test
  literals the cascade briefly required are reverted with it.
- 16.3e corrections: `AvatarManager` takes the preference as a *required*
  thunk (no `auto` default to hide behind); the loader gained a pure
  `platformDirectoryFor()` and an exported `validateLoadedAddon()` so every
  triple and every refusal is unit-tested; the dead outer try/catch is gone
  (each stage guards itself).
- 16.3b `src/backend/engine/addon.ts` (the only module that knows the
  `.node` file: dual `__dirname` anchors, `createRequire` on absolute
  paths, `EXPECTED_ENGINE_VERSION` refusal) and `index.ts` (engine-first
  reader, fallback only on `NotARepository:`/`Unsupported:`, genuine
  failures to null without CLI retry, `git-cli` never loads, session
  served-flag, per-call preference).
- 16.3c AvatarManager wiring (preference as a live thunk) plus the
  parity table (https origin, split push url, no remotes, non-repo dir)
  and a manager→github end-to-end wiring test on real backends.
- 16.3d `view.engineBackend` from the existing `recordCommitLoad` call
  site, true only when the engine served; `telemetry.json` and the README
  disclosure moved in the same slice.
- Four findings fixed inside the slice: napi camelCases exports (the
  addon speaks `remoteUrl`, verified against the binary; the loader
  refuses a binary without it); the engine contract is
  URL-or-null-or-decline (a non-repo throws `NotARepository`, which the
  parity model and the reader both route to the CLI); stub-based avatar
  tests pin `git-cli` to stay hermetic; fake timers hold back the engine
  threadpool, so the wiring test polls on real timers (proven by probe).
- Gate: the first scan failed `new_coverage` at `71.2` (ten uncovered
  lines: foreign-platform branches, the validator's refusal paths, the
  dead echo case, the preference default) and passed everything else;
  after the 16.3e corrections the gate is `OK` — full numbers in the
  16.3e commit.
