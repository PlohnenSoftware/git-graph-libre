import { describe, expect, it } from "vitest";

import {
  buildAdditionalCommonProperties,
  reducePlatformVersion
} from "@/telemetry/commonProperties";

describe("reducePlatformVersion", () => {
  // The suffix is the identifying part of a release string and is useless for
  // ranking features, so it must never reach the wire.
  it("drops a distribution build suffix", () => {
    expect(reducePlatformVersion("7.2.2-1-cachyos")).toBe("7.2.2");
    expect(reducePlatformVersion("5.15.0-generic")).toBe("5.15.0");
  });

  it("keeps a plain numeric release intact", () => {
    expect(reducePlatformVersion("10.0.22631")).toBe("10.0.22631");
    expect(reducePlatformVersion("22.6.0")).toBe("22.6.0");
  });

  it("keeps at most three segments", () => {
    expect(reducePlatformVersion("6.1.2.3.4")).toBe("6.1.2");
  });

  it("tolerates a shorter release string", () => {
    expect(reducePlatformVersion("14")).toBe("14");
    expect(reducePlatformVersion("14.1")).toBe("14.1");
  });

  // A suffix must not drag the following segment along with it: stopping at
  // the first non-numeric segment is what keeps the output a version.
  it("stops at the first segment that is not purely numeric", () => {
    expect(reducePlatformVersion("6.1-rc1.4")).toBe("6.1");
  });

  it("returns nothing for a release string with no leading digits", () => {
    expect(reducePlatformVersion("")).toBe("");
    expect(reducePlatformVersion("unknown")).toBe("");
  });
});

describe("buildAdditionalCommonProperties", () => {
  it("supplies the three properties VS Code does not inject", () => {
    expect(
      buildAdditionalCommonProperties({
        platform: "linux",
        arch: "x64",
        release: "7.2.2-1-cachyos"
      })
    ).toEqual({
      "common.os": "linux",
      "common.nodearch": "x64",
      "common.platformversion": "7.2.2"
    });
  });

  // The ingest matches lowercase keys when mapping properties to columns, so a
  // camelCase key here would land in the props blob and leave the column NULL
  // without failing anything server-side.
  it("keys every property in lowercase", () => {
    const properties = buildAdditionalCommonProperties({
      platform: "win32",
      arch: "arm64",
      release: "10.0.22631"
    });

    for (const key of Object.keys(properties)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it("omits a property it cannot determine rather than sending it empty", () => {
    const properties = buildAdditionalCommonProperties({
      platform: "darwin",
      arch: "",
      release: "unknown"
    });

    expect(properties).toEqual({ "common.os": "darwin" });
    expect("common.nodearch" in properties).toBe(false);
    expect("common.platformversion" in properties).toBe(false);
  });

  it("reads the real environment when no facts are supplied", () => {
    const properties = buildAdditionalCommonProperties();

    expect(properties["common.os"]).toBe(process.platform);
    expect(properties["common.nodearch"]).toBe(process.arch);
  });
});
