export const DEFAULT_SHORT_HASH_LENGTH = 8;
export const MIN_SHORT_HASH_LENGTH = 4;
export const MAX_SHORT_HASH_LENGTH = 64;

export function clampShortHashLength(length: number): number {
  if (!Number.isFinite(length)) return DEFAULT_SHORT_HASH_LENGTH;
  return Math.trunc(Math.min(MAX_SHORT_HASH_LENGTH, Math.max(MIN_SHORT_HASH_LENGTH, length)));
}

export function abbrevCommit(commitHash: string, length = DEFAULT_SHORT_HASH_LENGTH) {
  return commitHash.substring(0, clampShortHashLength(length));
}
