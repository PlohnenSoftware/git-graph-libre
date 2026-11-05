---
summary: >-
  W26F · wave A · ready · TypeScript + webview + manifest + l10n · ~200
  lines: decision Y23 (b), plus the review's webview findings. Add
  `git-graph-libre.repository.showTagRemotes`, a boolean on by default. When
  it is off, nothing asks for or reads remote tags, and badges look as before
  PR #47. Also: re-request when a visible tag is missing from the snapshot or
  has moved (F4); keep old aliases while revalidating, and patch only the tag
  cells (F5); a replacer function for remote names (F10).
---

# W26F — A setting for the tag remote check

Status: done — awaiting integration
Needs: W26 (integrated `a93ddc7`: PR #47 merged)
Decisions: Y23, answered (b) on `2026-11-05`: a setting, on by default
Kind: TypeScript, webview, manifest and l10n · Size budget: ~200 changed
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
6. The review's webview findings (W26's report, F4, F5 and F10):
   - **F4.** A tag created or moved outside the extension (a soft refresh)
     must not read as "unavailable". When a visible tag is missing from the
     snapshot, or its hash differs, re-request, and show no remote status
     for that tag until the reply arrives.
   - **F5.** A hard refresh or an action keeps the previous snapshot shown
     while the new request runs: stale-while-revalidate, still dropping
     stale replies. A reply updates only the tag cells it changes, as
     `loadCommitSignatures` does, rather than re-rendering the whole table
     and graph.
   - **F10.** Use a replacer function when putting remote names into
     `l10n.tagOnRemotes`, so `$&` in a name is literal. With no remotes at
     all, show no remote status rather than "not found on any remote".

   Each gets a test.
7. README: add a configuration table row, and mention the setting in the
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
- F4, F5 and F10 each have a passing test.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05
- **Branch and commits:** `wt-1.10.0/W26F`
  - `861e85c G feat(tags): declare the repository.showTagRemotes setting (W26F)`
  - `e46ff90 G feat(tags): gate the tag remote check on showTagRemotes (W26F)`
  - `08e9fb9 G fix(tags): request remote tags before drawing the rows (W26F)`
  - `9036be7 G test(tags): cover the setting, F4, F5 and F10 (W26F)`
  - `860fe39 G docs(tags): document showTagRemotes in the README and changelog (W26F)`
  - (the claim, `4d900e3`, and this report are separate commits)
- **Files changed:** manifest and five `package.nls*.json`; `src/config.ts`,
  `src/types.ts`, `src/webview/global.d.ts`, `src/extension/webviewHtml.ts`,
  `src/extension/messageHandler.ts` (the `remoteTags` handler only),
  `src/webview/main.ts` (remote tag logic, settings echo, the two ref
  listener registrars), `src/webview/utils/dom.ts`, README, CHANGELOG; tests.
  `remoteTags.ts` untouched.
- **Behavior:**
  - Off: the webview sends no request, drops the snapshot, ignores late
    replies, and badges are the pre-PR-47 ones; the handler answers an empty
    no-error result and starts no process. Toggling in the Settings popup
    works live (the hub echo; on behaves like a Refresh).
  - F4: a visible tag missing from the snapshot, or with another hash,
    re-requests (not when the last read failed, which lists no tags); the tag
    shows no status until the reply.
  - F5: a hard refresh keeps the snapshot and drops the in-flight request;
    a reply redraws only the ref badges of rows with tags, in place, and
    re-attaches the ref menu and double-click listeners to them; no
    `renderTable()` or `renderGraph()`.
  - F10: replacer function; no status when the repository has no remotes.
  - `requestRemoteTags()` now runs before the rows are drawn.
- **Tests added or changed:** webview: 4 new rendering tests (off and live
  toggle; F4; F5; F10), 1 changed (stale-while-revalidate assertion; the
  helper loads a repo with a remote); 2 new `messageHandler` tests (off and
  on); config and manifest default entries. All `GitGraphViewState` fixtures
  gained `showTagRemotes`. Counts: backend 1241 to 1244 total, webview 804 to
  810.
- **Gates:** strict Biome clean on the 31 touched `.ts` files plus
  `package.json`; `typecheck` passes; `test` backend 1184 passed, 60 skipped
  of 1244, webview 810 of 810; `l10n:check` complete; `kb:check` run after
  this report; Sonar: integrator
- **Acceptance:** met, each with a test as listed above.
- **Deviations from the slice:** `src/webview/utils/dom.ts` is outside the
  Touch list: `addListenerToClass` gained an optional root so patched cells
  can be wired without re-registering every row. Translations for nl, pl,
  zh-cn and zh-tw are my own, not reviewed by a native speaker. The
  settings-echo test fixtures in about 20 test files gained one line.
- **Open questions / follow-ups:** editing the key in VS Code's own settings
  UI does not reach an open graph (the whitelist in `extension.ts`, as for
  every other key); left alone.
