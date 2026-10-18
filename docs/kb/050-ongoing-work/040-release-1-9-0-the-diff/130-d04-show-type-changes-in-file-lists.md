---
summary: >-
  D04 · wave A · gated on X2 · TypeScript + Rust · ≤250 lines: stop hiding
  type changes (file ↔ symlink ↔ submodule), which both backends drop today,
  so such a commit lists nothing. List them as `M` with a type-changed
  marker, if X2 is (a).
---

# D04 — Show type changes in file lists

Status: waiting on X2
Needs: —
Decisions: X2
Kind: TypeScript + Rust (the Rust arm applies) · Size budget: ≤ 250 changed lines outside tests
Source: the "Diff parity against real history" record under Phase 16, root cause 11

## Goal

A commit that turns a file into a symlink (or a submodule, or back) lists
that path, the same way on both backends.

## Read first

- [The agent protocol](010-agent-protocol.md), and the answer to X2
- `src/backend/queries/commitDetails.ts` and `commitComparison.ts`, both of
  which pass `--diff-filter=AMDR`
- `src/backend/queries/diffFileChanges.ts`: `diffStatusRegex = /^[AMDR](?:\d+)?$/`
- `engine/native/core/src/diff.rs`: `classify`, which returns `None` when
  `is_link()` or `is_commit()` differs between the two sides
- `src/backend/engine/details.ts`: the engine payload parser

## Steps (for X2 = (a); stop if X2 says otherwise)

1. CLI: use `--diff-filter=AMDRT` in both queries. In
   `addFileChangesFromNameStatus`, accept `T` and emit
   `{ type: "M", typeChanged: true }`.
2. Engine: in `classify`, return `Modified` with a new serialized field
   `typeChanged: true` instead of `None`. In `line_counts`, count these like
   any modification. Add `typeChanged?: true` to `GitFileChange` and to the
   strict engine parser.
3. Bump the engine version (`engine/Cargo.toml` and
   `EXPECTED_ENGINE_VERSION`), because the TypeScript now relies on a field
   an older binary lacks. This is the KB rule in "Author Date through the
   engine".
4. Webview: a tooltip `l10n.typeChanged` ("Type changed") on such rows, in
   all five bundles. No new status icon.

## Touch

`src/backend/queries/commitDetails.ts`, `src/backend/queries/commitComparison.ts`,
`src/backend/queries/diffFileChanges.ts`, `src/backend/types/git.types.ts`,
`src/backend/engine/details.ts`, `src/backend/engine/addon.ts` (version
only), `engine/native/core/src/diff.rs`, `engine/native/core/src/types.rs`,
`engine/Cargo.toml` (version only), `engine/native/core/tests/git_parity.rs`,
`src/webview/main.ts` or `src/webview/commitDetailsView.ts` (tooltip only),
`src/extension/webviewL10n.ts`, `l10n/bundle.l10n*.json`, and the matching
tests

## Tests

- `git_parity.rs`: a commit turning `a.txt` into a symlink is listed as
  modified with `typeChanged`, and its counts equal `git diff-tree --numstat`.
- TypeScript parity test: CLI and engine agree on the same fixture.
- Parser tests for `T`.

## Acceptance

Gates and the Rust arm pass, and the symlink fixture lists the file on both
backends.

## Report

_(not started)_
