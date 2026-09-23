import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiffDocProviderDeps } from "@/diffDocProvider";

type FakeUri = { path: string; query: string; toString: () => string };

const closeHandlers = vi.hoisted(() => ({
  registered: [] as Array<(doc: { uri: FakeUri }) => void>,
  disposed: 0
}));

vi.mock("vscode", () => {
  function parse(value: string): FakeUri {
    const separator = value.indexOf("?");
    const head = separator === -1 ? value : value.slice(0, separator);
    const query = separator === -1 ? "" : value.slice(separator + 1);
    return { path: head.slice(head.indexOf(":") + 1), query, toString: () => value };
  }

  return {
    Uri: { parse },
    EventEmitter: class {
      public event = vi.fn();
      public dispose = vi.fn();
    },
    workspace: {
      onDidCloseTextDocument: (handler: (doc: { uri: FakeUri }) => void) => {
        closeHandlers.registered.push(handler);
        return {
          dispose: () => {
            closeHandlers.disposed += 1;
          }
        };
      }
    }
  };
});

function makeGitClient(result: string | Error) {
  const show = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  );
  const cwd = vi.fn(() => ({ show }));
  return { client: () => ({ cwd }) as never, cwd, show };
}

describe("diff document uris", () => {
  afterEach(() => {
    closeHandlers.registered.length = 0;
    closeHandlers.disposed = 0;
    vi.resetModules();
  });

  it("round-trips repo, path and commit", async () => {
    const { encodeDiffDocUri, decodeDiffDocUri } = await import("@/diffDocProvider");

    const uri = encodeDiffDocUri("/repos/my repo", "src/webview/main.ts", "a20cd94");

    expect(decodeDiffDocUri(uri)).toEqual({
      filePath: "src/webview/main.ts",
      commit: "a20cd94",
      repo: "/repos/my repo"
    });
  });

  it("encodes under the extension scheme and escapes query values", async () => {
    const { encodeDiffDocUri } = await import("@/diffDocProvider");

    const uri = encodeDiffDocUri("/repos/a b", "f.ts", "HEAD~1");

    expect(uri.toString().startsWith("git-graph-libre:f.ts?")).toBe(true);
    expect(uri.toString()).toContain("commit=HEAD~1");
    expect(uri.toString()).toContain("repo=%2Frepos%2Fa%20b");
  });
});

describe("diff document provider", () => {
  afterEach(() => {
    closeHandlers.registered.length = 0;
    closeHandlers.disposed = 0;
    vi.resetModules();
  });

  it("reads file content at a commit through the git client", async () => {
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const git = makeGitClient("line one\n");
    const provider = new DiffDocProvider(git.client);

    const content = await provider.provideTextDocumentContent(
      encodeDiffDocUri("/repo", "f.ts", "abc123") as never
    );

    expect(content).toBe("line one\n");
    expect(git.cwd).toHaveBeenCalledWith("/repo");
    expect(git.show).toHaveBeenCalledWith(["abc123:f.ts"]);
  });

  it("serves a second read from the cache", async () => {
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const git = makeGitClient("cached");
    const provider = new DiffDocProvider(git.client);
    const uri = encodeDiffDocUri("/repo", "f.ts", "abc123") as never;

    await provider.provideTextDocumentContent(uri);
    const second = await provider.provideTextDocumentContent(uri);

    expect(second).toBe("cached");
    expect(git.show).toHaveBeenCalledTimes(1);
  });

  it("yields empty content when git cannot show the file", async () => {
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const git = makeGitClient(new Error("unknown revision"));
    const provider = new DiffDocProvider(git.client);

    const content = await provider.provideTextDocumentContent(
      encodeDiffDocUri("/repo", "gone.ts", "abc123") as never
    );

    expect(content).toBe("");
  });

  it("drops the cached document when its editor closes", async () => {
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const git = makeGitClient("first");
    const provider = new DiffDocProvider(git.client);
    const uri = encodeDiffDocUri("/repo", "f.ts", "abc123") as never;

    await provider.provideTextDocumentContent(uri);
    expect(closeHandlers.registered).toHaveLength(1);
    closeHandlers.registered[0]({ uri: uri as unknown as FakeUri });
    await provider.provideTextDocumentContent(uri);

    expect(git.show).toHaveBeenCalledTimes(2);
  });

  it("exposes a change event and releases its subscription on dispose", async () => {
    const { DiffDocProvider } = await import("@/diffDocProvider");
    const git = makeGitClient("x");
    const provider = new DiffDocProvider(git.client);

    expect(provider.onDidChange).toBeTypeOf("function");
    provider.dispose();

    expect(closeHandlers.disposed).toBe(1);
  });

  it("declares the uri scheme used for registration", async () => {
    const { DiffDocProvider } = await import("@/diffDocProvider");

    expect(DiffDocProvider.scheme).toBe("git-graph-libre");
  });
});

describe("diff document provider on the engine backend", () => {
  afterEach(() => {
    closeHandlers.registered.length = 0;
    closeHandlers.disposed = 0;
    vi.resetModules();
  });

  function fileAddon(result: string | Error) {
    const loadCommitFile = vi.fn(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    );
    return {
      provider: () => ({ loadCommitFile }),
      loadCommitFile
    };
  }

  async function readWith(git: ReturnType<typeof makeGitClient>, deps: DiffDocProviderDeps = {}) {
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const provider = new DiffDocProvider(git.client, deps);
    return {
      content: await provider.provideTextDocumentContent(
        encodeDiffDocUri("/repo", "f.ts", "abc123") as never
      ),
      provider
    };
  }

  it("serves engine text without touching the git client", async () => {
    const git = makeGitClient("cli text");
    const addon = fileAddon(JSON.stringify({ contents: "engine text\n", binary: false }));
    const { content } = await readWith(git, {
      backend: () => "auto",
      addonProvider: addon.provider
    });

    expect(content).toBe("engine text\n");
    expect(git.show).not.toHaveBeenCalled();
    expect(addon.loadCommitFile).toHaveBeenCalledWith("/repo", "abc123", "f.ts");
  });

  it("caches the engine answer like the CLI one", async () => {
    const git = makeGitClient("cli text");
    const addon = fileAddon(JSON.stringify({ contents: "engine text", binary: false }));
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const provider = new DiffDocProvider(git.client, {
      backend: () => "auto",
      addonProvider: addon.provider
    });
    const uri = encodeDiffDocUri("/repo", "f.ts", "abc123") as never;

    await provider.provideTextDocumentContent(uri);
    const second = await provider.provideTextDocumentContent(uri);

    expect(second).toBe("engine text");
    expect(addon.loadCommitFile).toHaveBeenCalledTimes(1);
    expect(git.show).not.toHaveBeenCalled();
  });

  it("never loads the addon on the git-cli preference", async () => {
    const git = makeGitClient("cli text");
    const addon = fileAddon(JSON.stringify({ contents: "engine text", binary: false }));
    const load = vi.fn(addon.provider);
    const { content } = await readWith(git, { backend: () => "git-cli", addonProvider: load });

    expect(content).toBe("cli text");
    expect(load).not.toHaveBeenCalled();
    expect(git.show).toHaveBeenCalledWith(["abc123:f.ts"]);
  });

  it("falls back to the CLI when no addon is available", async () => {
    const git = makeGitClient("cli text");
    const { content } = await readWith(git, { backend: () => "auto", addonProvider: () => null });

    expect(content).toBe("cli text");
    expect(git.show).toHaveBeenCalledWith(["abc123:f.ts"]);
  });

  it.each(["a decline", "a genuine failure"])("falls back to the CLI on %s", async (name) => {
    const git = makeGitClient("cli text");
    const addon =
      name === "a decline"
        ? fileAddon(new Error("Unsupported: file not stubbed"))
        : fileAddon(new Error("Git: corrupt object"));
    const { content } = await readWith(git, {
      backend: () => "auto",
      addonProvider: addon.provider
    });

    expect(content).toBe("cli text");
    expect(git.show).toHaveBeenCalledWith(["abc123:f.ts"]);
  });

  it("falls back to the CLI on the binary marker, keeping the binary presentation", async () => {
    const git = makeGitClient("binary\tbytes");
    const addon = fileAddon(JSON.stringify({ contents: null, binary: true }));
    const { content } = await readWith(git, {
      backend: () => "auto",
      addonProvider: addon.provider
    });

    expect(content).toBe("binary\tbytes");
    expect(git.show).toHaveBeenCalledWith(["abc123:f.ts"]);
  });

  it("falls back to the CLI on a malformed payload", async () => {
    const git = makeGitClient("cli text");
    const addon = fileAddon("not json");
    const { content } = await readWith(git, {
      backend: () => "auto",
      addonProvider: addon.provider
    });

    expect(content).toBe("cli text");
    expect(git.show).toHaveBeenCalledWith(["abc123:f.ts"]);
  });
});
