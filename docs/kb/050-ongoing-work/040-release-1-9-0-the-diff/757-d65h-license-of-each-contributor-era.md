---
summary: >-
  D65H · integrated · webview + l10n · ~40 lines: in the Contributors tab, say
  under each era's heading which license its code came in under, so it is
  clear that the original Git Graph (up to commit 4af8583), the
  neo-git-graph fork and the Rust engine are the MIT-licensed parts, and
  Git Graph Libre's own work is AGPL-3.0-or-later. Maintainer request,
  `2026-10-20`.
---

# D65H — The license of each contributor era

Status: integrated e63801e
Needs: D65G
Decisions: — (maintainer, `2026-10-20`: "when it comes to git graph mention
it was MIT licensed part so it is clear everywhere")
Kind: webview + l10n · Size budget: ~40 changed lines outside tests
Source: the maintainer

## Goal

Each era in the Contributors tab shows its license beneath its name, in the
small secondary style the tab already uses for agent details
(`settingsContributorMeta`):

| Era | License line (English) |
| --- | --- |
| Git Graph Libre | AGPL-3.0-or-later |
| neo-git-graph fork | MIT-licensed |
| Original Git Graph | MIT-licensed, up to commit 4af8583 |
| Rust Git engine | MIT-licensed |

And one closing line after the eras, before "AI agents": "The MIT-licensed
code keeps its original notices in LICENSE.mit." These are statements
`NOTICE.md` and `LICENSE.mit` already make; add no other legal wording.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `src/webview/settingsWidget.ts`: `eraHeading`, the era rendering, and
  `renderAgentItem`'s `settingsContributorMeta` span
- `src/webview/contributors.ts`: `ContributorEraId`
- `src/extension/webviewL10n.ts` and the `settings.contributors*` keys in
  `l10n/bundle.l10n*.json`
- `NOTICE.md` and `LICENSE.mit`: the facts the lines restate
- The Webview UI Styling Guide and its headless-render record under Reference

## Steps

1. Five new l10n keys, `settings.contributorsEra{Libre,Fork,Original,Engine}License`
   and `settings.contributorsMitNote`, in all five bundles. "AGPL-3.0-or-later",
   "MIT" and "LICENSE.mit" are identifiers and stay as written in every
   language, as does the commit `4af8583`.
2. Render each era's license line beneath its heading, and the note after
   the last era, with escaped text and the existing meta style. Change no
   people, no agents and no other text.

## Touch

`src/webview/settingsWidget.ts`, `src/extension/webviewL10n.ts`,
`src/webview/main.ts` (the popup `labels` object only),
`l10n/bundle.l10n*.json`, `media/settings.css` (only if the meta style needs
a block variant), their tests

## Tests

- Each era renders its license line, and the note renders once, before
  "AI agents".

## Acceptance

- Headless renders of the tab, dark and light, with paths in the report.
- Strict Biome on touched files, typecheck, `pnpm run test` counts,
  `l10n:check` 100%, `kb:check`, `Sonar: integrator`.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-10-20
- **Branch and commits:** `diff-1.9.0/d65h` —
  `c6341a6 G docs(release): claim D65H for the license of each contributor era (D65H)`;
  `7880b50 G feat(settings): say the agents worked in cooperation with the people above (D65H)` (maintainer addition, see Deviations);
  `72788e2 G feat(settings): show each contributor era's license (D65H)`; this report commit follows.
- **Files changed:** `l10n/bundle.l10n.json` +6/−1, `l10n/bundle.l10n.nl.json` +6/−1, `l10n/bundle.l10n.pl.json` +6/−1, `l10n/bundle.l10n.zh-cn.json` +6/−1, `l10n/bundle.l10n.zh-tw.json` +6/−1, `src/extension/webviewL10n.ts` +5, `src/webview/main.ts` +5, `src/webview/settingsWidget.ts` +17, `media/settings.css` +4, `tests/webview/settingsWidget.test.ts` +29. Total 90 added, 5 removed (code and tests only; the slice file is excluded).
- **Tests added or changed:** `settingsWidget.test.ts`: new case "shows each era's license under its heading, and the MIT note once before AI agents"; the test labels stub gained the five new fields. Count before/after: webview 790 → 791 passed; backend unchanged at 1109 passed, 60 skipped (1169).
- **Gates:** biome strict clean (`--error-on-warnings`, the 9 touched .ts and .json files plus the test file after format); typecheck clean; test backend 1109/1169 (60 skipped), webview 791/791; l10n 100% in all five bundles; kb:check clean; Rust arm n/a; Sonar: integrator
- **Acceptance:**
  - Headless renders, dark and light, met. Paths: `/tmp/tmp.9062xTeVDn/contributors-dark.png` and `/tmp/tmp.9062xTeVDn/contributors-light.png` (PyQt6 QtWebEngine under `xvfb-run`, real `media/*.css`, Dark Modern and Light Modern token values as in D65; the page was built from the D65 harness with this worktree's paths and the new labels).
  - Each era renders its license line under its heading, and the note renders once before "AI agents": met (widget test plus the renders).
  - Strict Biome, typecheck, test counts, l10n 100%, kb:check: met, above. Sonar: integrator.
- **Deviations from the slice:**
  - Maintainer-requested addition (orchestrator message, 2026-10-20): `settings.contributorsAgentsNote` changed in all five bundles from "under the direction of" to "in cooperation with" (nl, pl, zh-cn, zh-tw translated to match), as its own commit `7880b50`. No test asserted the old sentence.
  - `media/settings.css`: the slice allowed a block variant of the meta style if needed. The inline meta style put a 6px left margin on the license and note lines, which misaligned them, so I added `.settingsContributorMeta.settingsContributorMetaBlock { display: block; margin: 0; }` and used it for the five lines.
  - The note line uses the same meta style as the license lines, not `settingsContributorsNote`.
- **Open questions / follow-ups:**
  - The D65 slice record (`750-d65-contributors-tab.md`) still says "under the direction of" in its historical text. It is a dated record, so I left it unchanged; the maintainer may want a note there.
  - Unexpected: a first attempt at the bundle script ran `node` without a script path and hung; I stopped that background process. It changed nothing (the worktree was clean before the real edits).
  - The five new strings, English / nl / pl / zh-cn / zh-tw:
    - `settings.contributorsEraLibreLicense`: "AGPL-3.0-or-later" in all five.
    - `settings.contributorsEraForkLicense`: "MIT-licensed" / "MIT-gelicentieerd" / "Licencja MIT" / "MIT 许可" / "MIT 授權".
    - `settings.contributorsEraOriginalLicense`: "MIT-licensed, up to commit 4af8583" / "MIT-gelicentieerd, tot en met commit 4af8583" / "Licencja MIT, do commita 4af8583" / "MIT 许可，截至提交 4af8583" / "MIT 授權，截至提交 4af8583".
    - `settings.contributorsEraEngineLicense`: same as the fork line in each language.
    - `settings.contributorsMitNote`: "The MIT-licensed code keeps its original notices in LICENSE.mit." / "De MIT-gelicentieerde code behoudt zijn oorspronkelijke vermeldingen in LICENSE.mit." / "Kod na licencji MIT zachowuje swoje oryginalne noty w pliku LICENSE.mit." / "MIT 许可的代码在 LICENSE.mit 中保留其原始声明。" / "MIT 授權的程式碼在 LICENSE.mit 中保留其原始聲明。"
    - Changed `settings.contributorsAgentsNote`: "These AI agents co-authored commits in this repository in cooperation with the people above." / "Deze AI-agents hebben in deze repository commits mede geschreven in samenwerking met de hierboven genoemde mensen." / "Ci agenci AI współtworzyli commity w tym repozytorium we współpracy z osobami wymienionymi powyżej." / "这些 AI 代理与上述人员合作，共同撰写了本仓库中的提交。" / "這些 AI 代理與上述人員合作，共同撰寫了本儲存庫中的提交。"
