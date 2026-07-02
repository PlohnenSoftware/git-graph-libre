import * as path from "node:path";

import type { SimpleGit } from "simple-git";

import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

export const ARCHIVE_FORMATS = ["tar", "zip"] as const;
export type ArchiveFormat = (typeof ARCHIVE_FORMATS)[number];

export type CreateArchiveInput = {
  repo?: string | null;
  ref: string;
  outputFilePath: string;
  format: ArchiveFormat;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function requireArchiveFormat(format: string): asserts format is ArchiveFormat {
  if (!ARCHIVE_FORMATS.includes(format as ArchiveFormat)) {
    throw new Error("Archive format must be tar or zip.");
  }
}

export function archiveFormatFromPath(filePath: string): ArchiveFormat | null {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return ARCHIVE_FORMATS.includes(extension as ArchiveFormat) ? (extension as ArchiveFormat) : null;
}

export async function createArchive(
  git: SimpleGit,
  input: CreateArchiveInput,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.ref, "Git reference");
  requireValue(input.outputFilePath, "Archive path");
  requireArchiveFormat(input.format);

  await runGitRaw(git, {
    label: "archive.create",
    kind: "action",
    args: ["archive", `--format=${input.format}`, "-o", input.outputFilePath, input.ref],
    repo: input.repo ?? null,
    record
  });
}
