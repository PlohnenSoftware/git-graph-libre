# Agent Instructions

**Read the knowledge base index, [docs/kb/README.md](docs/kb/README.md), in full before you
touch anything in this repository, then every section it marks *always read*.**
The knowledge base is the single source of truth for maintainer and agent guidance, and it
overrides whatever defaults or habits you arrive with.

Required before your first action in a session:

1. Read `README.md` for what this extension is and how it is configured.
2. Read `docs/kb/README.md`, its *always read* sections, and the sections you think are related to your current task. Keep the knowledge base updated while you work so if task interruption happens unexpectedly, you can find the relevant parts again.

Do not write code, edit docs, run a gate, commit, or push before those two
reads are done. When resuming mid-task, re-read the knowledge base sections
covering the work you are about to do — do not rely on memory of an earlier
session.

If anything here or elsewhere conflicts with the knowledge base, the knowledge
base wins. Raise the conflict with the maintainer instead of guessing.

Keep this file pointer-only. Durable rules belong in the knowledge base and must
never be duplicated here. `CLAUDE.md`, `CODEX.md` and `agents.md` are symlinks to
this file.
