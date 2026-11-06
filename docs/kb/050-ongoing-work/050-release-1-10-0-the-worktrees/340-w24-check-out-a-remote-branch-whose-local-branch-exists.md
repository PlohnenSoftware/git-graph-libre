---
summary: >-
  W24 · wave D · needs W05, W10, Y14 · webview + TypeScript · ~220 lines:
  issue #45's feature (and #39). Before running `git checkout -b`, detect that
  the local branch exists, by name or because it already tracks the clicked
  remote branch, and offer, in our own words: switch to it; switch and
  fast-forward it (`--ff-only`, never a merge); or create a branch with
  another name. If it is checked out in another worktree, offer that
  worktree.
---

# W24 — Check out a remote branch whose local branch exists

Status: integrated `65725f7` (`2026-11-06`)
Needs: W05, W10 (worktrees and upstreams)
Decisions: Y14 (fast-forward source and detection rules)
Kind: webview and TypeScript, l10n · Size budget: ~220 changed lines outside
tests
Source: issues #45 and #39; Issue #45: checking out a remote branch whose
local branch exists, under Open GitHub issues

## Facts (checked `2026-11-04`, `c47207e`)

- For a remote ref, `checkoutBranchAction()` (`src/webview/main.ts:5326`)
  asks for a name and sends `checkoutBranch` with `remoteBranch`, which runs
  `git checkout -b <name> <remote>/<branch>` (`src/backend/actions/branch.ts:72`–`:95`).
  That fails when `<name>` exists. `hasLocalBranch()` (`main.ts:4714`) can
  tell first.
- After W10, `gitUpstreams` gives each local branch's upstream, so a local
  branch tracking the clicked remote branch under another name can be found.
  That is the reporter's likely state: `admin-gui`, created through W05's
  bug.
- Clean-room: the "expected" dialog in the issue is mhutchie's post-MIT Git
  Graph. Use it as a behavioral target only, and word ours from Git's
  documentation (Open GitHub issues, Clean-room note).

## Steps (as recommended; Y14 may change them)

1. When the proposed name exists, or a local branch tracks the clicked remote
   branch, show a choice dialog before anything runs:
   - **Switch to <name>:** `git checkout <name>`;
   - **Switch to <name> and fast-forward it to <remote>/<branch>:** `git
     checkout <name>`, then `git merge --ff-only <remote>/<branch>`. This
     uses the remote-tracking ref the user clicked and needs no network.
     Git refuses cleanly when the branches have diverged, leaving the user on
     the branch, and says so;
   - **Create a branch with another name:** today's input, with inline
     validation that the name is free.
2. If <name> is checked out in another worktree (W10), replace both switch
   choices with Open Worktree (W31).
3. Backend: a `checkoutAndFastForward { branch, target }` action, two
   `runGitRaw` steps, reporting which step failed.
4. Tests:
   - name collision;
   - tracking under another name;
   - fast-forward success;
   - diverged refusal;
   - a branch in another worktree;
   - no collision, with today's flow unchanged.

   Then l10n. `CHANGELOG.md` credits `@rbalet`, and `@cktgh`'s analysis
   from #39.

## Touch

`src/webview/main.ts` (`checkoutBranchAction`, the new dialog),
`src/backend/actions/branch.ts`, `src/backend/types/actions.types.ts`,
`src/extension/messageHandler.ts`, l10n files, `tests/**`, `CHANGELOG.md`

## Acceptance

No remote checkout ends in "a branch named … already exists". Every
integration is fast-forward only, and only when chosen.

## Report

- **Agent / date:** Muse Code (`muse-wonder-full-1.0`), `2026-11-05`
  21:20–21:31. The agent stopped after its changelog commit, before
  writing this report. The integrator, Claude Opus 5.5, verified the work
  and wrote this report on `2026-11-06`.
- **Branch and commits:** `wt-1.10.0/W24`, on `ddbe602`. Seven commits,
  all `G`: `78d1f8d` (the claim), `97ae5ba` (strings), `8049798` and
  `694bb8e` (`checkoutAndFastForward` and its tests), `d79cf91` and
  `ec19c04` (the choice dialog and its tests), `c1e9ecb` (the changelog).
- **Files changed:** 15 files, +807/−11.
  - Source: `src/backend/actions/branch.ts` (+46),
    `src/backend/types/actions.types.ts`, `src/extension/messageHandler.ts`,
    `src/extension/webviewL10n.ts` and `src/webview/main.ts` (+187).
  - The five l10n bundles and `CHANGELOG.md`.
  - Tests: `tests/backend/actions/branch/checkoutAndFastForward.test.ts`
    (new), `tests/webview/checkoutRemoteExistingBranch.test.ts` (new, 9
    cases) and `tests/webview/checkoutRemoteBranchName.test.ts`.
- **What it does:**
  - **The choice.** Before checking out a remote branch, it detects a
    local branch with the proposed name, or one that already tracks the
    clicked remote branch. It then offers:
    - switch, which is a plain checkout;
    - switch and fast-forward;
    - create a branch under another name, with inline validation that
      the name is free.
  - **The fast-forward** is the `checkoutAndFastForward` action:
    `git checkout <name>`, then `git merge --ff-only <remote>/<branch>`.
    Each step is a recorded `runGitRaw`, and an error names the step
    that failed. A diverged branch is refused by Git and left checked
    out.
  - **Another worktree.** When another worktree holds the branch, it
    offers that worktree (W31) instead of the switch choices.
  - **No collision.** Without one, today's flow is unchanged.
- **Gates (integrator, in this worktree, with engine `1.0.30`):**
  - strict Biome is clean on every touched TypeScript file, and
    typecheck passes;
  - test: backend 1341 of 1341, webview 891 of 891, with no unhandled
    errors;
  - `l10n:check` is complete, and `kb:check` passes;
  - Sonar: integrator.
- **Acceptance:**
  - No remote checkout ends in "a branch named … already exists": met.
    The collision and tracking cases offer the choice first, and a taken
    name is blocked inline.
  - Integration is fast-forward only, and only when chosen: met. That is
    `--ff-only`, sent only from the explicit choice.
  - Every test case in step 4 is present.
- **Deviations from the slice:** `src/extension/webviewL10n.ts` is outside
  the Touch list, but the l10n pattern requires it. W05's
  `checkoutRemoteBranchName.test.ts` was adjusted for the new dialog.
- **Open questions / follow-ups:** the nl, pl, zh-cn and zh-tw strings
  were not reviewed by native speakers.

## Follow-up — the choices as buttons (`2026-11-06`)

Maintainer request, from using the integrated dialog: the `<select>` of
three full-sentence choices opened a native dropdown that overflowed the
panel and repeated the selected value, and every choice still needed the
generic "Checkout Branch" submit. `showChoiceDialog()` now presents the
same three choices (the plain switch included — the option upstream's
two-button dialog lacks) as one-click buttons in a horizontal row that
wraps, with the switch primary and Cancel secondary; "Create a branch
with another name" opens the ordinary name prompt with the same inline
taken-name block, and the worktree case offers its two buttons the same
way. The standing pattern is recorded in the Webview UI Styling Guide.
Behavior, messages and the `--ff-only` rule are unchanged; the select's
two labels (`dialog.checkoutRemote.action`, `dialog.checkoutRemote.newName`)
are removed from all five bundles. Verified by the rewritten
`checkoutRemoteExistingBranch.test.ts` (buttons, keyboard, both name-prompt
defaults), a CSS regression test, and headless QtWebEngine renders in dark
and light tokens with short and long branch names.

## Follow-up — aligned action rows (`2026-11-06`)

The maintainer's screenshot of `development_Q2_2026` showed that the
wrapping button row produced three unrelated widths and a two-line,
centered fast-forward label. The new choice dialog has a short title,
branch context in monospace, and one full-width row for each action. Each
row has an existing octicon, a short label and a separate explanation. The
fast-forward explanation names the clicked remote ref and says that the
update is fast-forward only. Cancel has a separate footer and now accepts
Enter and Space as well as a click. All five language bundles use this
structure. Git actions and the worktree alternative keep the same payloads.

Verification completed `2026-11-07`:

- Strict Biome on the touched files, `pnpm run package` (typecheck and full
  lint included), `pnpm run test` (1,426 backend and 986 webview tests),
  and `pnpm run l10n:check` (100% in all four translated locales) pass.
- Fresh `pnpm run test:coverage`: 2,412/2,412 tests, 92.33% line coverage
  (10,372/11,234). The checkout cases include Enter/Space on the name prompt
  and Cancel, literal refs containing markup characters, tracking under
  another name and worktree routing.
- The actual dialog markup and repository CSS were rendered with
  QtWebEngine/Xvfb in 13 cases: dark/light, short/long refs, the worktree
  alternative, Polish/Dutch and 360px-wide views. All action rows stay
  within the panel. For very long refs only `.dialogChoiceBody` scrolls;
  the title and Cancel footer remain visible. Scratch previews are in
  `/tmp/ggl-checkout-redesign/`, outside the commit.
- `pnpm run sonar:scan` and its server-side poll: quality gate **OK**,
  task `479d60fd-b285-417e-909c-aed31149bbe9`, analysis
  `ef654b9c-2a5c-4d8e-8a02-bd662ebe0664`; new coverage 94.1%, zero new
  issues, zero unreviewed new hotspots, zero reliability/security issues.
  Automatic approval review initially rejected the upload; the retry was
  accepted after checking the public repository and the standing scan
  instructions. No scanner host or token was overridden.
- `pnpm run kb:index` and `pnpm run kb:graph` refresh the maintenance
  artifacts. The Rust arm does not apply: no `engine/**` file changed.

The implementation touches
`src/webview/main.ts`, `src/webview/global.d.ts`,
`src/extension/webviewL10n.ts`, `media/dialogs.css`, the five l10n bundles,
the existing checkout/style tests and this styling guidance.
