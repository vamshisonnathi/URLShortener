/**
 * @file Base62 Code Generator
 * @description Cryptographically secure, unbiased Base62 short code generator using rejection sampling.
 * @module lib/base62
 */

import { randomBytes } from 'node:crypto';

/**
 * Standard Base62 character set: digits (0-9), uppercase (A-Z), lowercase (a-z).
 */
export const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Base62 radix (62 characters). */
const RADIX = BASE62_ALPHABET.length; // 62

/**
 * Largest multiple of 62 that fits within a single byte range (0-255).
 * Bytes at or above this threshold (>= 248) are rejected to eliminate modulo bias.
 */
const REJECT_THRESHOLD = 256 - (256 % RADIX); // 248

/** Default short code character length (7 characters). */
export const DEFAULT_CODE_LENGTH = 7;

/**
 * Generates a cryptographically random, uniformly distributed Base62 string.
 *
 * Uses `crypto.randomBytes` combined with rejection sampling (discarding byte values >= 248)
 * to ensure that all 62 symbols are equally probable, eliminating modulo bias.
 *
 * @param length - The desired number of characters in the short code (defaults to 7).
 * @returns A randomly generated Base62 string of the requested length.
 * @throws {Error} If `length` is less than or equal to zero.
 */
export function generateCode(length: number = DEFAULT_CODE_LENGTH): string {
  if (length <= 0) throw new Error('code length must be positive');

  let out = '';
  while (out.length < length) {
    // Over-fetch bytes to amortize syscall overhead (~3% of bytes rejected on average).
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
