---
summary: >-
  D60 · ready · TypeScript · ~180 lines: issue #30. With no global Git config
  file, `git config --list --global` exits 128, `loadRepoInfo` carries that
  as an error, the engine declines to match, and the webview empties remotes,
  authors, tags and stashes, hiding Fetch. Treat an absent scoped file as
  empty config on both backends, and stop discarding loaded repo info.
---

# D60 — A missing global Git config keeps the remotes

Status: done — awaiting integration
Needs: —
Decisions: — (the maintainer's own proposal in issue #30: Fix 1, Fix 2 and
Fix 3; the orchestrator chose how Fix 1 classifies the failure, see Facts)
Kind: TypeScript (backend, engine seam, webview) · Size budget: ~180 changed lines outside tests
Source: [issue #30](https://github.com/PlohnenSoftware/git-graph-libre/issues/30), added to release 1.9.0 at the maintainer's request (`2026-10-20`)

## Goal

On a machine with no global Git config file (no `~/.gitconfig`, no
`$XDG_CONFIG_HOME/git/config`, or `GIT_CONFIG_GLOBAL` naming a missing
file), the graph shows the repository's remotes, the Fetch and Push All
Tags actions, the author and tag filters and the stashes, on both
backends, and global identity simply reads as empty.

## Read first

- [The agent protocol](010-agent-protocol.md)
- Issue #30 in full (`gh issue view 30 --repo PlohnenSoftware/git-graph-libre`):
  its root-cause chain and its Fix 1–3 are the specification
- `src/backend/queries/loadRepoInfo.ts`: `loadScopedConfig` (about line 235),
  `loadConfig`, and how `loadRepoInfo` rolls sub-query errors up
- `src/backend/engine/repoInfo.ts`: `resolveGlobalGitConfigPath`,
  `resolveLocalGitConfigPath`, `isFile`, `loadEngineConfig` and its doc
  comment (about line 218)
- `src/backend/engine/index.ts`: the `composeDeclined` reroute (about line 409)
- `src/webview/main.ts`: `loadRepoInfo`'s four `errorReason === null &&
  repoInfo.isRepo ? … : []` lines (about line 636) and
  `updateRemoteActionsVisibility`
- `tests/backend/engine/repoInfo.test.ts` (the test `returns null when the
  global file is absent, matching the CLI error shape`),
  `tests/backend/engine/parity.test.ts`, `tests/backend/queries/loadRepoInfo/`

## Facts (checked `2026-10-20` on `the-diff`)

- Git 2.56: `GIT_CONFIG_GLOBAL=<missing> git config --list --global -z`
  prints `fatal: unable to read config file '<path>': No such file or
  directory` and exits 128. With an existing empty file it exits 0.
- Git queries run without `LC_ALL=C` (only `repositoryProbe.ts` sets it), so
  Git's error text can be localized. **Don't classify by message text
  alone.** Classify by absence instead: when `config --list --<scope>`
  fails and the scope's file does not exist (resolved the way the engine
  seam already resolves it, `GIT_CONFIG_GLOBAL` first, then `$HOME/.gitconfig`
  and the XDG file, where the scope counts as absent only when every
  candidate is), return the empty scoped config with `error: null`. Any
  other failure, including an existing file that can't be read or parsed,
  errors exactly as today. Move the resolvers to a shared backend utility
  rather than importing the engine seam from the CLI query.
- All three links of the chain are still present on `the-diff`.

## Steps

1. Fix 1 (CLI): classify the failure in `loadScopedConfig` as above.
2. Fix 2 (engine): `loadEngineConfig` stops returning `null` only because a
   scoped file is absent; an absent file answers empty identity for that
   scope, as the CLI now does. Unresolvable paths, throws, the include
   decline and malformed payloads still return `null`. Update the doc
   comment to the new contract.
3. Fix 3 (webview): apply `authors`, `tags`, `remotes` and `stashes`
   whenever `repoInfo.isRepo` is true, whatever `errorReason` says; the error
   still reaches the user through the existing error path.
4. Keep `loadConfig`'s `local ?? global` error precedence.

## Touch

`src/backend/queries/loadRepoInfo.ts`, `src/backend/engine/repoInfo.ts`,
one new or existing utility under `src/backend/utils/` for the shared
resolvers, `src/webview/main.ts` (the `loadRepoInfo` apply block only),
their tests under `tests/backend/` and `tests/webview/`

## Tests

- CLI: `loadRepoInfo` on a `makeRepo()` repository with a remote and
  `GIT_CONFIG_GLOBAL` set to a missing temp path: `error` null, empty
  global identity, `remotes` contains the remote. A second case with a
  global file that exists but is unreadable or malformed still errors.
- Engine: the absent-global test asserts the new contract (empty global
  identity, engine-composed, no CLI reroute); add the case to the parity
  suite so both backends agree with no global file.
- Webview: a `loadRepoInfo` response with `isRepo: true`, remotes and a
  non-null error still fills `gitRemotes` and leaves Fetch visible.
- Tests set `GIT_CONFIG_GLOBAL` explicitly and never touch `~/.gitconfig`.

## Acceptance

- Each of the four issue #30 checkboxes that can be tested in code is
  covered by a test above: remotes, Fetch, filters and stashes with no
  global file on both backends; unchanged behavior with a global file;
  an unreadable or corrupt file still errors; the engine serves the read
  with no `composeDeclined` reroute for an absent file.
- Focused checks per the protocol, `Sonar: integrator`.

## Report

- **Agent / date:** Claude Sonnet 5.5 slice agent, 2026-10-20 12:30
- **Branch and commits:** `diff-1.9.0/d60` — `2500e05 G docs(release): claim slice D60`; `4cbedd0 G fix(config): treat an absent scoped Git config as empty on both backends (D60)`; `6dc572a G fix(webview): apply loaded repo info whatever the error says (D60)`
- **Files changed:** `src/backend/utils/gitConfigPaths.ts` (new, +80); `src/backend/engine/repoInfo.ts` (+~15/−~70, resolvers moved out); `src/backend/queries/loadRepoInfo.ts` (+6/−1); `src/webview/main.ts` (+5/−8); tests: `tests/backend/engine/repoInfo.test.ts`, `tests/backend/engine/parity.test.ts`, `tests/backend/queries/loadRepoInfo/get.test.ts`, `tests/webview/fetchDialogDefaults.test.ts`
- **Tests added or changed:** CLI: absent global keeps remotes with null error and empty global identity, corrupt global errors, directory-as-global errors; engine: absent-global case now asserts empty global identity without calling `configList(repo, false)`; util: `isScopedGitConfigAbsent` cases; parity: absent global now served by the engine and equal to the CLI; webview: errored response keeps Fetch visible. Backend 1054 passed/60 skipped (1114) before, 1058/60 (1118) after; webview 760 before, 761 after.
- **Gates:** biome strict clean on all touched .ts; typecheck clean; test backend 1058/1118 (60 skipped, pre-existing), webview 761/761; l10n n/a (no text change); kb:check clean; Rust arm n/a; Sonar: integrator
- **Acceptance:** met, see test list above; engine no longer reroutes for an absent file (parity `served` true).
- **Deviations from the slice:** removed the now-unused `errorReason` parameter of `GitGraphView.loadRepoInfo` and its argument at the one call site in `src/webview/main.ts` (strict Biome flags an unused parameter).
- **Open questions / follow-ups:** none. With a corrupt global file, `git remote -v` itself fails, so remotes stay empty there (expected; not asserted).
