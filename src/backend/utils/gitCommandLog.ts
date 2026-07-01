import type { GitCommandRecord } from "./gitRunner";

export function formatGitCommandRecord(record: GitCommandRecord): string {
  const status = record.success ? "ok" : "failed";
  const repo = record.repo ?? "(no repo)";
  const args = record.args.map((arg) => JSON.stringify(arg)).join(" ");
  const error = record.error;
  const errorDetails =
    error === null
      ? ""
      : ` message=${JSON.stringify(error.message)} exit=${error.exitCode ?? "(unknown)"}`;

  return `[git:${record.kind}] ${record.label} ${status} ${record.durationMs}ms repo=${JSON.stringify(repo)} args=[${args}]${errorDetails}`;
}
