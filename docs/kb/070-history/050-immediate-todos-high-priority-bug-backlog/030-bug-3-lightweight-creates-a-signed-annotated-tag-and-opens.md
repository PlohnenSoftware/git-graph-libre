---
summary: >-
  BUG-3, fixed `2026-08-25`: the lightweight path passes `--no-sign` to defeat
  `tag.gpgSign`; annotated tags follow git's signing config; an empty
  annotated message is allowed again since `1.4.1`.
---

# BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window

**Status: fixed (`2026-08-25`). Priority: high. Area: backend action + webview dialog.**

Fault: `src/backend/actions/tag.ts:9-18`.

```ts
if (input.lightweight) {
  args.push(input.tagName);      // <- plain `git tag <name> <hash>`
} else {
  args.push("-a", input.tagName, "-m", input.message);
}
```

`git tag <name> <hash>` is only a lightweight tag when nothing else is
configured. With `tag.gpgsign = true` in the user's git config — which **is** set
on the maintainer's machine, globally — git creates a *signed annotated tag
object* instead and, because no `-m` was supplied, launches `core.editor` to
collect a tag message. That editor is `code-insiders --wait` here, so VS Code
opens a `TAG_EDITMSG` tab and the extension action blocks until the tab is
closed. That is the maintainer's "nasty tag description window", and it is git
opening it, not the webview.

Reproduced (`git 2.55.0`, `tag.gpgsign=true` inherited from `~/.gitconfig`,
`GIT_EDITOR` replaced with a stub that announces itself):

```
$ git tag lw1 $HASH
EDITOR-WAS-OPENED
$ git cat-file -t lw1
tag                     # <- annotated tag object, not a lightweight ref

$ git tag --no-sign lw2 $HASH
$ git cat-file -t lw2
commit                  # <- genuine lightweight tag, no editor
```

So the one-flag fix is `--no-sign` on the lightweight path. `--no-sign` exists
precisely to override `tag.gpgSign`, and the empirical check above confirms it
both suppresses the editor and restores the lightweight ref.

One secondary defect in the same flow: **the Message field is always visible.**
`renderDialogForm()` (`src/webview/main.ts:5829-5838`) emits a static table with
no conditional rows, so `showAddTagDialog()` (`src/webview/main.ts:2971-3005`)
shows the tag Message input even when Type is set to Lightweight, where it is
meaningless and is silently discarded.

**Maintainer decision (`2026-08-25`) — scope of `--no-sign`.** A lightweight tag
is a plain ref pointing straight at a commit; there is no tag object to carry a
signature, so a lightweight tag is *always* unsigned. That is git's design, not
a limitation of this extension, and the extension must not pretend otherwise.
Therefore:

- `--no-sign` is used **only** on the lightweight path, where it exists purely
  to stop `tag.gpgSign` from silently upgrading the tag into a signed tag
  object. It is a correctness guard for "lightweight means lightweight".
- The annotated path passes **no** sign-related flag at all and continues to
  follow the user's git configuration (`tag.gpgSign`, `tag.forceSignAnnotated`,
  `user.signingkey`, `gpg.format`). If the user has configured git to sign
  tags, their annotated tags get signed; that is the behavior they asked git
  for and the extension does not override it. Do **not** add `--no-sign` to the
  annotated path, and do **not** replace the two-way Type select with a
  three-way Lightweight/Annotated/Signed selector — the maintainer considered
  and rejected that; signing stays a git-config concern.
- Because the annotated path honors the config, a machine with signing
  configured but no usable key or agent will see tag creation fail with git's
  own error. That surfaces through the existing `error.unableToAddTag` dialog
  and is correct behavior — do not swallow it.

Fix:

- Lightweight: `git tag --no-sign <name> <hash>`. Non-negotiable, and the reason
  must be commented at the call site — a future reader will otherwise "clean up"
  the flag. State in that comment that the flag is deliberately absent from the
  annotated path.
- Annotated: keep `git tag -a <name> -m <msg> <hash>` exactly as it is. The
  `-m` is load-bearing: it is what guarantees git never opens `core.editor`.
- **Tell the user that lightweight means unsigned.** This is a documentation and
  UI duty, not an implementation detail:
  - Add a short explanatory line to the Add Tag dialog, shown when Lightweight
    is selected — e.g. "Lightweight tags are a plain ref with no tag object, so
    they carry no message and cannot be signed." New l10n key across `en`,
    `pl`, `zh-cn`, and `zh-tw`.
  - Extend the Lightweight option's own label or its adjacent help text so the
    difference is visible before the user commits to a choice.
  - Add a short "Tag types" note to the README next to the tag feature bullet,
    stating that lightweight tags are unsigned by definition and that annotated
    tags follow the user's git signing configuration.
- Hide the Message row when Lightweight is selected. This needs a small
  conditional-visibility affordance in the dialog form (a `dependsOn` field on
  `DialogInput`, or a change listener bound after `showDialog` returns, matching
  how `#dialogAction`/`#dialogDismiss` are already bound). Reject an empty
  message for annotated rather than creating an empty-message tag object — git
  2.55 accepts `-m ""` without complaint, so the guard has to be ours.
- Move `addTag` off `git.tag()` onto `runGitRaw` and pass `recordGitCommand`
  from `src/extension/messageHandler.ts:354`, so tag creation is logged like
  deletion is.
- Tests: `tests/backend/actions/tag/add.test.ts` currently proves lightweight
  creation only in a repo that inherits **no** `tag.gpgsign`, which is exactly
  why this shipped. Add cases that run with `-c tag.gpgsign=true` and assert
  `git cat-file -t` returns `commit` for lightweight (proving `--no-sign` held)
  and `tag` for annotated (proving the config was honored, not overridden),
  plus webview tests that the Message row hides for Lightweight and that the
  unsigned-lightweight explanation renders.

Implementation record (`2026-08-25`):

- Lightweight now runs `git tag --no-sign <name> <hash>` through `runGitRaw`
  (label `tag.addTag`, repo-recorded), with the load-bearing comment explaining
  why the flag exists and that it is deliberately absent from the annotated
  path. Annotated is unchanged (`-a <name> -m <msg> <hash>`), so it keeps
  following `tag.gpgSign`/`tag.forceSignAnnotated`. `messageHandler` passes
  `recordGitCommand` for `addTag` (the addTag half of BUG-6; pushTag remains
  for the BUG-1 slice).
- Add Tag dialog: the Lightweight option label now reads "Lightweight
  (unsigned)" and selecting it hides the Message row (new generic
  `dependsOn`/`required` affordance on `DialogInput`, with a new `note` input
  type rendering the explanation "Lightweight tags are a plain ref with no tag
  object, so they carry no message and cannot be signed."). An empty annotated
  message is rejected by the dialog instead of creating an empty-message tag
  object. New l10n keys across `en`/`pl`/`zh-cn`/`zh-tw`; README gained a
  "Tag types" note beside the tag feature bullet.
- Verified: independent verifier reproduced both halves against a scratch repo
  on this machine (`tag.gpgsign=true` global): old command → editor launched +
  signed `tag` object; new lightweight command → `cat-file -t` = `commit`, no
  editor; annotated → genuinely PGP-signed `tag` object (`git tag -v` Good
  signature), proving the config is honored, not overridden. Unit suites:
  `add.test.ts` uses a stub `gpg.program`/`core.editor` so the gpgsign cases
  are environment-independent; webview tests cover row hiding, the note, and
  empty-message rejection.
- Full gate green before commit: strict Biome on touched files, typecheck,
  lint, `test` (backend 46/324, webview 34/301), `l10n:check` 100%,
  `package`, fresh `test:coverage` (80 files / 625 tests, 92.1% lines), then
  `sonar:scan` task `8777f7a1-e3be-4684-a2f7-12b6ac16a9ac`, analysis
  `e48e5498-ea18-4142-a357-1b250b9036e0`: `ZAM` gate **`OK`** —
  `new_coverage` `94.1%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (of 3 allowed), reliability and security issues `0`.
- Process note: an external formatter reformatted `media/main.css` mid-gate
  (breaking CSS assertions); the tree was restored to HEAD plus the slice's
  genuine 8-line `.dialogFormNote` addition and the whole gate was re-run
  cleanly. Watch for concurrent editors touching this tree during gates.

Follow-up (`2026-09-03`): the maintainer reversed the empty-message part of the
decision after a user reported that annotated tags could not be created without
a message. An annotated tag's message is optional: the dialog labels it as such
and the backend deliberately passes `-m ""` when it is omitted, keeping tag
creation non-interactive. A lightweight tag still cannot carry a message; its
typed request omits the field and the backend rejects a message-bearing payload.
This fix is the `1.4.1` patch release.

Verification (`2026-09-03`): strict Biome passed on the six touched TypeScript
files; `pnpm run package` passed (typecheck, full lint, production builds);
`pnpm run test` passed (`54` backend files / `413` tests and `42` webview files /
`411` tests); `pnpm run l10n:check` remained at `100%` for all five languages;
and fresh `pnpm run test:coverage` passed (`96` files / `824` tests). SonarQube
task `72db4409-bd97-4858-a48f-bd40c31c614b`, analysis
`56894c64-9e4c-473e-b6f6-79c670b8e9ff`, passed the `ZAM` gate: new coverage
`100.0%`, duplication `0.0%`, new violations `0`, maintainability rating `1`,
and reliability/security issues `0`.
