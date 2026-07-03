import type { SimpleGit } from "simple-git";

import type { GitTagDetails, GitTagSignature, QueryResult } from "@/backend/types";
import {
  type GitCommandError,
  type GitCommandRecorder,
  runGitRaw
} from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

type TagDetailsInput = {
  repo: string;
  tagName: string;
  recordGitCommand?: GitCommandRecorder;
};

const gitFieldSeparatorFormat = "%00";
const gitFieldSeparatorOutput = "\0";
const tagDetailsFieldCount = 11;
const eolRegex = /\r\n|\r|\n/g;
const failedSignatureCodes = new Set(["ERRSIG", "EXPSIG", "EXPKEYSIG", "REVKEYSIG"]);

type MutableSignature = GitTagSignature;

function requireTagName(tagName: string) {
  if (tagName.trim() === "") throw new Error("Tag name is required.");
}

function trimOneRecordTerminator(value: string) {
  return value.replace(/\r?\n$/, "");
}

function trimTrailingBlankLines(text: string) {
  const lines = text.split(eolRegex);
  let lastLine = lines.length - 1;
  while (lastLine >= 0 && lines[lastLine] === "") lastLine--;
  return lines.slice(0, lastLine + 1).join("\n");
}

function cleanEmail(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed.slice(1, -1);
  return trimmed;
}

function parseUnixDate(value: string) {
  const date = Number.parseInt(value, 10);
  return Number.isFinite(date) ? date : null;
}

function emptySignature(): MutableSignature {
  return { status: "unknown", key: null, signer: null };
}

function parseTagRecord(tagName: string, stdout: string): Omit<GitTagDetails, "signature"> {
  const fields = trimOneRecordTerminator(stdout).split(gitFieldSeparatorOutput);
  if (fields.length < tagDetailsFieldCount || fields[0] === "") {
    throw new Error(`Tag '${tagName}' was not found.`);
  }

  const type = fields[1] === "tag" ? "annotated" : "lightweight";
  const objectHash = fields[2];
  const targetType = type === "annotated" ? fields[3] : fields[1];
  const targetHash = type === "annotated" ? fields[4] : fields[2];

  if (objectHash === "" || targetHash === "") {
    throw new Error(`Tag '${tagName}' has an unexpected object format.`);
  }

  return {
    tagName: fields[0],
    type,
    objectHash,
    targetHash,
    targetType: targetType || "unknown",
    taggerName: fields[5] === "" ? null : fields[5],
    taggerEmail: cleanEmail(fields[6]),
    taggerDate: parseUnixDate(fields[7]),
    subject: fields[8],
    body: trimTrailingBlankLines(fields[9])
  };
}

function recordKey(record: string[]) {
  return record[2] ?? null;
}

function recordSigner(record: string[]) {
  return record.slice(3).join(" ") || null;
}

function markBadSignature(signature: MutableSignature, record: string[]) {
  signature.status = "bad";
  signature.key = recordKey(record) ?? signature.key;
  signature.signer = recordSigner(record) ?? signature.signer;
}

function markFailedSignature(signature: MutableSignature, record: string[]) {
  if (signature.status !== "bad") signature.status = "failed";
  signature.key = recordKey(record) ?? signature.key;
}

function markGoodSignature(signature: MutableSignature, record: string[]) {
  if (signature.status === "unknown") signature.status = "valid";
  signature.key = recordKey(record) ?? signature.key;
  signature.signer = recordSigner(record) ?? signature.signer;
}

function markValidSignature(signature: MutableSignature, record: string[]) {
  if (signature.status === "unknown") signature.status = "valid";
  signature.key = recordKey(record) ?? signature.key;
}

function applySignatureRecord(signature: MutableSignature, record: string[]) {
  const code = record[1] ?? "";
  if (code === "BADSIG") return markBadSignature(signature, record);
  if (failedSignatureCodes.has(code)) return markFailedSignature(signature, record);
  if (code === "GOODSIG") return markGoodSignature(signature, record);
  if (code === "VALIDSIG") return markValidSignature(signature, record);
}

export function parseSignatureOutput(output: string): GitTagSignature {
  const records = output
    .split(eolRegex)
    .filter((line) => line.startsWith("[GNUPG:] "))
    .map((line) => line.split(" "));

  const signature = emptySignature();
  for (const record of records) applySignatureRecord(signature, record);
  return signature;
}

async function verifyTagSignature(
  git: SimpleGit,
  tagRef: string,
  repo: string,
  record?: GitCommandRecorder
): Promise<GitTagSignature> {
  try {
    const stdout = await runGitRaw(git, {
      label: "tagDetails.verifySignature",
      args: ["verify-tag", "--raw", tagRef],
      repo,
      record
    });
    return parseSignatureOutput(stdout);
  } catch (error: unknown) {
    const stderr = (error as Partial<GitCommandError>).record?.error?.stderr ?? "";
    return stderr === ""
      ? { status: "unknown", key: null, signer: null }
      : parseSignatureOutput(stderr);
  }
}

export async function tagDetails(
  git: SimpleGit,
  input: TagDetailsInput
): Promise<QueryResult<"tagDetails">> {
  try {
    requireTagName(input.tagName);
    const tagRef = `refs/tags/${input.tagName}`;
    const format = [
      "%(refname:short)",
      "%(objecttype)",
      "%(objectname)",
      "%(*objecttype)",
      "%(*objectname)",
      "%(taggername)",
      "%(taggeremail)",
      "%(taggerdate:unix)",
      "%(contents:subject)",
      "%(contents:body)",
      "%(contents:signature)"
    ].join(gitFieldSeparatorFormat);
    const stdout = await runGitRaw(git, {
      label: "tagDetails.info",
      args: ["for-each-ref", `--format=${format}`, tagRef],
      repo: input.repo,
      record: input.recordGitCommand
    });
    const fields = trimOneRecordTerminator(stdout).split(gitFieldSeparatorOutput);
    const hasSignature = (fields[10] ?? "").trim() !== "";
    const parsed = parseTagRecord(input.tagName, stdout);
    const signature = hasSignature
      ? await verifyTagSignature(git, tagRef, input.repo, input.recordGitCommand)
      : null;

    return {
      tagName: input.tagName,
      tagDetails: { ...parsed, signature },
      error: null
    };
  } catch (error: unknown) {
    return {
      tagName: input.tagName,
      tagDetails: null,
      error: toGitQueryError(error, "Unable to load tag details")
    };
  }
}
