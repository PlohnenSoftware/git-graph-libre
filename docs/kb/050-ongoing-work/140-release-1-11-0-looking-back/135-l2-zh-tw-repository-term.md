---
summary: >-
  L2: zh-tw uses two words for "repository" (存放庫 in older strings, 儲存庫
  in newer Blame/Reflog ones). Research how established Traditional Chinese
  localizations say it, pick the most accurate term, and use it in every
  zh-tw string. Maintainer's request, `2026-11-23`.
---

# L2 — zh-tw: one researched term for "repository"

Status: claimed by Claude Haiku on 2026-11-23 17:40

Needs: L1 (integrated)

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`, answers row
"zh-tw \"repository\""); L1's report
(`140-release-1-11-0-looking-back/130-l1-translation-review.md`, "Notes for a
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

Not started.
