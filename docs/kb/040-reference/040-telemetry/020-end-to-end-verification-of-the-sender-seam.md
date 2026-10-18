---
summary: >-
  Proof of the `createTelemetryLogger` sender seam: test launches are
  logging-only (`isLoggingOnly`), so it was verified with a packaged build;
  the injected `common.*` properties; `commonProperties.ts` and its removal
  condition.
---

# End-to-end verification of the sender seam (`2026-09-02`)

Everything below `vscode.env.createTelemetryLogger()` is unit-tested against a
fake and everything above it is VS Code's own code, so the handover between
them was the one unproven link — and it fails silently, which is
indistinguishable from "nobody uses this extension". It is now proven, and the
reason it *looked* broken is recorded here so nobody spends another session on
it.

**The extension host does not call a sender inside a test launch.**
`isLoggingOnly()` in
`resources/app/out/vs/workbench/workbench.desktop.main.js` is

```js
extensionTestsLocationURI ? true : !(isBuilt || disableTelemetry || (enableTelemetry && aiConfig?.ariaKey))
```

Its result reaches the extension host as
`initData.environment.isExtensionTelemetryLoggingOnly` and becomes
`ExtHostTelemetryLogger._inLoggingOnlyMode`, which `logEvent()` consumes as
`this._inLoggingOnlyMode || this._sender?.sendEventData(name, data)` — the
event goes to the hidden `extHostTelemetry (Not Sent)` output logger and the
sender is skipped. Every `pnpm run test:ext` launch sets
`extensionTestsLocationURI`, so `vscode.env.isTelemetryEnabled` and
`logger.isUsageEnabled` both read `true` while nothing is forwarded. An
earlier session hypothesized `ExtensionMode.Development` as the cause; that was
close but wrong, and the distinction matters — an ordinary F5 development host
of a *built* VS Code has `isBuilt` true and therefore **does** send.

**Verified against a packaged build.** `pnpm exec vsce package
--no-dependencies` with `TELEMETRY_ENDPOINT` temporarily pointed at a local
listener, installed into an isolated `--extensions-dir` plus `--user-data-dir`
(so the maintainer's real editor was untouched) under code-insiders
`1.136.0-insider`, opening a scratch repository with `--disable-workspace-trust`.
The `activate` event arrived roughly 30s later — the queue's flush interval,
not a hang — as a single-event batch. Two client behaviors were confirmed on
the wire at the same time: the event name arrived as the bare `activate`, so
`normalizeEventName()` really is load-bearing (VS Code prefixes
`PlohnenSoftware.git-graph-libre/`), and the batch envelope is the shape the
ingest validates.

**The common properties VS Code actually injects**, observed in that batch and
matching `getBuiltInCommonProperties` in the shipped extension host:
`common.extname`, `common.extversion`, `common.vscodeversion`,
`common.vscodemachineid`, `common.vscodesessionid`, `common.vscodecommithash`,
`common.vscodereleasedate`, `common.sqmid` (empty on this install),
`common.devDeviceId`, `common.isnewappinstall`, `common.product`,
`common.uikind`, `common.remotename`. Thirteen properties, far inside the
ingest's 64-property cap. Two corrections follow from that list:

- `common.devDeviceId` is **camelCase**, so "VS Code lowercases the injected
  keys" holds only for the keys the ingest actually maps to columns. Do not
  write a test asserting every `common.*` key is lowercase; it fails against
  reality.
- **`common.os`, `common.nodearch` and `common.platformversion` are not
  injected at all.** VS Code leaves that gap open in
  `extHostTelemetry.ts`. The ingest has `os`/`node_arch`/`platform_version`
  columns and both the README and `telemetry.json` promised them, so those
  columns were guaranteed to stay NULL and the user-facing disclosure
  overstated what was sent. Maintainer decision (`2026-09-02`): keep the
  columns and supply the three properties from the client through
  `createTelemetryLogger`'s `additionalCommonProperties`. Implemented the same
  day in `src/telemetry/commonProperties.ts` (no `vscode` import, so the
  backend project tests it): `common.os` and `common.nodearch` come from
  `process`, and `common.platformversion` is `os.release()` reduced to its
  leading numeric segments — the build/distribution suffix is the identifying
  part and is dropped. **Removal condition: when VS Code closes its own TODO
  and starts injecting them, delete that module in the same slice.** Nothing
  breaks if it is missed, because the logger mixes its built-ins in *after* the
  additional properties and VS Code's values would win, which is precisely why
  the duplication could sit there unnoticed. Owner: whoever next touches
  `src/telemetry/index.ts`.

`tests/extension/telemetry.test.ts` was rewritten to assert only what a test
launch can see — that the real `createTelemetryLogger` accepts the sender's
shape (its `validateSender` throws during activation, so a shape regression
breaks the extension rather than just losing data), that the logging-only
blindness is still the behavior, and that an empty endpoint is inert. Its
header comment carries the mechanism above; the throwaway `zzProbe.test.ts`
that discovered it was deleted.

**History note (`2026-09-03`).** This work was originally built as sixty-four
small resumable commits, and was squashed onto `AI-dev` as eight logical ones
at the maintainer's request. Two consequences for anyone reading back:

- **The per-slice records in this document cite Sonar task ids, not commit
  hashes**, which is why nothing here dangles after the rewrite. Keep it that
  way — a task id survives a rebase, a short SHA does not.
- **The ingest service is not in this history at all.** It was developed here
  for about twenty commits before moving to
  `PlohnenSoftware/git-graph-libre-telemetry`, and since it never shipped from
  this repository the add-and-remove churn was squashed out rather than
  preserved. Its design, deployment and schema live in that repository's own
  README; there is no `server/` directory here and the former
  `docs/TELEMETRY_PLAN.md` is gone with it. The durable client rules are the
  section above.

Every slice was gated to an `OK` `ZAM` result before its original commit, and
the squashed branch was gated again as a whole after the rewrite.
