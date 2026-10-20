/**
 * Prints the distinct `Co-Authored-By` identities in a git log, names only
 * (never addresses), with how many commits carry each. Use it to spot a new
 * AI agent that `src/webview/contributors.ts` does not yet credit. It is not
 * part of the test suite: CI clones may be shallow.
 *
 * The log is read from standard input, so this script spawns nothing:
 *
 *   pnpm run contributors:agents
 *
 * runs `git log --format=%B%x00 | node scripts/list-coauthor-agents.mjs`.
 */
import { readFileSync } from "node:fs";

const TRAILER_KEY = "co-authored-by:";

/** The name on a `Co-Authored-By:` line, or "" when the line is not one. */
function trailerName(line) {
  const text = line.replaceAll("\0", "");
  if (text.slice(0, TRAILER_KEY.length).toLowerCase() !== TRAILER_KEY) return "";
  const rest = text.slice(TRAILER_KEY.length);
  const address = rest.indexOf("<");
  return (address === -1 ? rest : rest.slice(0, address)).trim();
}

function countTrailerNames(log) {
  const tally = new Map();
  for (const line of log.split("\n")) {
    const name = trailerName(line);
    if (name !== "") tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  return tally;
}

const counts = countTrailerNames(readFileSync(0, "utf8"));
const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [name, count] of rows) {
  console.log(`${String(count).padStart(5)}  ${name}`);
}
