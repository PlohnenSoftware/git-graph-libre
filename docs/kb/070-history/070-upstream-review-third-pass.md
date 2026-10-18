---
summary: >-
  Record: last reviewed upstream commit `86be522` — start the next pass there.
  License clean. All rejected except `34835ec` (no-folder activation) and
  `49c8025` (init-repository button).
---

# Upstream review, third pass (`2026-09-03`)

**Last reviewed upstream commit: `86be522`.** Start the next pass at
`git log 86be522..upstream/main`. The previous pass ended at `750f96f`; the
eight commits between them are classified below.

**Licence check first, and it came back clean.** None of the post-fork markers
listed under Mission appear anywhere in `upstream/main`, and their tree never
mentions this project, its publisher, or the AGPL. Their `LICENSE` reads
`Copyright (c) 2019 mhutchie. Fork (c) 2026-present asispts` with no claim over
material from here. Nothing to raise.

The eight commits are dominated by one architectural push — a webview RPC
protocol replacing their signal-based sync — plus bootstrap and config
cleanups. Nothing was taken; these are candidates for the maintainer to pick
from, listed newest first:

| Commit | What it does | Worth taking? |
| --- | --- | --- |
| `34835ec` | Returns from `activate()` immediately when the window has no workspace folder at all | **The most interesting of the eight**, but read it against BUG-5 before acting: this fork deliberately activates on `onStartupFinished` so the watching-eye status bar item can exist in a *non-git* folder. "No folder open at all" is a genuinely different case from "folder without a `.git`", and skipping activation there costs nothing — but the two are one line apart, and getting it wrong silently reverts a decision the maintainer already made. |
| `49c8025` | Richer no-repository page with an initialize-repository button | Idea only. This fork has its own no-repository and no-commits screens; the button that runs `git init` from the empty state is the part worth considering, and it is a few lines of our own code, not theirs. |
| `86be522` | Regenerates and hardens the tsconfig set | Third time the tsconfig split has come up (`867eddc` in the first pass, still "a rewrite rather than a merge"). Our configs have diverged further since — TypeScript 6, local aliases for `tests-ext` — so this stays a rewrite. Only worth doing as its own deliberate slice. |
| `ee90612`, `fbe641d`, `662d51e` | A typed RPC protocol for webview↔extension, then migrating initialization onto it and deleting the signal-based sync | **Rejected by the maintainer (`2026-09-03`).** Do not re-propose. Our `webviewBridge` already carries typed request/response messages with the union in `src/types.ts`, and theirs is bound to a preact webview this project keeps as plain TypeScript on purpose. |
| `c939ff7` | Simplifies their extension bootstrap | **Rejected (`2026-09-03`).** |
| `a5fc838` | Readme roadmap | **Rejected (`2026-09-03`).** Chore. |

**Maintainer decision (`2026-09-03`): everything in this pass except `34835ec`
and `49c8025` is rejected outright, `86be522` included — the tsconfig question
is closed, not deferred.** The two survivors are under consideration; the
findings below are what the maintainer asked for before giving upstream
feedback.

**`34835ec` in detail.** The guard is four lines at the top of their
`activate()`, and their manifest lists `onStartupFinished` as the only
activation event. Because the early return happens before *any* setup, it skips
their logger, their status bar item **and their
`vscode.commands.registerCommand("neo-git-graph.view", …)`** — so in a window
with no folder the extension counts as activated while its palette command does
not exist. Whether that matters rests entirely on the host being restarted when
a folder appears, and the API contract only promises that softly: `vscode.d.ts`
on `updateWorkspaceFolders` says "**in some cases** calling this method **may**
result in the currently executing extensions … to be terminated and restarted.
For example when the first workspace folder is added, removed or changed". A
`may`, not a guarantee — and nothing at all is promised for a folder arriving
by other routes. The conservative shape is to register commands unconditionally
and skip only the expensive setup.

**This fork cannot take it as written**, for a reason that does not apply to
upstream: they contribute two commands (`view`, `clearAvatarCache`), we
contribute seven, and `git-graph-libre.addRepo` is *designed* to work with no
folder open — it prompts for a directory with `showOpenDialog` and adds it by
path. Guarding activation the same way would unregister it in exactly the
window where someone would reach for it. Read this against BUG-5 too: that
decision restored `onStartupFinished` so the watching-eye status bar item can
exist in a **non-git folder**, which is a different case from **no folder at
all** — one line apart, and confusing them silently reverts a settled decision.

**`49c8025` in detail.** Their no-repository page gained a primary
**Initialize Repository** button, an inline error line (`role="alert"`), a
disabled state while the call is in flight, and an illustrative inline SVG. The
extension side is three lines: the handler simply runs VS Code's built-in
`git.init` command rather than shelling out to git itself, which is the part
worth copying as an idea — it inherits the folder picker, multi-root handling
and the SCM view refresh for free. Three new l10n keys. This fork already has
both a no-repository screen (`body.unableToLoad`) and a no-commits view, so the
question is only whether an action belongs on them; the code would be ours.
