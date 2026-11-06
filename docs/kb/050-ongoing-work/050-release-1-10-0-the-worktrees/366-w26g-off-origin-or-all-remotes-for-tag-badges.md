---
summary: >-
  W26G · wave A · ready (after W32 frees the manifest and l10n slot) ·
  TypeScript + webview + manifest + l10n · ~150 lines: the maintainer's
  three-way choice (`2026-11-06`). `repository.showTagRemotes` becomes
  `"off"`, `"origin"` (the default, PR #47's final `dc1886c` behavior:
  query and show only `origin`) or `"all"` (every remote, as integrated).
  It replaces W26F's unreleased boolean outright, wired at both ends.
---

# W26G — Off, origin or all remotes for tag badges

Status: ready
Needs: W26F, W26H, W26HF (integrated); PR #47's update `dc1886c`
(merged at `d1bc642`)
Decisions: the maintainer, `2026-11-06`: "for these tag labels make settings
if to show these tag remotes 1. off 2. only origin 3. all". The default is
`"origin"`, chosen by the integrator: it is what issue #46 asked for ("show
if a tag has been pushed to origin"), what the contributor's final PR
does, and the mode that contacts one remote rather than all. The
maintainer may change it.
Kind: TypeScript, webview, manifest and l10n · Size budget: ~150 changed
lines outside tests
Source: issue #46; PR #47 (`dc1886c`, "fix(tags): limit remote tag badges
to origin"); W26F — A setting for the tag remote check

## Facts (checked `2026-11-06`, `the-worktrees` at `d1bc642`)

- **The boolean it replaces.** W26F's setting
  `git-graph-libre.repository.showTagRemotes` is a boolean, default `true`.
  It has never been released, so it is replaced outright, with no legacy
  fallback. It is wired at:
  - the manifest: `package.json:542`, `package.nls*.json:74`–`:75`;
  - the accessor: `src/config.ts:169`;
  - the boot config and its types: `src/extension/webviewHtml.ts:79`,
    `src/types.ts:301`, `src/webview/global.d.ts:36`;
  - the handler gate: `src/extension/messageHandler.ts:863`;
  - the webview: `main.ts:1117`, `:1131`, `:1935`–`:1973` (the live
    toggle), the settings echo at `:2029`–`:2030`, `:5970` (the badge
    status), and `:7853`;
  - the README: `README.md:25`, `:142`.
- **The read.** `src/backend/queries/remoteTags.ts` (W26H/W26HF) lists
  every remote with `git remote` (`:201`). It then reads each one with
  bounded, abortable, non-interactive `ls-remote` processes, at most 4 at
  a time.
- **The contributor's version.** `dc1886c`'s origin-only behavior, read
  with `git show dc1886c -- src/backend/queries/remoteTags.ts
  src/webview/main.ts`:
  - only `origin` is queried, and only when it is configured;
  - a repository without `origin` makes no network request;
  - other remotes are neither queried nor shown;
  - the badge shows a single `origin` segment.

  Its strings, in all five bundles: `ref.tagOnOrigin` ("On origin"),
  `ref.tagNotOnOrigin` ("Local tag not found on origin") and
  `ref.tagOriginUnavailable` ("Tag information from origin is
  unavailable"). Read them with `git show dc1886c:l10n/bundle.l10n.json`
  and the other four bundles.

## Steps

1. Change the setting to a string enum `"off" | "origin" | "all"`, default
   `"origin"`.
   - Give it `enumDescriptions`, a description and a title in all five
     `package.nls*.json`.
   - The Settings popup's enum editor renders it.
   - Validate it at both ends: the boot config, and the raw settings-hub
     echo. Any other value, including a stale `true` or `false`, means the
     default.
2. Backend: `remoteTags` takes the mode.
   - `"off"`: the handler answers an empty no-error result and spawns
     nothing, as now.
   - `"origin"`: read and report only `origin`, and only if `git remote`
     lists it. With no `origin`, there is no network read and nothing to
     show.
   - `"all"`: today's behavior.

   Keep W26H's bounds, abort and non-interactive environment for every
   read.
3. Webview:
   - `"off"`: badges exactly as before PR #47.
   - `"origin"`: a single `origin` segment, with the contributor's three
     origin strings in its tooltip.
   - `"all"`: today's segments and strings.
   - Switching modes live re-requests, or forgets the snapshot, the way
     the boolean toggle does now.
4. Tests:
   - for each mode: no spawn when off; only `origin` queried in
     `"origin"`, with a backup remote neither queried nor shown; no
     network read without `origin`; every remote in `"all"`;
   - a live switch between the modes;
   - a raw echo with an invalid value falls back to the default.
5. Update the README feature line and configuration row, and widen
   `CHANGELOG.md`'s `[Unreleased]` `#46` entry to name the three modes.
   Credit `@rbalet`.

## Touch

`package.json`, the five `package.nls*.json`, `src/config.ts`,
`src/types.ts`, `src/extension/webviewHtml.ts`, `src/webview/global.d.ts`,
`src/webview/main.ts` (the remote-tag request, render, live toggle and
settings echo only), `src/extension/messageHandler.ts` (the `remoteTags`
handler only), `src/backend/queries/remoteTags.ts`,
`src/backend/types/queries.types.ts` (the request's mode),
`src/extension/webviewL10n.ts`, the five `l10n/bundle.l10n*.json`,
`tests/**`, `README.md`, `CHANGELOG.md`

## Acceptance

- `"off"` contacts no remote, and its badges match those before PR #47.
- `"origin"` contacts at most `origin`, and shows only its segment.
- `"all"` behaves as integrated today.
- The default is `"origin"`. Switching live works without a reload.
- Invalid values fall back to the default.
- `l10n:check` is at 100%.

## Report

Not started.
