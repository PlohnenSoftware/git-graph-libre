---
summary: >-
  W26F · wave A · needs W26 · TypeScript + webview + manifest + l10n · ~100
  lines: decision Y23 (b). Add `git-graph-libre.repository.showTagRemotes`,
  a boolean on by default. When it is off, the webview never asks for
  `remoteTags`, the extension contacts no remote, and tag badges look as
  they did before PR #47. Wired at both ends, since settings reach the
  webview twice.
---

# W26F — A setting for the tag remote check

Status: ready once W26 is integrated
Needs: W26 (PR #47 merged into the integration branch)
Decisions: Y23, answered (b) on `2026-11-05`: a setting, on by default
Kind: TypeScript, webview, manifest and l10n · Size budget: ~100 changed
lines outside tests
Source: decision Y23; W26 — Tags show the remotes that hold them (PR #47);
Settings reach the webview twice, and the second time is raw (Reference)

## Goal

PR #47 checks every remote with `git ls-remote` whenever a graph with tags
renders, on Refresh and after actions. Anyone whose remotes are slow,
metered, or need a key touch or a passphrase can turn that off. The setting
is on by default, so the feature shows out of the box.

## Facts (checked `2026-11-05`, before the merge)

- A boolean `repository.*` setting is wired in eight places. The example
  `repository.fetchTagsByDefault` shows each one:
  - `package.json:496` declares it, its text in `%config.…%`;
  - the five `package.nls*.json` files hold its description and title
    (`:67`–`:68`);
  - `src/config.ts:168` is its accessor;
  - `src/extension/webviewHtml.ts:78` puts it into the boot config;
  - `src/types.ts:296` and `src/webview/global.d.ts:35` type it;
  - `src/webview/main.ts:1698`–`:1699` applies the settings hub's echo;
  - `README.md:133` lists it in the configuration table.
- Settings reach the webview twice: validated at boot, raw in the settings
  hub's echo. Change both ends, and check that the `onDidChangeConfiguration`
  whitelist forwards the new key (Reference: Settings reach the webview
  twice, and the second time is raw).
- After W26, the webview asks for `remoteTags` from `src/webview/main.ts`
  (PR #47's code), and the handler is in `src/extension/messageHandler.ts`.
  Find the exact call sites in the merged code.

## Steps

1. Declare `git-graph-libre.repository.showTagRemotes`, a boolean, default
   `true`. Description: check each remote with `git ls-remote` and show on
   each tag badge the remotes that hold it; turn off to never contact
   remotes for this. Add it in all five `package.nls*` files, with an
   English copy where you can't translate, and say so in the report.
2. Add an accessor and the boot config field, and type it at both ends.
   Handle the settings hub echo in `main.ts`, turning the check on or off
   live.
3. When the setting is off, the webview sends no `remoteTags` request, and
   tag badges render exactly as before PR #47: no remote segment and no
   "unavailable" tooltip. Turning it off clears any snapshot already shown.
   Turning it on fetches like an explicit Refresh.
4. Defense in depth: the extension-side handler also answers an empty
   result, without spawning `git`, while the setting is off.
5. Tests:
   - webview: off means no request and plain badges; switching it on live
     sends the request;
   - extension: off means the handler spawns nothing.
6. README: add a configuration table row, and mention the setting in the
   tag feature line that PR #47 added. `CHANGELOG.md` `[Unreleased]`: one
   line, beside PR #47's entry.

## Touch

`package.json`, `package.nls.json`, `package.nls.nl.json`,
`package.nls.pl.json`, `package.nls.zh-cn.json`, `package.nls.zh-tw.json`,
`src/config.ts`, `src/extension/webviewHtml.ts`, `src/types.ts`,
`src/webview/global.d.ts`, `src/webview/main.ts` (the `remoteTags`
request and the settings echo only), `src/extension/messageHandler.ts`
(the `remoteTags` handler only, and the configuration whitelist if the key
needs adding there), tests, `README.md`, `CHANGELOG.md`

## Acceptance

- With the setting off: no `git ls-remote` is spawned, and tag badges are
  identical to before PR #47.
- With it on, the default: PR #47's behavior is unchanged.
- Toggling it in the Settings popup takes effect without a reload.
- `l10n:check` passes at 100%.

## Report

Not started.
