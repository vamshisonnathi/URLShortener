import { randomBytes } from 'node:crypto';

export const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const RADIX = BASE62_ALPHABET.length; // 62

// Largest multiple of 62 that fits in a byte (0..255). Bytes at or above this
// threshold are rejected so every alphabet index is equally likely. Without
// this, `byte % 62` would over-represent indices 0..7 (256 = 4*62 + 8) — bias.
const REJECT_THRESHOLD = 256 - (256 % RADIX); // 248

export const DEFAULT_CODE_LENGTH = 7;

/**
 * Generate a cryptographically-random, uniformly-distributed base62 string.
 * Uses crypto.randomBytes + rejection sampling (no Math.random, no naive modulo).
 */
export function generateCode(length: number = DEFAULT_CODE_LENGTH): string {
  if (length <= 0) throw new Error('code length must be positive');

  let out = '';
  while (out.length < length) {
    // Over-fetch to amortize the syscall; ~3% of bytes get rejected on average.
    const buf = randomBytes(length);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const b = buf[i]!;
      if (b < REJECT_THRESHOLD) {
        out += BASE62_ALPHABET[b % RADIX];
      }
    }
  }
  return out;
}
