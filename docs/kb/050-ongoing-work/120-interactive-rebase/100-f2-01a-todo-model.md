---
summary: >-
  F2-01a: the pure todo model for interactive rebase (`src/backend/rebase/todo.ts`):
  entry and action types, `validateTodo` rules, `serializeTodo`, and the run
  outcome type, with unit tests only. No Git, no UI.
---

# F2-01a — Todo model (pure)

Status: done — awaiting integration

Needs: none

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research section 3 and 4 (F2-01) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Add no
user-visible string, so no l10n work. No new telemetry events or declarations.
Do not bump versions or edit CHANGELOG, README or notices; the integrator does.
Report `Sonar: integrator`.

## Touch

- `src/backend/rebase/todo.ts` (new)
- `tests/backend/rebase/todo.test.ts` (new, unit tests only)
- this slice file's `Status:` line and `## Report`

## Task and acceptance

This slice is the pure model. It calls no Git, spawns nothing, and touches no
other module.

- Types:
  - `TodoAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop'`.
  - `TodoEntry = { action: TodoAction; hash: string; message?: string }`.
  - Run outcome: `TodoRunOutcome = 'completed' | 'paused-edit' | 'paused-conflict' | 'invalid-todo' | 'failed'`.
    Export it now so F2-01b uses the same type; this slice does not classify anything.
- `validateTodo(entries, rangeHashes, base)` returns a result that names the
  first failed rule with a reason code (not a message string; no l10n here).
  It rejects, in this order:
  1. `base` starting with `-`;
  2. an empty list;
  3. a hash that is not 40 or 64 hex digits (the handoff writes full hashes;
     the range read in F2-02 supplies them full-length);
  4. a duplicate hash;
  5. a first entry whose action is `squash` or `fixup` (Git keeps a broken
     state for it, verified in the research);
  6. a hash set that is not exactly the set of `rangeHashes` (nothing missing,
     nothing extra).
- `serializeTodo(entries)` returns the todo text: one line per entry, in
  order, `<action> <full hash>`, with `\n` line endings and a final newline.
  A `reword` entry serializes as `pick` here. The `exec git commit --amend -F
  '<file>'` line that a reword or an edited squash group needs is F2-01b's
  concern and is not emitted by this slice.
- Unit tests cover: each validation rule with a passing and a failing case,
  rule order when several fail, abbreviated and uppercase hashes, a 64-digit
  hash, serialization order and line endings, and `reword` serializing as
  `pick`.

## Checks

Run the checks that fit the change and record each command and its result:

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings src/backend/rebase/todo.ts tests/backend/rebase/todo.test.ts
pnpm run typecheck
pnpm exec vitest run tests/backend/rebase/todo.test.ts
```

## Report

## Report

- **Agent / date:** Claude Haiku 5.5 (claude-haiku-5-5), 2026-11-23 02:05 (claim) to 2026-11-23 (report)
- **Branch and commits:** `rebase/F2-01a` — `ddc9d8f9 G docs(kb): claim the todo model slice (F2-01a)`; `8e34e078 G feat(rebase): add the pure todo model (F2-01a)`; `338d72a3 G test(rebase): cover the todo model rules and serialization (F2-01a)`; this report commit (see git log)
- **Files changed:** `src/backend/rebase/todo.ts` (new, 139 lines); `tests/backend/rebase/todo.test.ts` (new, 323 lines); this slice file (claim and report lines only). Code and tests: 462 added lines in total.
- **Tests added or changed:** 38 new unit tests in `tests/backend/rebase/todo.test.ts`, covering rules 1 to 6, rule order, abbreviated, uppercase and 64-digit hashes, serialization order, line endings, every action word, reword as pick, messages kept out of the text, and no mutation of inputs. Count before: 0; after: 38.
- **Gates:** `npx vitest run --project backend tests/backend/rebase/todo.test.ts`: 38 passed. `npx biome check --config-path biome.strict.jsonc --error-on-warnings src/backend/rebase/todo.ts tests/backend/rebase/todo.test.ts`: exit 0, no errors. `pnpm run typecheck`: exit 0. `node ./docs/kb/housekeeping.mjs --check`: exit 0. Sonar: integrator
- **Acceptance:** types `TodoAction`, `TodoEntry`, `TodoRunOutcome` exported: met. `validateTodo` returns a discriminated union naming the first failed rule (not an exception), rules in the slice order: met (tests per rule and per order pair). `serializeTodo` one `<action> <full hash>` line per entry, `\n` endings, final newline, reword as pick: met. No Git, no I/O, no vscode import, readonly inputs, no mutation: met (module imports nothing; mutation test). Unit tests for every listed case: met.
- **Deviations from the slice:** Two choices the slice left open, both recorded here for the integrator. (1) Hash matching is case-insensitive: an uppercase full hash passes rule 3, matches the lowercase range, and counts as a duplicate of its lowercase copy; `serializeTodo` writes hashes in lower case, as Git prints them. (2) For an empty list, rule 1 (base) is still checked first, per the rule order. The `validateTodo` result carries the missing and extra hashes for rule 6. No other deviation.
- **Open questions / follow-ups:** The `README.md` and the Biome config schema notice (`2.5.13` configured, `2.6.8` expected by the CLI) were already present in the base and are not touched by this slice; Biome still exits 0. No follow-ups for this slice.
