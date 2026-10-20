/**
 * The release gate that tolerates runner shortages (`.github/workflows/publish.yml`).
 *
 * GitHub-hosted runners are sometimes simply not there: a verify leg is queued,
 * GitHub gives up on it, and it ends `cancelled` with no runner and no steps.
 * That says nothing about the VSIX, so up to `max_not_run` such legs (default
 * 2) do not block a release, after one automatic retry each. A leg that did
 * run and did not succeed, a timeout included, always blocks it.
 *
 * Outcomes of a leg:
 * - passed: it ran and succeeded;
 * - failed: it ran (a runner id or any step) and did not succeed;
 * - not run: it never got a runner, or is still queued when the queue timeout
 *   (from its creation) expires;
 * - skipped: named in the manual `skip_legs` input, never scheduled.
 *
 * `evaluateGate` is pure: payloads in, outcomes and a decision out. `runGate`
 * loops it against an injected API. The CLI wires both to GitHub:
 *
 *   node scripts/release-verify-gate.mjs plan   # applies skip_legs, writes outputs
 *   node scripts/release-verify-gate.mjs gate   # polls, retries, decides
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MAX_NOT_RUN = 2;
export const DEFAULT_QUEUE_TIMEOUT_MINUTES = 30;
export const DEFAULT_POLL_SECONDS = 30;
const VERIFY_WORKFLOW = "verify-vsix.yml";
const MINUTE_MS = 60_000;
const QUEUED_STATUSES = new Set(["queued", "waiting", "pending", "requested"]);

/** The job names a leg can appear under: `<caller job> / <leg>` or just `<leg>` in a retry run. */
function jobIsLeg(job, leg) {
  return job.name === leg || job.name.endsWith(` / ${leg}`);
}

function didRun(job) {
  return (job.runner_id ?? 0) !== 0 || (job.steps ?? []).length > 0;
}

/**
 * What the jobs API says about one leg's job, or about the lack of it.
 * `job` is undefined while the job is not listed yet; `since` is when to start
 * counting the queue timeout then.
 */
export function classifyJob(job, { now, since, queueTimeoutMinutes }) {
  const waited = now - (job === undefined ? since : Date.parse(job.created_at));
  const queueExpired = waited >= queueTimeoutMinutes * MINUTE_MS;
  if (job === undefined) return queueExpired ? "not-run" : "waiting";
  if (job.status === "completed") {
    if (job.conclusion === "success") return "passed";
    return didRun(job) ? "failed" : "not-run";
  }
  if (QUEUED_STATUSES.has(job.status)) return queueExpired ? "not-run" : "waiting";
  return "waiting";
}

function newestJob(jobs, leg) {
  return jobs.filter((job) => jobIsLeg(job, leg)).sort((a, b) => b.id - a.id)[0];
}

/** The outcome of a leg's retry, from its dispatch record and the jobs of the retry run. */
function classifyRetry(leg, retry, retryJobs, options) {
  if (retry.dispatchError !== undefined) return { outcome: "not-run", job: undefined };
  const job = newestJob(retryJobs ?? [], leg);
  const outcome = classifyJob(job, { ...options, since: retry.dispatchedAt });
  return { outcome, job };
}

function evaluateLeg(leg, input, options) {
  const job = newestJob(input.jobs, leg);
  const first = classifyJob(job, { ...options, since: input.startedAt });
  const row = { name: leg, outcome: first, job, retry: null, retryJob: undefined, retryRun: undefined };
  if (first !== "not-run") return row;
  const retry = input.retried?.[leg];
  if (retry === undefined) return { ...row, outcome: "retrying", needsRetry: true };
  const second = classifyRetry(leg, retry, input.retryJobs?.[leg], options);
  return {
    ...row,
    outcome: second.outcome,
    retry: { outcome: second.outcome, error: retry.dispatchError },
    retryJob: second.job,
    retryRun: retry.runUrl
  };
}

function describeDecision(rows, notRun, maxNotRun) {
  const failed = rows.filter((row) => row.outcome === "failed").map((row) => row.name);
  if (failed.length > 0) {
    return `${failed.length} leg(s) ran and failed: ${failed.join(", ")}. A leg that ran and failed always blocks the release.`;
  }
  if (notRun.length > maxNotRun) {
    return (
      `${notRun.length} legs never got a runner (${notRun.join(", ")}), more than the ${maxNotRun} allowed. ` +
      'Use "Re-run failed jobs" on this run once runners are available.'
    );
  }
  const waiting = rows.filter((row) => ["waiting", "retrying"].includes(row.outcome));
  if (waiting.length > 0) return `Waiting for ${waiting.map((row) => row.name).join(", ")}.`;
  if (notRun.length > 0) {
    return `Passed with ${notRun.length} leg(s) never run after a retry (${notRun.join(", ")}); ${maxNotRun} allowed.`;
  }
  return "Every leg passed.";
}

/**
 * Applies the rules to the jobs of this run (`filter=latest`) and of any retry
 * runs.
 *
 * input: `legs` (expected names), `skipped` (names, informational), `jobs`,
 * `retried` (leg -> `{dispatchedAt, dispatchError?, runUrl?}`), `retryJobs`
 * (leg -> jobs of its retry run), `startedAt` (ms; when the gate began).
 * options: `now` (ms), `queueTimeoutMinutes`, `maxNotRun`.
 *
 * Returns `{rows, state, retryRequested, notRun, message}`: `state` is "pass",
 * "fail" or "wait"; `retryRequested` lists the legs to dispatch now.
 */
export function evaluateGate(input, options) {
  const settings = {
    now: options.now,
    queueTimeoutMinutes: options.queueTimeoutMinutes ?? DEFAULT_QUEUE_TIMEOUT_MINUTES
  };
  const maxNotRun = options.maxNotRun ?? DEFAULT_MAX_NOT_RUN;
  const rows = input.legs.map((leg) => evaluateLeg(leg, input, settings));
  const notRun = rows.filter((row) => row.outcome === "not-run").map((row) => row.name);
  const retryRequested = rows.filter((row) => row.needsRetry).map((row) => row.name);
  const failed = rows.some((row) => row.outcome === "failed");
  const pending = rows.some((row) => ["waiting", "retrying"].includes(row.outcome));
  let state = "pass";
  if (failed || notRun.length > maxNotRun) state = "fail";
  else if (pending) state = "wait";
  return { rows, state, retryRequested, notRun, message: describeDecision(rows, notRun, maxNotRun) };
}

function splitNames(text) {
  return (text ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/** Removes the `skip_legs` names from the leg list; a name that is not a leg is an error. */
export function planLegs(allLegs, skipText) {
  const known = new Set(allLegs.map((leg) => leg.name));
  const skip = splitNames(skipText);
  const unknown = skip.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown leg name(s) in skip_legs: ${unknown.join(", ")}. Known legs: ${[...known].join(", ")}.`);
  }
  const skipped = new Set(skip);
  return {
    legs: allLegs.filter((leg) => !skipped.has(leg.name)),
    skipped: allLegs.filter((leg) => skipped.has(leg.name)).map((leg) => leg.name)
  };
}

/** A manual publish must name the tag it publishes. */
export function validateManualInputs({ event, tag, publish }) {
  if (event === "workflow_dispatch" && publish === "true" && (tag ?? "") === "") {
    throw new Error("publish is true but tag is empty: name the existing tag to publish, for example v1.9.0.");
  }
}

export function parseMaxNotRun(text) {
  if ((text ?? "").trim() === "") return DEFAULT_MAX_NOT_RUN;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) throw new Error(`max_not_run must be a whole number, got "${text}".`);
  return value;
}

const OUTCOME_LABELS = {
  passed: "passed",
  failed: "FAILED (ran, did not succeed)",
  "not-run": "not run (no runner)",
  waiting: "waiting",
  retrying: "retry pending",
  skipped: "skipped"
};

function link(label, url) {
  return url ? `[${label}](${url})` : "";
}

function retryCell(row) {
  if (row.retry === null) return "none";
  const detail = row.retry.error ? ` (${row.retry.error})` : "";
  return `${OUTCOME_LABELS[row.retry.outcome]}${detail}`;
}

/** The job summary: every leg, its outcome, its retry and the links. */
export function renderSummary(result, skipped, maxNotRun) {
  const lines = [
    "## Verify gate",
    "",
    `**${result.state === "pass" ? "Passed" : "Failed"}.** ${result.message}`,
    "",
    "| Leg | Outcome | Retry | Links |",
    "| --- | --- | --- | --- |"
  ];
  for (const row of result.rows) {
    const links = [link("job", row.job?.html_url), link("retry run", row.retryRun)].filter(Boolean).join(" ");
    lines.push(`| ${row.name} | ${OUTCOME_LABELS[row.outcome]} | ${retryCell(row)} | ${links} |`);
  }
  for (const name of skipped) lines.push(`| ${name} | ${OUTCOME_LABELS.skipped} | none | |`);
  lines.push("", `Not-run legs tolerated: ${maxNotRun}. Not run after retries: ${result.notRun.length}.`, "");
  return lines.join("\n");
}

/**
 * Polls, retries each not-run leg once, and returns the final evaluation.
 *
 * `api` supplies `listJobs(runId)`, `dispatchRetry(leg, token)` and
 * `findRetryRun(token)` (a `{id, html_url}` or undefined); `sleep(ms)` and
 * `clock()` are injected so tests need no real time.
 */
export async function runGate(config, api, { sleep, clock }) {
  const startedAt = clock();
  const retried = {};
  const retryRunIds = {};
  for (;;) {
    const jobs = await api.listJobs(config.runId);
    const retryJobs = {};
    for (const [leg, retry] of Object.entries(retried)) {
      if (retry.dispatchError !== undefined) continue;
      const run = retryRunIds[leg] ?? (await api.findRetryRun(retry.token));
      if (run === undefined) continue;
      retryRunIds[leg] = run;
      retry.runUrl = run.html_url;
      retryJobs[leg] = await api.listJobs(run.id);
    }
    const result = evaluateGate(
      { legs: config.legs, jobs, retried, retryJobs, startedAt },
      { now: clock(), queueTimeoutMinutes: config.queueTimeoutMinutes, maxNotRun: config.maxNotRun }
    );
    if (result.state === "fail") return result;
    for (const leg of result.retryRequested) {
      const token = `${config.runId}-${config.legs.indexOf(leg)}-${clock()}`;
      retried[leg] = { token, dispatchedAt: clock() };
      try {
        await api.dispatchRetry(leg, token);
      } catch (error) {
        retried[leg].dispatchError = `dispatch failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (result.state === "pass") return result;
    await sleep(config.pollSeconds * 1000);
  }
}

async function githubFetch(env, method, route, body) {
  const response = await fetch(`${env.GITHUB_API_URL ?? "https://api.github.com"}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${method} ${route} answered ${response.status}: ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

function githubApi(env, ctx) {
  const repo = `/repos/${env.GITHUB_REPOSITORY}`;
  return {
    async listJobs(runId) {
      const jobs = [];
      for (let page = 1; ; page++) {
        const data = await githubFetch(env, "GET", `${repo}/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`);
        jobs.push(...data.jobs);
        if (data.jobs.length < 100) return jobs;
      }
    },
    async dispatchRetry(leg, token) {
      const inputs = {
        legs: JSON.stringify(ctx.allLegs.filter((entry) => entry.name === leg)),
        artifact_run_id: String(env.GITHUB_RUN_ID),
        retry_token: token,
        checkout_ref: env.CHECKOUT_REF ?? ""
      };
      await githubFetch(env, "POST", `${repo}/actions/workflows/${VERIFY_WORKFLOW}/dispatches`, {
        ref: env.GITHUB_REF_NAME,
        inputs
      });
    },
    async findRetryRun(token) {
      const data = await githubFetch(
        env,
        "GET",
        `${repo}/actions/workflows/${VERIFY_WORKFLOW}/runs?event=workflow_dispatch&per_page=50`
      );
      return data.workflow_runs.find((run) => (run.display_title ?? run.name ?? "").includes(token));
    }
  };
}

function writeOutput(env, name, value) {
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
  else console.log(`${name}=${value}`);
}

function readLegFile(env) {
  return JSON.parse(readFileSync(env.LEGS_FILE ?? ".github/verify-vsix-legs.json", "utf8"));
}

function runPlan(env) {
  validateManualInputs({ event: env.GITHUB_EVENT_NAME, tag: env.TAG, publish: env.PUBLISH });
  parseMaxNotRun(env.MAX_NOT_RUN);
  const { legs, skipped } = planLegs(readLegFile(env), env.SKIP_LEGS);
  writeOutput(env, "legs", JSON.stringify(legs));
  writeOutput(env, "count", String(legs.length));
  writeOutput(env, "skipped", skipped.join(","));
  console.log(`Verifying ${legs.length} leg(s); skipped: ${skipped.join(", ") || "none"}.`);
}

async function runGateCli(env) {
  const allLegs = readLegFile(env);
  const legs = JSON.parse(env.LEGS).map((leg) => leg.name);
  const skipped = splitNames(env.SKIPPED);
  const maxNotRun = parseMaxNotRun(env.MAX_NOT_RUN);
  const config = {
    runId: env.GITHUB_RUN_ID,
    legs,
    maxNotRun,
    queueTimeoutMinutes: Number(env.VERIFY_QUEUE_TIMEOUT_MINUTES || DEFAULT_QUEUE_TIMEOUT_MINUTES),
    pollSeconds: Number(env.POLL_SECONDS || DEFAULT_POLL_SECONDS)
  };
  const result = await runGate(config, githubApi(env, { allLegs }), {
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    clock: () => Date.now()
  });
  const summary = renderSummary(result, skipped, maxNotRun);
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  if (result.state !== "pass") {
    console.error(`::error::${result.message}`);
    process.exitCode = 1;
  }
}

async function main(command, env) {
  if (command === "plan") return runPlan(env);
  if (command === "gate") return runGateCli(env);
  throw new Error(`Usage: release-verify-gate.mjs plan|gate (got "${command ?? ""}").`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2], process.env).catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
