import { describe, expect, it } from "vitest";

import { TELEMETRY_ENDPOINT } from "@/telemetry/endpoint";

describe("telemetry endpoint", () => {
  it("ships a configured ingest URL", () => {
    // An empty endpoint makes the reporter a total no-op. That was the correct
    // state before the ingest existed; shipping it now would silently collect
    // nothing.
    expect(TELEMETRY_ENDPOINT).not.toBe("");
  });

  it("targets the ingest route over TLS", () => {
    const url = new URL(TELEMETRY_ENDPOINT);

    // Plain HTTP would put usage data on the wire in clear text, and a wrong
    // path is an invisible failure: the ingest answers anything else with a
    // redirect or a 404, and the queue swallows the error without retrying.
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/v1/events");
  });
});
