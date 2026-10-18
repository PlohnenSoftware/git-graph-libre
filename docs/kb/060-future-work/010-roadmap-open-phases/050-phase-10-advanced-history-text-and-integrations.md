---
summary: >-
  Partial. Done: issue linking, config sharing, archives, commit/tag
  signatures, staging panel (`1.5.0`). Open: markdown/emoji, inline body,
  `.mailmap`, encoding. `2026-07-27` record: signature column, SonarQube gate,
  the empty-`SONAR_TOKEN=` pitfall.
---

# Phase 10: Advanced History, Text, and Integrations

**Status: partially complete** — issue linking, repo config export/import sharing (`7a18099`), ref archives (`b4d97fe`), commit signature status, and tag signature status (Phase 15, `2026-07-29`) are done. Remaining: markdown/emoji message rendering, inline commit body, `.mailmap` support, code-review state, and file encoding setting. The uncommitted-changes details view landed as the staged/unstaged drag-drop staging panel (`2026-09-07`), released as `1.5.0`.

Goal: close feature gaps after the core UX is strong.

Implementation plan:

- Add markdown, URL, and emoji-shortcode rendering behind safe parsing helpers.
- Add optional inline commit body display.
- Add uncommitted-changes details and compare-to-commit.
- Add issue linking and pull request provider configuration.
- Add commit/tag signature status.
- Add code-review state for commit details/comparison.
- Add external directory diff only after the file details model is robust.

Acceptance:

- Each advanced feature has a toggle or clear entry point.
- Unsafe HTML is not introduced.
- Tests cover parsing, escaping, and message contracts.

Slice progress:

- `2026-07-27`: Added commit signature status as an opt-in table column.
  `GitCommitSignature` carries a normalized `status` mapped from `git log %G?`
  (`G`, `U`, `B`, `X`, `Y`, `R`, `E`, plus `unknown` for anything unrecognized)
  alongside `%GS` signer and `%GK` key. `%G?`/`%GS`/`%GK` are appended to the log
  format only when `showSignature` is requested, so an unsigned or
  signature-blind repository pays no verification cost; `signature` is therefore
  `undefined` when the query skipped it and `null` when the commit is unsigned.
  The column is hidden unless `git-graph-libre.columns.signature` is on
  (default `false`), can be toggled per-session from the table header context
  menu, and reacts to live setting changes. Persisted column visibility is
  versioned with `COLUMN_VISIBILITY_STATE_VERSION` so the new default replaces
  stale saved state instead of resurrecting it. In the same slice,
  `GitCommitDetails` gained `authorDate`, `committerEmail`, and `committerDate`
  in place of the single `dateType`-dependent `date` field, so commit details
  render author and committer rows independently and collapse to one Date row
  only when both identity and date match. Verified with:
  - `git fetch --all --prune` (branch level with `origin/AI-dev`)
  - `pnpm run typecheck`
  - `pnpm run lint` (`176` files; one pre-existing `biome.jsonc` schema-version
    info, `2.5.2` against CLI `2.5.5`)
  - `pnpm run lint:strict:staged` (`34` files, clean)
  - `pnpm run test` (backend `37` files / `195` tests; webview `30` files /
    `244` tests)
  - `pnpm run l10n:check` passed with `100%` package and bundle coverage for
    `pl`, `zh-cn`, and `zh-tw`
  - `pnpm run package`
  - `pnpm run test:coverage` (`67` files / `439` tests, `coverage/lcov.info`
    written)
  - Fixed one stale assertion found by the gate: `tests/backend/manifest.test.ts`
    still required an `onCommand:` activation event per contributed command after
    those entries were dropped from the manifest. With `engines.vscode`
    `^1.98.0`, VS Code generates that activation implicitly, so the test now
    asserts no `onCommand:` events are listed instead.
  - SonarQube scan of committed revision `a20cd94`, analysis
    `68c1e955-1fb8-45c7-935f-5efb2b5684aa`: quality gate **ERROR**.
    `new_violations` `1` against a threshold of `0` and `new_coverage` `80.7%`
    against a threshold of `90%` both failed; `new_duplicated_lines_density`
    `0.0` passed.
  - The one violation was `typescript:S3776` in
    `src/backend/queries/loadCommits.ts`: `getLog` reached cognitive complexity
    `17` against the `15` allowed once signature handling was added. Fixed by
    splitting it into `buildLogFormat`, `buildLogArgs`, and `parseLogEntries`,
    which also resolved `typescript:S7755` on a line the split moved
    (`fields.at(-1)` in place of `fields[fields.length - 1]`). No behavior
    change; the full suite still passes at `67` files / `439` tests.
  - The coverage condition was not a property of this slice. With
    `sonar.projectVersion` still `1.0.0` the `Previous Version` window reaches
    back to the `0.4.1-ai-dev` analysis of `2026-07-03`, covering 16,408 new
    lines with `465` uncovered of `3,121` to cover. The maintainer chose to close
    it with coverage work rather than by advancing the version, so the baseline
    still starts at `0.4.1-ai-dev`.
  - Closed by covering the modules that had no tests at all: `avatarManager`
    (cache and staleness rules, remote-source detection, and the full GitHub and
    GitLab response branches with their rate-limit and back-off paths),
    `statusBarItem`, `diffDocProvider`, `l10n`, the output-channel logger, every
    `config` accessor, and two untested areas of `main.ts` — commit-table column
    resizing and the repository settings widget actions. Test count went from
    `423` to `566`; line coverage reached `92.1%` and blended line-and-branch
    coverage `86.2%`.
  - Final gate on revision `a6410e01`: **`OK`** — `new_coverage` `85.0%` against
    the `85%` threshold, `new_violations` `0`, `new_duplicated_lines_density`
    `0.0`. Note the threshold was `90%` earlier in this slice and the maintainer
    lowered it to `85%`; read the current value from the server rather than
    assuming either number.
  - Coverage sits barely above the threshold, so the next slice that adds
    lightly-tested code will push `new_coverage` back under it. The largest
    remaining pools are `src/webview/main.ts` (`265` uncovered lines),
    `src/avatarManager.ts` (`24`), and `src/extension/messageHandler.ts` (`25`).
  - `2026-07-27`, follow-up: the maintainer added project-wide conditions to the
    gate, which then failed on `software_quality_reliability_issues` `5`. All five
    were `typescript:S7781` (`String#split().join()` where `String#replaceAll()`
    belongs) in `src/backend/actions/file.ts`, `src/backend/actions/commit.ts`,
    and three places in `src/webview/main.ts` — none introduced by this slice;
    they dated from `2026-07-01` and `2026-07-02`. Replaced with `replaceAll`,
    which takes a literal string here and so keeps the deliberate
    no-regex-backtracking property of the CRLF helpers. Gate on revision
    `fb05e6a`: **`OK`** on all five conditions — `new_coverage` `85.0%`,
    `new_duplicated_lines_density` `0.0`, `new_violations` `0`,
    `software_quality_reliability_issues` `0`,
    `software_quality_security_issues` `0`.
  - Correction for future agents: an earlier attempt in this slice reported the
    gate as unrunnable after a `401`. That was wrong — the command had been
    prefixed with an empty `SONAR_TOKEN=`, which overrode the valid
    `sonar.token` in the scanner config. See the SonarQube notes under Current
    Architecture.
