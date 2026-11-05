---
summary: >-
  W26H · wave A · needs W26F · TypeScript · ~120 lines: the PR #47 review's
  process findings. Make the background `git ls-remote` truly
  non-interactive for SSH (`SSH_ASKPASS_REQUIRE=never`, stdin closed),
  killable on every platform, capped at about 4 remotes at a time, hidden on
  Windows and abortable. Close the unhandled rejection in the handler, check
  untrusted workspaces, and isolate the tests from the real Git config.
---

# W26H — Harden the remote tag read

Status: integrated `d607144` (`2026-11-05`)
Needs: W26 (integrated `a93ddc7`), W26F (it changes the same handler and
adds the setting this read obeys)
Decisions: —
Kind: TypeScript · Size budget: ~120 changed lines outside tests
Source: W26's report, findings F2, F3, F6, F7, F8 and F9 of the PR #47
review (`2026-11-05`)

## Facts (from the review, at `a109e9a`)

- `src/backend/queries/remoteTags.ts` sets these for each read:
  `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `SSH_ASKPASS=""`,
  `GCM_INTERACTIVE=Never` and `-c credential.interactive=false`.
  - OpenSSH reads an empty `SSH_ASKPASS` as "use the compiled-in default",
    not as "none".
  - Without `BatchMode`, a host-key confirmation or a passphrase reads
    `/dev/tty` when VS Code was started from a terminal. The read then
    stalls until the 10 s timeout.
- `execFile`'s `timeout` sends `SIGTERM` to `git` only.
  - On POSIX, git passes it on to ssh and the remote helper.
  - On Windows, `kill()` does not end the process tree, so a hung
    `ssh.exe` or `git-remote-https.exe` can outlive the timeout and pile up
    with every refresh.
- The read has three more gaps:
  - `Promise.all` starts one process per remote at once.
  - There is no `windowsHide`.
  - Nothing cancels a read when the panel closes or the repository
    switches.
- `messageHandler.ts`: the unawaited
  `remoteTags(...).then(result => bridge.post(...))` has no `.catch`.
  `bridge.post` rejects once the webview is disposed. The request trace
  logs about 0 ms, because the real work is not awaited.
- Bypassing `runGitRaw` is consistent with the runner rules: the read
  still goes through `runGitCommand`, which records and redacts. But no
  comment explains why, and the architecture note doesn't list it.
- Two smaller gaps:
  - Workspace trust: a repository-local `core.sshCommand` or a hostile
    remote URL now runs when the graph opens. Check whether
    `package.json`'s `capabilities.untrustedWorkspaces` already disables
    the graph in an untrusted workspace.
  - The remote-tags tests inherit the developer's real `~/.gitconfig`.

## Steps

1. **Non-interactive SSH.**
   - Set `SSH_ASKPASS_REQUIRE=never`.
   - Spawn with stdin closed, or ignored.
   - Do not set `GIT_SSH_COMMAND`, `core.sshCommand` or `GIT_SSH`: they
     would override the user's own.
   - If `BatchMode` can be added only by overriding them, don't. Rely on
     the closed stdin, the setting (W26F) and the timeout, and say so in a
     comment.
2. **Bounded child processes.**
   - Use `windowsHide: true`.
   - Use `killSignal: "SIGKILL"` off Windows.
   - On Windows, end the tree on timeout (`taskkill /pid <pid> /T /F`),
     or document the gap if that can't be done safely.
   - Run at most 4 remote reads at a time.
   - Accept an `AbortSignal`. The handler aborts the previous read when a
     new one starts for the same panel, or when the panel is disposed.
3. **Handler.**
   - Add `.catch` around the post, and log it at debug level.
   - Trace the real promise, so the request log shows its duration.
4. **Workspace trust.** Verify the manifest's `untrustedWorkspaces`. If
   the graph can run untrusted, return an empty result without spawning
   while `!vscode.workspace.isTrusted`. Record which case applies.
5. **Comments and docs.**
   - Add a file comment in `remoteTags.ts` explaining why the read uses its
     own bounded processes rather than `runGitRaw`, and the 16 MB
     `maxBuffer` limit, which reads as "unavailable".
   - List `remoteTags` beside `runGitWithInput` in Current Architecture
     (Reference).
6. **Tests.**
   - Set `GIT_CONFIG_GLOBAL` to an empty temp file and
     `GIT_CONFIG_NOSYSTEM=1`.
   - The timeout kills a hung remote: a fake remote helper or a slow
     command, with a short injected timeout.
   - Concurrency never exceeds the cap.
   - An abort stops a running read.
   - CRLF output parses.
   - A rejected post is caught.

## Touch

`src/backend/queries/remoteTags.ts`, `src/extension/messageHandler.ts`
(the `remoteTags` handler only),
`docs/kb/040-reference/020-current-architecture.md` (one line),
`tests/backend/queries/remoteTags.test.ts`, the handler's test file

## Acceptance

- No SSH, credential or askpass prompt can appear, and no read outlives its
  timeout on Linux. Windows behavior is documented, or killed by tree.
- At most 4 concurrent reads. A disposed panel or a repository switch
  aborts them.
- No unhandled rejection.
- The tests don't read the real Git config.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05
- **Branch and commits:** `wt-1.10.0/W26H`
  - `df4cf7b G docs(release): claim W26H`
  - `aaf54d3 G fix(tags): bound and abort the remote tag read's processes (W26H)`
  - `58cb1bd G fix(tags): abort stale remote tag reads and catch the reply (W26H)`
  - `83da1c9 G fix(tags): end the remote tag read when the panel is disposed (W26H)`
  - `ecc8181 G test(tags): cover the bounded remote read (W26H)`
  - `1dbf307 G test(tags): cover aborting and a rejected post in the handler (W26H)`
  - `375e33c G docs(reference): list remoteTags beside runGitWithInput (W26H)`
- **Files changed:** `remoteTags.ts` (rewritten runner), `messageHandler.ts`
  (handler plus a `dispose` return), `extension.ts` (+2 lines), both test
  files, one architecture line.
- **Tests added or changed:** backend 1228 → 1236 passed (60 skipped both
  before and after); webview 825 passed. New: timeout kills a hung helper,
  cap of 4, abort, pre-aborted, CRLF, `killProcessTree` (win32 by injection,
  fallback, no pid); handler: rejected post logged, dispose aborts, newer
  request aborts.
- **Gates:** strict Biome on the five touched files clean; `typecheck` clean;
  `test` backend 1236/1236 run, webview 825/825, no "Unhandled Errors"
  (the `TypeError: undefined line` Rust panic lines are pre-existing, same on
  the base); `kb:check` passes; Sonar: integrator
- **Acceptance:** met. No askpass (`SSH_ASKPASS_REQUIRE=never`), stdin
  ignored, no controlling tty off Windows. The timeout test proves the hung
  helper is killed. Cap and abort tested; no unhandled rejection; tests use
  an empty `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM=1`.
- **Workspace trust:** `package.json` has
  `capabilities.untrustedWorkspaces.supported: false`, so VS Code does not
  run the extension in an untrusted workspace. No `isTrusted` check added.
- **Windows:** tree kill by `taskkill /pid <pid> /T /F` from
  `%SystemRoot%\System32`, `windowsHide`. Covered only by injection on
  Linux; not run on Windows.
- **Deviations from the slice:**
  - `extension.ts` (outside Touch, +2 lines, commit `83da1c9`, droppable):
    nothing inside the handler sees the panel's disposal, so
    `registerMessageHandlers` now returns `dispose` and the panel's
    `onDispose` calls it.
  - Not `killSignal: "SIGKILL"` on the git pid: a SIGKILLed git cannot
    forward the signal and would orphan ssh. The child runs `detached` (own
    session and process group) and the whole group gets SIGKILL.
- **Open questions / follow-ups:** none besides the `extension.ts` line.

