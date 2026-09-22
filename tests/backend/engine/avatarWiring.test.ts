import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarManager } from "@/avatarManager";
import { loadEngineAddon } from "@/backend/engine/addon";
import { didEngineServeRead, resetEngineServedRead } from "@/backend/engine/index";
import type { ExtensionState } from "@/extensionState";
import type { AvatarCache } from "@/types";

/**
 * Avatar manager → reader → real backends, end to end (Phase 16, slice
 * 16.3c). Unlike `tests/backend/avatarManager.test.ts` — which stubs
 * `getRemoteUrl` per case and therefore pins `git-cli` — this file uses a
 * real scratch repository and no git stub, so the `auto` preference exercises
 * whichever backend the environment provides. The served flag pins which one
 * it was: with a built addon the engine must have served, without one the
 * CLI must have.
 */

const net = vi.hoisted(() => ({ requested: [] as string[] }));

vi.mock("node:https", () => ({
  get: (
    options: { hostname?: string; path?: string },
    callback?: (res: unknown) => void
  ): { on: (event: string, handler: (error?: Error) => void) => unknown } => {
    net.requested.push(`${options.hostname ?? ""}${options.path ?? ""}`);
    const request = {
      on(_event: string, _handler: (error?: Error) => void) {
        return request;
      }
    };
    if (callback !== undefined) {
      queueMicrotask(() => {
        const listeners = new Map<string, (chunk?: Buffer) => void>();
        const res = {
          statusCode: 422,
          headers: {},
          on(event: string, handler: (chunk?: Buffer) => void) {
            listeners.set(event, handler);
            return res;
          }
        };
        callback(res);
        listeners.get("data")?.(Buffer.from("{}"));
        listeners.get("end")?.();
      });
    }
    return request;
  }
}));

let repo: string;
let storage: string;

beforeAll(() => {
  repo = makeRepo();
  git(["remote", "add", "origin", "https://github.com/some/repo.git"], repo);
  storage = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-avatars-"));
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(storage, { recursive: true, force: true });
});

beforeEach(() => {
  // Real timers by design: the engine answers from its own threadpool, which
  // fake timers hold back, so this file polls with a bounded wait instead.
  vi.useRealTimers();
  net.requested.length = 0;
  resetEngineServedRead();
});

describe("avatar backend wiring", () => {
  it("reaches the github api through the auto reader", async () => {
    const state = {
      getAvatarStoragePath: () => storage,
      getAvatarCache: (): AvatarCache => ({}),
      removeAvatarFromCache: () => {},
      saveAvatar: () => {},
      clearAvatarCache: () => {}
    } as unknown as ExtensionState;
    // Live product default: the preference thunk, like the git-path thunk,
    // is read on every call rather than captured.
    const manager = new AvatarManager(
      () => "git",
      state,
      () => "auto"
    );

    manager.fetchAvatarImage("someone@example.test", repo, ["deadbeef"]);
    const deadline = Date.now() + 10000;
    while (net.requested.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(net.requested.some((url) => url.startsWith("api.github.com/"))).toBe(true);
    // The 422 stub carries a single commit, so the manager falls through to
    // Gravatar rather than requeueing — the routing decision is what matters.
    expect(didEngineServeRead()).toBe(loadEngineAddon() !== null);
  });
});
