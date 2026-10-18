---
summary: >-
  BUG-5, fixed `2026-08-25`: the status bar `$(eye)` could never appear;
  restored `onStartupFinished`, removed the dead `workspaceContains:**/.git`;
  notes the untrusted-workspace limitation.
---

# BUG-5 — The "watching" eye status bar item can never appear

**Status: fixed (`2026-08-25`). Priority: high. Area: extension manifest. Decision made
(`2026-08-25`): restore `onStartupFinished`.**

The maintainer's report and the borrowed-icon verification are the same bug, so
they are recorded together.

`src/statusBarItem.ts:36-44` says, in a comment written for exactly this case:

```ts
// Stay visible with no repository, so the extension does not simply vanish
// in a non-Git folder. The eye says it is still watching for one.
if (this.numRepos === 0) {
  this.statusBarItem.text = `$(eye) ${name}`;
```

`package.json` says the opposite:

```json
"activationEvents": ["workspaceContains:.git", "workspaceContains:**/.git"]
```

In a folder with no `.git`, the extension never activates, `activate()` never
runs, `new StatusBarItem(...)` never happens, and there is nothing to show an
eye. The `numRepos === 0` branch is reachable only in the few hundred
milliseconds between activation and repo discovery inside a folder that already
*is* a repository — which is why the maintainer only ever sees the
`$(type-hierarchy)` state.

**Borrowed-icon verification (the maintainer's explicit question).** The
behavior came in on `5d9da6d`, adapted from upstream `neo-git-graph` `4afcb69`
and `deba9af`. The adaptation of the *icons and wording* is faithful — upstream
uses the same `$(eye)` / `$(type-hierarchy)` split and the same "watching"
tooltip, and this fork correctly swapped upstream's inline `vscode.l10n.t`
strings for key-based lookups and dropped upstream's earlier
`statusBarItem.warningBackground` treatment. What was **not** carried across is
the precondition that makes it work: upstream activates on `onStartupFinished`
(verified against `upstream/main`'s manifest), so upstream's status bar item
always exists. This fork replaced `onStartupFinished` with the
`workspaceContains` pair in `039aa6c` ("Scope extension activation events") and
then removed the explicit `onCommand:` entries in `55f4d7f`. The borrow landed
on a manifest that cannot support it. The status bar code itself is correct and
needs no change.

The rest of the watching machinery is intact and needs no work:
`createRepoWatcher()` (`src/extension/workspaceWatcher.ts`) already watches every
workspace folder from zero repos, and its create path runs `sendRepos()` →
`statusBarItem.setNumRepos()`, so `git init` in an open folder will flip the eye
to the graph icon the moment activation is fixed.

**Maintainer decision (`2026-08-25`): make the eye work again.** Restore
`onStartupFinished` to `activationEvents`. The watching promise stays; the
manifest is what changes.

Fix:

- Add `onStartupFinished` back to `activationEvents` in `package.json`.
  `activate()` is cheap — repo discovery is already an async IIFE
  (`src/extension.ts:100-105`) — and this is exactly what upstream does, which
  is why the borrowed behavior works there.
- Edit `tests/backend/manifest.test.ts:39`, which currently asserts
  `expect(manifest.activationEvents).not.toContain("onStartupFinished")`. That
  assertion encodes the very decision being reversed by `039aa6c`; replace it
  with a positive assertion and a comment recording that the extension
  deliberately activates at startup so the status bar item can exist in a
  non-Git workspace. Keep the existing assertion that no `onCommand:` entries
  are listed — VS Code still generates those implicitly.
- Leave `src/statusBarItem.ts` alone. The eye branch, the icons, the tooltips
  and the l10n keys are all correct; they were simply unreachable.
- Add an extension-host test that the status bar item is created and shown with
  `numRepos === 0`, so a future activation-scoping change cannot silently break
  this again. `tests/backend/statusBarItem.test.ts` is the existing home for
  status bar coverage.
- Verify by hand: open a folder with no `.git` and confirm the `$(eye)` item
  appears with the watching tooltip, then `git init` in that folder and confirm
  the watcher flips it to `$(type-hierarchy)` without a reload.

**Secondary finding, verify before relying on it:** `workspaceContains:**/.git`
is very likely dead. VS Code resolves a glob-bearing `workspaceContains` through
its file-search service, which honors `files.exclude`, and the default
`files.exclude` contains `**/.git`. If so, only the non-glob
`workspaceContains:.git` fires — meaning a workspace whose **root** is not a
repository but which contains one in a subfolder never activates the extension
either. Confirm this against a real VS Code instance (open a folder containing
only `sub/repo/.git` and watch the extension host log) before either deleting
the entry or replacing it with a working equivalent.

Implementation record (`2026-08-25`):

- `onStartupFinished` is back as the first `activationEvents` entry; the
  negative manifest assertion was replaced with a positive one carrying the
  rationale comment, and the no-`onCommand:` assertion stayed.
- **The secondary finding was confirmed and the dead glob removed in the same
  slice.** Against real VS Code `1.134.0` (variant extension copy without
  `onStartupFinished`, isolated profiles): a workspace whose root is not a repo
  but which holds `sub/repo/.git` never activated under default settings — and
  still never activated with `files.exclude`'s `**/.git` un-excluded, so the
  mechanism is deeper than `files.exclude`: VS Code's file search hard-excludes
  `.git` directories. The control (`.git` at workspace root) activated via the
  non-glob `workspaceContains:.git`, proving the variant was functional.
  `workspaceContains:**/.git` is therefore removed; the manifest test now
  asserts its absence with this evidence recorded in a comment.
- `src/statusBarItem.ts` untouched. Coverage added on two levels: the unit test
  locks construction → `show()` → `$(eye)` at zero repos and the
  `setNumRepos(1)` → `$(type-hierarchy)` flip; a new extension-host launch in
  `.vscode-test.mjs` (`non-git-workspace`, fixture without `.git`) asserts the
  extension activates at startup, which future activation-scoping changes
  cannot silently break. Real-VS-Code hand verification: exthost log shows
  `activationEvent: 'onStartupFinished'` in a no-git folder, and `git init`
  plus a first commit flipped the watcher path (`addRepo → saveRepos →
  sendRepos → setNumRepos(1)` evidenced by the persisted repo state) without a
  window reload.
- Observation for the maintainer (not fixed here): the manifest declares no
  `capabilities.untrustedWorkspaces`, so in an untrusted workspace VS Code
  disables the extension entirely — the eye cannot appear there regardless of
  activation events. Also noted: `tests/extension/workspaceWatcher` host test
  waits only 10ms for a watcher callback and flaked once under VS Code cold
  start (clean on re-run); a future slice should raise that wait like its
  sibling test's 500ms.
- Full gate green before commit: strict Biome, typecheck, lint, `test`
  (backend 46/330, webview 34/304), `test:ext` both launches (49/49 + 1/1),
  `l10n:check` 100%, `package`, fresh coverage (80 files / 634 tests, 92.1%
  lines), `sonar:scan` task `8b6e8aee-fa38-42c9-8105-8670f72e18e2`, analysis
  `1419ad8f-c7d5-4b78-875b-28f930c23f1b`: `ZAM` gate **`OK`** —
  `new_coverage` `93.8%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (slice added 0), reliability and security `0`.
