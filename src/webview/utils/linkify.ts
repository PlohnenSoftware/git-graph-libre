import type { IssueLinkingConfig } from "@/types";
import { escapeHtml } from "./html";

const httpUrlPattern = /\bhttps?:\/\/[^\s<>"']+/gi;
const maxIssuePatternLength = 200;
const trailingPunctuation = new Set([".", ",", ";", ":", "!", "?"]);
const trailingClosers = {
  ")": "(",
  "]": "[",
  "}": "{"
} as const;

export type TextLink = {
  displayText: string;
  url: string;
};

export function linkifyHttpUrls(text: string): string {
  return linkifyText(text, null);
}

export function linkifyText(text: string, issueLinking: IssueLinkingConfig | null): string {
  let html = "";
  let lastIndex = 0;
  const links = collectLinks(text, issueLinking);

  for (const link of links) {
    html += escapeHtml(text.slice(lastIndex, link.start));
    const escapedUrl = escapeHtml(link.url);
    html += `<a class="externalLink" href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.displayText)}</a>`;
    lastIndex = link.end;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html.replaceAll("\n", "<br>");
}

export function extractIssueLinks(
  text: string,
  issueLinking: IssueLinkingConfig | null
): TextLink[] {
  return collectIssueLinks(text, issueLinking).map(({ displayText, url }) => ({
    displayText,
    url
  }));
}

type LinkRange = TextLink & {
  start: number;
  end: number;
};

function collectLinks(text: string, issueLinking: IssueLinkingConfig | null): LinkRange[] {
  const links = [...collectHttpLinks(text), ...collectIssueLinks(text, issueLinking)];
  links.sort((a, b) => a.start - b.start || b.end - a.end);

  const nonOverlapping: LinkRange[] = [];
  let cursor = 0;
  for (const link of links) {
    if (link.start < cursor) continue;
    nonOverlapping.push(link);
    cursor = link.end;
  }
  return nonOverlapping;
}

function collectHttpLinks(text: string): LinkRange[] {
  const links: LinkRange[] = [];
  for (const match of text.matchAll(httpUrlPattern)) {
    const rawUrl = match[0];
    const matchIndex = match.index ?? 0;
    const { url, suffix } = splitTrailingUrlPunctuation(rawUrl);
    if (url.length === 0) continue;
    links.push({
      start: matchIndex,
      end: matchIndex + rawUrl.length - suffix.length,
      url,
      displayText: url
    });
  }
  return links;
}

function collectIssueLinks(text: string, issueLinking: IssueLinkingConfig | null): LinkRange[] {
  const issuePattern = createIssuePattern(issueLinking);
  if (issuePattern === null || issueLinking === null) return [];

  const links: LinkRange[] = [];
  while (true) {
    const match = issuePattern.exec(text);
    if (match === null) break;
    if (match[0].length === 0) break;
    const url = buildIssueUrl(match, issueLinking.urlTemplate);
    if (url !== null) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        url,
        displayText: match[0]
      });
    }
  }
  return links;
}

function createIssuePattern(issueLinking: IssueLinkingConfig | null): RegExp | null {
  if (issueLinking === null) return null;
  const pattern = issueLinking.pattern.trim();
  if (pattern === "" || pattern.length > maxIssuePatternLength) return null;
  try {
    // User-defined issue patterns are an explicit repository feature. Keep the
    // expression bounded in size and break zero-length matches while rendering.
    return new RegExp(pattern, "g");
  } catch {
    return null;
  }
}

function buildIssueUrl(match: RegExpExecArray, urlTemplate: string) {
  const url = urlTemplate.replace(/\$([1-9]\d*)/g, (_, index: string) => {
    const value = match[Number.parseInt(index, 10)] ?? "";
    return encodeURIComponent(value);
  });
  return isSafeUrl(url) ? url : null;
}

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function splitTrailingUrlPunctuation(rawUrl: string): { url: string; suffix: string } {
  let end = rawUrl.length;
  while (end > 0 && shouldTrimTrailingCharacter(rawUrl.slice(0, end), rawUrl[end - 1])) {
    end -= 1;
  }
  return { url: rawUrl.slice(0, end), suffix: rawUrl.slice(end) };
}

function shouldTrimTrailingCharacter(url: string, character: string): boolean {
  if (trailingPunctuation.has(character)) return true;
  if (!isTrailingCloser(character)) return false;

  const opener = trailingClosers[character];
  return countCharacter(url, character) > countCharacter(url, opener);
}

function isTrailingCloser(character: string): character is keyof typeof trailingClosers {
  return Object.hasOwn(trailingClosers, character);
}

function countCharacter(value: string, character: string): number {
  let count = 0;
  for (const current of value) {
    if (current === character) count += 1;
  }
  return count;
}
