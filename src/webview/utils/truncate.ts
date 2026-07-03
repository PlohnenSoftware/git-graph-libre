const ELLIPSIS = "\u2026";

export function truncateMiddle(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  if (maxChars <= 0) return "";
  if (maxChars === 1) return ELLIPSIS;

  const visibleChars = maxChars - ELLIPSIS.length;
  const prefixLength = Math.ceil(visibleChars / 2);
  const suffixLength = Math.floor(visibleChars / 2);
  return `${name.slice(0, prefixLength)}${ELLIPSIS}${name.slice(name.length - suffixLength)}`;
}

export function truncateRefName(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;

  const segments = name.split("/");
  if (segments.length < 3) return truncateMiddle(name, maxChars);

  const firstSegment = segments[0];
  let best: string | null = null;
  for (let tailStart = segments.length - 1; tailStart >= 2; tailStart--) {
    const candidate = `${firstSegment}/${ELLIPSIS}/${segments.slice(tailStart).join("/")}`;
    if (candidate.length <= maxChars) {
      best = candidate;
    }
  }

  return best ?? truncateMiddle(name, maxChars);
}
