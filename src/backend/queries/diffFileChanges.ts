import type { GitFileChange, GitFileChangeType } from "@/backend/types";

const gitFieldSeparatorOutput = "\0";
const diffStatusRegex = /^[AMDR](?:\d+)?$/;
const objectHashRegex = /^[0-9a-f]{40,64}$/i;

function toPath(str: string) {
  return str.replaceAll("\\", "/");
}

export function splitNulTerminatedFields(stdout: string) {
  const fields = stdout.split(gitFieldSeparatorOutput);
  if (fields.at(-1) === "") fields.pop();
  return fields;
}

function parseNumStatValue(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function splitNumStatSummary(summary: string) {
  const firstTab = summary.indexOf("\t");
  const secondTab = firstTab === -1 ? -1 : summary.indexOf("\t", firstTab + 1);
  if (firstTab === -1 || secondTab === -1) return null;
  return {
    additions: parseNumStatValue(summary.slice(0, firstTab)),
    deletions: parseNumStatValue(summary.slice(firstTab + 1, secondTab)),
    path: summary.slice(secondTab + 1)
  };
}

function addFileChangesFromNameStatus(fileChanges: GitFileChange[], nameStatusLines: string[]) {
  const fileLookup: Record<string, number> = {};
  for (let i = 0; i < nameStatusLines.length; ) {
    if (objectHashRegex.test(nameStatusLines[i])) {
      i++;
      continue;
    }

    const status = nameStatusLines[i];
    if (!diffStatusRegex.test(status)) break;

    const oldPathField = nameStatusLines[i + 1];
    if (oldPathField === undefined) break;

    const isRename = status.startsWith("R");
    const newPathField = isRename ? nameStatusLines[i + 2] : oldPathField;
    if (newPathField === undefined) break;

    const newFilePath = toPath(newPathField);
    fileLookup[newFilePath] = fileChanges.length;
    fileChanges.push({
      oldFilePath: toPath(oldPathField),
      newFilePath,
      type: status[0] as GitFileChangeType,
      additions: null,
      deletions: null
    });
    i += isRename ? 3 : 2;
  }
  return fileLookup;
}

function getNumStatPath(summaryPath: string, numStatLines: string[], index: number) {
  if (summaryPath !== "") return { fileName: summaryPath, nextIndex: index + 1 };

  const renamedPath = numStatLines[index + 2];
  if (renamedPath === undefined) return null;
  return { fileName: renamedPath, nextIndex: index + 3 };
}

function applyNumStatFileChanges(
  fileChanges: GitFileChange[],
  fileLookup: Record<string, number>,
  numStatLines: string[]
) {
  for (let i = 0; i < numStatLines.length; ) {
    if (objectHashRegex.test(numStatLines[i])) {
      i++;
      continue;
    }

    const summary = splitNumStatSummary(numStatLines[i]);
    if (summary === null) break;

    const pathResult = getNumStatPath(summary.path, numStatLines, i);
    if (pathResult === null) break;
    i = pathResult.nextIndex;

    const fileName = toPath(pathResult.fileName);
    const fileIndex = fileLookup[fileName];
    if (typeof fileIndex === "number") {
      fileChanges[fileIndex].additions = summary.additions;
      fileChanges[fileIndex].deletions = summary.deletions;
    }
  }
}

export function parseDiffFileChanges(
  nameStatusLines: string[],
  numStatLines: string[]
): GitFileChange[] {
  const fileChanges: GitFileChange[] = [];
  const fileLookup = addFileChangesFromNameStatus(fileChanges, nameStatusLines);
  applyNumStatFileChanges(fileChanges, fileLookup, numStatLines);
  return fileChanges;
}
