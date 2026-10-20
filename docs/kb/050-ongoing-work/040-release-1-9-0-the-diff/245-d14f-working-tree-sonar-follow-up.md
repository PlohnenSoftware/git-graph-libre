---
summary: >-
  D14F · ready · TypeScript · ≤150 lines: clear the six SonarQube findings
  the second wave gate found in the D12/D14 comparison code (messageHandler
  complexity 32, two nested ternaries, two nested template literals, one
  optional chain). Behavior and tests stay unchanged.
---

# D14F — Working-tree comparison Sonar follow-up

Status: integrated 0971f91
Needs: D14 (integrated), D15
Decisions: — (a follow-up the integrator opened to bring the wave gate to `OK`, as with D41F, D42F, D43F, D04AF and D13F)
Kind: TypeScript · Size budget: ≤ 150 changed lines outside tests
Source: the integration log's second wave gate on `2026-10-19` (Sonar analysis `2671be4c-0a5c-4621-bfdf-18f32f392fff`)

## Goal

Fix the six findings below without changing any comparison behavior.
D04AF's and D13F's findings are already closed; these six are what keeps
the gate at `ERROR` (1 high issue; 6 new violations against the limit 5).

## Read first

- [The agent protocol](010-agent-protocol.md)
- D14's and D12's reports (`240-d14-compare-with-the-working-tree.md`,
  `220-d12-compare-with-dialog.md`)
- `src/extension/messageHandler.ts` around lines 97–121,
  `src/backend/queries/commitComparison.ts` line 37,
  `src/webview/main.ts` line 3885 (line numbers from the scan's tree;
  find the code by content after D15 lands)

## Facts (the wave gate, `2026-10-19`)

| Rule | File:line | Severity | Finding |
| --- | --- | --- | --- |
| `typescript:S3776` | `src/extension/messageHandler.ts:97` | critical (the gate's high issue) | Cognitive Complexity 32, 16 allowed |
| `typescript:S3358` | `src/extension/messageHandler.ts:109` | major | nested ternary |
| `typescript:S4624` | `src/extension/messageHandler.ts:121` | major | nested template literal (×2) |
| `typescript:S3358` | `src/backend/queries/commitComparison.ts:37` | major | nested ternary |
| `typescript:S6582` | `src/webview/main.ts:3885` | minor | prefer an optional chain |

## Steps

1. `messageHandler.ts`: extract small helpers from the flagged function
   (the diff-title/viewDiff working-tree logic D14 added is the natural
   seam) until complexity is at most 16; the nested ternary and template
   literals go with the same restructure. Titles, URIs and the
   deleted-file behavior stay byte-identical — D14's `messageHandler`
   tests pin them.
2. `commitComparison.ts:37`: replace the nested ternary with a plain
   statement; the `*`/`-R` argument construction stays identical.
3. `main.ts:3885`: the optional chain, same semantics.
4. Change nothing else; no suppressions anywhere.

## Touch

`src/extension/messageHandler.ts`, `src/backend/queries/commitComparison.ts`,
`src/webview/main.ts`; their test files only if a case is needed for an
uncovered branch

## Tests

Full `pnpm run test` green unchanged (backend and webview), with counts
in the report.

## Acceptance

- Strict Biome clean on touched files, typecheck green, full tests green.
- The integrator's next Sonar scan shows none of the six findings and
  the gate returns to `OK`.

## Report

- **Agent / date:** Muse Code (general-purpose) sub-agent D14F, claimed
  2026-10-19 11:26 Europe/Warsaw, report 2026-10-19 11:30. Model note:
  general-purpose on the inherited runtime model — no named-model
  selector exists in this runtime; the integrator records the constraint.
- **Branch and commits:** `diff-1.9.0/d14f` — `9ce0f0e G docs(release):
  claim D14F working-tree Sonar follow-up slice (D14F)`, `ca2299f G
  refactor(compare): clear the working-tree comparison Sonar findings
  (D14F)`, plus the signed report commit carrying this section. No push.
- **Files changed:** `src/extension/messageHandler.ts` +70/−42,
  `src/backend/queries/commitComparison.ts` +11/−10,
  `src/webview/main.ts` +1/−1; 135 changed lines outside tests (budget
  ≤150), all within *Touch*; this slice's claim, status and report.
  No test file changed, no suppression added anywhere.
- **Tests added or changed:** none; no case was needed. D14's and D12's
  existing cases already pin every restructured branch — titles
  (`example.ts (abcd ↔ Working Tree)` and the swapped form), the
  `file:` URI side, the deleted file opening its revision alone via
  `vscode.open`, the `*`/`-R` argv through real-repository comparisons,
  and the stale `resolveRef` reply being ignored. Counts unchanged:
  backend 965, webview 682.
- **Gates:** strict Biome clean on the 3 touched files (`npx biome check
  --config-path biome.strict.jsonc --error-on-warnings`, also
  `lint:strict:staged` at commit); `pnpm run typecheck` green (all
  three projects); full `pnpm run test` with the built engine addon
  (`engine:build` + `engine:smoke` OK at 1.0.26): backend 965/965,
  webview 682/682 — exactly the D15-integrated counts; focused
  `messageHandler` 40/40, `compareWith` 11/11, `commitComparison` 4/4;
  `pnpm run kb:check` green; `git diff --check` clean. l10n n/a (no
  user-visible text). Rust arm n/a (no `engine/**` change).
  Sonar: integrator.
- **Acceptance:**
  - Strict Biome clean, typecheck green, full tests green unchanged:
    met, numbers above.
  - The integrator's next Sonar scan shows none of the six findings and
    the gate returns to `OK`: closed in the code, to be confirmed by
    the integrator's scan. Found by content after D15 (the scan's lines
    still matched: `viewDiff` at `messageHandler.ts:98`, the guard at
    `main.ts:3885`). `S3776`: `viewDiff`'s working-tree branch is now
    `viewWorktreeDiff`, fed by `worktreeSideOf` (the `"*"` side, `new`
    checked first as before) and `formatWorktreeDiffTitle`; each
    side-dependent value is picked once into a local instead of eight
    repeated ternaries. `S3358`/`S4624` ×2 in `messageHandler.ts` go
    with that restructure: the side comes from plain `if` returns and
    the title's inner `↔` segment is built in its own statement, so no
    template literal nests. `S3358` in `commitComparison.ts`: the
    revisions come from `comparisonRevisions` with plain returns;
    argv is identical in all three cases (`["-R", compareRef]`,
    `[baseRef]`, `[baseRef, compareRef]`). `S6582` in `main.ts`:
    `pending?.requestId !== requestId` returns in exactly the old two
    cases (no pending submission, or a stale reply).
  - How complexity was estimated: SonarQube was not run here
    (integrator). As D41F did, I scored each function with a scratch
    script, not committed (`/tmp/ggl-d14f-complexity.mjs`), following
    the S3776 rules D41F's report records and parsing with the
    repository's `@babel/parser` from the pnpm store. On the old code
    it reproduces Sonar's 32 for `viewDiff` exactly, and on D41's
    pre-D41F `rowModel.ts` (`82cc778`) it reproduces Sonar's 18 and
    20. New scores: `viewDiff` 4, `viewWorktreeDiff` 10,
    `worktreeSideOf` 2, `formatWorktreeDiffTitle` 1,
    `comparisonRevisions` 2, `fetchComparisonDiff` 1 — the touched
    maximum is 10 against the 16 allowed. The title strings, URIs and
    the deleted-file `vscode.open` path are byte-identical, as the
    unchanged pinning tests prove.
- **Deviations from the slice:** none. Only the three *Touch* files
  changed outside this slice file; no behavior change, no test change,
  no suppression.
- **Open questions / follow-ups:** none for the slice. Integrator: the
  confirming wave gate with coverage and Sonar; if it returns `OK`,
  wave gate 2's six findings are closed and nothing in wave E–G
  remains open on the Sonar side.
