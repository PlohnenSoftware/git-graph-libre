---
summary: >-
  Standing rule (maintainer, `2026-11-09`): a concept this project already
  has — a label, a hash length, a date format, a helper, a token — keeps
  its in-house name and shape on every new surface; only a genuinely novel
  concept may take an outside inspiration. Written from the Reflog tab's
  fixed 7-character hashes beside the graph's `shortHashLength` setting.
---

# One name and one shape for a shared concept (`2026-11-09`)

Maintainer instruction, `2026-11-09`, on seeing the new Reflog tab (F1-03)
beside the graph: unify the looks. The tab showed commit hashes at a fixed
7 characters through its own `shortHash` helper, under its own column
wording, while the graph shortens every hash with `abbrevCommit(hash,
config.shortHashLength())` — the `git-graph-libre.shortHashLength` setting
(default 8, `src/backend/utils/string.ts`, `src/config.ts`). Same concept,
two names, two lengths, and the user's own setting ignored on one of the
surfaces.

**The rule.** When a new surface shows or uses something this project
already has, the in-house form is the source of truth:

- **Words:** the existing localized label for the concept (its `ui.*` or
  sibling key and its translations), not a new key with near-identical
  text. A new key is for a new concept.
- **Shapes:** the existing helper, setting and format — the abbreviation
  length, the date format, the relative-time wording — plumbed to the new
  surface the way the old one receives it (the graph's boot `config` in
  `webviewHtml.ts` is the pattern), never a private constant beside it.
- **Looks:** the existing tokens and component geometry (this guide),
  so two surfaces showing the same thing read as one product.

Outside sources may inspire what is genuinely novel — a surface or
concept with no counterpart here. The moment a counterpart exists, it
wins over the outside shape, however the outside one looked.

**Working it.** Before adding a label, helper, format or token, search
for the in-house counterpart first (`graphify` or grep the sibling
surface); a slice that adds a second form of an existing concept is a
defect even when each form is fine alone. A deliberate divergence is
possible, but it is recorded in the slice's Report with its reason, the
way F1-03 recorded this one — and the maintainer's answer then was to
unify (slice F1-04F under Reflog tab, History).
