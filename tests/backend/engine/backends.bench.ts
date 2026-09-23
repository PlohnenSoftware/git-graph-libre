import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { type SimpleGit, simpleGit } from "simple-git";

import { loadEngineAddon } from "@/backend/engine/addon";
import {
  createRepoReader,
  didEngineServeRead,
  type RepoReader,
  resetEngineServedRead
} from "@/backend/engine/index";

/**
 * Engine against `git` CLI, on the same reads, through the same seam.
 *
 * `createRepoReader` takes the backend preference as an argument, so both
 * sides here are the *extension's own* code path with one flag flipped —
 * not a hand-rolled approximation of what the extension does. Anything these
 * numbers show is what a user would feel.
 *
 *   pnpm run bench:backends
 *
 * The engine side needs a built addon (`pnpm run engine:build`); without one
 * the engine benches are not registered and the CLI numbers still stand on
 * their own. Point `GGL_BENCH_REPO` at a real repository to measure that
 * instead of the generated one — the synthetic fixture is comparable across
 * runs and machines, a real repository is representative of one workload.
 */

/** Commits in the generated fixture. `git fast-import` makes this cheap. */
const FIXTURE_COMMITS = Number(process.env.GGL_BENCH_COMMITS ?? 2000);
/** Branches and tags, so the ref scan has something to do. */
const FIXTURE_BRANCHES = 40;
const FIXTURE_TAGS = 120;

let repoPath: string;
let generated: string | null = null;
let git: SimpleGit;
let engine: RepoReader;
let cli: RepoReader;
let headHash: string;
let olderHash: string;

/**
 * A repository with a history worth measuring, built through `fast-import`
 * rather than a few thousand `git commit` invocations — seconds instead of
 * minutes, and the shape is identical every time so two runs are comparable.
 */
function generateRepository(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-bench-"));
  cp.execFileSync("git", ["init", "--quiet", "-b", "main", dir]);

  const stream: string[] = [];
  const mark = (n: number) => `:${n}`;
  for (let i = 1; i <= FIXTURE_COMMITS; i++) {
    const when = 1600000000 + i * 60;
    stream.push(
      `commit refs/heads/main`,
      `mark ${mark(i)}`,
      `author Bench <bench@example.invalid> ${when} +0000`,
      `committer Bench <bench@example.invalid> ${when} +0000`,
      `data <<EOM\ncommit ${i}\n\nA body line so commit bodies have something to read.\nEOM`,
      ...(i > 1 ? [`from ${mark(i - 1)}`] : []),
      `M 100644 inline file-${i % 50}.txt`,
      `data <<EOM\ncontents ${i}\nEOM`,
      ""
    );
  }
  // Branches and tags spread across the history, so a ref scan is not trivial.
  for (let b = 0; b < FIXTURE_BRANCHES; b++) {
    const at = Math.max(1, Math.floor((FIXTURE_COMMITS / FIXTURE_BRANCHES) * (b + 1)));
    stream.push(`reset refs/heads/branch-${b}`, `from ${mark(at)}`, "");
  }
  for (let t = 0; t < FIXTURE_TAGS; t++) {
    const at = Math.max(1, Math.floor((FIXTURE_COMMITS / FIXTURE_TAGS) * (t + 1)));
    stream.push(`reset refs/tags/v0.0.${t}`, `from ${mark(at)}`, "");
  }

  cp.execFileSync("git", ["fast-import", "--quiet"], { cwd: dir, input: stream.join("\n") });
  cp.execFileSync("git", ["reset", "--hard", "--quiet", "main"], { cwd: dir });
  // Packed, because an unpacked object store measures loose-object IO rather
  // than either backend.
  cp.execFileSync("git", ["gc", "--quiet", "--aggressive"], { cwd: dir });
  // A remote, because the fixture is otherwise unrepresentative in a way that
  // silently distorts the result: simple-git adds ~50 ms to any git command
  // that produces empty stdout, so a repository with no remotes makes
  // `git remote -v` — and therefore the whole CLI repo-info read — look 50 ms
  // slower than it is anywhere real.
  cp.execFileSync("git", ["remote", "add", "origin", "https://example.invalid/bench.git"], {
    cwd: dir
  });
  return dir;
}

/** Timed runs per operation, after an untimed warm-up. Odd, so the median is a real sample. */
const RUNS = Number(process.env.GGL_BENCH_RUNS ?? 11);

type Case = { name: string; run: (reader: RepoReader) => Promise<unknown> };

function setUp(): void {
  const provided = process.env.GGL_BENCH_REPO;
  if (provided !== undefined && provided !== "") {
    repoPath = fs.realpathSync(provided);
  } else {
    generated = generateRepository();
    repoPath = generated;
  }
  git = simpleGit({ baseDir: repoPath, binary: "git" });
  engine = createRepoReader({ preference: "auto", gitPath: "git" });
  cli = createRepoReader({ preference: "git-cli", gitPath: "git" });

  const log = cp
    .execFileSync("git", ["log", "--format=%H", "-n", "40"], { cwd: repoPath, encoding: "utf8" })
    .trim()
    .split("\n");
  headHash = log[0] ?? "";
  olderHash = log[log.length - 1] ?? headHash;
}

/** The arguments every `loadCommits` case shares, so both sides ask the same question. */
function commitsArgs(maxCommits: number) {
  return {
    repoPath,
    git,
    hard: false,
    maxCommits,
    // The show-all load: no branch filter, which is what opening the graph
    // does and the shape the engine is allowed to serve.
    branchName: "",
    dateType: "Commit Date" as const,
    showUncommittedChanges: true,
    showRemoteBranches: true,
    showTags: true
  };
}

const CASES: Case[] = [
  {
    name: "view load (repo info + first page)",
    run: async (reader) => {
      await reader.loadRepoInfo({ repoPath, showStashes: true, git });
      return reader.loadCommits(commitsArgs(300));
    }
  },
  {
    name: "loadRepoInfo",
    run: (reader) => reader.loadRepoInfo({ repoPath, showStashes: true, git })
  },
  { name: "loadCommits (300)", run: (reader) => reader.loadCommits(commitsArgs(300)) },
  { name: "loadCommits (1000)", run: (reader) => reader.loadCommits(commitsArgs(1000)) },
  {
    name: "commit details",
    run: (reader) =>
      reader.loadCommitDetails({ repoPath, git, commitHash: headHash, dateType: "Commit Date" })
  },
  {
    name: "commit comparison (40 apart)",
    run: (reader) =>
      reader.loadCommitComparison({
        repoPath,
        git,
        commitHash: headHash,
        baseRef: olderHash,
        compareRef: headHash,
        dateType: "Commit Date"
      })
  },
  { name: "remote url", run: (reader) => reader.getRemoteUrl(repoPath) }
];

async function median(run: () => Promise<unknown>): Promise<number> {
  await run(); // warm-up, untimed: the first call opens the repository handle
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const started = performance.now();
    await run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return samples[(samples.length - 1) >> 1] ?? Number.NaN;
}

function pad(text: string, width: number, right = false): string {
  return right ? text.padStart(width) : text.padEnd(width);
}

async function main(): Promise<void> {
  setUp();
  const engineAvailable = loadEngineAddon() !== null;

  console.log(`repository   ${repoPath}`);
  console.log(
    `commits      ${cp.execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: repoPath, encoding: "utf8" }).trim()}`
  );
  console.log(`runs         ${RUNS} timed, median reported, after one untimed warm-up`);
  console.log(
    `engine       ${engineAvailable ? "available" : "NOT BUILT — run pnpm run engine:build"}`
  );
  console.log("");
  console.log(
    `${pad("operation", 36)}${pad("git CLI", 12, true)}${pad("engine", 12, true)}${pad("verdict", 14, true)}`
  );
  console.log("-".repeat(74));

  let anyFellBack = false;
  for (const testCase of CASES) {
    const cliMs = await median(() => testCase.run(cli));
    if (!engineAvailable) {
      console.log(
        `${pad(testCase.name, 36)}${pad(`${cliMs.toFixed(1)} ms`, 12, true)}${pad("—", 12, true)}${pad("—", 12, true)}`
      );
      continue;
    }
    // Whether the engine *actually served* the read, rather than declining
    // into the CLI. Without this a fallback reads as a 1.0x speedup — the
    // engine and the CLI being equally fast because they are the same code.
    resetEngineServedRead();
    await testCase.run(engine);
    const served = didEngineServeRead();
    if (!served) anyFellBack = true;

    const engineMs = await median(() => testCase.run(engine));
    const speedup = engineMs > 0 ? cliMs / engineMs : Number.NaN;
    const verdict = served ? `${speedup.toFixed(1)}x` : "CLI fallback";
    console.log(
      `${pad(testCase.name, 36)}${pad(`${cliMs.toFixed(1)} ms`, 12, true)}${pad(`${engineMs.toFixed(1)} ms`, 12, true)}${pad(verdict, 14, true)}`
    );
  }

  if (anyFellBack) {
    console.log("");
    console.log("Rows marked `CLI fallback` are the engine declining the read and the CLI");
    console.log("answering it, so both columns time the same code. That is a correct");
    console.log("outcome for a declined shape — see the non-goals in Phase 16 — but it is");
    console.log("not a measurement of the engine.");
  }

  if (generated !== null) fs.rmSync(generated, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
