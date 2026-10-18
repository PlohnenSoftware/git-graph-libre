---
summary: >-
  Complete (`2026-07-29`, `v1.1.1`–`v1.2.0`): signed-tag badges, remote tag
  deletion (`tagRemote.ts`), tag details popup redesign, SSH-signed commits
  detected via a batched `gpgsig` probe, release-workflow token rule.
---

# Phase 15: Tag Surfaces — Signed-Tag Distinction and Remote Tag Deletion

**Status: complete (`2026-07-29`).** Maintainer-priority slice released as
`v1.1.1`. It closes the "tag signatures" item listed as remaining under Phase 10.

Goal: make signed tags recognizable at a glance in the graph, let the delete-tag
flow remove the tag from selected remotes, and confirm the tag details popup is
reachable from the tag context menu.

Findings before implementation (verified `2026-07-29`):

- The tag details popup already existed and was already enabled. The backend
  query `src/backend/queries/tagDetails.ts` returns type, object, target, tagger,
  date, subject/body, and a verified signature, and `tag.viewDetails` is `true`
  in `DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY`
  (`src/contextMenuVisibility.ts`). Only the signature line needed work. Check
  this file before treating a "missing" tag feature as unimplemented.
- `GitRef` carried no signature information, so the graph could not distinguish
  signed tags without a second query.
- `deleteTag` had no remote surface at all, and `deleteRemoteBranch` held a
  private `remoteBranchMissing()` helper that the tag path would have duplicated.

Implementation record:

- Signed-tag detection rides on the existing `getRefs()` `for-each-ref` call, so
  it costs no extra git invocation. The format gained `%(objecttype)` and
  `%(if)%(contents:signature)%(then)1%(else)0%(end)`. The `%(if)` conditional is
  load-bearing: `%(contents:signature)` is a multi-line PGP block and would
  otherwise break the one-ref-per-line parsing. A ref is `signed` only when
  `objecttype` is `tag` **and** the signature atom is truthy — a lightweight tag
  points straight at a commit and has no tag object that could be signed.
  Verified against this repository, where `v0.1.0`–`v0.5.0` are signed and
  `v1.0.0`/`v1.1.0` are not.
- This reports only the *presence* of a signature; it deliberately does not run
  `git verify-tag`, which stays in the on-demand `tagDetails` query. Marking a
  tag "signed" is therefore not a claim that the signature is valid.
- `getRefs()` was split into `buildRefFormat()`, `toGitRef()`, and
  `parseRefLines()` after the added branch pushed it to cognitive complexity `16`
  against the `15` allowed (`typescript:S3776`). `toGitRef()` is exported so the
  ref mapping is unit-testable without a repository.
- `remoteBranchMissing()` moved to `isMissingRemoteRefError()` in
  `src/backend/utils/remoteRefs.ts` and is now shared by branch and tag deletion.
  The old private copy was removed in the same slice per the obsolete-surfaces
  rule.
- New `src/backend/actions/tagRemote.ts` owns `deleteRemoteTag()`. It pushes
  `--delete refs/tags/<name>` rather than the bare name so a same-named branch is
  never deleted by mistake. Because `refs/tags` has no per-remote tracking refs,
  the webview cannot know which remotes hold a tag; every remote is offered,
  each unchecked by default, and an already-absent remote tag resolves as success.
- `deleteTag` moved off `git.tag()` to `runGitRaw` so the deletion is recorded
  like every other action, and `messageHandler` now passes `recordGitCommand`.
- Webview: `renderCommitRef()` adds a `signed` class, the `verified` octicon
  (added to `scripts/generate-octicons.js` and regenerated), and a "signed tag"
  tooltip suffix. `--ngg-signed-ref` reuses the commit-signature token chain
  (`--vscode-testing-iconPassed` → `--vscode-charts-green` → `--ngg-success`) so
  the badge and the signature column agree. The tag details signature line is now
  status-colored via `.tagSignature-*`; `formatTagSignature()` returns escaped
  HTML and the signer/key are escaped individually, covered by an XSS test.
- Release workflow rewritten: it packages the VSIX, creates (or updates) the
  GitHub release for the pushed tag with the VSIX attached, and publishes to the
  marketplace only when `VS_MARKETPLACE_TOKEN` is set. The `secrets` context is
  not available to a step-level `if`, so the token presence is resolved into a
  step output first — do not "simplify" that back to `if: secrets.…`.

Verification (`2026-07-29`):

- `git fetch --all --prune`; `AI-dev` level with `origin/AI-dev` at `ff8b744`
- `pnpm run typecheck`
- strict Biome format + lint over all touched files, warnings as errors
- `pnpm run lint`, `pnpm run format`
- `pnpm run test`: backend `44` files / `315` tests, webview `34` files /
  `290` tests
- `pnpm run l10n:check`: `100%` package and bundle coverage for `pl`, `zh-cn`,
  `zh-tw`
- `pnpm run package`
- `pnpm run test:coverage`
- `pnpm run sonar:scan` with fresh coverage from the completed working tree.
  Task `4b2e18a3-89b9-4f70-a82a-4e5cdb3322a8`, analysis
  `9918d4a9-59ba-4570-9fdb-7552bf31f7e2`: `ZAM` quality gate **`OK`** on all six
  conditions — `new_duplicated_lines_density` `0.0`, `new_violations` `0`,
  `software_quality_maintainability_issues` `0`,
  `software_quality_maintainability_remediation_effort` `0`,
  `software_quality_reliability_issues` `0`,
  `software_quality_security_issues` `0`. `new_lines` `184`, overall project
  coverage `84.6%`. The gate no longer carries a `new_coverage` condition; see
  the SonarQube notes under Current Architecture.
- `pnpm run format` still reports the same six pre-existing drifts in files this
  slice did not touch (`.vscode/settings.json`,
  `tests/backend/avatarManager.test.ts`, `tests/backend/diffDocProvider.test.ts`,
  `tests/backend/manifest.test.ts`, `tests/backend/statusBarItem.test.ts`,
  `tests/webview/utils/dom.test.ts`), unchanged since `2026-07-27` and left for a
  dedicated cleanup slice per the scoped-cleanup rule. `pnpm run lint` reports
  only the pre-existing Biome schema-version info (`2.5.2` config vs `2.5.5` CLI).
- `sonar.projectVersion` advanced `1.1.0` → `1.1.1` so the `Previous Version`
  new-code window covers exactly this slice rather than reaching back past the
  1.1.0 release.

Follow-up (`2026-07-29`): tag details popup redesign, same slice. The popup was
read-only with a single Dismiss button and rendered its metadata as inline
`<b>…</b><br>` markup inside the generic `#dialog` (`width: max-content;
max-width: min(440px, 90vw)`), which squeezed hashes and long messages into a
narrow, uneven column. Redesigned it with a dedicated `#dialog.tagDetails`
variant: a structured `dl.tagDetailsFields` two-column grid (`max-content 1fr`)
for label/value rows, a full-width `white-space: pre-wrap` message row, and a
predictable `width: min(460px, 90vw)` so the panel no longer shrink-to-fits.
Added three copy actions in a wrapping flex row — **Copy Tag Name**, **Copy
Object Hash** (`type: "Tag Hash"`), and **Copy Tag Message** (`type:
"Tag Message"`) — each reusing the existing `copyToClipboard` path; the
message copy sends the joined subject+body. New l10n keys
`action.copyTagHash`, `action.copyTagMessage`, `type.tagHash`, `type.tagMessage`
across `en`/`pl`/`zh-cn`/`zh-tw`, and the copy-error `typeLabel` map gained
`Tag Hash`/`Tag Message` for friendly failure labels. Dismiss remains the single
primary action; the copy buttons are bound after `showDialog` returns (same
pattern as `#dialogAction`/`#dialogDismiss`), and `hideDialog()`'s
`dialog.className = ""` already drops the `tagDetails` class. Added a webview
rendering test for the copy actions and a `dialogStyles` CSS regression test
for the grid layout.

Verification (`2026-07-29`):

- `git fetch --all --prune`; `AI-dev` level with `origin/AI-dev` at `ff8b744`
- `pnpm run typecheck`
- strict Biome over the five touched files (`src/webview/main.ts`,
  `src/extension/webviewL10n.ts`, `tests/webview/rendering.test.ts`,
  `tests/webview/dialogStyles.test.ts`; CSS is not counted), warnings as errors,
  clean
- `pnpm run lint` (`189` files; only the pre-existing Biome schema-version info)
- `pnpm run format`: only the same six pre-existing drifts in untouched files
- `pnpm run test`: backend `44` files / `315` tests, webview `34` files /
  `292` tests
- `pnpm run l10n:check`: `100%` package and bundle coverage for `pl`, `zh-cn`,
  `zh-tw`
- `pnpm run package`
- `pnpm run test:coverage` (`78` files / `607` tests, `coverage/lcov.info`)
- `graphify update .` + `graphify tree`: rebuilt the map at `2,059` nodes /
  `4,839` edges / `118` communities
- `pnpm run sonar:scan` with fresh coverage from the completed working tree.
  Task `58015533-498b-45fa-8406-c8fa005054e9`, analysis
  `25fdced8-1fa5-4897-90a9-72f6d35f5423`: `ZAM` quality gate **`OK`** on all
  seven conditions — `new_coverage` `95.8`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `0`, and project-wide maintainability issues/effort,
  reliability issues, and security issues all `0`. Note the `new_coverage >= 85`
  condition is back on the gate (it had been removed per the earlier
  `2026-07-29` note); this slice cleared it at `95.8%`.

Follow-up (`2026-07-29`): signed-tag visual polish, released as `v1.1.2`. The
1.1.1 signed-tag look had regressed: the tag icon was replaced by the verified
glyph and lost its commit-color background. Restored a unified design:

- `refIcon()` always returns the **tag** octicon for tags (signed or not); the
  `signedTag` glyph-as-icon path is gone. A signed tag renders the tag icon on
  the commit-color background, then a `.gitRefSignedBadge` (the verified octicon
  on the signature-status green) sits **flush** against it.
- `.gitRef.tag.signed > svg { margin-right: 0 }` zeroes the default 5px right
  margin only on signed tags so the badge meets the icon with no background gap;
  it does **not** override the icon background, so the commit color is preserved.
- The `.gitRefSignedBadge` is a square (`border-radius: 0`), sized 14px with the
  glyph at 14px to match the 1.1.1 verified-icon weight.
- Signed tags now share the **default neutral border** with every other ref
  (`.gitRef.tag.signed { border-color: var(--ngg-neutral-border-heavy) }`); the
  green verified badge — not the border — carries the signature distinction.
- Commit signature column: `COMMIT_SIGNATURE_PRESENTATIONS.valid` glyph changed
  from the `"✓"` character to `svgIcons.verified`, and `.commitSignature-valid`
  is now a filled `background: var(--ngg-signed-ref)` circle (not the old 14%
  tint) with the glyph in the editor-background color, unifying with the tag
  badge. A new `svgIcons.verified` was added (the `signedTag` alias is kept so
  existing `signedTagIcon` test selectors keep matching).

Verification (`2026-07-29`):

- `git fetch --all --prune`; `AI-dev` level with `origin/AI-dev`
- `pnpm run typecheck`
- strict Biome over the five touched files (clean), `pnpm run lint` (only the
  pre-existing schema-version info), `pnpm run format` (only the six known
  pre-existing drifts in untouched files)
- `pnpm run test`: backend `44` files / `315` tests, webview `34` files /
  `294` tests
- `pnpm run l10n:check` `100%`; `pnpm run package`
- `pnpm run test:coverage` (`78` files / `609` tests)
- `sonar.projectVersion` advanced `1.1.1` → `1.1.2` so the `Previous Version`
  new-code window covers exactly this slice.
- `pnpm run sonar:scan`, task `1f5566fc-d85d-4a1e-a386-881b73a80f3b`: `ZAM`
  quality gate **`OK`** — `new_violations` `0`, `new_duplicated_lines_density`
  `0.0`, and all four project-wide conditions `0`.

Follow-up (`2026-07-29`): SSH-signed commits shown as unsigned, released as
`v1.2.0`. `git log %G?` reports `N` for commits it cannot verify, and that
conflates **truly unsigned** commits with **signed-but-unverifiable** ones —
notably SSH-signed commits when no `gpg.ssh.allowedSignersFile` is configured
(the verifier cannot even run, so it answers `N` instead of `U`). The result
was that every SSH-signed commit in such a repo rendered as `—` Unsigned in the
Signature column. `%GG` (raw signature) is also empty on unverified SSH
signatures, so no `git log` format atom can disambiguate.

The fix: after the log is parsed, the loader collects the hashes of every
commit whose `%G?` was `N` and runs **one** batched `git cat-file --batch` over
them (hashes on stdin). The new `parseGpgsigPresence(stdout)` splits the batch
output on `<40-hex-sha> commit <size>` header lines and flags any block that
contains a `gpgsig ` line. Those commits become
`{ status: "unverifiable", signer: null, key: null }` (reusing the existing
`E`-mapped status the webview already renders as `?` Unverifiable); genuinely
unsigned commits stay `null`. The probe is skipped entirely when the Signature
column is hidden or no commit reported `N`, so the common path adds zero git
calls; failures are swallowed (worst case = pre-fix behavior).

To feed stdin (which `git.raw()` cannot), a new
`runGitWithInput(git, { args, input, binary, repo, record, ... })` spawns the
git binary directly via `node:child_process.spawnSync`. The binary is the
caller-resolved `config.gitPath()` — threaded into `LoadCommitsInput.gitPath`
(mirroring `loadBranches`) rather than guessed from `process.env`, consistent
with the Phase 0.5 direction of diverging from `simple-git`. `runGitWithInput`
goes through the same `runGitCommand` wrapper for timing/recording/error
normalization.

Verification (`2026-07-29`):

- Reproduced the bug against a real repo (`_TA/ALPACA`): `git log %G?` reported
  `N` for all SSH-signed commits, while `git cat-file --batch` showed a
  `gpgsig -----BEGIN SSH SIGNATURE-----` header on every one of them.
- `pnpm run typecheck`; strict Biome over touched files (clean); `pnpm run lint`
  (only the pre-existing schema-version info); `pnpm run format` (only the six
  known pre-existing drifts in untouched files).
- `pnpm run test`: backend `46` files / `322` tests, webview `34` files /
  `294` tests. New tests: `parseGpgsigPresence` (5, pure-function unit cases)
  and `unverifiedSignatures` (2, real-repo integration: a `gpgsig`-bearing
  commit built via `git hash-object -t commit -w --stdin` reclassifies to
  `unverifiable`; a genuinely unsigned commit stays `null`).
- `pnpm run l10n:check` `100%` (no new keys — reused `signatureUnverifiable`);
  `pnpm run package`.
- `pnpm run test:coverage` (`80` files / `616` tests).
- `sonar.projectVersion` advanced `1.1.2` → `1.2.0` so the `Previous Version`
  new-code window covers exactly this slice.
- `pnpm run sonar:scan`. First scan flagged one new-code violation
  (`typescript:S6594`, `.match()` vs `RegExp.exec()` in `parseGpgsigPresence`);
  fixed by switching to `commitHeaderRegex.exec(line)` and rescanned. Final
  `ZAM` quality gate **`OK`** — `new_violations` `0`,
  `new_duplicated_lines_density` `0.0`, `new_coverage` `88.3%`, and all four
  project-wide conditions `0`.

Test notes for future slices:

- A signature-bearing tag object can be created **without a GPG key** by writing
  the object with `git mktag` and pointing the ref at it with `git update-ref`
  (see `tests/backend/queries/loadCommits/signedTags.test.ts`). Use this instead
  of generating throwaway GPG keys, which is slow and flaky in CI.
- Webview tests that click `refreshBtn` must re-supply commits with
  `receiveLoadedCommits(...)` after answering `loadRepoInfo`; the refresh clears
  the table, so ref lookups silently find nothing otherwise.
