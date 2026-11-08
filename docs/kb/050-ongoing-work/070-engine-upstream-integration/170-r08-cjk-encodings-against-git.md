---
summary: >-
  R08: CJK encodings against Git. R04 decodes commit text through
  `encoding_rs` and checked only ISO-8859-1, Windows-1252 and Shift_JIS
  against Git's iconv. Verify EUC-KR, GBK, GB18030, Big5, EUC-JP and the
  other labels R04 accepts, and decline every one whose decoding differs
  from Git's.
---

# R08 — CJK encodings against Git

Status: claimed by Claude Haiku on 2026-11-08 23:56

Needs: R04

Read first: Engine upstream integration overview, Multi-agent releases,
R04's report (`130-r04-encoding.md`) and `engine/native/core/src/text.rs`,
Phase 16 invariants/non-goals.

## Facts (R04's report, `2026-11-08`)

- Git converts a commit's text from its `encoding` header to UTF-8 with
  iconv; the engine decodes it with `encoding_rs`. The two can differ on
  unusual byte sequences.
- R04 verified ISO-8859-1, Windows-1252 and Shift_JIS against Git. It already
  declines unknown labels, encodings that are not ASCII supersets, the
  ISO-8859 labels `encoding_rs` folds into Windows code pages, and bytes
  invalid in the declared encoding.
- EUC-KR, GBK, Big5 and the other CJK labels `encoding_rs` knows decode
  unverified.

## Touch

engine/native/core/src/text.rs; engine/native/core/tests/encoding_parity.rs

Own slice report/status are allowed. The integrator owns shared provenance,
changelog and version bumps.

## Task and acceptance

For every label family `text.rs` accepts that is not yet verified (at least
EUC-KR, GBK, GB18030, Big5, EUC-JP, ISO-2022-JP if accepted, KOI8-R, and
the remaining Windows and ISO-8859 code pages), commit real text with
`git -c i18n.commitEncoding=<label> commit` (or `commit-tree` with an
`encoding` header) in temporary repositories, and compare the engine's
decoded names, subjects and bodies with Git's UTF-8 output. Include byte
sequences where the encoding standards are known to disagree, such as
Big5-HKSCS extensions, GBK and GB18030 four-byte forms, and EUC-KR
extensions. Keep accepting a label only where it matches Git byte for byte;
decline the rest with `Unsupported` (the CLI then serves the read), and pin
each verdict in `encoding_parity.rs`. Record in the report which iconv
(glibc version) Git used, since Git's output depends on it.

Run focused checks: `cargo test -p git-graph-core --test encoding_parity`,
`engine:fmt`, `engine:lint`, `engine:test`. Document exact commands and
results. Claim and changes use signed commits; never push. Report Sonar:
integrator.

## Report

Not started.
