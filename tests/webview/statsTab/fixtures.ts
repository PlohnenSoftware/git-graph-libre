import type {
  StatsDataMessage,
  StatsLabels,
  StatsLoadingMessage,
  StatsLoadResult
} from "@/statsTabTypes";

/** Shared statistics fixtures for the tab's test files. */
export const LABELS: StatsLabels = {
  title: "Statistics: {0}",
  loading: "Loading statistics…",
  empty: "No commits yet (empty wording).",
  refresh: "Refresh",
  contributors: "Contributors",
  activity: "Commits by weekday and hour",
  activityNote: "In each author's local time; merge commits are not counted.",
  less: "Less",
  more: "More",
  cellNone: "{0} at {1}:00: no commits",
  cellOne: "{0} at {1}:00: 1 commit",
  cellMany: "{0} at {1}:00: {2} commits",
  unavailable: "Statistics are unavailable.",
  unavailableReasons: {
    noAddon: "Statistics need the Rust engine, which is not available.",
    backendCli:
      "Statistics need the Rust engine, but the backend setting uses the Git command line.",
    notVerified: "Git has not confirmed this repository, so the Rust engine cannot read it.",
    failed: "The Rust engine could not read this repository's statistics."
  },
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

export function okResult(
  overrides: Partial<Extract<StatsLoadResult, { state: "ok" }>> = {}
): StatsLoadResult {
  return {
    state: "ok",
    authors: [
      { name: "Ada", email: "ada@example.test", commits: 3 },
      { name: "Lin", email: "lin@example.test", commits: 1 }
    ],
    cells: [
      { weekday: 1, hour: 9, count: 4 },
      { weekday: 1, hour: 10, count: 1 },
      { weekday: 6, hour: 23, count: 2 }
    ],
    ...overrides
  };
}

export function loadingMessage(overrides: Partial<StatsLoadingMessage> = {}): StatsLoadingMessage {
  return {
    command: "statsLoading",
    requestId: 1,
    repo: "/repos/one",
    locale: "en",
    labels: LABELS,
    ...overrides
  };
}

export function dataMessage(overrides: Partial<StatsDataMessage> = {}): StatsDataMessage {
  return {
    command: "statsData",
    requestId: 1,
    repo: "/repos/one",
    locale: "en",
    labels: LABELS,
    result: okResult(),
    ...overrides
  };
}
