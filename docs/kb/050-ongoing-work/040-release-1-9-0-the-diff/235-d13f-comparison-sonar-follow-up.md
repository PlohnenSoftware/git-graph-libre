---
summary: >-
  D13F · ready · TypeScript · ≤40 lines: clear the two SonarQube findings
  the wave gate found in D13's `src/webview/main.ts` (S6582 optional chain,
  S2234 argument order at the swap call). Comparison behavior and tests
  stay unchanged.
---

# D13F — Comparison Sonar follow-up

Status: integrated 0acf413
Needs: D13 (integrated); dispatch after D12 integrates (both touch `src/webview/main.ts`)
Decisions: — (a follow-up the integrator opened to bring the wave gate to `OK`, as with D41F, D42F and D43F)
Kind: TypeScript · Size budget: ≤ 40 changed lines outside tests
Source: the integration log's wave gate on `2026-10-19` (Sonar analysis `a86769fe-5852-4332-8281-a9aff7766380`)

## Goal

Fix the two findings in `src/webview/main.ts` without changing what the
comparison header, Swap or diff titles do.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D13's slice file and report (`230-d13-comparison-header-and-swap.md`)
- `src/webview/main.ts` around lines 6132–6134 and
  `tests/webview/commitDetailsView.test.ts`

## Facts (the wave gate, `2026-10-19`)

| Rule | Line | Severity | Finding |
| --- | --- | --- | --- |
| `typescript:S6582` | 6132 | minor | prefer an optional chain expression |
| `typescript:S2234` | 6134 | major | arguments `compareRef`/`baseRef` not in the function's parameter order |

The S2234 call is the Swap action: exchanging base and compare is the
point of the call. Fix it by making the exchange explicit in code (for
example named locals for the swapped values), never by suppressing the
rule, and verify against the function signature that the swap still
sends base and compare exchanged, exactly as D13's tests pin.

## Steps

1. Line 6132: use the optional chain Sonar asks for, same semantics.
2. Line 6134: restructure so the intentional exchange reads as one and
   S2234 no longer fires, with the sent request unchanged.
3. Change nothing else.

## Touch

`src/webview/main.ts`, `tests/webview/commitDetailsView.test.ts` (only
if a case is needed)

## Tests

All existing webview tests pass unchanged, the Swap cases included
(`pnpm exec vitest run --project webview tests/webview/commitDetailsView.test.ts`,
then the full webview project).

## Acceptance

- Strict Biome clean on touched files, typecheck green, webview tests green.
- The integrator's next Sonar scan shows neither finding.

## Report

- **Agent / date:** Muse Code (general-purpose) sub-agent D13F, 2026-10-19 11:04 Europe/Warsaw (inherited runtime model `muse-wonder-full-1.0`; this runtime has no named-model selector — the slice was classed easy-tier, for the integrator to record)
- **Branch and commits:** `diff-1.9.0/d13f` — `1fcdb7a G docs(release): claim D13F comparison Sonar follow-up slice (D13F)`; `e175ea8 G refactor(compare): clear the comparison swap Sonar findings (D13F)`; this report in a further signed docs commit on the same branch. No push.
- **Files changed:** `src/webview/main.ts` (+20 −5, 25 changed lines, within the ≤40 budget), this slice file (claim, status and report). Nothing else; `tests/webview/commitDetailsView.test.ts` unchanged.
- **Tests added or changed:** none; no case was needed. The existing Swap case (`tests/webview/commitDetailsView.test.ts`, "swaps a comparison, exchanging refs and labels") already pins the sent `commitComparison` request (`baseRef: "HEAD"`, `compareRef: <branch hash>`) and the exchanged labels in state. Counts unchanged: `commitDetailsView` 22, webview project 673.
- **Gates:** strict Biome clean on the touched file (`npx biome check --config-path biome.strict.jsonc --error-on-warnings src/webview/main.ts`, `Checked 1 file`, also clean staged before the code commit); `pnpm run typecheck` green (all three projects); `pnpm exec vitest run --project webview tests/webview/commitDetailsView.test.ts` 22/22; `pnpm exec vitest run --project webview` 673/673 in 59 files; backend project not run (no backend file touched; webview-only slice); `git diff --check` clean; l10n n/a (no user-visible text); kb:check green (run with this report); Rust arm n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:**
  - Strict Biome clean, typecheck green, webview tests green: met (numbers above).
  - The integrator's next Sonar scan shows neither finding: closed in the code, to be confirmed by the integrator's scan. The scan's lines 6132/6134 are the `swapCommitComparison` guard and call, now at `src/webview/main.ts:6247` after D12/D04b landed (found by content). `S6582`: the guard no longer reads `expanded.comparison`/`expanded.srcElem` behind an `expanded === null ||` check; it reads `expanded?.comparison` and `expanded?.srcElem` into locals and returns when `expanded` is null or either local is null/undefined — for the typed states (`comparison`/`srcElem` are `| null`, so `undefined` arises only from the chain when `expanded` is null) it returns in exactly the old three cases. `S2234`: the destructuring itself performs the exchange under explicit names (`baseRef: swappedCompareRef`, `compareRef: swappedBaseRef`, likewise the labels), and the call passes `swappedBaseRef, swappedCompareRef` in `loadCommitComparison`'s parameter order (`baseRef`, `compareRef` at `src/webview/main.ts:5638`). The sent request is byte-for-byte the old one — base and compare exchanged — as the unchanged Swap test proves. No rule suppression anywhere.
- **Deviations from the slice:** none. Only `src/webview/main.ts` was touched outside this slice file, as *Touch* allows; no behavior change, no test change.
- **Open questions / follow-ups:** none.
