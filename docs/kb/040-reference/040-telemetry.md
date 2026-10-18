---
summary: >-
  Standing client telemetry rules (ingest lives in
  `PlohnenSoftware/git-graph-libre-telemetry`): the `createTelemetryLogger`
  boundary, three chokepoints, once-per-session view features, tri-state
  `telemetry.enabled`, `TELEMETRY_ENDPOINT`, `telemetry.json`.
---

# Telemetry (`telemetry` branch, `2026-08-26`)

Usage telemetry for feature ranking, **client side only in this repository**.
The Go ingest service was extracted on `2026-08-26` into its own private
repository, `PlohnenSoftware/git-graph-libre-telemetry`, checked out beside
this one as `../git-graph-libre-telemetry`. Its self-contained README carries
the design decisions, event model, API contract, schema, deployment, and the
no-IP-address rule; do not move backend detail back into this knowledge base
or the extension README. A merge to that repository's `main` builds the image
in GitHub Actions and calls the Coolify deploy webhook, so a push there is a
deployment.

Client rules that must survive any refactor:

- **Goal**: rank features by how many installations use them, so effort goes
  where it is used. Not crash reporting, not performance, not user counts.
- **Compliance boundary** is `vscode.env.createTelemetryLogger()`. It gates on
  the user's global telemetry setting and scrubs paths, URIs, and usernames
  before our sender is called. Never bypass it with a direct `fetch` from
  feature code.
- **Three chokepoints** cover the feature surface, and telemetry calls must
  not be scattered beyond them: `registerAction()` in
  `src/extension/messageHandler.ts` (all webview actions, outcome included),
  `register()` in `src/extension/commandManager.ts` (palette commands), and
  `createViewFeatureReporter()` in `src/telemetry/viewFeatures.ts`, called from
  the `loadCommits` route, for features that consist of something being
  *shown*. The action payload is in scope at the first one and carries
  repository paths, branch names, and commit hashes — send `command` only.
- **View-side features are reported once per session, never per load.** The
  commit-load path runs on activation, every refresh, every filter change and
  every watcher tick, so per-load reporting would rank one user's refresh
  habits instead of installations; read those numbers as "installations that
  saw it". Two further rules live in that module: a signal fires only when the
  feature *took effect* (the unreachable scan is skipped by the query unless
  the log covers all refs, so an enabled setting under a filter is intent, not
  use), and feature ids must match the ingest's
  `^[a-z][a-zA-Z0-9._-]{0,63}$` — a malformed id makes the ingest reject the
  **whole batch**, silently losing up to 25 unrelated events, which is why the
  pattern is mirrored in the client and asserted in tests.
- **Client modules** in `src/telemetry/`: `index.ts`
  (`createTelemetryReporter()`), `endpoint.ts` (the compiled-in ingest URL),
  `sender.ts` (TelemetrySender → fetch transport), `eventQueue.ts` (pure
  batching: 25 events / 30 seconds), `activationSnapshot.ts` (once-per-session
  settings-divergence snapshot — only *that* a setting changed, never the
  value), `commonProperties.ts` (the OS properties VS Code does not inject;
  carries its own removal condition), `consentPrompt.ts` (the consent
  question — see its own section below), `language.ts` (which translation the
  session actually used).
- **Two settings gate sending**, and both must be on: VS Code's global flag,
  which always wins, and `git-graph-libre.telemetry.enabled`. Ours is a
  three-state consent (`unset` / `enabled` / `disabled`) defaulting to `unset`
  since `2026-09-02`, and only `enabled` sends — an unanswered question is not
  permission, so `unset` is silent *and* keeps prompting. `config.ts`
  normalizes anything unrecognized to `unset` rather than to `enabled`, and
  maps a leftover boolean from the pre-consent branch build onto the state the
  user actually chose (`false` → `disabled`), because reading a refusal as
  "not asked yet" would resume sending.
- **`TELEMETRY_ENDPOINT` in `src/telemetry/endpoint.ts` is the on/off switch.**
  An empty string makes the reporter a total no-op, which is how the client
  shipped while no ingest existed; on `2026-09-02` it was pointed at the
  deployed service, so telemetry is live from the next release. The constant
  sits in its own module precisely because that module imports nothing from
  `vscode`: `index.ts` does, so the backend test project cannot load it, and
  the shipped value would otherwise be untestable
  (`tests/backend/telemetry/endpoint.test.ts`).
- **`sendErrorData` is deliberately a no-op** and the logger sets
  `ignoreUnhandledErrors: true`. The two must change together: without the
  flag, VS Code routes every unhandled extension-host error into the sender,
  and the ingest accepts only `activate` and `feature`.
- **Every user-facing telemetry string is localized in all five languages**
  (`en`, `nl`, `pl`, `zh-cn`, `zh-tw`). Dutch was added on `2026-09-02` as
  `package.nls.nl.json` plus `l10n/bundle.l10n.nl.json`, mirroring the existing
  sets; `pnpm run l10n:check` discovers new locales by filename, so a language
  is complete or it is visibly not. Note `time.needFormatMonth` and
  `time.dateformat` are behavior values rather than prose — Dutch follows the
  Polish pair (`true`, `DD MM YYYY`), not the Chinese one.
- **The `activate` event reports `language` and `translation` together**, and
  the pair is the point: `language` is VS Code's display language, the one the
  user asked for, and `translation` is the bundle that actually served them. A
  difference between the two is a request for a language this build does not
  ship — the single most actionable thing this telemetry can surface, and
  invisible if either property is dropped. `listBundleLanguages()` reads the
  shipped locales off the `l10n` directory rather than a constant, so adding a
  language cannot leave the reported list behind, and `resolveBundleLanguage()`
  deliberately mirrors VS Code's own fallback order (exact, then base language,
  then English) — a resolver that disagreed with the runtime would report a
  translation the user is not seeing.
- **`telemetry.json` at the repository root** declares every collected
  property for `code --telemetry` and is shipped in the VSIX. Update it in the
  same slice as any event or property change, and keep the README's Telemetry
  section (the user-facing disclosure) in sync with it.

Deployment (`2026-09-02`): the ingest answers at
`https://t.plohnensoftware.download`, behind Cloudflare and Caddy. `GET
/healthz` returned `{"database":true,"ok":true}` and a correctly shaped batch
POSTed to `/v1/events` returned `204`, so routing, validation, and the database
write path are all live. That probe inserted one synthetic row; clear it with
`delete from events where machine_id = 'probe-machine';`.
