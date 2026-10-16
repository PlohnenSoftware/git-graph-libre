/**
 * Commit signature status, read apart from the graph load.
 *
 * Verifying a signature is the expensive part of showing the signature
 * column: `%G?` runs GPG (or SSH verification) once per signed commit, while
 * everything else about a page of commits is a cheap read — and, for the
 * engine, one that never spawns `git` at all. So the graph load never asks
 * for signatures. The page renders at once with the column pending, and the
 * webview asks for the signatures of exactly the commits it shows through
 * this query, filling the cells in as the answer arrives.
 *
 * Verification stays on the `git` command line by design: it is a permanent
 * non-goal of the engine, which reads signature presence but cannot verify.
 */

import type { SimpleGit } from "simple-git";

import type { GitCommitSignature, QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw, runGitWithInput } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const eolRegex = /\r\n|\r|\n/g;
const formatFieldSeparator = "%x00";
const outputFieldSeparator = "\0";
const signatureFormat = ["%H", "%G?", "%GS", "%GK"].join(formatFieldSeparator);
const signatureFieldCount = 4;

/**
 * Hashes per `git log` call. Each run carries its hashes on the command line,
 * and Windows caps a command line at 32,767 characters; 200 full hashes stay
 * far below that, and the runs go out concurrently.
 */
const HASHES_PER_RUN = 200;

/**
 * A full SHA-1 or SHA-256 object name. The hashes arrive from the webview and
 * become `git log` arguments, so anything else — an option, a revision
 * expression — is dropped before it can reach git.
 */
const fullHashRegex = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

const commitSignatureStatuses: Readonly<Record<string, GitCommitSignature["status"]>> = {
  G: "valid",
  U: "valid-untrusted",
  B: "bad",
  X: "expired",
  Y: "expired-key",
  R: "revoked-key",
  E: "unverifiable"
};

export function parseCommitSignature(
  status: string,
  signer: string,
  key: string
): GitCommitSignature | null {
  if (status === "" || status === "N") return null;

  return {
    status: commitSignatureStatuses[status] ?? "unknown",
    signer: signer || null,
    key: key || null
  };
}

const commitHeaderRegex = /^([0-9a-f]{40}) commit \d+$/;
const gpgsigPrefix = "gpgsig ";

/**
 * Parses `git cat-file --batch` output and returns the hashes whose commit
 * object carries a `gpgsig` header.
 *
 * Git emits `%G?` = `N` for both truly unsigned commits AND signed commits that
 * could not be verified (notably SSH-signed commits when no
 * `gpg.ssh.allowedSignersFile` is configured). The `gpgsig` header is the only
 * reliable, signature-type-agnostic signal that a commit *is* signed. This lets
 * the caller reclassify those `N` commits as signed-but-unverifiable instead of
 * unsigned. Non-commit objects (blobs/tags) are ignored.
 */
export function parseGpgsigPresence(stdout: string): Set<string> {
  const signed = new Set<string>();
  let currentHash: string | null = null;
  for (const line of stdout.split(eolRegex)) {
    const header = commitHeaderRegex.exec(line);
    if (header !== null) {
      currentHash = header[1];
      continue;
    }
    if (currentHash !== null && line.startsWith(gpgsigPrefix)) {
      signed.add(currentHash);
      currentHash = null;
    }
  }
  return signed;
}

type SignatureEntry = {
  hash: string;
  statusRaw: string;
  signature: GitCommitSignature | null;
};

/** `git log -z` output in `signatureFormat`, one entry per commit. */
export function parseSignatureEntries(stdout: string): SignatureEntry[] {
  const fields = stdout.split(outputFieldSeparator);
  if (fields.at(-1) === "") fields.pop();
  const entries: SignatureEntry[] = [];
  for (let i = 0; i + signatureFieldCount - 1 < fields.length; i += signatureFieldCount) {
    const statusRaw = fields[i + 1];
    entries.push({
      hash: fields[i],
      statusRaw,
      signature: parseCommitSignature(statusRaw, fields[i + 2], fields[i + 3])
    });
  }
  return entries;
}

export type CommitSignaturesInput = {
  hashes: readonly string[];
  repo?: string | null;
  /** Resolved git binary path, threaded from `config.gitPath()`; the `gpgsig` probe needs it. */
  gitPath?: string;
  recordGitCommand?: GitCommandRecorder;
};

type GitQueryContext = {
  repo: string | null;
  record?: GitCommandRecorder;
};

/**
 * The signature of each requested commit: an object for a signed one, null
 * for an unsigned one. Hashes that are not full object names are ignored, and
 * a commit git cannot find fails the whole answer rather than half of it —
 * the caller asks only for commits it has just loaded.
 */
export async function commitSignatures(
  git: SimpleGit,
  input: CommitSignaturesInput
): Promise<QueryResult<"commitSignatures">> {
  const hashes = [...new Set(input.hashes)].filter((hash) => fullHashRegex.test(hash));
  if (hashes.length === 0) return { signatures: {}, error: null };
  const context: GitQueryContext = { repo: input.repo ?? null, record: input.recordGitCommand };

  let entries: SignatureEntry[];
  try {
    const runs: string[][] = [];
    for (let start = 0; start < hashes.length; start += HASHES_PER_RUN) {
      runs.push(hashes.slice(start, start + HASHES_PER_RUN));
    }
    const outputs = await Promise.all(
      runs.map((run) =>
        runGitRaw(git, {
          label: "commitSignatures.log",
          args: ["log", "--no-walk=unsorted", "-z", `--format=${signatureFormat}`, ...run, "--"],
          repo: context.repo,
          record: context.record
        })
      )
    );
    entries = outputs.flatMap(parseSignatureEntries);
  } catch (error: unknown) {
    return { signatures: {}, error: toGitQueryError(error, "Unable to load commit signatures") };
  }

  await reclassifyUnverifiedSignatures(git, entries, input.gitPath, context);
  return {
    signatures: Object.fromEntries(entries.map((entry) => [entry.hash, entry.signature])),
    error: null
  };
}

/**
 * Reclassifies commits that git reported as `%G?` = `N` (no signature) but that
 * actually carry a `gpgsig` header. This happens for SSH-signed commits when no
 * `gpg.ssh.allowedSignersFile` is configured: git cannot even attempt
 * verification, so it reports `N` even though the commit is genuinely signed.
 *
 * Only the ambiguous `N` commits are probed (a single batched
 * `git cat-file --batch` over their hashes). Any that carry a `gpgsig` header
 * become `unverifiable` (signed but cannot be verified); truly unsigned commits
 * stay `null`. Failures are swallowed so the worst case is the pre-fix behavior.
 */
async function reclassifyUnverifiedSignatures(
  git: SimpleGit,
  entries: SignatureEntry[],
  binary: string | undefined,
  context: GitQueryContext
): Promise<void> {
  if (binary === undefined || binary === "") return;
  const ambiguousHashes = entries
    .filter((entry) => entry.statusRaw === "N")
    .map((entry) => entry.hash);
  if (ambiguousHashes.length === 0) return;

  let signedHashes: Set<string>;
  try {
    const stdout = await runGitWithInput(git, {
      label: "commitSignatures.signaturePresence",
      args: ["cat-file", "--batch"],
      input: `${ambiguousHashes.join("\n")}\n`,
      binary,
      repo: context.repo,
      record: context.record
    });
    signedHashes = parseGpgsigPresence(stdout);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.statusRaw === "N" && signedHashes.has(entry.hash)) {
      entry.signature = { status: "unverifiable", signer: null, key: null };
    }
  }
}
