---
summary: >-
  Finding: no tag-specific graying path exists; lists the only three
  ref-appearance paths (muted cell, `.gitRefAlias`, signed/unsigned pill
  tint); the unsigned gray tint is intended design.
---

# Tag-specific graying — investigation result (`2026-08-25`)

The maintainer additionally reported seeing tag labels specifically go gray.
Every rendering path was enumerated; these are the **only** places a ref label's
appearance changes, and there is no tag-specific text-graying path anywhere in
the codebase:

1. **Inherited from the muted Description cell** (the rule above). This is the
   one and only path that grays ref label *text*, and it applies to branches and
   tags identically. `renderCommitRef()` (`src/webview/main.ts:4203-4215`) is
   the sole ref-rendering site in the whole webview — nothing else emits a
   `.gitRef` — and it sets no `color` of its own.
2. **`.gitRefGroup > .gitRefAlias`** (`media/main.css:661-665`) uses
   `--vscode-badge-foreground`. This applies **only** to remote-branch segments
   inside a grouped branch badge; `groupCommitRefs()` never puts a tag in a
   group, so tags can never take this rule. Badge foreground is near-white in
   Dark Modern (the maintainer's theme), so it is not a graying source there
   either — but confirm it still reads at full contrast in a light theme once
   the fix lands.
3. **Signed vs unsigned tag pill background** — the likely explanation for the
   tag-specific impression. A signed tag gets
   `color-mix(in srgb, var(--ngg-signed-ref) 12%, transparent)`, a green tint
   (`media/main.css:698-701`), while every other ref including an unsigned tag
   gets the neutral `--ngg-neutral-overlay-muted`, which is literally
   `oklch(60% 0 0 / 0.15)` — a gray overlay. In this repository `v0.1.0`–
   `v0.5.0` are signed and `v1.0.0` onward are not, so the tag column shows
   green-tinted pills above gray pills. That is the intended Phase 15 design,
   not a defect.

Note that in *this* repository the merge rule cannot be what was seen on tags:
every tagged commit here (`v0.1.0` … `v1.3.0`) has exactly one parent, and
`muteCommitsNotAncestorsOfHead` is absent from the maintainer's settings so it
sits at its `false` default. In repositories that tag merge commits — the common
GitHub merge-then-release flow — the merge rule explains it completely.

**Action for the implementing agent:** fix path 1 as described above, then ask
the maintainer to re-check. If tag labels still gray after that, the remaining
candidate is path 3 being read as "gray", and the answer is a design question
(should unsigned tags carry a tint of their own?) rather than a bug — do not
guess at a fix for it.
