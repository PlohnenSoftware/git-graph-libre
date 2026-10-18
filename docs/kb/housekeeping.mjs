/**
 * Knowledge-base housekeeping: rebuild the index in `README.md` from the sections themselves.
 *
 *   pnpm run kb:index          rewrite the index between the markers in README.md
 *   pnpm run kb:check          fail if the index is stale or a section breaks the layout rules
 *   pnpm run kb:graph          refresh the graphify graph, then add the knowledge base's edges
 *   node docs/kb/housekeeping.mjs [--check | --graph [graph.json]] [--root <dir>]
 *
 * `--graph` leaves README.md alone and rewrites only the knowledge base's own edges in
 * `graphify-out/graph.json` (see graphify.mjs); it needs a graph that already has the section files.
 *
 * Every section is one Markdown file named `<NNN>-<slug>.md`. Its children, if it has any, live
 * in the directory of the same name beside it, and the three-digit prefix orders siblings. The
 * files directly in the root are the groups (Mission, Rules, ... History). A section file starts
 * with front matter, then its one `# Title`:
 *
 *   ---
 *   summary: >-
 *     What the index says about this section, wrapped over as many indented lines as needed.
 *   always_read: true
 *   ---
 *
 *   # Title
 *
 * `summary` is required and always written as a folded block (`>-`), which needs no quoting
 * whatever the text contains. `always_read` is optional and only ever `true`; it puts the section
 * on the always-read list and marks its entry *always read*.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { linkGraph } from "./graphify.mjs";

const INDEX_FILE = "README.md";
const START_MARKER = "<!-- kb-index:start -->";
const END_MARKER = "<!-- kb-index:end -->";
const SECTION_NAME = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const DIRECTORY_NAME = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Read the supported front-matter subset: a folded `summary` and an optional `always_read`. */
export function parseSection(text, file, problems) {
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    problems.push(`${file}: does not start with front matter (---)`);
    return null;
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    problems.push(`${file}: front matter is never closed`);
    return null;
  }
  const meta = parseFrontMatter(lines.slice(1, end), file, problems);
  const title = parseTitle(lines.slice(end + 1), file, problems);
  if (meta === null || title === null) return null;
  return { title, ...meta };
}

function parseFrontMatter(lines, file, problems) {
  let summary = "";
  let isAlwaysRead = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "summary: >-") {
      const folded = [];
      while (i + 1 < lines.length && lines[i + 1].startsWith("  ")) {
        i++;
        folded.push(lines[i].trim());
      }
      summary = folded.join(" ");
    } else if (line === "always_read: true") {
      isAlwaysRead = true;
    } else {
      problems.push(`${file}: unsupported front matter line "${line}"`);
      return null;
    }
  }
  if (summary === "") {
    problems.push(`${file}: no summary (write it as "summary: >-" and indented lines)`);
    return null;
  }
  return { summary, alwaysRead: isAlwaysRead };
}

function parseTitle(lines, file, problems) {
  const first = lines.find((line) => line.trim() !== "");
  if (first === undefined || !first.startsWith("# ")) {
    problems.push(`${file}: the first line after the front matter must be its "# Title"`);
    return null;
  }
  let inFence = false;
  let titles = 0;
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence;
    else if (!inFence && line.startsWith("# ")) titles++;
  }
  if (titles > 1) problems.push(`${file}: has more than one "# " title; split it instead`);
  return first.slice(2).trim();
}

/** The sections of one directory, in prefix order, each with its children. */
export function readTree(root, dir, problems) {
  const names = readdirSync(path.join(root, dir)).sort((a, b) => a.localeCompare(b, "en"));
  const sections = [];
  const prefixes = new Set();
  for (const name of names) {
    const rel = dir === "" ? name : `${dir}/${name}`;
    if (dir === "" && (name === INDEX_FILE || name.endsWith(".mjs"))) continue;
    if (statSync(path.join(root, rel)).isDirectory()) {
      checkDirectory(names, name, rel, problems);
      continue;
    }
    if (!SECTION_NAME.test(name)) {
      problems.push(`${rel}: not a section name like 010-some-title.md`);
      continue;
    }
    const prefix = name.slice(0, 3);
    if (prefixes.has(prefix)) problems.push(`${rel}: prefix ${prefix} is used twice here`);
    prefixes.add(prefix);
    const section = parseSection(readFileSync(path.join(root, rel), "utf8"), rel, problems);
    if (section === null) continue;
    const childDir = rel.slice(0, -".md".length);
    const children = names.includes(name.slice(0, -".md".length))
      ? readTree(root, childDir, problems)
      : [];
    sections.push({ ...section, path: rel, children });
  }
  return sections;
}

function checkDirectory(siblings, name, rel, problems) {
  if (!DIRECTORY_NAME.test(name)) problems.push(`${rel}/: not a section directory name`);
  else if (!siblings.includes(`${name}.md`)) problems.push(`${rel}/: has no ${name}.md beside it`);
}

function escapeLinkText(text) {
  return text.replaceAll("[", String.raw`\[`).replaceAll("]", String.raw`\]`);
}

function entryLines(sections, depth) {
  return sections.flatMap((section) => {
    const flag = section.alwaysRead ? " (*always read*)" : "";
    const link = `[${escapeLinkText(section.title)}](${section.path})`;
    const line = `${"  ".repeat(depth)}- ${link}${flag} — ${section.summary}`;
    return [line, ...entryLines(section.children, depth + 1)];
  });
}

function alwaysRead(sections) {
  return sections.flatMap((section) => [
    ...(section.alwaysRead ? [section] : []),
    ...alwaysRead(section.children)
  ]);
}

/** The generated part of README.md, markers included. */
export function renderIndex(groups) {
  const out = [START_MARKER, "", "**Always read**, in this order:", ""];
  alwaysRead(groups).forEach((section, i) => {
    out.push(`${i + 1}. [${escapeLinkText(section.title)}](${section.path})`);
  });
  for (const group of groups) {
    out.push("", `**${group.title}**: ${group.summary}`, "", ...entryLines(group.children, 0));
  }
  out.push("", END_MARKER);
  return out.join("\n");
}

/** Replace the marked region of `readme`, or return null when the markers are missing. */
export function spliceIndex(readme, index) {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) return null;
  return readme.slice(0, start) + index + readme.slice(end + END_MARKER.length);
}

/** The value after `flag`, or undefined when the flag is absent or has none. */
function optionValue(argv, flag) {
  const at = argv.indexOf(flag);
  const value = at === -1 ? undefined : argv[at + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function report(problems) {
  for (const problem of problems) console.error(`kb: ${problem}`);
  return 1;
}

/** `--graph [graph.json]`: replace the knowledge base's edges in the graphify graph. */
function runGraph(argv, groups, root) {
  const value = optionValue(argv, "--graph");
  const graphPath =
    value === undefined
      ? path.resolve(root, "..", "..", "graphify-out", "graph.json")
      : path.resolve(value);
  const result = linkGraph({ groups, root, graphPath });
  if (result.problems.length > 0) return report(result.problems);
  console.log(`kb: ${path.relative(process.cwd(), graphPath)} linked`);
  console.log(`kb: ${result.contains} contains edges, ${result.mentions} mentions edges`);
  return 0;
}

function run(argv) {
  const check = argv.includes("--check");
  const rootOption = optionValue(argv, "--root");
  const root =
    rootOption === undefined
      ? path.dirname(fileURLToPath(import.meta.url))
      : path.resolve(rootOption);
  const problems = [];
  const groups = readTree(root, "", problems);
  const readmePath = path.join(root, INDEX_FILE);
  const readme = readFileSync(readmePath, "utf8");
  const updated = spliceIndex(readme, renderIndex(groups));
  if (updated === null) problems.push(`${INDEX_FILE}: missing ${START_MARKER} / ${END_MARKER}`);
  if (problems.length > 0) return report(problems);
  if (argv.includes("--graph")) return runGraph(argv, groups, root);
  const count = alwaysRead(groups).length;
  if (check) {
    if (updated === readme) return 0;
    console.error(`kb: ${INDEX_FILE} is out of date; run pnpm run kb:index`);
    return 1;
  }
  if (updated !== readme) writeFileSync(readmePath, updated);
  console.log(`kb: ${INDEX_FILE} ${updated === readme ? "already current" : "rewritten"}`);
  console.log(`kb: ${groups.length} groups, ${count} always-read sections`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
