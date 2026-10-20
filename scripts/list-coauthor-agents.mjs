/**
 * Prints the distinct `Co-Authored-By` identities in this repository's git
 * history, names only (never addresses), with how many commits carry each.
 * Use it to spot a new AI agent that `src/webview/contributors.ts` does not
 * yet credit. It is not part of the test suite: CI clones may be shallow.
 */
import { execFileSync } from "node:child_process";

const TRAILER = /^co-authored-by:\s*(.+?)\s*(?:<[^>]*>)?\s*$/i;

function readCommitBodies() {
  return execFileSync("git", ["log", "--format=%B%x00"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
}

function countTrailerNames(log) {
  const counts = new Map();
  for (const line of log.split("\n")) {
    const name = TRAILER.exec(line.replaceAll("\0", ""))?.[1];
    if (name !== undefined && name !== "") counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

const counts = countTrailerNames(readCommitBodies());
const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [name, count] of rows) {
  console.log(`${String(count).padStart(5)}  ${name}`);
}
