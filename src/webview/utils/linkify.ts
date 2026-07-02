import { escapeHtml } from "./html";

const httpUrlPattern = /\bhttps?:\/\/[^\s<>"']+/gi;
const trailingPunctuation = new Set([".", ",", ";", ":", "!", "?"]);
const trailingClosers = {
  ")": "(",
  "]": "[",
  "}": "{"
} as const;

export function linkifyHttpUrls(text: string): string {
  let html = "";
  let lastIndex = 0;

  for (const match of text.matchAll(httpUrlPattern)) {
    const rawUrl = match[0];
    const matchIndex = match.index ?? 0;
    const { url, suffix } = splitTrailingUrlPunctuation(rawUrl);
    if (url.length === 0) continue;

    html += escapeHtml(text.slice(lastIndex, matchIndex));
    const escapedUrl = escapeHtml(url);
    html += `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    html += escapeHtml(suffix);
    lastIndex = matchIndex + rawUrl.length;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html.replaceAll("\n", "<br>");
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
