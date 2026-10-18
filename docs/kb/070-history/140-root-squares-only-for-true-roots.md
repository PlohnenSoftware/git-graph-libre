---
summary: >-
  Fix: `Vertex.parents` holds drawn parents only, so page-boundary commits
  took root squares; `hasParentBeyondGraph` now reserves the square for
  commits both backends report parentless (`[""]`).
---

# Root squares only for true roots (`2026-10-16`)

`Vertex.parents` holds *drawn* parents only — `Graph.loadCommits()` adds a
parent solely when its hash is in the loaded lookup — and the square test
was `parents.length === 0`, so every commit at the edge of the loaded
window (page boundary, filtered-out parents) rendered as a root. A vertex
now also records `hasParentBeyondGraph` for any non-empty parent hash the
lookup misses, and the square requires both no drawn parents and none
beyond the graph. Both backends normalize a truly parentless commit to
`parentHashes: [""]` (the CLI's `"".split(" ")`, the engine mapper
explicitly), which is what makes the test exact rather than a heuristic.
Lane assignment is untouched: it still runs on drawn parents alone, so a
boundary commit keeps its lane end and merely changes marker. Verified by
two new cases in `tests/webview/graph.test.ts` (the boundary case written
failing first) and a headless QtWebEngine screenshot of the real `Graph`
SVG: boundary circle, true-root square.
