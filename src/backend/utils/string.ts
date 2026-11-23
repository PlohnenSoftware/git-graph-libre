export const DEFAULT_SHORT_HASH_LENGTH = 8;
export const MIN_SHORT_HASH_LENGTH = 4;
export const MAX_SHORT_HASH_LENGTH = 64;

export function clampShortHashLength(length: number): number {
  if (!Number.isFinite(length)) return DEFAULT_SHORT_HASH_LENGTH;
  return Math.trunc(Math.min(MAX_SHORT_HASH_LENGTH, Math.max(MIN_SHORT_HASH_LENGTH, length)));
}

/** True when the text holds a C0 control character or DEL, checked by code point. */
export function hasControlCharacter(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function abbrevCommit(commitHash: string, length = DEFAULT_SHORT_HASH_LENGTH) {
  return commitHash.substring(0, clampShortHashLength(length));
}
