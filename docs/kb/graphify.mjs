/**
 * Knowledge-base edges for the graphify code graph (`graphify-out/graph.json`).
 *
 * graphify already reads every section file: `graphify update .` gives each one a node, its
 * headings, and a `references` edge for every Markdown link, so the index in README.md links all
 * sections. What it cannot see is the structure of the knowledge base, nor which code a section
 * talks about, because it ignores links to anything but documents. This module adds both:
 *
 * - `contains` edges from the index to each group, from each group to its sections, and from each
 *   section to its subsections;
 * - `mentions` edges from a section to the code it names in inline backticks: a path that matches
 *   exactly one file in the graph (`EXTRACTED`), or a code-shaped name (camelCase, PascalCase or
 *   snake_case, four characters or more) that matches one to three symbols (`INFERRED`).
 *
 * Every edge it writes carries `"_origin": "kb"` and the section file as its `source_file`, the
 * provenance graphify gives its own non-AST edges. `graphify update` therefore keeps them as long
 * as both ends exist, and drops them with their section file. Each run first removes all `kb`
 * edges, so running it again is idempotent.
 *
 * graph.json is written by Python's `json.dumps(indent=2, ensure_ascii=True)`. The file is parsed
 * keeping each number's source text and written back the same way, and nothing is written unless
 * that reproduces the file byte for byte, so a run changes only the edges it owns.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ORIGIN = "kb";
const MAX_SYMBOL_MATCHES = 3;
const CODE_PATH = /\.(?:ts|js|mjs|cjs|rs|json|jsonc|css|ya?ml|toml|sh|py|html|md)$/;
const NAME = /^[A-Za-z_$][\w$]*(?:(?:::|\.|#)[A-Za-z_$][\w$]*)*(?:\(\))?$/;

/** A number exactly as it was written in the file, so `1.0` stays `1.0`. */
class RawNumber {
  constructor(raw) {
    this.raw = raw;
  }
}

export function parseGraph(text) {
  return JSON.parse(text, (_key, value, context) =>
    typeof value === "number" ? new RawNumber(context.source) : value
  );
}

function pyString(value) {
  return JSON.stringify(value).replaceAll(
    /[\u007f-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

/** Serialize the way Python's `json.dumps(value, indent=2, ensure_ascii=True)` does. */
export function serializeGraph(value, indent = "") {
  if (value instanceof RawNumber) return value.raw;
  if (typeof value === "string") return pyString(value);
  if (value === null || typeof value !== "object") return String(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => inner + serializeGraph(item, inner));
    return `[\n${items.join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const items = entries.map(
    ([key, item]) => `${inner}${pyString(key)}: ${serializeGraph(item, inner)}`
  );
  return `{\n${items.join(",\n")}\n${indent}}`;
}

/** The file node of each source file: the shortest id among the nodes it produced. */
function fileNodes(nodes) {
  const byFile = new Map();
  for (const node of nodes) {
    const file = node.source_file;
    if (!file) continue;
    const current = byFile.get(file);
    if (current === undefined || node.id.length < current.length) byFile.set(file, node.id);
  }
  return byFile;
}

function symbolKey(label) {
  return label.replace(/^\./, "").replace(/\(\)$/, "");
}

/** The code the knowledge base can point at: files by path, and symbols by name. */
function codeTargets(nodes, files, kbPrefix) {
  const fileIds = new Set(files.values());
  const symbols = new Map();
  for (const node of nodes) {
    const file = node.source_file;
    if (!file || file.startsWith(`${kbPrefix}/`) || fileIds.has(node.id)) continue;
    if (node.file_type !== "code") continue;
    const key = symbolKey(node.label);
    symbols.set(key, [...(symbols.get(key) ?? []), node.id]);
  }
  const paths = [...files].filter(([file]) => !file.startsWith(`${kbPrefix}/`));
  return { paths, symbols };
}

/** Inline code spans outside fenced blocks, with their 1-based line numbers. */
export function inlineCode(text) {
  const spans = [];
  let inFence = false;
  text.split("\n").forEach((line, index) => {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      spans.push({ token: match[1].trim(), line: index + 1 });
    }
  });
  return spans;
}

function isCodeShapedName(name) {
  return name.length >= 4 && (/[A-Z]/.test(name.slice(1)) || name.includes("_"));
}

/** What one inline code span refers to, as `[id, confidence]` pairs; empty when unclear. */
export function resolveMention(token, targets) {
  const cleaned = token.replace(/^\.\//, "").replace(/:\d+$/, "");
  if (/[\s*]/.test(cleaned)) return [];
  if (cleaned.includes("/") || CODE_PATH.test(cleaned)) {
    const hits = targets.paths.filter(([file]) => file === cleaned || file.endsWith(`/${cleaned}`));
    return hits.length === 1 ? [[hits[0][1], "EXTRACTED"]] : [];
  }
  if (!NAME.test(cleaned)) return [];
  const name = symbolKey(cleaned.split(/::|\.|#/).at(-1));
  if (!isCodeShapedName(name)) return [];
  const ids = targets.symbols.get(name) ?? [];
  return ids.length > 0 && ids.length <= MAX_SYMBOL_MATCHES
    ? ids.map((id) => [id, "INFERRED"])
    : [];
}

function edge(source, target, relation, sourceFile, line, confidence) {
  const score = new RawNumber(confidence === "EXTRACTED" ? "1.0" : "0.8");
  return {
    relation,
    confidence,
    source_file: sourceFile,
    source_location: `L${line}`,
    weight: new RawNumber("1.0"),
    _origin: ORIGIN,
    source,
    target,
    confidence_score: score
  };
}

/** Every `kb` edge for the sections, or a list of section files the graph does not know yet. */
export function knowledgeBaseEdges({ groups, root, kbPrefix, nodes }) {
  const files = fileNodes(nodes);
  const targets = codeTargets(nodes, files, kbPrefix);
  const missing = [];
  const edges = [];
  const idOf = (rel) => {
    const id = files.get(`${kbPrefix}/${rel}`);
    if (id === undefined) missing.push(`${kbPrefix}/${rel}`);
    return id;
  };
  const visit = (parentRel, sections) => {
    const parentId = idOf(parentRel);
    for (const section of sections) {
      const id = idOf(section.path);
      if (parentId !== undefined && id !== undefined) {
        edges.push(edge(parentId, id, "contains", `${kbPrefix}/${parentRel}`, 1, "EXTRACTED"));
      }
      if (id !== undefined) edges.push(...mentionEdges(section, id, root, kbPrefix, targets));
      visit(section.path, section.children);
    }
  };
  visit("README.md", groups);
  return { edges, missing };
}

function mentionEdges(section, id, root, kbPrefix, targets) {
  const seen = new Set();
  const edges = [];
  const text = readFileSync(path.join(root, section.path), "utf8");
  for (const { token, line } of inlineCode(text)) {
    for (const [target, confidence] of resolveMention(token, targets)) {
      if (seen.has(target)) continue;
      seen.add(target);
      edges.push(edge(id, target, "mentions", `${kbPrefix}/${section.path}`, line, confidence));
    }
  }
  return edges;
}

/** Replace the `kb` edges of graph.json; returns a message for each problem, or the counts. */
export function linkGraph({ groups, root, graphPath }) {
  const text = readFileSync(graphPath, "utf8");
  const graph = parseGraph(text);
  if (serializeGraph(graph) !== text) {
    return { problems: [`${graphPath}: not in the format graphify writes; nothing changed`] };
  }
  const repoRoot = path.dirname(path.dirname(graphPath));
  const kbPrefix = path.relative(repoRoot, root).split(path.sep).join("/");
  const key = Array.isArray(graph.links) ? "links" : "edges";
  const { edges, missing } = knowledgeBaseEdges({ groups, root, kbPrefix, nodes: graph.nodes });
  if (missing.length > 0) {
    const sample = missing.slice(0, 3).join(", ");
    return {
      problems: [
        `${graphPath} predates ${missing.length} knowledge-base file(s) (${sample}); run graphify update . first`
      ]
    };
  }
  graph[key] = [...graph[key].filter((item) => item._origin !== ORIGIN), ...edges];
  writeFileSync(graphPath, serializeGraph(graph));
  const mentions = edges.filter((item) => item.relation === "mentions").length;
  return { problems: [], contains: edges.length - mentions, mentions };
}
