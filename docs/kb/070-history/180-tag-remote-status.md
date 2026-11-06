---
summary: >-
  Issue #46: tag badges show only origin when its tag matches. A bounded Git
  query compares exact tag objects; refresh invalidates the webview snapshot,
  and failed remote reads remain unknown.
---

# Tag remote status (`2026-11-05`)

Issue [#46](https://github.com/PlohnenSoftware/git-graph-libre/issues/46)
asks whether a tag exists on origin, using the graph's segmented ref badge.
Implemented from this repository and Git's `ls-remote` documentation alone.

`src/backend/queries/remoteTags.ts` reads local tag object IDs and runs
`git ls-remote --tags --refs -- origin` when origin is configured. Other
remotes are neither queried nor displayed, as requested by the contributor. It
compares the exact object IDs, not just names or peeled commit IDs: two
annotations on the same commit are different tags. Each lookup uses
origin's fetch endpoint, like the branch labels; separate push URLs are
not queried. No refs or Git configuration are written.

The query uses the configured Git executable, a separate process per read,
a ten-second timeout and the existing command recorder. Terminal and
credential-manager prompts are disabled. A failed origin read is returned as
unavailable. A repository without origin does not make a network request.
The handler starts the read without awaiting it so the file watcher is not
muted for the network round trip. The engine and graph-loading path are unchanged.

`src/webview/main.ts` asks after rendering a page containing tags and keeps
the snapshot across soft refreshes, filters and pagination. Explicit Refresh
and action-triggered hard refreshes discard it; opening another repository
does too. Request IDs and repository names reject late replies, and commit
hashes reject a stale tag target. External remote changes require Refresh.
The graph keeps its original badge while the first lookup is pending.

The single `origin` segment uses the existing `gitRefGroup` / `gitRefAlias`
styling. The alias retains tag actions and the original tag name; signed-tag
badges are preserved. Tooltips distinguish absence on origin from unavailable
information, with translations in all five bundle locales. No new setting,
icon, engine export or dependency is needed.

Verification (`2026-11-05`, macOS arm64):

- Strict Biome over every changed TypeScript and localization file, full
  `pnpm run package` (typecheck, lint, production bundles), `l10n:check`
  (all locales complete), and `kb:check` pass. Whole-tree lint warns about
  a pre-existing self-referencing `AGENTS.md` symlink, left untouched.
- The focused query and rendering suites pass: 103 tests. Fresh coverage
  covers every line and branch of `remoteTags.ts`.
- Full backend and webview runs, and
  `pnpm run test:coverage --coverage.reportOnFailure`, reproduce five
  baseline failures: one in `tests/backend/utils/repositoryProbe.test.ts`
  and four in `tests/webview/commandManager.test.ts`. All five also fail
  in an isolated archive of unchanged `main` at `c47207e`. The completed
  coverage run has 1,843 passing and 156 skipped tests; the skips include
  unavailable native-engine tests. These unrelated failures were not changed.
- Before/after browser fixtures execute the original and changed webview
  code with the actual `media/*.css` in headless Chrome. Captures live in
  `docs/screenshots/issue-46-before.png` and `issue-46-after.png`; they are
  fixture renders, not a running VS Code extension. Impeccable's detector
  reports no findings. Live VS Code and authenticated network remotes were
  not exercised; integration tests use local bare remotes.
- `pnpm run sonar:scan` cannot run: `sonar-scanner: command not found`,
  and the documented global scanner configuration is absent. No SonarQube
  gate result is claimed. `pnpm run kb:graph` likewise cannot run because
  `graphify` is not installed; the knowledge-base index is current.

The contributor explicitly authorized submitting a draft PR with these
verification gaps documented (`2026-11-05`). This exception covers submission;
the full gate remains pending maintainer verification before merge. The
contribution uses GitHub's signed-commit API; no unsigned commit is needed.

The contributor narrowed the implementation to `| origin` (`2026-11-05`),
matching the requested UI. Regression coverage checks that backup remotes
are not queried or rendered, missing origin makes no network request, and
an unreachable origin stays unknown. The existing badge styling is unchanged.

Verification of the origin-only update: strict Biome, production package,
localization, knowledge-base checks, and 105 focused tests pass. The full
coverage run has 1,845 passing, five baseline failures, and 156 skipped tests;
`remoteTags.ts` has 22/22 lines and 4/4 branches covered. A fresh Chrome
render confirms the single origin segment. SonarQube remains unavailable
(`sonar-scanner: command not found`); live VS Code and authenticated remotes
remain unverified. The existing draft-submission exception still applies.

**Integration note (`2026-11-06`, maintainer and integrator).** PR #47's
head `dc1886c` was merged unchanged into release 1.10.0's integration
branch, so GitHub sees all three commits, `a109e9a`, `0ded155` and
`dc1886c`, when `main` is fast-forwarded. The origin-only code change was
not taken as written. By then the branch carried its own follow-ups to the
original read:
- W26F: the setting, and the review's webview fixes;
- W26H and W26HF: non-interactive SSH, bounded and abortable reads.

The maintainer asked instead for a three-way setting: off, only `origin`,
or every remote. The contributor's narrowing becomes its "only origin"
mode, which is the default, with his wording for the origin tooltips. That
is the slice W26G — "Off, origin or all remotes for tag badges", under
Release 1.10.0. The simplified screenshot (`0ded155`) was taken as is.
