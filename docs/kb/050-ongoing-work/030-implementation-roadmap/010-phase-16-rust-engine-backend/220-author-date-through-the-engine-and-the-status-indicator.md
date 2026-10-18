---
summary: >-
  Done (`1.8.1`): engine `1.0.25` `useAuthorDate` lifts the Author Date
  decline; rule: bump the engine version when TS relies on behavior an older
  binary silently lacks; `loadCommitsDecline()` reasons; the status popup,
  amber unavailable state, `[engine]` log line; response field `components`,
  never `status`.
---

# Author Date through the engine, and the status indicator (`2026-10-16`)

**Why.** `dateType` defaults to `"Author Date"`, and slice 16.5 declined
it, so on default settings the engine never served the graph load — the one
read the phase's view-load numbers are about. It surfaced while answering the
maintainer's "how do I see the engine started?": nothing in the extension
said, and their own settings declined twice (signature column on, Author
Date by default).

**Engine `1.0.25`.** `LogOptions.use_author_date` (struct-level serde
default, so `false` when absent) makes `graph.rs` emit `record.author_date`,
which `log::read_commit` already carried for the author-date ordering. Only
the row date changes: the walk still ranks by `commit_ordering`, as
`git log --date-order --format=%at` does, and stash rows keep the committer
date on both backends, because the CLI lists them with
`git stash list --format=%ct`. `search_commits` already had the option.
`reports_the_author_date_only_when_asked` pins it — an amend with `--date`
makes the two dates differ — and the mutation back to `record.date` fails
only that test.

**Bump the engine version when the TypeScript starts relying on behavior an
older binary would silently lack.** serde drops unknown fields, so a `1.0.24`
binary would accept `useAuthorDate` and answer with committer dates. Moving
`EXPECTED_ENGINE_VERSION` and the Cargo workspace version (plus
`engine/package.json`) to `1.0.25` together makes the loader refuse that
binary into the CLI path instead. A payload *shape* change needs no bump —
the strict payload guards already refuse it — but a new *option* does.

**TypeScript.** The decline is gone and `buildLoadCommitsOptions` sends
`useAuthorDate: dateType === "Author Date"`. The predicate became
`loadCommitsDecline()`, which returns the reason (`GraphLoadDecline`:
`signatureColumn`, `topoOrdering`, `reflog`, `unreachableCommits`,
`globPattern`) instead of a boolean; `shouldServeLoadCommitsFromEngine` was
removed with it.

**Parity needed a new fixture.** Every earlier fixture wrote equal author and
committer dates, so an Author Date case over them passes with the engine
wrong. `skewed` has a rebased branch (authored early, committed late) and a
commit authored after it was committed, and the case first asserts that the
CLI's dates differ between the two settings. It then compares both date
types across both orderings, stash rows, a small page and a branch filter.
Forcing `useAuthorDate: false` fails exactly that case.

**The status indicator.** The dot and the "Ready" text in the status strip
are one focusable target (`#statusSummary`). Resting on it for 700 ms, or
focusing it, opens a popup listing the Git CLI (`git --version` through the
configured binary), the engine (version and build target, `off` under
`git-cli`, or the reason it is unavailable with the loader's own detail) and
which backend answered the last graph load — with the decline reason when it
was the CLI. A ready strip over an unavailable engine turns the dot amber and
reads "Ready (Rust engine unavailable)". `git-cli` stays green: a choice, not
a degradation. The pieces:

- `addon.ts` describes its single load attempt: `engineLoadStatus()`, built
  by the pure `resolveEngineLoad()`, which reports the most telling refusal
  across every candidate (`versionMismatch` > `incompatible` > `loadFailed` >
  `missing` > `unsupportedPlatform`; Node's `MODULE_NOT_FOUND` is `missing`).
  Without the ranking a glibc host whose binary failed to load would report
  the musl fallback's absence.
- `index.ts` exports `engineComponentStatus(preference)` — `git-cli`
  answers `off` without touching the loader — and `lastGraphLoadRoute()`,
  set on every `readCommits` return path. That route is local state only; it
  is not telemetry and never leaves the extension.
- `src/extension/componentStatus.ts` is `vscode`-free so the backend project
  tests it: `probeGit()` (`execFile`, 5 s timeout, never rejects),
  `buildComponentStatus()`, and `describeEngineStatus()` for the output
  channel, which gets an `[engine] …` line whenever the graph document is
  built — the log answer to "did the engine start?".
- The webview asks (`componentStatus`) when a hover begins, so answers are
  usually back before the popup opens. The host also pushes unasked when
  `git-graph-libre.backend` or `git.path` changes; `backend` was added to the
  `onDidChangeConfiguration` whitelist for that. The engine state is baked
  into the strip as `data-engine` at document build.
- **The response field is `components`, not `status`.** `handleActionResponse`
  in `main.ts` treats any response carrying `status` as a git action's
  outcome; the typecheck caught the collision. Do not name a new response
  field `status` unless it is one.

Verified visually with the headless QtWebEngine harness in Dark and Light
Modern. The images showed two defects that were then fixed: a label centered
against a wrapped value (now `align-self: start`), and `overflow-wrap:
anywhere` splitting `linux-x64-gnu` (now `break-word`, with the width cap
raised to 480 px).

Gate (`2026-10-16`): strict Biome clean on the 26 touched TypeScript files,
`pnpm run package` clean (262 files linted), `pnpm run test` green (`70`/`725`
backend plus `49`/`537` webview), `l10n:check` `100%` (589 bundle keys per
locale), fresh `test:coverage` `119` files / `1262` tests at `93.1%` lines
(`6763/7262`), Rust arm green (`cargo fmt --check`, clippy `-D warnings`,
`107` passed / `0` failed), the release addon rebuilt and smoke-tested at
`1.0.25`, and the Author Date parity case run against it, not skipped. Sonar
numbers are in the `1.8.1` entry under Current Architecture.
