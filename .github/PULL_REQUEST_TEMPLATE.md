<!--
Thanks for contributing to Git Graph Libre!
Text between these comment markers is hidden once the pull request is opened,
so you can leave it in place or delete it.
-->

## What and why

<!--
What does this change, and what problem does it solve?
Link the issue it closes, if there is one, for example "Closes #26".
-->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor or cleanup, with no change in behavior
- [ ] Documentation, build or CI

## How it was tested

<!--
Which commands did you run, and what did you try by hand in VS Code?
For anything you can see in the graph, a dialog or a menu, add a before and
after screenshot or a short recording.
-->

## Checklist

Always:

- [ ] `pnpm run package` passes. It runs the typecheck, and `pnpm run test` does not, because Vitest only transpiles.
- [ ] `pnpm run test` passes, and changed behavior comes with new or updated tests.
- [ ] Strict Biome is clean on the files I changed: `pnpm exec biome check --config-path biome.strict.jsonc --changed --error-on-warnings .`
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]`.
- [ ] Every commit is signed with GPG or SSH. This repository rejects unsigned commits on every branch, so an unsigned commit blocks the merge.
- [ ] My branch is rebased onto `main`. I did not merge `main` into it.

Only if it applies (delete the lines that don't):

- [ ] New user-facing text is in every `l10n/bundle.l10n*.json` and `package.nls*.json` file, and `pnpm run l10n:check` reports 100%.
- [ ] A new setting is in `package.json` and in the configuration table in `README.md`.
- [ ] I changed files under `engine/`, and `pnpm run engine:check`, `engine:test`, `engine:lint` and `engine:fmt` all pass.

## License

Git Graph Libre is licensed under the
[GNU Affero General Public License v3.0 or later](https://github.com/PlohnenSoftware/git-graph-libre/blob/main/LICENSE)
(`AGPL-3.0-or-later`), and contributions are accepted on the same terms.
Whatever you submit is licensed to everyone under AGPL-3.0-or-later as part of
the project. You keep the copyright in your own work. Once your pull request
is merged, you are listed under "Contributors to the AGPL-licensed work" in
[NOTICE.md](https://github.com/PlohnenSoftware/git-graph-libre/blob/main/NOTICE.md)
and credited by name in the changelog of the release that ships it.

**Where code may come from.** This project descends from the last MIT-licensed
commit of the original [Git Graph](https://github.com/mhutchie/vscode-git-graph)
by mhutchie,
[`4af8583`](https://github.com/mhutchie/vscode-git-graph/commit/4af8583a42082b2c230d2c0187d4eaff4b69c665)
from May 2019. Everything that project published after that commit is under a
license that does not allow derivative works, so none of that code can be used
here. The same applies to the `src/` and `web/` layers of
[vscode-git-graph-rs](https://github.com/neophack/vscode-git-graph-rs). Please
do not submit code from those projects, or code that is derived from or built
on top of them.

Every pull request ticks the boxes under **All contributions**, plus the boxes
of exactly one of the two sections after it. Keep the section that matches
your pull request and delete the other.

### All contributions

By ticking these boxes, you confirm that:

- [ ] I license this contribution under AGPL-3.0-or-later, and I agree that it may be distributed as part of Git Graph Libre under those terms.
- [ ] It contains no code from Git Graph published after commit `4af8583`, and no code from the `src/` or `web/` layers of vscode-git-graph-rs, nor anything derived from them.

### Only code I wrote myself

Choose this section if you wrote every line yourself, and nothing in it was
copied, vendored, ported or translated from somewhere else, even with changes.
Reimplementing a feature you have seen in another project still counts as your
own code, as long as you worked from how it behaves and from its documentation,
not from its source.

By ticking this box, you confirm that:

- [ ] I wrote all of this contribution myself, and I have the right to submit it under AGPL-3.0-or-later.

### Includes third-party code

Choose this section if any part of the contribution comes from somewhere else:
a copied snippet, a vendored file or library, or code ported or adapted from
another project, even with changes. Third-party code can only come in under a
license that allows it to be distributed as part of an AGPL-3.0-or-later work,
and only together with the copyright and license notices that license requires.

List each source here:

<!--
One line per source: what it is, a link to it, its license, and the files it
went into. For example: "Date parsing helper from <link>, MIT, in
src/utils/date.ts."
-->

By ticking these boxes, you confirm that:

- [ ] I wrote the rest of this contribution myself, and I have the right to submit it under AGPL-3.0-or-later.
- [ ] I listed every piece of third-party code above, with its source and its license.
- [ ] Each of those licenses allows the code to be distributed as part of an AGPL-3.0-or-later work, I kept every copyright and license notice it requires, and I am authorized to distribute the code under its license.

A pull request can only be merged once every box under **All contributions**
and every box in the section you kept are ticked.
