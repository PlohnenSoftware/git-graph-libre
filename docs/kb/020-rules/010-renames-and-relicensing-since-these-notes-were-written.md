---
summary: >-
  Reading note: the project was renamed from the MIT fork `neo-git-graph` to
  Git Graph Libre; `neo-git-graph.*` IDs are now `git-graph-libre.*`, AGPL
  from 1.0.0, Sonar key `git-graph-libre`; old notes are kept as written.
always_read: true
---

# Renames and relicensing since these notes were written

Most of this document, and all of the dated slice notes below, were written
while the project was still the MIT fork `neo-git-graph`. Those notes are kept
as a historical record and are deliberately not rewritten. When reading them,
apply these facts:

- The project is **Git Graph Libre** (`PlohnenSoftware.git-graph-libre`).
- Every setting and command ID moved from the `neo-git-graph.*` prefix to
  `git-graph-libre.*`. Any `neo-git-graph.<id>` named below is dead; check
  `package.json` for the live ID.
- From version 1.0.0 the project as a whole is `AGPL-3.0-or-later`, not MIT.
- The SonarQube project key is `git-graph-libre`, not `neo-git-graph`.
- The local SonarQube setup recorded below belonged to an earlier machine and
  no longer exists; see the SonarQube bullets under Current Architecture.
