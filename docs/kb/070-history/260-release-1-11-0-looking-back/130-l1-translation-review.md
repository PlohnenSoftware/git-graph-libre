---
summary: >-
  L1: review of every nl, pl, zh-cn and zh-tw value added or changed since
  v1.10.0 (111 bundle keys and 3 package.nls keys per language), checked
  against the English and the terms each bundle already uses. Fixes are
  value-only (no key was renamed, added, removed or reordered), listed one by
  one with the reason; notes for a native speaker close the record.
---

# L1 — Translation review of the 1.11.0 strings

Status: done — awaiting integration

Needs: nothing (works from `main` at `b31a963c`).

Agent: Claude Haiku (Haiku 5.5)

Read first: `AGENTS.md`; Multi-agent releases (Agent protocol); Commit signing;
the release section (`260-release-1-11-0-looking-back.md`, Translations answer).

## Touch

`l10n/bundle.l10n.{nl,pl,zh-cn,zh-tw}.json` (values only); this file's Status
and Report.

## Task and acceptance

Review the strings added or changed since `v1.10.0`: keys in
`l10n/bundle.l10n.json` and `package.nls.json` (102 added and 9 changed bundle
keys, 3 added package keys: `command.showReflog`, `command.showBlame`,
`command.showBlame.shortTitle`). Each value was compared with the English and
with the terms the bundle already uses (worktree, branch, commit, repository,
reflog, blame, stash, HEAD, Fetch, Refresh and the rest). Placeholders kept,
zh-cn in Simplified, zh-tw in Traditional, no English left except product and
Git terms the bundle itself keeps. Values only.

## Report

- **Agent / date:** Claude Haiku (Haiku 5.5), 2026-11-23
- **Branch and commits:** `rel-1.11.0/L1`, base `b31a963c`
  - `751392df G fix(l10n): review nl 1.11.0 strings (L1)`
  - `0a1547dc G fix(l10n): review pl 1.11.0 strings (L1)`
  - `6c4f8daf G fix(l10n): review zh-cn 1.11.0 strings (L1)`
  - `c54d1589 G fix(l10n): review zh-tw 1.11.0 strings (L1)`
  - plus this record's commit.
- **Keys reviewed per language:** 114 (111 bundle keys + 3 package.nls keys).
  Four bundle keys removed since v1.10.0 (`ui.branchInWorktreeCaption`,
  `componentStatus.route.topoOrdering`, `dialog.worktreeCreated.nothing`,
  `dialog.worktreeCreated.submit`) are absent from all four translations, as
  expected; the key sets match the base file.

| Language | Reviewed | Unchanged | Changed |
|----------|----------|-----------|---------|
| nl       | 114      | 112       | 2       |
| pl       | 114      | 110       | 4       |
| zh-cn    | 114      | 110       | 4       |
| zh-tw    | 114      | 110       | 4       |

### Changes

| Key | Lang | Old | New | Reason |
|-----|------|-----|-----|--------|
| `reflog.action.fetch` | nl | Ophalen | Fetchen | Bundle uses "Fetch" as the term (`ui.fetch`, `settings.fetchRemote`). |
| `dialog.deleteBranch.staleNote` | nl | ...alleen het gegeven in Git wordt verwijderd. | ...alleen de registratie in Git wordt verwijderd. | "gegeven" means "data"; the thing removed is Git's record of the worktree. |
| `dialog.worktreeCreated.title` | pl | Worktree utworzone | Utworzono worktree | Grammar: a title for a created item, "utworzono" with "worktree" as the noun. |
| `dialog.moveWorktree.pickFolder` | pl | ...przenieść drzewo robocze | ...przenieść worktree | "drzewo robocze" is the working tree; the Git worktree is "worktree" everywhere else. |
| `reflog.bareHeadNote` | pl | To jest puste repozytorium... | To jest repozytorium typu bare... | "puste" means "empty" (no commits), not "bare". |
| `blame.bareWorkingTree` | pl | To jest puste repozytorium bez drzewa roboczego... | To jest repozytorium typu bare bez drzewa roboczego... | Same as above. |
| `reflog.action.fetch` | zh-cn | 获取 | 抓取 | The bundle's fetch term is 抓取 (25 uses). |
| `blame.loadError` | zh-cn | 无法加载 blame: {0} | 无法加载 blame：{0} | Full-width colon, as in every other zh-cn message. |
| `blame.workingTree` | zh-cn | 工作区 | 工作树 | Matches `diff.workingTree` (工作树). |
| `dialog.createBranch.title` | zh-cn | 输入 {0} 的新分支名称 | 输入从 {0} 创建的新分支名称 | The old text read as "the new branch name of {0}"; the English says the new branch starts from {0}. |
| `reflog.action.fetch` | zh-tw | 取得 | 擷取 | The bundle's fetch term is 擷取 (25 uses). |
| `blame.loadError` | zh-tw | 無法載入 blame: {0} | 無法載入 blame：{0} | Full-width colon, as in every other zh-tw message. |
| `blame.workingTree` | zh-tw | 工作區 | 工作樹 | Matches `diff.workingTree` (工作樹). |
| `dialog.createBranch.title` | zh-tw | 輸入 {0} 的新分支名稱 | 輸入從 {0} 建立的新分支名稱 | As zh-cn. |

After the edits, `scripts/check-l10n.js` reports complete for all four
languages (bundle and package.nls), the strict Biome check passes on the four
files, each file parses as JSON, and a placeholder check finds no mismatch in
any language.

### Notes for a native speaker

- **zh-tw repository word.** The bundle mixes 儲存庫 (most new strings, for
  example `blame.unborn`, `blame.repoChanged`) and 存放庫 (older strings,
  for example `command.addRepo.*`, `ui.repo`). Not changed; the choice is the
  maintainer's.
- **pl `reflog.sub.finish` "Koniec"** reads as "end". "Zakończenie" may read
  better for the rebase sub-action. Kept.
- **pl `blame.resizeGutter`** keeps the loan "gutter" ("szerokość guttera").
  A native term for the editor margin may be preferred.
- **nl `blame.workingTree` "Werkboom"** follows the bundle's `blame.bareWorkingTree`
  choice; a native reviewer may prefer "Werkmap" or the Git-tools term.
- **Churn** (`blame.heatChurn`: nl "Frequentie", pl "Częstotliwość", zh-cn
  "变动频率"). Churn means how often lines change; check that the three
  read as intended in the hotspot legend.
- **zh-tw `reflog.action.clone` "複製"** is the common zh-TW Git term, but it
  also means "copy". zh-cn uses 克隆. Check which reads better in the Reflog.
- **Status strings** lost their trailing "..." in English (`status.*Worktree`).
  The translations also dropped it. Native check of the Title-Case style is
  welcome.
- **Outside L1 (pre-existing, not changed):** `diff.workingTree` is still
  English in nl ("Working tree") and reads "Kopia robocza" in pl, while the new
  pl strings use "drzewo robocze". Worth aligning in a later pass.
