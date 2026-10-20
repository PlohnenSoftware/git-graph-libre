/** Types for `release-verify-gate.mjs`, so the TypeScript test suite can import it. */

export type GateJob = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  runner_id: number | null;
  created_at: string;
  html_url?: string;
  steps?: readonly unknown[];
};

export type LegOutcome = "passed" | "failed" | "not-run" | "waiting" | "retrying";

export type RetryRecord = { dispatchedAt: number; dispatchError?: string; runUrl?: string; token?: string };

export type GateInput = {
  legs: readonly string[];
  jobs: readonly GateJob[];
  retried?: Readonly<Record<string, RetryRecord>>;
  retryJobs?: Readonly<Record<string, readonly GateJob[]>>;
  startedAt?: number;
};

export type GateOptions = { now: number; queueTimeoutMinutes?: number; maxNotRun?: number };

export type GateRow = {
  name: string;
  outcome: LegOutcome;
  job: GateJob | undefined;
  retry: { outcome: LegOutcome; error?: string } | null;
  retryJob: GateJob | undefined;
  retryRun: string | undefined;
  needsRetry?: boolean;
};

export type GateResult = {
  rows: GateRow[];
  state: "pass" | "fail" | "wait";
  retryRequested: string[];
  notRun: string[];
  message: string;
};

export type GateApi = {
  listJobs(runId: string | number): Promise<GateJob[]>;
  dispatchRetry(leg: string, token: string): Promise<void>;
  findRetryRun(token: string): Promise<{ id: number; html_url?: string } | undefined>;
};

export type GateConfig = {
  runId: string | number;
  legs: readonly string[];
  maxNotRun: number;
  queueTimeoutMinutes: number;
  pollSeconds: number;
};

export declare const DEFAULT_MAX_NOT_RUN: number;
export declare const DEFAULT_QUEUE_TIMEOUT_MINUTES: number;

export declare function classifyJob(
  job: GateJob | undefined,
  options: { now: number; since?: number; queueTimeoutMinutes: number }
): LegOutcome;
export declare function evaluateGate(input: GateInput, options: GateOptions): GateResult;
export declare function planLegs<T extends { name: string }>(
  allLegs: readonly T[],
  skipText: string | undefined
): { legs: T[]; skipped: string[] };
export declare function validateManualInputs(inputs: { event?: string; tag?: string; publish?: string }): void;
export declare function parseMaxNotRun(text: string | undefined): number;
export declare function renderSummary(result: GateResult, skipped: readonly string[], maxNotRun: number): string;
export declare function runGate(
  config: GateConfig,
  api: GateApi,
  clockwork: { sleep(ms: number): Promise<void>; clock(): number }
): Promise<GateResult>;
