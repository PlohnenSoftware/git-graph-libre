import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateGate,
  type GateApi,
  type GateJob,
  githubApi,
  parseMaxNotRun,
  planLegs,
  renderSummary,
  runGate,
  validateManualInputs
} from "../../scripts/release-verify-gate.mjs";

/**
 * The release gate (`.github/workflows/publish.yml`): which verify legs ran,
 * which never got a runner, and whether the release may publish. Payloads are
 * shaped like the jobs API's, including the real `cancelled`, runner 0, no
 * steps answer of the `v1.9.0` run `39461675485`.
 */

const NOW = Date.parse("2026-10-20T18:00:00Z");
const MINUTE = 60_000;
const PREFIX = "Verify the VSIX on every platform / ";
const LEGS = ["Linux x64 (glibc)", "macOS arm64", "Windows x64", "Windows arm64"];
const OPTIONS = { now: NOW, queueTimeoutMinutes: 30, maxNotRun: 2 };

let nextId = 1000;

type JobSpec = Partial<GateJob> & { ranFor?: boolean };

function job(leg: string, spec: JobSpec = {}): GateJob {
  const { ranFor = true, ...rest } = spec;
  return {
    id: nextId++,
    name: `${PREFIX}${leg}`,
    status: "completed",
    conclusion: "success",
    runner_id: ranFor ? 1_000_002_401 : 0,
    created_at: new Date(NOW - 20 * MINUTE).toISOString(),
    html_url: `https://example.test/job/${nextId}`,
    steps: ranFor ? [{ name: "Set up job" }] : [],
    ...rest
  };
}

const passed = (leg: string): GateJob => job(leg);
const failed = (leg: string): GateJob => job(leg, { conclusion: "failure" });
const timedOut = (leg: string): GateJob =>
  job(leg, { conclusion: "cancelled", steps: [{ name: "Run" }] });
const noRunner = (leg: string): GateJob => job(leg, { conclusion: "cancelled", ranFor: false });
const queued = (leg: string, minutesAgo: number): GateJob =>
  job(leg, {
    status: "queued",
    conclusion: null,
    ranFor: false,
    created_at: new Date(NOW - minutesAgo * MINUTE).toISOString()
  });
const retryJob = (leg: string, spec: JobSpec = {}): GateJob => ({ ...job(leg, spec), name: leg });

function rowOutcomes(result: ReturnType<typeof evaluateGate>): Record<string, string> {
  return Object.fromEntries(result.rows.map((row) => [row.name, row.outcome]));
}

describe("evaluateGate", () => {
  it("passes when every leg passed", () => {
    const result = evaluateGate({ legs: LEGS, jobs: LEGS.map(passed) }, OPTIONS);
    expect(result.state).toBe("pass");
    expect(result.retryRequested).toEqual([]);
    expect(result.message).toBe("Every leg passed.");
  });

  it("fails at once when a leg ran and failed, whatever else is queued", () => {
    const jobs = [failed(LEGS[0]), queued(LEGS[1], 2), noRunner(LEGS[2]), passed(LEGS[3])];
    const result = evaluateGate({ legs: LEGS, jobs }, OPTIONS);
    expect(result.state).toBe("fail");
    expect(rowOutcomes(result)[LEGS[0]]).toBe("failed");
    expect(result.message).toContain(LEGS[0]);
  });

  it("counts a leg that ran past its timeout as failed, not as not run", () => {
    const jobs = [timedOut(LEGS[0]), passed(LEGS[1]), passed(LEGS[2]), passed(LEGS[3])];
    const result = evaluateGate({ legs: LEGS, jobs }, OPTIONS);
    expect(result.state).toBe("fail");
    expect(rowOutcomes(result)[LEGS[0]]).toBe("failed");
    expect(result.retryRequested).toEqual([]);
  });

  it("treats a leg that has steps but no runner id as having run", () => {
    const odd = job(LEGS[0], {
      conclusion: "failure",
      runner_id: 0,
      steps: [{ name: "Set up job" }]
    });
    const result = evaluateGate({ legs: [LEGS[0]], jobs: [odd] }, OPTIONS);
    expect(rowOutcomes(result)[LEGS[0]]).toBe("failed");
  });

  it("asks for one retry per leg that never got a runner, and waits", () => {
    const jobs = [passed(LEGS[0]), noRunner(LEGS[1]), noRunner(LEGS[2]), passed(LEGS[3])];
    const result = evaluateGate({ legs: LEGS, jobs }, OPTIONS);
    expect(result.state).toBe("wait");
    expect(result.retryRequested).toEqual([LEGS[1], LEGS[2]]);
    expect(rowOutcomes(result)[LEGS[1]]).toBe("retrying");
  });

  it("does not ask twice: a dispatched retry that is not listed yet is waited for", () => {
    const jobs = [passed(LEGS[0]), noRunner(LEGS[1]), passed(LEGS[2]), passed(LEGS[3])];
    const retried = { [LEGS[1]]: { dispatchedAt: NOW - MINUTE } };
    const result = evaluateGate({ legs: LEGS, jobs, retried }, OPTIONS);
    expect(result.retryRequested).toEqual([]);
    expect(result.state).toBe("wait");
  });

  it("passes when the retries pass", () => {
    const jobs = [passed(LEGS[0]), noRunner(LEGS[1]), noRunner(LEGS[2]), passed(LEGS[3])];
    const retried = {
      [LEGS[1]]: { dispatchedAt: NOW - MINUTE },
      [LEGS[2]]: { dispatchedAt: NOW - MINUTE }
    };
    const retryJobs = { [LEGS[1]]: [retryJob(LEGS[1])], [LEGS[2]]: [retryJob(LEGS[2])] };
    const result = evaluateGate({ legs: LEGS, jobs, retried, retryJobs }, OPTIONS);
    expect(result.state).toBe("pass");
    expect(rowOutcomes(result)[LEGS[1]]).toBe("passed");
    expect(result.rows[1].retry?.outcome).toBe("passed");
  });

  it("passes with two legs that again get no runner, and says so", () => {
    const jobs = [passed(LEGS[0]), noRunner(LEGS[1]), noRunner(LEGS[2]), passed(LEGS[3])];
    const retried = {
      [LEGS[1]]: { dispatchedAt: NOW - MINUTE },
      [LEGS[2]]: { dispatchedAt: NOW - MINUTE }
    };
    const retryJobs = {
      [LEGS[1]]: [retryJob(LEGS[1], { conclusion: "cancelled", ranFor: false })],
      [LEGS[2]]: [retryJob(LEGS[2], { conclusion: "cancelled", ranFor: false })]
    };
    const result = evaluateGate({ legs: LEGS, jobs, retried, retryJobs }, OPTIONS);
    expect(result.state).toBe("pass");
    expect(result.notRun).toEqual([LEGS[1], LEGS[2]]);
    expect(result.message).toContain("2 allowed");
  });

  it("fails with the re-run message when three legs are still not run after retries", () => {
    const jobs = [noRunner(LEGS[0]), noRunner(LEGS[1]), noRunner(LEGS[2]), passed(LEGS[3])];
    const retried = Object.fromEntries(
      LEGS.slice(0, 3).map((leg) => [leg, { dispatchedAt: NOW - MINUTE }])
    );
    const retryJobs = Object.fromEntries(
      LEGS.slice(0, 3).map((leg) => [
        leg,
        [retryJob(leg, { conclusion: "cancelled", ranFor: false })]
      ])
    );
    const result = evaluateGate({ legs: LEGS, jobs, retried, retryJobs }, OPTIONS);
    expect(result.state).toBe("fail");
    expect(result.message).toContain("Re-run failed jobs");
    expect(result.message).toContain("more than the 2 allowed");
  });

  it("honors a different max_not_run", () => {
    const jobs = [noRunner(LEGS[0]), passed(LEGS[1]), passed(LEGS[2]), passed(LEGS[3])];
    const retried = { [LEGS[0]]: { dispatchedAt: NOW - MINUTE } };
    const retryJobs = {
      [LEGS[0]]: [retryJob(LEGS[0], { conclusion: "cancelled", ranFor: false })]
    };
    const input = { legs: LEGS, jobs, retried, retryJobs };
    expect(evaluateGate(input, { ...OPTIONS, maxNotRun: 0 }).state).toBe("fail");
    expect(evaluateGate(input, { ...OPTIONS, maxNotRun: 1 }).state).toBe("pass");
  });

  it("waits for a leg queued less than the timeout and calls it not run after it", () => {
    const early = evaluateGate({ legs: [LEGS[0]], jobs: [queued(LEGS[0], 29)] }, OPTIONS);
    expect(early.state).toBe("wait");
    expect(early.retryRequested).toEqual([]);
    const late = evaluateGate({ legs: [LEGS[0]], jobs: [queued(LEGS[0], 31)] }, OPTIONS);
    expect(late.retryRequested).toEqual([LEGS[0]]);
  });

  it("measures the queue timeout from the leg's creation, with a configurable limit", () => {
    const result = evaluateGate(
      { legs: [LEGS[0]], jobs: [queued(LEGS[0], 6)] },
      { ...OPTIONS, queueTimeoutMinutes: 5 }
    );
    expect(result.retryRequested).toEqual([LEGS[0]]);
  });

  it("waits for a leg that is not listed yet, then calls it not run after the timeout", () => {
    const base = { legs: [LEGS[0]], jobs: [] };
    const early = evaluateGate({ ...base, startedAt: NOW - 5 * MINUTE }, OPTIONS);
    expect(early.state).toBe("wait");
    const late = evaluateGate({ ...base, startedAt: NOW - 31 * MINUTE }, OPTIONS);
    expect(late.retryRequested).toEqual([LEGS[0]]);
  });

  it("waits for a leg that is running", () => {
    const running = job(LEGS[0], { status: "in_progress", conclusion: null });
    expect(evaluateGate({ legs: [LEGS[0]], jobs: [running] }, OPTIONS).state).toBe("wait");
  });

  it("does not count legs that were skipped: only planned legs are expected", () => {
    const { legs, skipped } = planLegs(
      LEGS.map((name) => ({ name })),
      `${LEGS[1]}, ${LEGS[2]}`
    );
    const names = legs.map((leg) => leg.name);
    expect(names).toEqual([LEGS[0], LEGS[3]]);
    const jobs = [passed(LEGS[0]), passed(LEGS[3])];
    const result = evaluateGate({ legs: names, jobs }, OPTIONS);
    expect(result.state).toBe("pass");
    expect(result.rows).toHaveLength(2);
    expect(renderSummary(result, skipped, 2)).toContain(`| ${LEGS[1]} | skipped |`);
  });

  it("fails when a retry runs and fails, even though the first attempt only lacked a runner", () => {
    const jobs = [passed(LEGS[0]), noRunner(LEGS[1])];
    const retried = { [LEGS[1]]: { dispatchedAt: NOW - MINUTE } };
    const retryJobs = { [LEGS[1]]: [retryJob(LEGS[1], { conclusion: "failure" })] };
    const result = evaluateGate({ legs: [LEGS[0], LEGS[1]], jobs, retried, retryJobs }, OPTIONS);
    expect(result.state).toBe("fail");
    expect(rowOutcomes(result)[LEGS[1]]).toBe("failed");
  });

  it("calls a retry that is never listed not run once its own queue timeout passes", () => {
    const jobs = [noRunner(LEGS[0])];
    const retried = { [LEGS[0]]: { dispatchedAt: NOW - 31 * MINUTE } };
    const result = evaluateGate({ legs: [LEGS[0]], jobs, retried }, OPTIONS);
    expect(result.state).toBe("pass");
    expect(result.notRun).toEqual([LEGS[0]]);
  });

  it("leaves a leg not run when its retry could not be dispatched", () => {
    const retried = { [LEGS[0]]: { dispatchedAt: NOW, dispatchError: "dispatch failed: 403" } };
    const result = evaluateGate({ legs: [LEGS[0]], jobs: [noRunner(LEGS[0])], retried }, OPTIONS);
    expect(result.notRun).toEqual([LEGS[0]]);
    expect(renderSummary(result, [], 2)).toContain("dispatch failed: 403");
  });

  it("reads the latest attempt: a re-run job replaces the cancelled one of the same name", () => {
    const old = noRunner(LEGS[0]);
    const rerun = passed(LEGS[0]);
    const result = evaluateGate({ legs: [LEGS[0]], jobs: [old, rerun] }, OPTIONS);
    expect(result.state).toBe("pass");
    const reversed = evaluateGate({ legs: [LEGS[0]], jobs: [rerun, old] }, OPTIONS);
    expect(reversed.state).toBe("pass");
  });

  it("ignores jobs that are not legs, such as the package and the release", () => {
    const others = [
      { ...passed("x"), name: "Package universal VSIX" },
      { ...passed("x"), name: "Release and publish", conclusion: "skipped" }
    ];
    const result = evaluateGate({ legs: [LEGS[0]], jobs: [...others, passed(LEGS[0])] }, OPTIONS);
    expect(result.state).toBe("pass");
  });

  it("reads the real shape of the stalled v1.9.0 run: macOS arm64 cancelled, runner 0, no steps", () => {
    const stalled = {
      id: 118776886717,
      name: `${PREFIX}macOS arm64`,
      status: "completed",
      conclusion: "cancelled",
      runner_id: 0,
      created_at: "2026-10-20T17:24:46Z",
      steps: []
    };
    const result = evaluateGate({ legs: ["macOS arm64"], jobs: [stalled] }, OPTIONS);
    expect(result.retryRequested).toEqual(["macOS arm64"]);
  });
});

describe("planLegs and the manual inputs", () => {
  const all = LEGS.map((name) => ({ name, runner: "x" }));

  it("keeps every leg when nothing is skipped", () => {
    expect(planLegs(all, "").legs).toEqual(all);
    expect(planLegs(all, undefined).skipped).toEqual([]);
  });

  it("trims names and ignores empty entries", () => {
    expect(planLegs(all, ` ${LEGS[0]} ,, `).skipped).toEqual([LEGS[0]]);
  });

  it("rejects an unknown leg name and lists the known ones", () => {
    expect(() => planLegs(all, "macOS arm65")).toThrow(
      /Unknown leg name\(s\) in skip_legs: macOS arm65/
    );
    expect(() => planLegs(all, "macOS arm65")).toThrow(/Known legs: Linux x64 \(glibc\)/);
  });

  it("requires a tag for a manual publish only", () => {
    expect(() =>
      validateManualInputs({ event: "workflow_dispatch", tag: "", publish: "true" })
    ).toThrow(/tag is empty/);
    expect(() =>
      validateManualInputs({ event: "workflow_dispatch", tag: "v1.9.0", publish: "true" })
    ).not.toThrow();
    expect(() =>
      validateManualInputs({ event: "workflow_dispatch", tag: "", publish: "false" })
    ).not.toThrow();
    expect(() => validateManualInputs({ event: "push", tag: "", publish: "" })).not.toThrow();
  });

  it("parses max_not_run, defaulting to 2 and rejecting nonsense", () => {
    expect(parseMaxNotRun("")).toBe(2);
    expect(parseMaxNotRun(undefined)).toBe(2);
    expect(parseMaxNotRun("0")).toBe(0);
    expect(parseMaxNotRun("3")).toBe(3);
    expect(() => parseMaxNotRun("-1")).toThrow(/whole number/);
    expect(() => parseMaxNotRun("two")).toThrow(/whole number/);
  });

  it("the shipped leg list names ten distinct legs with the keys the workflow reads", () => {
    const file = path.resolve(__dirname, "../../.github/verify-vsix-legs.json");
    const legs = JSON.parse(fs.readFileSync(file, "utf8")) as {
      name: string;
      runner: string;
      args: string;
    }[];
    expect(legs).toHaveLength(10);
    expect(new Set(legs.map((leg) => leg.name)).size).toBe(10);
    for (const leg of legs) {
      expect(typeof leg.runner).toBe("string");
      expect(typeof leg.args).toBe("string");
    }
  });
});

describe("runGate", () => {
  type Fake = {
    api: GateApi;
    dispatched: string[];
    clock: () => number;
    sleep: () => Promise<void>;
  };

  /** A fake GitHub: `script(step)` gives the jobs of the main run and of the retry run at each poll. */
  function fake(
    script: (step: number) => { main: GateJob[]; retry?: Record<string, GateJob[]> }
  ): Fake {
    let step = 0;
    let time = NOW;
    const dispatched: string[] = [];
    const tokens = new Map<string, string>();
    const api: GateApi = {
      async listJobs(runId) {
        const view = script(step);
        if (String(runId) === "run") return view.main;
        return view.retry?.[String(runId)] ?? [];
      },
      async dispatchRetry(leg, token) {
        dispatched.push(leg);
        tokens.set(token, leg);
      },
      async findRetryRun(token) {
        const leg = tokens.get(token);
        return leg === undefined
          ? undefined
          : { id: leg as unknown as number, html_url: `https://example.test/run/${leg}` };
      }
    };
    return {
      api,
      dispatched,
      clock: () => time,
      sleep: async () => {
        step++;
        time += 30_000;
      }
    };
  }

  const config = {
    runId: "run",
    legs: LEGS,
    maxNotRun: 2,
    queueTimeoutMinutes: 30,
    pollSeconds: 30
  };

  it("dispatches one retry for a leg with no runner, then passes when it passes", async () => {
    const world = fake((step) => ({
      main: [passed(LEGS[0]), noRunner(LEGS[1]), passed(LEGS[2]), passed(LEGS[3])],
      retry: step >= 1 ? { [LEGS[1]]: [retryJob(LEGS[1])] } : {}
    }));
    const result = await runGate(config, world.api, world);
    expect(world.dispatched).toEqual([LEGS[1]]);
    expect(result.state).toBe("pass");
    expect(rowOutcomes(result)[LEGS[1]]).toBe("passed");
  });

  it("never dispatches a retry for a leg that ran and failed, and stops at once", async () => {
    const world = fake(() => ({
      main: [failed(LEGS[0]), noRunner(LEGS[1]), passed(LEGS[2]), passed(LEGS[3])]
    }));
    const result = await runGate(config, world.api, world);
    expect(world.dispatched).toEqual([]);
    expect(result.state).toBe("fail");
  });

  it("retries each not-run leg only once even when the retry gets no runner either", async () => {
    const dead = (leg: string): GateJob =>
      retryJob(leg, { conclusion: "cancelled", ranFor: false });
    const world = fake(() => ({
      main: [passed(LEGS[0]), noRunner(LEGS[1]), noRunner(LEGS[2]), passed(LEGS[3])],
      retry: { [LEGS[1]]: [dead(LEGS[1])], [LEGS[2]]: [dead(LEGS[2])] }
    }));
    const result = await runGate(config, world.api, world);
    expect(world.dispatched).toEqual([LEGS[1], LEGS[2]]);
    expect(result.state).toBe("pass");
    expect(result.notRun).toEqual([LEGS[1], LEGS[2]]);
  });

  it("records a failed dispatch as a leg that stays not run", async () => {
    const world = fake(() => ({ main: [noRunner(LEGS[0])] }));
    world.api.dispatchRetry = async () => {
      throw new Error("403");
    };
    const result = await runGate({ ...config, legs: [LEGS[0]] }, world.api, world);
    expect(result.state).toBe("pass");
    expect(result.rows[0].retry?.error).toContain("403");
  });

  it("dispatches two simultaneous retries and records only the failed one", async () => {
    const world = fake(() => ({
      main: [noRunner(LEGS[0]), noRunner(LEGS[1]), passed(LEGS[2])],
      retry: { [LEGS[0]]: [retryJob(LEGS[0])] }
    }));
    const dispatchRetry = world.api.dispatchRetry.bind(world.api);
    world.api.dispatchRetry = async (leg, token) => {
      await dispatchRetry(leg, token);
      if (leg === LEGS[1]) throw new Error("403");
    };
    const result = await runGate({ ...config, legs: LEGS.slice(0, 3) }, world.api, world);
    expect(world.dispatched).toEqual([LEGS[0], LEGS[1]]);
    expect(result.rows[0].retry?.error).toBeUndefined();
    expect(result.rows[1].retry?.error).toContain("403");
    expect(result.notRun).toEqual([LEGS[1]]);
  });
});

describe("githubApi listJobs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads page 1, then the remaining pages together, using total_count", async () => {
    const pages = [1, 2].map((page) =>
      Array.from({ length: page === 1 ? 100 : 5 }, (_, index) => ({ id: page * 1000 + index }))
    );
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      requested.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      return new Response(JSON.stringify({ total_count: 105, jobs: pages[page - 1] }), {
        status: 200
      });
    });
    const api = githubApi({ GITHUB_REPOSITORY: "o/r", GH_TOKEN: "t" }, { allLegs: [] });
    const jobs = await api.listJobs("run");
    expect(jobs.map((entry) => entry.id)).toEqual(pages.flat().map((entry) => entry.id));
    expect(requested.map((url) => new URL(url).searchParams.get("page"))).toEqual(["1", "2"]);
  });
});
