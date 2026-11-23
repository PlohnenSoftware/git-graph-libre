---
summary: >-
  L2: zh-tw uses two words for "repository" (存放庫 in older strings, 儲存庫
  in newer Blame/Reflog ones). Research how established Traditional Chinese
  localizations say it, pick the most accurate term, and use it in every
  zh-tw string. Maintainer's request, `2026-11-23`.
---

# L2 — zh-tw: one researched term for "repository"

Status: done — awaiting integration

Needs: L1 (integrated)

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`070-history/260-release-1-11-0-looking-back.md`, answers row
"zh-tw \"repository\""); L1's report
(`260-release-1-11-0-looking-back/130-l1-translation-review.md`, "Notes for a
native speaker"); Localization (Reference) if present.

## Touch

`l10n/bundle.l10n.zh-tw.json` and `package.nls.zh-tw.json` only (values,
never keys); this file's Status and Report.

## Task and acceptance

1. **Research.** Find how established Traditional Chinese (Taiwan)
   localizations translate "repository" in the version-control sense, from
   primary sources you can actually open and quote: VS Code's own zh-tw
   language pack (microsoft/vscode-loc, for example its Git extension
   strings), Microsoft's terminology for zh-TW, GitHub's or GitHub Desktop's
   zh-TW strings, Git's own `po/zh_TW.po`, and other widely used Git tools.
   Record each source (URL or file), the exact term it uses, and a short
   quote in the Report. Do not cite a source you did not open.
2. **Decide.** Pick the term that is most accurate and most consistent with
   what a zh-TW VS Code user sees elsewhere in VS Code (this extension lives
   inside VS Code, so VS Code's own term weighs most), and say why in the
   Report.
3. **Apply.** Replace the other term in every zh-tw value in both files,
   adjusting only the surrounding words where grammar needs it. Change
   nothing else; keys and placeholders (`{0}` and the like) stay exactly
   as they are. Count the strings changed and list them in the Report.

Checks: `pnpm run l10n:check` (complete), both files parse as JSON, a
placeholder comparison against `l10n/bundle.l10n.json` / `package.nls.json`
shows no mismatch, `grep -c` of the replaced term in both files is 0, KB
check. Claim and changes are separate signed commits; never push.

## Report

- **Agent / date:** Claude Haiku (Haiku 5.5), 2026-11-23 17:40
- **Branch and commits:** `rel-1.11.0/L2` — `d3c8dbc7 G docs(kb): claim slice L2 (zh-tw repository term)`; `a0741851 G fix(l10n): zh-tw repository term 存放庫 (L2)`; plus this Report commit.
- **Term chosen: 存放庫** (replaces 儲存庫 everywhere in zh-tw). Reason: this extension lives in VS Code, and VS Code's own zh-hant Git strings use 存放庫 most often (about 64 uses against about 24 for 儲存庫, approximate manual tally from the opened file). Git's own zh_TW.po and the l10n-tw Git glossary use 版本庫, which is the Git-community term; it was not chosen because the slice asks that VS Code's term weigh most, and VS Code does not use it.
- **Sources (each opened):**
  - microsoft/vscode-loc, `i18n/vscode-language-pack-zh-hant/translations/extensions/vscode.git.i18n.json` (github.com/microsoft/vscode-loc/blob/main/…). Quotes: `"Open Repository": "開啟存放庫"`; `"There are no available repositories matching the filter": "沒有符合篩選條件的可用存放庫"`. Same file also has `"Would you like to open the repository?": "要開啟儲存庫嗎?"`, so the VS Code file itself mixes both terms, with 存放庫 the majority.
  - microsoft/vscode-loc, `…/extensions/vscode.git-base.i18n.json`. Quote: `"Repository name": "存放庫名稱"`; `"Provide repository URL": "提供存放庫 URL"`. Only 存放庫 appears in that file.
  - microsoft/vscode @31419e2, `extensions/git/package.nls.json` (English source). Quote: `"command.openRepository": "Open Repository"`. Used to confirm the source wording.
  - git-l10n Git `po/zh_TW.po`, tag v2.35.4 (code.googlesource.com/git/+/refs/tags/v2.35.4/po/zh_TW.po?format=TEXT). Quote: `msgstr "版本庫中缺少這些必要的提交："` (for `Repository lacks these prerequisite commits:`). Read only the first 100,000 of about 1 MB, so this is a partial view.
  - l10n-tw/git-glossary, `zh_Hant.tbx` (raw.githubusercontent.com/l10n-tw/git-glossary/master/zh_Hant.tbx). Entries: "repository" → "版本庫"; "repo" → "版本庫"; no note on the choice.
  - Not used: docs.github.com/zh page (opened; it is Simplified Chinese and uses 存储库, so it does not apply to zh-TW). A Microsoft Terminology Collection entry was not found; search snippets (Multitran) were not opened and are not cited.
- **Strings changed:** 38 zh-tw values (32 in `l10n/bundle.l10n.zh-tw.json`, 6 in `package.nls.zh-tw.json`). 38 lines changed in each `git diff --stat`. The one sentence that needed a grammar change: `config.repository.worktreePathTemplate` (package.nls.zh-tw.json) "存放儲存庫的資料夾" became "存放庫所在的資料夾", so it does not read 存放存放庫. Keys and placeholders are unchanged.
- **Files changed:** `l10n/bundle.l10n.zh-tw.json` (+32/−32), `package.nls.zh-tw.json` (+6/−6), this slice file (Status and Report).
- **Tests added or changed:** none (value-only change).
- **Gates:**
  - `pnpm run l10n:check`: complete, all four languages at 100% for both bundle and package.nls.
  - Both zh-tw files parse as JSON.
  - Placeholder comparison against `l10n/bundle.l10n.json` and `package.nls.json`: no mismatch.
  - Key sets: `package.nls.zh-tw.json` matches the English key list exactly; `bundle.l10n.zh-tw.json` has the same 947 keys as the English file (set comparison; key order is unchanged from before this slice).
  - `grep -c 儲存庫` in both files: 0.
  - Strict Biome, `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on both files: exit 0.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Not run: `pnpm run typecheck`, the vitest projects, and the full `pnpm run test` (not needed for a value-only l10n change; the integrator runs the gate).
  - Sonar: integrator
- **Acceptance:**
  1. Research, with sources opened and quoted: met.
  2. Decision with reason: met (存放庫, VS Code precedence).
  3. Apply to every zh-tw value, keys and placeholders untouched, count and list reported: met (38 values; the list is the `git diff` of commit `a0741851`).
- **Deviations from the slice:** none.
- **Open questions / follow-ups:** The maintainer may prefer 版本庫 for a Git-centric reading; that would be a one-term swap in the same 38 values. Native review of the zh-tw wording is welcome, as the L1 notes say. The `/tmp` usage in this session (a temporary file for a check output, removed after) was a slip against the scratchpad guidance; nothing was left behind.
