---
summary: >-
  Maintainer instruction (`2026-11-05`): the release workflow publishes to the
  VS Marketplace and Open VSX by OIDC trusted publishing (`id-token: write`,
  `vsce publish --oidc`, `ovsx publish --trusted-publishing`) instead of the
  long-lived PAT secrets; both installed CLIs already support it; each
  registry needs one registration naming this repository and `publish.yml`
  before the first publish run.
---

# Trusted publishing for releases (`2026-11-05`)

**Maintainer instruction (`2026-11-05`).** The `release` job of
`.github/workflows/publish.yml` no longer reads the `VS_MARKETPLACE_TOKEN` and
`OPEN_VSX_TOKEN` secrets. It asks for an OIDC token (`id-token: write`, on that
job only) and publishes with `vsce publish --oidc` and
`ovsx publish --trusted-publishing`, each still against the single VSIX the
GitHub release carries and still with `--skip-duplicate`. The two token-check
steps and the `VSCE_PAT`/`OVSX_PAT` wiring are gone: `ovsx` prefers a PAT from
its environment when one is present, and `vsce --oidc` refuses to run
alongside a PAT, so leaving either wired would silently keep the old path or
fail the publish. Each registry instead holds a registration that names this
repository and this workflow file, and exchanges the job's OIDC token for a
short-lived publishing credential (the Marketplace session token lasts up to
15 minutes; Open VSX issues a token scoped to this one extension). The
earlier token records — Phase 15's release-workflow token rule and "Open VSX
restored as a publish target, released as `1.6.1`" — stay as written; this
section supersedes their token mechanics, not their history.

What changed in behavior, beyond the credential:

- **A missing registration now fails the release instead of skipping a
  registry.** The old steps published to whichever registry had a token and
  left a notice for the other. The new steps always run inside `release`, so
  a missing or wrong registration is a red job. The steps stay sequential, so
  a failing Marketplace publish still skips Open VSX, and `--skip-duplicate`
  still makes re-running the whole job safe.
- **Dry runs are unchanged.** `release` still runs only on a tag push or a
  manual run with `publish` ticked, and no GitHub `environment:` was added to
  the job, so release approval behavior is exactly as before. Pinning an
  environment later (with required reviewers) is the registries' own way to
  restrict publishing further; both registrations take an optional
  environment name for it, left empty here because the job has none.

**Neither CLI needed a bump (checked `2026-11-05`).** After
`pnpm install --frozen-lockfile`, the lockfile resolves `@vscode/vsce` `4.0.0`
(specifier `^4.0.0`) and `ovsx` `1.3.0` (specifier `^1.2.0`). `ovsx publish
--help` lists `--trusted-publishing` outright. `vsce publish --help` does not
list `--oidc` — the installed `out/main.js` defines it with `hideHelp(true)`,
conflicting with `--pat` and `--azure-credential` — but `out/oidc.js` carries
the full exchange (audience `marketplace.visualstudio.com`, error text naming
the missing `id-token: write` permission), and `vsce publish --oidc
--packagePath /nonexistent.vsix` fails on the missing file rather than on an
unknown option, proving the flag parses. `package.json` is untouched.

**What the maintainer registers, once per registry, before the first publish
run on this workflow.** This repository is public (verified through the
unauthenticated GitHub API: `PlohnenSoftware/git-graph-libre`,
`"private": false`), so neither registry's private-repository path applies:
no Open VSX registration code, and no 48-hour first-run window on the
Marketplace policy — that rule is private-repository only in both vendors'
documents. The extension already exists with active versions on both
registries, which Open VSX requires before a trusted publisher can be
registered for it. Values are compared exactly, including case, and
`package.json`'s `publisher` (`PlohnenSoftware`) already matches the Open VSX
namespace's case, which its trusted-publishing check requires.

- **VS Marketplace** (publisher management page, publisher `PlohnenSoftware`,
  *Trusted Publishing*, *Create*): Policy name `git-graph-libre release
  (publish.yml)`; Provider GitHub Actions; Repository owner
  `PlohnenSoftware`; Repository `git-graph-libre` (name only, no owner);
  Workflow `publish.yml`; Environment empty.
- **Open VSX** (*Settings* → *Trusted Publishers*, *Register trusted
  publisher*; one trusted publisher per extension, and a registration cannot
  be edited, only deleted and recreated): Publisher (namespace)
  `PlohnenSoftware`; Extension `git-graph-libre` (the existing
  `PlohnenSoftware/git-graph-libre` extension); Provider GitHub Actions;
  Organization or User name `PlohnenSoftware`; Repository name
  `git-graph-libre`; Workflow filename `publish.yml` (filename only);
  Environment name empty.

**Order and aftermath.** Create both registrations first, then run the first
publish (the next release tag, or a manual run with `publish` ticked): that
run proves both exchanges end to end, and nothing before it can — a dry run
never reaches the publish steps. Once a release has published to both
registries this way, delete the `VS_MARKETPLACE_TOKEN` and `OPEN_VSX_TOKEN`
repository secrets; until that first success, keep them, because the rollback
needs them: restore the two token-check steps and the PAT wiring (the reverse
of this change), drop `--oidc`/`--trusted-publishing` and `id-token: write`,
and the old path works again while the secrets still exist. Nothing in this
change publishes, tags, or proves either registry's side; the first real
publish run is the proof, and a generic "no trusted publisher matches" answer
from either registry means the registered owner, repository, or workflow
names differ from the workflow that ran — check spelling and case first.
