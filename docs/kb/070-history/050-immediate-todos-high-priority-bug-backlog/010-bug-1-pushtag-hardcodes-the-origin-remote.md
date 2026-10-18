---
summary: >-
  BUG-1: `pushTag` hardcoded `origin`. Implemented `2026-08-25` (pushes
  `refs/tags/<name>` to the chosen remotes via `runGitRaw`,
  force/`--no-verify`), though its `Status:` line still says open.
---

# BUG-1 — `pushTag` hardcodes the `origin` remote

**Status: open. Priority: high. Area: backend action + webview dialog.**

Fault: `src/backend/actions/tag.ts:39-41`.

```ts
export async function pushTag(git: SimpleGit, input: ActionPayload<"pushTag">): Promise<void> {
  await git.push("origin", input.tagName);
}
```

The remote name is a string literal. Any repository whose remote is called
something else — `upstream`, `gitlab`, a fork named after its owner, or a repo
with several remotes and no `origin` — cannot push a tag at all.

Reproduced (`git 2.55.0`, scratch repo with a single remote named `upstream`):

```
$ git push origin v1.0
fatal: 'origin' does not appear to be a git repository
fatal: Could not read from remote repository.
```

The user sees the generic `error.unableToPushTag` dialog carrying that text.

Three further defects sit in the same two lines:

1. **Bare refspec.** `git push <remote> <tagName>` is ambiguous when a branch
   and a tag share a name. Reproduced: with both a branch and a tag named
   `v2.0`, `git push upstream v2.0` fails with
   `error: src refspec v2.0 matches more than one`, while
   `git push upstream refs/tags/v2.0` succeeds. `deleteRemoteTag()` in
   `src/backend/actions/tagRemote.ts:29` already learned this lesson and pushes
   `refs/tags/<name>`; `pushTag` never did.
2. **Not recorded.** It calls `git.push()` through `simple-git` instead of
   `runGitRaw`, so the push never reaches the git-command log that every other
   action feeds. `src/extension/messageHandler.ts:356` correspondingly omits
   `recordGitCommand`, unlike the `deleteTag` route one line above it.
3. **No options.** No force/lease mode, no `--no-verify`, no multi-remote fan-out
   — see BUG-2.

Fix:

- Widen `ActionPayload<"pushTag">` in `src/backend/types/actions.types.ts:88`
  from `{ tagName: string }` to carry `remotes: string[]` plus the same option
  fields `pushBranch` already has, and reject an empty `remotes` array the way
  `pushBranch` does (`src/backend/actions/branchRemote.ts:105-107`).
- Reimplement `pushTag` on `runGitRaw` with
  `["push", remote, `refs/tags/${input.tagName}`]`, looping over the selected
  remotes, and thread `recordGitCommand` through `messageHandler`.
- Replace the bare confirmation in `showPushTagDialog()`
  (`src/webview/main.ts:3707-3717`) with the remote-checkbox form used by
  `showPushBranchDialog()` (`src/webview/main.ts:3863-3880`), defaulting the
  checked remote through the existing `defaultPushRemoteName()` helper
  (`src/webview/main.ts:4001`). Keep the plain confirmation only for the
  single-remote case.
- Extend `tests/backend/actions/tag/push.test.ts`: a remote **not** named
  `origin`, a repository with two remotes, and a branch/tag name collision that
  must still push the tag and leave the branch untouched.

Implementation record (`2026-08-25`):

- `ActionPayload<"pushTag">` now carries `{ tagName, remotes: string[],
  mode: GitPushBranchMode, noVerify: boolean }` — the pushBranch shape minus
  branch fields, reusing `GitPushBranchMode` (no second enum). `pushTag` was
  reimplemented on `runGitRaw` (label `tag.pushTag`): rejects an empty
  `remotes` array like `pushBranch`, loops over the selected remotes, and
  pushes the fully-qualified `refs/tags/<name>` refspec. `pushModeArg` moved to
  an export in `branchRemote.ts` so branch and tag pushes share one
  mode→arg mapping; `--force-with-lease`/`--force`/`--no-verify` thread through
  exactly as for branches. `messageHandler` passes `recordGitCommand` (closes
  the pushTag half of BUG-6; the addTag half landed with BUG-3).
- `showPushTagDialog()` now mirrors `showPushBranchDialog()`: no remotes →
  silent return; single remote → plain confirmation sending
  `remotes: [name]`; multiple remotes → checkbox form with the default checked
  remote from `defaultPushRemoteName()` and an empty-selection error. Zero new
  l10n keys — the branch dialog's remote labels carry no branch wording and
  were reused.
- Verified: independent verifier reproduced all three failure modes against
  scratch repos (non-`origin` remote fatal under the old command; branch/tag
  name collision "matches more than one" under the bare refspec; both succeed
  with `refs/tags/` refspec, branch ref untouched; two-remote fan-out works)
  and confirmed the recorded log line embeds `refs/tags/` args. Tests:
  `push.test.ts` rewritten (7 cases incl. collision and two-remote subset),
  webview rendering + messageHandler coverage for the dialog and the record
  line (backend 46/329, webview 34/304).
- Full gate green before commit: strict Biome, typecheck, lint, `test`,
  `l10n:check` 100%, `package`, fresh coverage (80 files / 633 tests, 92.1%
  lines), `sonar:scan` task `9e9165bf-e3be-4814-affa-ba11a5684594`, analysis
  `ef1eaebc-ba59-4d2a-a411-0c5ce58bdf3e`: `ZAM` gate **`OK`** —
  `new_coverage` `93.8%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (unchanged; this slice added 0), reliability and
  security issues `0`. Note: a concurrent editor staged a `biome.jsonc`
  `$schema` bump (2.5.2→2.5.5) mid-campaign; it was unstaged and left as a
  working-tree change, and lint passes under either schema value.
