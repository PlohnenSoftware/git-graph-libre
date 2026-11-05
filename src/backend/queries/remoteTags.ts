import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitCommand } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

type RemoteTagsInput = {
  repo: string;
  gitPath: string;
  recordGitCommand?: GitCommandRecorder;
};

const execGit = promisify(execFile);

/** Separate, bounded processes keep network reads out of the graph's Git queue. */
export async function remoteTags(input: RemoteTagsInput): Promise<QueryResult<"remoteTags">> {
  try {
    const read = (label: string, args: string[]) =>
      runGitCommand(
        async () => {
          const { stdout } = await execGit(input.gitPath, args, {
            cwd: input.repo,
            timeout: 10_000,
            maxBuffer: 16 * 1024 * 1024,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: "0",
              GIT_ASKPASS: "",
              SSH_ASKPASS: "",
              GCM_INTERACTIVE: "Never"
            }
          });
          return stdout;
        },
        { label, args, repo: input.repo, record: input.recordGitCommand }
      );
    const [localOutput, remotesOutput] = await Promise.all([
      read("remoteTags.local", [
        "for-each-ref",
        "--format=%(objectname)%09%(refname)%09%(*objectname)",
        "refs/tags"
      ]),
      read("remoteTags.remotes", ["remote"])
    ]);
    const localTags = localOutput
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [objectHash, ref, peeledHash] = line.trim().split("\t");
        return { objectHash, ref, hash: peeledHash || objectHash };
      });
    const remotes =
      localTags.length === 0
        ? []
        : remotesOutput
            .trim()
            .split(/\r?\n/)
            .filter((remote) => remote === "origin");
    const results = await Promise.all(
      remotes.map(async (remote) => {
        try {
          const output = await read("remoteTags.remote", [
            "-c",
            "credential.interactive=false",
            "ls-remote",
            "--tags",
            "--refs",
            "--",
            remote
          ]);
          return new Set(output.trim().split(/\r?\n/));
        } catch {
          return null;
        }
      })
    );
    return {
      tags: Object.fromEntries(
        localTags.map(({ ref, hash, objectHash }) => [
          ref.slice("refs/tags/".length),
          {
            hash,
            remotes: remotes.filter((_, index) => results[index]?.has(`${objectHash}\t${ref}`))
          }
        ])
      ),
      unavailableRemotes: remotes.filter((_, index) => results[index] === null),
      error: null
    };
  } catch (error: unknown) {
    return {
      tags: {},
      unavailableRemotes: [],
      error: toGitQueryError(error, "Unable to load remote tags")
    };
  }
}
