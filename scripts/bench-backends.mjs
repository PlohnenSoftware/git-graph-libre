/**
 * Engine against `git` CLI, on the same reads, through the same seam.
 *
 *   pnpm run bench:backends
 *   GGL_BENCH_REPO=/path/to/repo pnpm run bench:backends
 *   GGL_BENCH_COMMITS=20000 GGL_BENCH_RUNS=21 pnpm run bench:backends
 *
 * The benchmark itself is TypeScript, in `tests/backend/engine/backends.bench.ts`,
 * because it drives `createRepoReader` — the extension's own seam — rather than
 * a reimplementation of it. Both sides are that same function with the backend
 * preference flipped, so a difference here is a difference a user would feel.
 *
 * This wrapper exists only to compile it. esbuild is already a dependency and
 * already knows the `@/` alias from `esbuild.js`, so the bundle costs a few
 * hundred milliseconds and nothing has to be installed.
 *
 * `.node` addons are marked external: they are loaded by the engine loader at
 * runtime from `engine/native/<platform>/`, and bundling one would both fail
 * and defeat the point.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "tests", "backend", "engine", "backends.bench.ts");

// Inside the project, not a temp directory: dependencies stay external, so
// the bundle has to sit somewhere Node resolves `node_modules` from.
const outDir = path.join(root, "node_modules", ".cache", "ggl-bench");
// CommonJS, because the engine loader resolves the addon relative to
// `__dirname` — it is written for the extension's own CJS bundle, and an ESM
// bundle has no `__dirname` at all. From
// `node_modules/.cache/ggl-bench/` its second candidate path lands on
// `<repo>/engine/native/`, which is where a local build puts the binary.
const outFile = path.join(outDir, "backends.bench.cjs");
mkdirSync(outDir, { recursive: true });

try {
  await build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    // Everything installed stays external: this bundles the project's own
    // source, not its dependencies.
    packages: "external",
    alias: { "@": path.join(root, "src") },
    logLevel: "warning"
  });

  execFileSync(process.execPath, [outFile], { stdio: "inherit", cwd: root });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
