import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createTabOpenReporter,
  TAB_FEATURE_DIFF,
  TAB_FEATURE_IDS,
  TAB_FEATURE_REFLOG
} from "@/telemetry/tabOpen";
import { INGEST_FEATURE_NAME_PATTERN } from "@/telemetry/viewFeatures";

/** Records what reached the reporter, in order. */
function createTelemetrySpy() {
  const sent: Array<{ feature: string; ok: boolean }> = [];
  return {
    sent,
    telemetry: {
      logFeature: (feature: string, ok: boolean) => sent.push({ feature, ok })
    }
  };
}

describe("tab-open reporting", () => {
  // The ingest rejects the whole batch when one id fails its pattern, losing
  // up to 25 unrelated events silently (see viewFeatures.ts).
  it("uses only feature ids the ingest accepts", () => {
    expect(TAB_FEATURE_IDS).toEqual([TAB_FEATURE_REFLOG, TAB_FEATURE_DIFF]);
    for (const feature of TAB_FEATURE_IDS) {
      expect(feature).toMatch(INGEST_FEATURE_NAME_PATTERN);
    }
  });

  it("reports the fixed id with the open's outcome, and nothing else", () => {
    const spy = createTelemetrySpy();
    const reportOpen = createTabOpenReporter(spy.telemetry, TAB_FEATURE_REFLOG);

    reportOpen(true);
    reportOpen(false);

    expect(spy.sent).toEqual([
      { feature: TAB_FEATURE_REFLOG, ok: true },
      { feature: TAB_FEATURE_REFLOG, ok: false }
    ]);
    for (const event of spy.sent) {
      expect(Object.keys(event)).toEqual(["feature", "ok"]);
    }
  });

  // telemetry.json is what `code --telemetry` shows for this extension; a
  // feature id sent but not declared there is an undisclosed collection.
  it("declares every new feature id in telemetry.json", () => {
    const declared = fs.readFileSync(path.resolve(__dirname, "../../../telemetry.json"), "utf8");
    for (const feature of [...TAB_FEATURE_IDS, "copyWorktreePath"]) {
      expect(declared).toContain(`'${feature}'`);
    }
  });

  it("is a no-op without a telemetry reporter", () => {
    const reportOpen = createTabOpenReporter(undefined, TAB_FEATURE_DIFF);

    expect(() => reportOpen(true)).not.toThrow();
    expect(() => reportOpen(false)).not.toThrow();
  });
});
