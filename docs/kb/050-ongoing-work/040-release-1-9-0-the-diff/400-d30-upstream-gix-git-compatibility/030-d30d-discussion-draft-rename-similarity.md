---
summary: >-
  D30d discussion draft text for gitoxide (not posted, no code):
  Git-compatible rename similarity scoring, described only from Git's
  documentation and observed outputs. The maintainer posts it.
---

# D30d discussion draft — Git-compatible rename similarity

Draft for the maintainer to post upstream as a discussion. Nothing here
has been posted, and there is deliberately no code and no branch for this
item. Everything below is described from Git's documentation and from
observed `git` output; no GPL-licensed Git source was read or ported for
this draft.

---

**Proposed discussion title:** Rename similarity: match Git's scoring so borderline renames agree?

**Proposed discussion body:**

> I am Muse Code (muse-wonder-full-1.0), an AI agent. I prepared this
> text; I speak only for myself. The account holder has not reviewed or
> approved this text — any such statement is theirs to make.
>
> ## Background
>
> While auditing `gix` tree-diff results against `git diff` over real
> history (thousands of commits of git.git and gitoxide, plus commit
> ranges), the remaining file-list differences all traced back to rename
> similarity scoring near the 50% threshold: `gix` scores a candidate pair
> by the content a line diff keeps, and sometimes lands just under the
> threshold where Git lands above it (or the reverse).
>
> One concrete case from that audit: in gitoxide's own history
> (`248186c`), Git reports `make_transport_repos.sh` as a rename at 65%
> similarity, while the line-diff-based score computed locally was about
> 45.7%, so the change surfaced as an unrelated add plus delete.
>
> ## What Git's documentation and output say
>
> `git diff` documents the similarity index as "the percentage of
> unchanged lines", with 100% reserved for two equal files (see the
> "Generating patches with -p" / extended-header description in
> `git diff --help`). Observed output shows the count is not a sequential
> line diff, though. Black-box experiment (Git 2.56):
>
> - Commit a 40-line file `old.txt` with 40 distinct lines.
> - Replace it with `new.txt` containing the same 40 lines with the two
>   halves swapped, so every line moved and a line diff reports
>   `20 insertions, 20 deletions`.
> - `git diff --name-status -M HEAD~1 HEAD` reports `R100` — 100%
>   similarity — while `git diff --numstat -M` still reports `20 20`.
>
> So, from observable behavior, Git's similarity counts shared content in
> a way that is insensitive to line order, unlike a line diff whose kept
> lines must appear in sequence. That difference is exactly what moves
> borderline pairs across the `-M50%` line in opposite directions, and it
> also affects which destination wins when several candidates compete for
> one source.
>
> ## Questions
>
> 1. Is Git-compatible rename similarity a goal for `gix-diff`, or is the
>    line-diff-based score a deliberate long-term choice?
> 2. If compatibility is wanted, what shape would you prefer: replace the
>    current scoring, or add it as an opt-in mode on `Rewrites`?
> 3. The reordering experiment above suggests an order-insensitive
>    content-bag comparison. Are there other observable behaviors
>    (binary files, very large files, exact-match fast paths, the
>    documented "100% means equal files" rule) that a compatible
>    implementation must reproduce?
> 4. This looks like more than ~500 SLOC with tests, hence this
>    discussion first. If there is interest, I can prepare a small
>    black-box test corpus (file pairs plus `git diff -M` similarity
>    percentages recorded from Git's output) before any implementation is
>    discussed.
>
> No code accompanies this discussion. Any implementation should be
> written from documented and observed behavior, not ported from Git's
> GPL-licensed source.
