/**
 * Diff parity over real history, on every computing backend.
 *
 *   pnpm run diff:parity
 *   GGL_PARITY_REPO=/path/to/repo pnpm run diff:parity
 *   GGL_PARITY_COMMITS=250 GGL_PARITY_MAX_LINES=50000 pnpm run diff:parity
 *
 * Needs both of our builds first: `pnpm run engine:build` (the native
 * arm) and `pnpm run diff:wasm` (the WebAssembly arm). The parity tool
 * refuses to run without either, so a missing build never reads as a
 * smaller agreeing set.
 *
 * The measurement itself is TypeScript, in
 * `tests/backend/engine/diffParity.bench.ts`, because the native arm is
 * the extension's own `diffTexts` seam rather than a reimplementation of
 * it. This wrapper exists only to compile it, exactly as
 * `bench-backends.mjs` does: esbuild is already a dependency, the bundle
 * is CommonJS so the engine loader's `__dirname` candidates resolve, and
 * installed packages stay external. `GGL_DIFF_PARITY` is what makes the
 * bundle run; importing the entry from a test only loads its helpers.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "tests", "backend", "engine", "diffParity.bench.ts");

// Inside node_modules, not a temp directory: dependencies stay external,
// so the bundle has to sit somewhere Node resolves them from, and from
// `node_modules/.cache/ggl-diff-parity/` the engine loader's second
// candidate lands on `<repo>/engine/native/`, where a local build puts
// the binary. The directory is removed afterwards.
const outDir = path.join(root, "node_modules", ".cache", "ggl-diff-parity");
const outFile = path.join(outDir, "diffParity.bench.cjs");
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

  execFileSync(process.execPath, [outFile], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, GGL_DIFF_PARITY: "1" }
  });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
