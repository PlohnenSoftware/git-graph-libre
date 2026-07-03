export type OklchColor = {
  l: number;
  c: number;
  h: number;
  alpha?: number;
};

const oklchRegex = /^\s*oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)\s*$/i;
const hexRegex = /^\s*#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?\s*$/i;
const rgbRegex =
  /^\s*rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)\s*$/i;

export function parseOklch(value: string): OklchColor | null {
  const match = oklchRegex.exec(value);
  if (match === null) return null;

  return {
    l: clamp(Number(match[1]), 0, 100),
    c: Math.max(0, Number(match[2])),
    h: normalizeHue(Number(match[3])),
    ...(match[4] === undefined ? {} : { alpha: clamp(Number(match[4]), 0, 1) })
  };
}

export function formatOklch(color: OklchColor): string {
  const alpha = color.alpha === undefined ? "" : ` / ${round(clamp(color.alpha, 0, 1), 3)}`;
  return `oklch(${round(clamp(color.l, 0, 100), 2)}% ${round(Math.max(0, color.c), 4)} ${round(normalizeHue(color.h), 2)}${alpha})`;
}

export function hexToOklch(value: string): OklchColor | null {
  const match = hexRegex.exec(value);
  if (match === null) return null;

  const red = Number.parseInt(match[1], 16);
  const green = Number.parseInt(match[2], 16);
  const blue = Number.parseInt(match[3], 16);
  const alpha = match[4] === undefined ? undefined : Number.parseInt(match[4], 16) / 255;
  return rgbComponentsToOklch(red, green, blue, alpha);
}

export function rgbToOklch(value: string): OklchColor | null {
  const match = rgbRegex.exec(value);
  if (match === null) return null;

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  if ([red, green, blue].some((channel) => channel < 0 || channel > 255)) return null;
  const alpha = match[4] === undefined ? undefined : clamp(Number(match[4]), 0, 1);
  return rgbComponentsToOklch(red, green, blue, alpha);
}

export function toOklch(value: string): OklchColor | null {
  return parseOklch(value) ?? hexToOklch(value) ?? rgbToOklch(value);
}

export function rewritePaletteLightnessChroma(
  colors: readonly string[],
  lightness: number,
  chroma: number
): string[] {
  return colors.map((value) => {
    const parsed = toOklch(value);
    const hue = parsed?.h ?? 0;
    return formatOklch({
      l: lightness,
      c: chroma,
      h: hue,
      ...(parsed?.alpha === undefined ? {} : { alpha: parsed.alpha })
    });
  });
}

function rgbComponentsToOklch(
  red: number,
  green: number,
  blue: number,
  alpha: number | undefined
): OklchColor {
  const r = srgbToLinear(red / 255);
  const g = srgbToLinear(green / 255);
  const b = srgbToLinear(blue / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, labB);
  const hue = normalizeHue((Math.atan2(labB, a) * 180) / Math.PI);

  return {
    l: lightness * 100,
    c: chroma,
    h: chroma < 0.000001 ? 0 : hue,
    ...(alpha === undefined ? {} : { alpha })
  };
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function normalizeHue(value: number) {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
