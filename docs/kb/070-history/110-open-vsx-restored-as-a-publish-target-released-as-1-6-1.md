---
summary: >-
  Maintainer reversal of the `2026-08-25` decision, not to be re-dropped:
  releases publish to Open VSX again; `ovsx` devDependency, `OPEN_VSX_TOKEN` →
  `OVSX_PAT`, separate token checks, `--skip-duplicate`, namespace claiming.
---

# Open VSX restored as a publish target, released as `1.6.1` (`2026-09-17`)

**Maintainer reversal of the `2026-08-25` decision.** The release workflow
publishes to Open VSX again, so releases reach VSCodium, Cursor, Gitpod and
Eclipse Theia as well as the VS Marketplace. Open VSX was this project's own
second target until `3be16fc` (`2026-07-25`) collapsed the two-entry
`HaaLeo/publish-vscode-extension` matrix to a Marketplace-only job; the
`2026-08-25` upstream review then recorded the exclusion as deliberate. Both
notes are historical now — do not re-propose dropping it without a new
maintainer decision.

What the restoration is made of:

- **`ovsx` is a devDependency** (`^1.2.0`), so the CLI version is pinned by the
  lockfile exactly like `@vscode/vsce`. Do not switch this to `pnpm dlx`: an
  unpinned publisher is the thing the `2026-08-25` move off the third-party
  action was avoiding.
- **The secret keeps its historical name, `OPEN_VSX_TOKEN`** — the name
  `3be16fc` removed, and the one upstream uses. `ovsx` itself reads the token
  from `OVSX_PAT`, so the step maps one to the other; they are not
  interchangeable.
- **Two token-check steps, not one.** `Check Open VSX token` mirrors
  `Check marketplace token` for the same reason that step exists at all: the
  `secrets` context is not available to a step-level `if`. Keeping them
  separate is what lets a release publish to one registry while the other's
  token is absent.
- **Both publishes take `--packagePath "$VSIX" --skip-duplicate`** against the
  single VSIX that `Package extension` built and the GitHub release carries, so
  the two registries cannot receive differently-built artifacts and a re-run is
  a no-op rather than a failure.
- **The steps are sequential, so a failing Marketplace publish skips Open VSX.**
  That is the existing workflow's shape, kept deliberately: `--skip-duplicate`
  makes re-running the whole job safe. If a registry outage ever makes that
  coupling expensive, the fix is an `if: !cancelled()` guard on the Open VSX
  step plus an explicit `steps.package.outcome == 'success'` condition — not
  `always()`, which would run it after a failed package step.

**The `PlohnenSoftware` namespace must exist and be claimed before the first
publish, and neither is the workflow's job.** Creating it is
`ovsx create-namespace PlohnenSoftware -p <token>` once; until a namespace has
an owner, Open VSX shows "This namespace is not verified" and a warning icon
instead of the shield. Ownership is granted by the Eclipse Foundation on a
public request issue at
`github.com/EclipseFdn/open-vsx.org/issues/new/choose`, which requires having
logged into open-vsx.org at least once and signed the Publisher Agreement. The
criteria exist to stop namespace squatting — an extension published on both
registries should come from the same person or organization — so the request
should link this repository and the Marketplace publisher page as evidence.
Publishing works while unverified; only the badge and banner change.
