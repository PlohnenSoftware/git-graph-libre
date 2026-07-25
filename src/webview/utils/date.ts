let getMonthCache: string[] | null = null;
export function getMonth(): string[] {
  if (getMonthCache) return getMonthCache;
  getMonthCache = [
    l10n.monthJan,
    l10n.monthFeb,
    l10n.monthMar,
    l10n.monthApr,
    l10n.monthMay,
    l10n.monthJun,
    l10n.monthJul,
    l10n.monthAug,
    l10n.monthSep,
    l10n.monthOct,
    l10n.monthNov,
    l10n.monthDec
  ];
  return getMonthCache;
}
export function pad2(i: number) {
  return i > 9 ? i : "0" + i;
}

/**
 * Build a formatter once per locale. Constructing an Intl formatter is costly
 * enough to be worth caching when rendering a column of hundreds of commits.
 * Invalid locale tags fall back to the runtime's default locale.
 */
function memoizeByLocale<T>(build: (locale: string | undefined) => T) {
  const cache = new Map<string, T>();
  return (locale: string): T => {
    let formatter = cache.get(locale);
    if (!formatter) {
      try {
        formatter = build(locale);
      } catch {
        formatter = build(undefined);
      }
      cache.set(locale, formatter);
    }
    return formatter;
  };
}

const getRelativeFormatter = memoizeByLocale(
  (locale) => new Intl.RelativeTimeFormat(locale, { numeric: "always" })
);

/** Largest unit that fits, paired with the number of seconds in it. */
const RELATIVE_UNITS: [threshold: number, unit: Intl.RelativeTimeFormatUnit, seconds: number][] = [
  [60, "second", 1],
  [3600, "minute", 60],
  [86400, "hour", 3600],
  [604800, "day", 86400],
  [2629800, "week", 604800],
  [31557600, "month", 2629800],
  [Number.POSITIVE_INFINITY, "year", 31557600]
];

/**
 * Format a commit date as a relative time ("5 minutes ago") using the VS Code
 * display language. Intl supplies the locale's own plural rules and word order,
 * so no part of this string is localized by the extension itself.
 */
export function formatRelativeDate(date: Date, now: Date, locale: string): string {
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  const abs = Math.abs(diff);
  const fitting = RELATIVE_UNITS.find(([threshold]) => abs < threshold) ?? RELATIVE_UNITS[0];
  const [, unit, seconds] = fitting;
  // Negative means in the past, which is what RelativeTimeFormat expects.
  return getRelativeFormatter(locale).format(-Math.round(diff / seconds), unit);
}
