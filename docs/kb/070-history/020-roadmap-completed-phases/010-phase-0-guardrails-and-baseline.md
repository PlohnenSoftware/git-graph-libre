---
summary: >-
  Complete. Guardrails: keep this document current, baseline `pnpm run
  typecheck`/`lint`/`test`/`l10n:check`; acceptance: `AI-dev` exists, and
  `README.md` deliberately does not link this document.
---

# Phase 0: Guardrails and Baseline

**Status: complete.**

Goal: make future implementation reviewable and MIT-clean.

- Keep this knowledge base updated when a feature plan changes.
- Before code work, run a baseline `pnpm` check set if dependencies are present:
  `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and
  `pnpm run l10n:check`.

Acceptance:

- `AI-dev` branch exists.
- `README.md` deliberately does **not** link to this knowledge base; see Branch
  containment.
- This document names source boundaries and current integration points.
