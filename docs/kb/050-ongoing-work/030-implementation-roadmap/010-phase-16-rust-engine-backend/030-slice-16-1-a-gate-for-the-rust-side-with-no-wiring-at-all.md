---
summary: >-
  Done (`2026-09-22`): `engine:check`/`test`/`lint`/`fmt` scripts,
  `.github/workflows/engine.yml` CI keyed on `engine/**`, `engine/**` in
  `sonar.exclusions`, the Rust arm added to the gate order.
---

# Slice 16.1 — A gate for the Rust side, with no wiring at all

Nothing can be verified until the Rust half has a gate, and today
`sonar.sources` (`src,scripts,esbuild.js`) and Biome's `includes` allowlist
both miss `engine/` entirely.

1. Add package scripts: `engine:check` (`cargo check --workspace
   --all-targets`), `engine:test` (`cargo test --workspace`), `engine:lint`
   (`cargo clippy --workspace --all-targets -- -D warnings`), `engine:fmt`
   (`cargo fmt --all --check`), each running with `--manifest-path
   engine/Cargo.toml` so they work from the repository root.
2. Add a CI job that runs all four on `ubuntu-latest`, keyed on changes under
   `engine/**`.
3. Add `engine/**` to `sonar.exclusions` **explicitly**. It is already outside
   `sonar.sources`, so this is belt-and-braces — but the exclusion is one line
   and the failure it prevents (a 418-line `build-addon.mjs` with
   `spawnSync(…, { shell: true })` entering analysis if `sonar.sources` is
   ever broadened) lands on an unrelated slice.
4. Extend the documented gate order in this file with the Rust arm, stating
   that it runs only when `engine/**` changed.

Acceptance: the four scripts exist and pass from a clean checkout; CI runs
them; `pnpm run lint` still reports the same file count it does today.

Implementation record (`2026-09-22`, four subslice commits, all signed):

- 16.1a `package.json`: the four `engine:*` scripts, each with
  `--manifest-path engine/Cargo.toml`. All pass: `fmt` clean, `check` with
  zero warnings, `cargo test` 101 passed / 0 failed, `clippy` clean under
  `-D warnings`.
- 16.1b `.github/workflows/engine.yml`: runs the four scripts on
  `ubuntu-latest`, keyed on `engine/**` plus the workflow itself. Action pins
  and Node setup mirror `publish.yml`; `rustup component add clippy rustfmt`
  covers components the runner image does not guarantee.
- 16.1c `sonar-project.properties`: `engine/**` appended to
  `sonar.exclusions` with the belt-and-braces comment. `pnpm run lint` checks
  243 files before and after — the acceptance count.
- 16.1d this file: the Rust arm added to the documented gate order, running
  only when `engine/**` changed.
- Nothing in `src/` references the engine; `git status` shows only the four
  intended files across the subslices, and `engine/target/` stays ignored.
