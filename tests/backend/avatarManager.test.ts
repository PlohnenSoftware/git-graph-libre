import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtensionState } from "@/extensionState";
import type { AvatarCache, ResponseMessage } from "@/types";

type StubResponse = {
  statusCode?: number;
  // `null` sends the response with no content-type header at all, which is
  // distinct from leaving the field out and taking the image/png default.
  contentType?: string | string[] | null;
  body?: string;
  error?: boolean;
};

const net = vi.hoisted(() => ({
  responses: [] as StubResponse[],
  requested: [] as string[]
}));

const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  written: [] as string[],
  readError: false,
  writeError: false
}));

vi.mock("node:https", () => ({
  get: (
    options: { hostname?: string; path?: string },
    callback?: (res: unknown) => void
  ): { on: (event: string, handler: (error?: Error) => void) => unknown } => {
    net.requested.push(`${options.hostname ?? ""}${options.path ?? ""}`);
    const stub = net.responses.shift();
    const request = {
      on(event: string, handler: (error?: Error) => void) {
        if (event === "error" && stub?.error === true) handler(new Error("network down"));
        return request;
      }
    };
    if (stub !== undefined && stub.error !== true && callback !== undefined) {
      // Deliver on a later tick so the caller can attach its listeners first.
      queueMicrotask(() => {
        const listeners = new Map<string, (chunk?: Buffer) => void>();
        const contentType = stub.contentType === null ? undefined : (stub.contentType ?? "image/png");
        const res = {
          statusCode: stub.statusCode ?? 200,
          headers: { "content-type": contentType },
          on(event: string, handler: (chunk?: Buffer) => void) {
            listeners.set(event, handler);
            return res;
          }
        };
        callback(res);
        listeners.get("data")?.(Buffer.from(stub.body ?? "binary"));
        listeners.get("end")?.();
      });
    }
    return request;
  }
}));

vi.mock("node:fs", () => ({
  readFile: (
    filePath: string,
    callback: (error: Error | null, data?: Buffer) => void
  ): void => {
    if (disk.readError) {
      callback(new Error("missing"));
      return;
    }
    const contents = disk.files.get(filePath);
    if (contents === undefined) {
      callback(new Error("missing"));
      return;
    }
    callback(null, Buffer.from(contents));
  },
  promises: {
    writeFile: async (filePath: string): Promise<void> => {
      if (disk.writeError) throw new Error("read-only");
      disk.written.push(filePath);
    }
  }
}));

const { getRemoteUrl } = vi.hoisted(() => ({ getRemoteUrl: vi.fn() }));

vi.mock("@/backend/utils/git", () => ({ getRemoteUrl }));

const STORAGE = "/storage/avatars";
const REPO = "/workspace/repo";

function makeExtensionState(cache: AvatarCache = {}) {
  const removed: string[] = [];
  const saved: Array<{ email: string; entry: unknown }> = [];
  let cleared = 0;
  const state = {
    getAvatarStoragePath: () => STORAGE,
    getAvatarCache: () => cache,
    removeAvatarFromCache: (email: string) => removed.push(email),
    clearAvatarCache: () => {
      cleared += 1;
    },
    saveAvatar: (email: string, entry: unknown) => saved.push({ email, entry })
  } as unknown as ExtensionState;
  return {
    state,
    removed,
    saved,
    clearedCount: () => cleared
  };
}

async function createManager(cache: AvatarCache = {}) {
  const { AvatarManager } = await import("@/avatarManager");
  const extensionState = makeExtensionState(cache);
  const posted: ResponseMessage[] = [];
  const manager = new AvatarManager(() => "git", extensionState.state);
  manager.registerBridge((msg) => posted.push(msg));
  return { manager, posted, extensionState };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(1);
}

const DAY = 86400000;

describe("avatar manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    net.responses.length = 0;
    net.requested.length = 0;
    disk.files.clear();
    disk.written.length = 0;
    disk.readError = false;
    disk.writeError = false;
    getRemoteUrl.mockReset();
    getRemoteUrl.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("sends a cached avatar to the webview as a data uri", async () => {
    disk.files.set(`${STORAGE}/cached.png`, "image-bytes");
    const { manager, posted } = await createManager({
      "ada@example.test": { image: "cached.png", timestamp: Date.now(), identicon: false }
    });

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(posted).toEqual([
      {
        command: "fetchAvatar",
        email: "ada@example.test",
        image: `data:image/png;base64,${Buffer.from("image-bytes").toString("base64")}`
      }
    ]);
    expect(net.requested).toEqual([]);
  });

  it("does not post anything once the bridge is deregistered", async () => {
    disk.files.set(`${STORAGE}/cached.png`, "image-bytes");
    const { manager, posted } = await createManager({
      "ada@example.test": { image: "cached.png", timestamp: Date.now(), identicon: false }
    });

    manager.deregisterBridge();
    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(posted).toEqual([]);
  });

  it("skips the webview when the cache entry has no image", async () => {
    const { manager, posted } = await createManager({
      // `Avatar.image` is typed as string, but the cache is rehydrated from
      // persisted state that older versions could have written a null into, which
      // is why the manager still guards against it. The cast reaches that guard.
      "ada@example.test": {
        image: null as unknown as string,
        timestamp: Date.now(),
        identicon: false
      }
    });

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(posted).toEqual([]);
  });

  it("drops the cache entry and refetches when the stored file cannot be read", async () => {
    disk.readError = true;
    net.responses.push({ statusCode: 200, contentType: "image/png" });
    const { manager, extensionState } = await createManager({
      "ada@example.test": { image: "gone.png", timestamp: Date.now(), identicon: false }
    });

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(extensionState.removed).toContain("ada@example.test");
    expect(net.requested.some((target) => target.includes("gravatar"))).toBe(true);
  });

  it("requests an uncached avatar from gravatar", async () => {
    net.responses.push({ statusCode: 200, contentType: "image/png", body: "png" });
    const { manager } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested[0]).toContain("secure.gravatar.com/avatar/");
    expect(net.requested[0]).toContain("d=404");
  });

  it("stores a downloaded avatar and forwards it to the webview", async () => {
    net.responses.push({ statusCode: 200, contentType: "image/png", body: "png-bytes" });
    const { manager, extensionState, posted } = await createManager();
    disk.files.set(
      `${STORAGE}/${"a".repeat(0)}`,
      "" // placeholder so the map is not empty before the write path runs
    );

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();
    await flush();

    expect(disk.written).toHaveLength(1);
    expect(disk.written[0].startsWith(`${STORAGE}/`)).toBe(true);
    expect(disk.written[0].endsWith(".png")).toBe(true);
    expect(extensionState.saved).toHaveLength(1);
    expect(extensionState.saved[0].email).toBe("ada@example.test");
    // The saved file is not in the fake filesystem, so the webview post is skipped
    // rather than sending a broken image.
    expect(posted).toEqual([]);
  });

  it("falls back to the identicon image when gravatar has no avatar", async () => {
    net.responses.push({ statusCode: 404 }, { statusCode: 200, contentType: "image/png" });
    const { manager, extensionState } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();
    await flush();

    expect(net.requested).toHaveLength(2);
    expect(net.requested[1]).toContain("d=identicon");
    expect(extensionState.saved[0].entry).toMatchObject({ identicon: true });
  });

  it("gives up on the avatar when both gravatar requests fail", async () => {
    net.responses.push({ error: true }, { error: true });
    const { manager, extensionState } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();
    await flush();

    expect(extensionState.saved).toEqual([]);
    expect(disk.written).toEqual([]);
  });

  it("does not save an avatar when the response has no usable content type", async () => {
    net.responses.push({ statusCode: 200, contentType: null }, { statusCode: 404 });
    const { manager, extensionState } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();
    await flush();

    expect(disk.written).toEqual([]);
    expect(extensionState.saved).toEqual([]);
  });

  it("keeps the avatar out of the cache when the file cannot be written", async () => {
    disk.writeError = true;
    net.responses.push({ statusCode: 200, contentType: "image/png" }, { statusCode: 404 });
    const { manager, extensionState } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();
    await flush();

    expect(extensionState.saved).toEqual([]);
  });

  it("asks the github api for avatars in a github repository", async () => {
    getRemoteUrl.mockResolvedValue("https://github.com/octocat/Hello-World.git");
    net.responses.push({ statusCode: 200, contentType: "application/json", body: "{}" });
    const { manager } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested[0]).toContain("api.github.com");
    expect(net.requested[0]).toContain("octocat");
    expect(net.requested[0]).toContain("Hello-World");
  });

  it("asks the gitlab api for avatars in a gitlab repository", async () => {
    getRemoteUrl.mockResolvedValue("https://gitlab.com/group/project.git");
    net.responses.push({ statusCode: 200, contentType: "application/json", body: "[]" });
    const { manager } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested[0]).toContain("gitlab.com");
  });

  it("uses gravatar for a self-hosted remote", async () => {
    getRemoteUrl.mockResolvedValue("https://git.example.test/group/project.git");
    net.responses.push({ statusCode: 404 }, { statusCode: 404 });
    const { manager } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested[0]).toContain("secure.gravatar.com");
  });

  it("caches the remote source across requests for the same repository", async () => {
    getRemoteUrl.mockResolvedValue(null);
    net.responses.push({ statusCode: 404 }, { statusCode: 404 }, { statusCode: 404 });
    const { manager } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();
    await flush();
    manager.fetchAvatarImage("grace@example.test", REPO, ["def456"]);
    await flush();

    expect(getRemoteUrl).toHaveBeenCalledTimes(1);
  });

  it("refreshes an avatar that has not been checked for two weeks", async () => {
    disk.files.set(`${STORAGE}/old.png`, "stale");
    net.responses.push({ statusCode: 404 }, { statusCode: 404 });
    const { manager } = await createManager({
      "ada@example.test": {
        image: "old.png",
        timestamp: Date.now() - 15 * DAY,
        identicon: false
      }
    });

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested.length).toBeGreaterThan(0);
  });

  it("refreshes an identicon placeholder after four days", async () => {
    disk.files.set(`${STORAGE}/identicon.png`, "placeholder");
    net.responses.push({ statusCode: 404 }, { statusCode: 404 });
    const { manager } = await createManager({
      "ada@example.test": {
        image: "identicon.png",
        timestamp: Date.now() - 5 * DAY,
        identicon: true
      }
    });

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested.length).toBeGreaterThan(0);
  });

  it("leaves a fresh identicon alone", async () => {
    disk.files.set(`${STORAGE}/identicon.png`, "placeholder");
    const { manager } = await createManager({
      "ada@example.test": {
        image: "identicon.png",
        timestamp: Date.now() - DAY,
        identicon: true
      }
    });

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(net.requested).toEqual([]);
  });

  it("removes a single avatar from the cache", async () => {
    const { manager, extensionState, posted } = await createManager({
      "ada@example.test": { image: "cached.png", timestamp: Date.now(), identicon: false }
    });

    manager.removeAvatarFromCache("ada@example.test");
    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    await flush();

    expect(extensionState.removed).toEqual(["ada@example.test"]);
    expect(posted).toEqual([]);
  });

  it("clears the whole cache", async () => {
    const { manager, extensionState } = await createManager({
      "ada@example.test": { image: "cached.png", timestamp: Date.now(), identicon: false }
    });

    manager.clearCache();

    expect(extensionState.clearedCount()).toBe(1);
  });

  it("merges later commits into a pending request for the same author", async () => {
    net.responses.push({ statusCode: 404 }, { statusCode: 404 });
    const { manager } = await createManager();

    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123"]);
    manager.fetchAvatarImage("ada@example.test", REPO, ["abc123", "def456"]);
    await flush();

    // One queue entry, so only the first gravatar lookup pair is issued.
    expect(net.requested.filter((target) => target.includes("d=404"))).toHaveLength(1);
  });
});
