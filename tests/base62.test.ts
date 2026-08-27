import { describe, it, expect } from 'vitest';
import {
  generateCode,
  BASE62_ALPHABET,
  DEFAULT_CODE_LENGTH,
} from '../src/lib/base62.js';

const ALPHABET_SET = new Set(BASE62_ALPHABET.split(''));

describe('generateCode', () => {
  it('produces a code of the requested length (default 7)', () => {
    expect(generateCode()).toHaveLength(DEFAULT_CODE_LENGTH);
    expect(generateCode(12)).toHaveLength(12);
  });

  it('emits only base62 alphabet characters', () => {
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateCode()) {
        expect(ALPHABET_SET.has(ch)).toBe(true);
      }
    }
  });

  it('throws on non-positive length', () => {
    expect(() => generateCode(0)).toThrow();
    expect(() => generateCode(-3)).toThrow();
  });

  it('is effectively collision-free at scale (uniqueness)', () => {
    const seen = new Set<string>();
    const N = 50_000;
    for (let i = 0; i < N; i++) seen.add(generateCode());
    // With 62^7 (~3.5e12) space, 50k draws should not collide.
    expect(seen.size).toBe(N);
  });

  it('has no modulo bias — character distribution is near-uniform (chi-square)', () => {
    // Sample a large number of single characters and check the frequency of
    // each of the 62 symbols is within tolerance of the expected uniform mean.
    const counts = new Map<string, number>();
    const samples = 62 * 4000; // ~4000 expected per symbol
    for (let i = 0; i < samples; i++) {
      const ch = generateCode(1);
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }

    // Every symbol must appear.
    expect(counts.size).toBe(62);

    const expected = samples / 62;
    let chiSquare = 0;
    for (const symbol of BASE62_ALPHABET) {
      const observed = counts.get(symbol) ?? 0;
      chiSquare += (observed - expected) ** 2 / expected;
    }
    // 61 degrees of freedom: chi-square critical value at p=0.001 is ~112.
    // A biased (naive modulo) generator blows far past this; a uniform one
    // stays well under. Threshold is generous to avoid flakiness.
    expect(chiSquare).toBeLessThan(112);
  });
});
