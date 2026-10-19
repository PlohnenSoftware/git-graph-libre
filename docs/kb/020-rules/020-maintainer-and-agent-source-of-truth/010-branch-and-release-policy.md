---
summary: >-
  Standing rules: release by fast-forwarding `main` to `AI-dev`; session-start
  reading order; workflow (rebase not merge, signing, strict Biome, OKLCH,
  American English, gate order up to SonarQube `OK`, Rust arm on `engine/**`);
  handoff rules.
always_read: true
---

# Branch and release policy

The AI/agent tooling was deliberately kept off the first `v1.0.0` release. On
`2026-07-27` the maintainer lifted that restriction for `main` and releases
starting with `v1.1.0`:

- `AGENTS.md` and its `CLAUDE.md`, `CODEX.md` and `agents.md` symlinks, the
  knowledge base under `docs/kb/` (`docs/AI_DEV_KNOWLEDGE_BASE.md` until
  `2026-10-18`), and
  `graphify-out/` may be tracked on both `AI-dev` and `main` and included in
  release-tag history. They remain development/maintenance artifacts and do not
  need to be linked from the public README or packaged into the VSIX.
- Supporting configuration such as the `/graphify-out/` ignores in `.gitignore`
  and the `graphify-out/**` Sonar exclusion may also be carried on `main`.
- After the completed `AI-dev` tree passes the full release gates, release by
  fast-forwarding `main` to that exact commit and tagging it. Keep the `AI-dev`
  branch on the remote after publication; do not delete it or rewrite its
  history merely to manufacture a separate release lineage.
- `v1.0.0` remains the historical clean first-release boundary; do not rewrite
  that tag or its history.

At the start of every agent session:

- Read `README.md` first for public project purpose, user-facing features,
  configuration, build notes, and license context.
- Then read this document for the active roadmap, clean-room rules, graphify map,
  implementation phases, current work order, verification expectations, and
  handoff rules.
- Do not infer the next task only from chat memory, private memory, or stale
  branch context. Let the tracked project docs define the current state.
- If `graphify-out/graph.json` exists and the question is about project
  architecture, file relationships, or code flow, use graphify query/explain/path
  as a navigation aid before broad manual scanning.

Workflow rules:

- Work through the documented phases and slices unless the maintainer changes
  priority.
- Treat slices as the unit of progress. Plan remaining microsteps before coding,
  do core behavior first, then tests, UI, reports, docs, and cleanup.
- Before starting work and before every commit, run `git fetch --all --prune`,
  check whether the branch is behind, and update safely if needed.
- **Never merge `main` into a pull request branch to bring it up to date.**
  Rebase the branch onto `main` instead. A branch that is going to be merged
  back into `main` gains nothing from having `main` merged into it, and the
  merge commit is not free: GitHub disables **Rebase and merge** on any pull
  request whose branch contains one, so the merge obfuscates the history *and*
  takes away the maintainer's chosen merge button. This is the one place a
  force-push is expected — rebasing a pull request branch and pushing it with
  `--force-with-lease` is normal here and does not need a separate request; the
  no-force rule above is about `main`, release tags, and shared long-lived
  branches.
- Never use destructive remote operations. Never force-push or rewrite shared
  history unless the maintainer explicitly requests that exact operation.
- Prefer small, atomic, reviewable commits and push normally after each coherent
  milestone unless the maintainer says not to push.
- **Every commit must be signed, and an unsigned commit must never be pushed.**
  If signing cannot work — the usual cause is a sandbox with no access to
  `gpg-agent` — stop, push nothing, and hand the decision to the maintainer.
  See Commit signing below.
- On `AI-dev`, include a commit trailer identifying the agent, for example
  `Co-Authored-By: Codex <codex@openai.com>`. When `main` is fast-forwarded for
  a release, retain the validated commits and their trailers unchanged.
- Add or update tests for every feature or behavior change.
- Use focused checks during a slice and the documented full gate at phase
  boundaries or before calling a larger slice complete.
- Every agile slice should leave touched files cleaner than it found them:
  address existing Biome, SonarQube, type-safety, and obvious maintainability
  issues in files touched by the slice instead of knowingly carrying local debt
  forward. Keep this scoped to touched files unless the maintainer approves a
  broader cleanup.
- Prefer cohesive, narrowly scoped modules/files for new behavior instead of
  growing large catch-all files. Split code when a new helper, command surface,
  parser, view component, or workflow has its own clear responsibility and can
  be tested in isolation.
- Treat `biome.strict.jsonc` as the target rule set for all new code and any
  existing code touched in a slice. The main `biome.jsonc` is a migration bridge
  for whole-tree checks while older files are cleaned up incrementally.
- Do not use `var` in new code, and remove `var` from files touched in a slice
  by replacing it with `const` or `let`. Keep `var` only when a reviewed,
  documented function-scoped escape behavior is required.
- Use OKLCH for repo-owned visual colors in CSS and webview rendering code.
  Prefer semantic CSS custom properties for repeated colors, preserve VS Code
  theme tokens as the primary source where available, and use OKLCH fallbacks
  instead of hex, RGB, HSL, or named color literals in touched visual code.
  User-supplied colors, validation examples, external assets, and compatibility
  fixtures may keep their required formats, but document why when adding them.
- Use American English spelling in all repo code surfaces: identifiers, CSS
  classes and custom properties, setting keys, localization keys, user-facing
  strings, and new documentation ("color", not "colour"). The webview and
  CSS specs use American spelling, so mixed spellings create split
  identifier families. When touching code that still carries British
  spellings, rename it within the slice. Public setting keys renamed for this
  rule keep a legacy fallback read (see the legacy-surfaces note in the Phase 1
  slice notes) so existing user settings keep working; document every such
  fallback with its removal condition. Historical prose in this document is
  exempt; new prose follows the rule.
- Before committing code changes, run Biome over touched/staged files and fix
  findings. The default target is `pnpm run lint:strict:staged` after staging,
  or an equivalent `biome.strict.jsonc` command over the touched files before
  staging. Do not commit with known Biome failures in touched code.
- **Multi-agent gate policy (maintainer, `2026-10-19`):** delegated slices
  and sub-slices do not require the full gate before their signed commits.
  Run focused checks appropriate to the change, keep commits small and
  frequent, and report exactly what ran. The integrator runs the full gate
  on the combined result at integration. Work without multi-agent delegation
  still requires the full pre-commit gate. No test, lint rule, threshold or
  gate may be weakened.
- For integration and work without multi-agent delegation, all gates run
  **before the completed result is committed**. The required order is: strict Biome on touched files, full package/typecheck/lint, full
  tests, localization checks, fresh `pnpm run test:coverage`, then
  `pnpm run sonar:scan` and an explicit server-side quality-gate poll. Commit
  only after the SonarQube quality gate is `OK`. If any gate changes code, rerun
  every affected check plus coverage and Sonar before committing. If the server
  is unavailable or the gate cannot run, do not silently substitute a
  post-commit scan; record the exact reason and remaining risk in the handoff.
- The Rust arm runs **only when `engine/**` changed**: `pnpm run engine:check`,
  `pnpm run engine:test`, `pnpm run engine:lint`, `pnpm run engine:fmt`
  (each with `--manifest-path engine/Cargo.toml`), plus the `engine.yml` CI
  job on GitHub. Biome and SonarQube never see `engine/` — their configs are
  allowlists that miss it, and `sonar.exclusions` names it explicitly — so a
  slice that touches no Rust file skips this arm entirely, and a slice that
  does must pass it before committing alongside the TypeScript gates above.
- SonarQube's local new-code definition is `Previous Version`. The
  `sonar.projectVersion` value is therefore an analysis baseline, not only a
  package-release label. Advance it deliberately when starting a stricter local
  quality-gate epoch, and document the reason in this knowledge base.
- If a full gate cannot be run, record the reason, the exact checks run instead,
  and the remaining risk.
- Update docs in the same slice as behavior changes: roadmap status,
  verification evidence, known limitations, and next steps.
- Keep generated outputs, caches, local scratch folders, and operating-system
  sidecar files out of commits unless they are intentional tracked artifacts.
- When replacing a legacy function, file, workflow, setting, compatibility path,
  or temporary bridge, remove the obsolete surface as soon as the replacement is
  verified. Do not keep parallel legacy code "just in case"; if compatibility
  requires it, document the reason, owner, and removal condition in this
  knowledge base.
- Respect recorded architecture and licensing decisions. Revisit them only when
  new evidence shows they are wrong or the maintainer redirects the plan.

Handoff rules:

- Leave the repo in a resumable state.
- Record changed files, verification commands/results, blockers, non-blocking
  risks, and the exact next slice.
- Keep agent-specific files pointer-only. If a durable rule belongs to future
  agents or maintainers, add it here instead of copying it into `AGENTS.md`,
  `agents.md`, `CLAUDE.md`, `CODEX.md`, or similar files.
