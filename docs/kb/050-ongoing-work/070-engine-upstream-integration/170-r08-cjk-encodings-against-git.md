---
summary: >-
  R08: CJK encodings against Git. R04 decodes commit text through
  `encoding_rs` and checked only ISO-8859-1, Windows-1252 and Shift_JIS
  against Git's iconv. Verify EUC-KR, GBK, GB18030, Big5, EUC-JP and the
  other labels R04 accepts, and decline every one whose decoding differs
  from Git's.
---

# R08 — CJK encodings against Git

Status: done — awaiting integration

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

- **Agent / date:** Claude Haiku 5.5, 2026-11-09 00:20
- **Branch and commits:** `engine-review/R08`
  - `1fcd2bc G` docs(engine): claim R08 for CJK encodings against Git (R08)
  - `b331a9a G` fix(engine): decode only commit labels checked against Git (R08)
  - `4e65aa8 G` test(engine): sweep every label byte for byte against Git (R08)
  - `5bda37a G` test(engine): correct the KOI8 note in the verdict table (R08)
  - this report commit (the last on the branch)
- **Files changed (`git diff --numstat eb7a9d8..HEAD`):** `engine/native/core/src/text.rs` +74 −16; `engine/native/core/tests/encoding_parity.rs` +443 −21 (the comment fix adds 3 and removes 2 more); this slice file +1 −1 and this report.
- **Tests added or changed:** `encoding_parity.rs` 11 → 15 tests. Added `single_byte_labels_match_git_on_every_high_byte`, `multi_byte_and_other_labels_decline`, `real_text_in_verified_labels_matches_git`, `shift_jis_and_windows_1252_decline_although_encoding_rs_decodes_them`. Changed: `other_encodings_that_git_and_the_engine_read_alike` (now KOI8-R and ISO-8859-2, which are served; Shift_JIS and windows-1252 moved to the decline test) and `bytes_invalid_in_the_declared_encoding_decline_the_reads_that_show_them` (label EUC-JP to ISO-8859-3, because EUC-JP now declines at the label; the bytes are `0xA5`, unassigned in ISO-8859-3). `text.rs` unit tests 5 → 6: `other_encodings_decode_or_decline` became `verified_labels_decode_or_decline` with new expectations, and `every_verified_label_is_one_encoding_rs_knows` was added. The engine's library unit tests went from 7 to 8.
- **Gates (all with `CARGO_BUILD_JOBS=8`):**
  - `cargo test --manifest-path engine/Cargo.toml -p git-graph-core --test encoding_parity`: 15 passed, 0 failed (6.6 s).
  - `pnpm run engine:fmt`: clean (exit 0).
  - `pnpm run engine:lint` (clippy `-D warnings`, whole workspace): clean (exit 0).
  - `pnpm run engine:test` (whole workspace): exit 0, every suite ok. The counts: git-graph-core unit 8, api 1, bounded_reads 7, config_and_blob 9, encoding_parity 15, git_parity 12, gitlink_content 5, graph_and_diff 31, linked_worktree 10, log_and_refs 22, queries 24, ref_errors 4, reftable 2, remote_ref_parity 4, search 12, stats 6, traversal_parity 14, untrusted 7, worktrees 14; git-graph-diff unit 72, default_lines_diff_oracle 1, vscode_fixtures 1 (passed here); git-graph-node unit 4 and 1.
  - The three cargo gates ran before commit `5bda37a`, which changes a comment in `encoding_parity.rs` and no code; `engine:fmt` was rerun after it and passed.
  - Not run: the addon build and the TypeScript parity tests (not in this slice's check list). `tests/backend/engine/encodingParity.test.ts` uses only ISO-8859-1, which is unchanged. Sonar: integrator.
- **Git and iconv used for the verdicts:** Git 2.56.0 (`git --version`), built from commit `a018953`, with iconv taken from the system C library. `ldd $(which git)` shows `/usr/lib/libc.so.6`; `getconf GNU_LIBC_VERSION` prints `glibc 2.44`; `iconv --version` prints `iconv (GNU libc) 2.44`. The verdicts depend on that iconv (see open questions).
- **Acceptance:**
  - Commits in every unverified family, in their own encoding, compared with Git's UTF-8 output: met. The sweeps write author, subject and body in each encoding and read Git's output with one `git log --no-walk --stdin --format=%an%x1f%s%x1f%B`, as raw bytes. The R04 real-`git commit` test still runs with ISO-8859-1. The sweeps use `git hash-object --literally` with an `encoding` header, not `git -c i18n.commitEncoding=… commit`, which is the same header.
  - Byte sequences where the standards disagree: met. Named probes: `0x8160` and `0xA1C1` (WAVE DASH vs FULLWIDTH TILDE), `0x80` (GB18030 and Shift_JIS), `0x8141` (EUC-KR UHC), `0x8862` and `0x8740` (Big5 HKSCS), `0x8FA2AF` (EUC-JP JIS X 0212), `0xA140` (GBK), `0x81308130` (GB18030 four-byte), and every single byte from 0x80 to 0xFF for the single-byte labels. Each label's verdict has its evidence in the table below.
  - Accepted only on a byte-for-byte match: met. `VERIFIED_LABELS` in `text.rs` lists the labels that verified. Any other label declines with `Unsupported`, and the CLI serves the read.
  - Every verdict pinned in `encoding_parity.rs`: met (`single_byte_labels_match_git_on_every_high_byte`, `multi_byte_and_other_labels_decline`, the R04 decline pin).

  Verdicts. Counts are probes whose engine output differed from Git's, of the probes run, before the fix:

  | Label(s) | Verdict | Evidence |
  | --- | --- | --- |
  | latin1, iso-8859-1, iso8859-1, iso_8859-1, iso-ir-100, cp819, l1 | Accepted (Latin-1 path) | 128 of 128 high bytes, 0 differ |
  | iso-8859-2 and aliases (latin2, iso8859-2, iso_8859-2, csisolatin2, iso-ir-101) | Accepted | 128 of 128, 0 differ |
  | iso-8859-3 and aliases (latin3, iso-ir-109) | Accepted | 121 served, 7 declined, 0 differ |
  | iso-8859-4 and aliases (latin4, iso-ir-110) | Accepted | 128 of 128, 0 differ |
  | iso-8859-5 and aliases (cyrillic, iso-ir-144) | Accepted | 128 of 128, 0 differ |
  | iso-8859-6 and aliases (arabic, iso-ir-127) | Accepted | 83 served, 45 declined, 0 differ |
  | iso-8859-7 and aliases (greek, iso-ir-126) | Accepted | 125 served, 3 declined, 0 differ |
  | iso-8859-8 and aliases (hebrew, iso-ir-138) | Accepted | 92 served, 36 declined, 0 differ |
  | iso-8859-10 (latin6), iso-8859-13, iso-8859-14, iso-8859-15, iso-8859-16 | Accepted | 128 of 128 each, 0 differ |
  | ibm866, cp866, csibm866 | Accepted | 128 of 128, 0 differ |
  | koi8-r, cskoi8r | Accepted | 128 of 128, 0 differ |
  | windows-1256, cp1256 | Accepted | 128 of 128, 0 differ |
  | iso-8859-9, iso-8859-11, tis-620, iso-8859-8-i | Declined | Not in the list. 92 differ for `-i`, which iconv does not know; 0 served otherwise |
  | windows-874, windows-1250 to -1255, -1257, -1258, cp1250, cp1251, cp1252 | Declined | 1251: 1 differs (0x98). 1252: 5 (0x81, 0x8D, 0x8F, 0x90, 0x9D). 1250: 5. 1253: 14. 1254: 7. 1255: 13. 1257: 10. 1258: 9. 874: 23. iconv rejects the undefined bytes; the web standard maps them to C1 controls |
  | koi8-u | Declined | 2 differ (0xAE and 0xBE: U+045E and U+040E in the engine, box drawing in Git) |
  | koi8 | Declined | 65 differ. iconv's `KOI8` table is not KOI8-R's (it rejects 0xB4, which KOI8-R maps to a box-drawing character) |
  | macintosh, mac | Declined | 2 differ (0xC6: U+2206 in the engine, U+0394 in Git; 0xF0: U+F8FF vs U+E01E) |
  | x-mac-cyrillic | Declined | 128 of 128 differ. iconv does not know the name |
  | ascii, us-ascii | Declined | Not in the list. The web standard reads them as Windows-1252; 0 served |
  | gbk, gb2312, x-gbk | Declined | GBK: 2,151 of 24,068 differ (0xA140: U+E4C6 in the engine, raw bytes in Git) |
  | gb18030 | Declined | 4 of 34,724 differ (0x80 as U+20AC; 0xA3A0) |
  | big5, big5-hkscs, cn-big5 | Declined | 5,092 of 19,910 differ (0x8740 and the HKSCS extension) |
  | euc-kr, ks_c_5601-1987, windows-949 | Declined | 8,822 of 22,556 differ (UHC bytes such as 0x8141) |
  | euc-jp, x-euc-jp | Declined | 463 of 17,863 differ (0xA1C1: U+FF5E in the engine, U+301C in Git) |
  | shift_jis, sjis, windows-31j, x-sjis | Declined | 2,732 of 11,408 differ (0x8160 as in EUC-JP; 0x80). R04 had accepted this label on a sample |
  | iso-2022-jp, utf-16le, utf-16be, replacement, klingon | Declined | Not ASCII supersets, or unknown; 0 served |

- **Deviations from the slice:** none in the Touch list. The sweeps use `hash-object --literally` with an `encoding` header instead of `git commit`, as the task allowed. Two existing R04 tests were changed, as described under *Tests*, because two of their labels declined. The R04 report's claim that Shift_JIS and windows-1252 were verified is wrong: a sample passed, but the sweep found the differences above. The decline is the rule the slice asks for. A byte-level rule is an open question below.
- **Open questions / follow-ups:**
  1. Label or byte. The slice asks for a decline per label. Several labels fail on a few bytes only: windows-1252 (5 bytes), windows-1251 (1 byte), GB18030 (4 probes), and EUC-KR on its UHC bytes. A byte-level decline would keep those labels. That needs a per-label table of the bytes `encoding_rs` maps and iconv does not, so it is a maintainer decision. Shift_JIS and EUC-JP fail on common characters (0x8160 and 0xA1C1), so they stay declined.
  2. The verdicts depend on the iconv of the machine that runs the test. Another glibc, musl or macOS libiconv can disagree with these tables. A CI run on another platform could then fail, correctly, on a verdict. The integrator should decide whether the sweeps run on every platform or whether the verdicts are pinned to Linux glibc.
  3. Shift_JIS is now served by the CLI. It is correct, but a Shift_JIS repository loses the engine's speed. Phase 16 should record that R04's Shift_JIS claim is withdrawn.
  4. Commit `b331a9a` has a stray line in its body, `Refs PlohnenSoftware/git-graph-libre (none)`. I wrote it by mistake. It is not an issue reference. Amending it was blocked by a safety gate, so I left it. Its body also says that `koi8` is a label iconv does not know; the later commit `5bda37a` corrects that in the test's comment, but not in `b331a9a`.
  5. Process note. My first sweep run deadlocked: the test wrote input to `git hash-object` before reading its output. I fixed `pipe_bytes` to write from a thread. That run's test process (`encoding_parity-6c4df748b5087513 explore_verdicts`, PID 1640606 at `2026-11-09 00:04`) is still hung in this worktree's `engine/target`. I tried to stop it, and that was refused as interfering with a workload, so I left it. It holds no git lock and no file the integrator needs. It can be stopped with `pkill -f 'encoding_parity-6c4df748b5087513 explore'`.
  6. Sonar: integrator.
