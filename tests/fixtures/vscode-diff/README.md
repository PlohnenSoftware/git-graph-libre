# VS Code diff fixtures (vendored)

These 58 fixture folders are copied verbatim from
[microsoft/vscode](https://github.com/microsoft/vscode),
`src/vs/editor/test/node/diffing/fixtures/` at commit
`28a562309973a386b2bdefae78127788a4742fe8`, the commit recorded by
release 1.9.0 slice D20. Each folder diffs the file starting with `1.`
against the file starting with `2.`; `advanced.expected.diff.json` is
VS Code's expected result for its `advanced` diff algorithm, which the
oracle suite in `tests/backend/vscodeDiffOracles.test.ts` compares
against. The `legacy.expected.diff.json` and `advanced.human.diff.json`
files are kept as copied, for completeness; the suite does not use
them.

The fixtures are MIT-licensed. Microsoft's copyright lines, preserved
in `LICENSE.mit` at the repository root with the full MIT permission
text, are:

```text
Copyright (c) 2015 - present Microsoft Corporation
Copyright (c) Microsoft Corporation. All rights reserved.
```

Source paths and the Phase 17 licensing boundary are recorded in
`NOTICE.md` and `engine/NOTICE.md`. Do not edit an expected file by
hand; refresh the whole directory from a recorded upstream commit
instead, following the Phase 17 re-sync procedure in the knowledge
base.
