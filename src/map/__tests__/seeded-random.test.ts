import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import type { WeightedItem } from '../SeededRandom';

describe('SeededRandom — Determinism (Task 3.5, 3.6, Property 32)', () => {
  it('same seed produces same sequence of next() values', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const seq1 = Array.from({ length: 100 }, () => rng1.next());
    const seq2 = Array.from({ length: 100 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('same string seed produces same sequence', () => {
    const rng1 = new SeededRandom('mictlan');
    const rng2 = new SeededRandom('mictlan');

    const seq1 = Array.from({ length: 50 }, () => rng1.next());
    const seq2 = Array.from({ length: 50 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('different seeds can produce different sequences', () => {
    const rng1 = new SeededRandom(1);
    const rng2 = new SeededRandom(999);

    const seq1 = Array.from({ length: 20 }, () => rng1.next());
    const seq2 = Array.from({ length: 20 }, () => rng2.next());

    // At least one value should differ
    const allSame = seq1.every((v, i) => v === seq2[i]);
    expect(allSame).toBe(false);
  });

  it('normalizes string seeds to produce deterministic state', () => {
    const rng1 = new SeededRandom('test_seed_123');
    const rng2 = new SeededRandom('test_seed_123');

    expect(rng1.next()).toBe(rng2.next());
    expect(rng1.integer(0, 100)).toBe(rng2.integer(0, 100));
  });

  it('seed 0 is handled without producing constant output', () => {
    const rng = new SeededRandom(0);
    const values = Array.from({ length: 10 }, () => rng.next());
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('SeededRandom.next() — Range [0, 1)', () => {
  it('produces values in [0, 1) across 10000 calls', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 10000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('does not produce the same value repeatedly', () => {
    const rng = new SeededRandom(777);
    const values = Array.from({ length: 100 }, () => rng.next());
    const unique = new Set(values);
    // With 100 floats from a good PRNG, expect very high uniqueness
    expect(unique.size).toBeGreaterThan(90);
  });
});

describe('SeededRandom.integer(min, max) — Always within range', () => {
  it('returns values in [min, max] inclusive across many calls', () => {
    const rng = new SeededRandom(42);
    const min = 5;
    const max = 15;

    for (let i = 0; i < 5000; i++) {
      const val = rng.integer(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('works when min === max', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 100; i++) {
      expect(rng.integer(7, 7)).toBe(7);
    }
  });

  it('throws if min > max', () => {
    const rng = new SeededRandom(1);
    expect(() => rng.integer(10, 5)).toThrow();
  });

  it('handles large ranges', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng.integer(0, 1000000);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1000000);
    }
  });

  it('handles negative ranges', () => {
    const rng = new SeededRandom(456);
    for (let i = 0; i < 1000; i++) {
      const val = rng.integer(-50, -10);
      expect(val).toBeGreaterThanOrEqual(-50);
      expect(val).toBeLessThanOrEqual(-10);
    }
  });
});

describe('SeededRandom.pick() — Only returns existing elements', () => {
  it('always returns an element from the array', () => {
    const rng = new SeededRandom(42);
    const items = ['a', 'b', 'c', 'd', 'e'];

    for (let i = 0; i < 1000; i++) {
      const picked = rng.pick(items);
      expect(items).toContain(picked);
    }
  });

  it('throws on empty array', () => {
    const rng = new SeededRandom(1);
    expect(() => rng.pick([])).toThrow();
  });

  it('works with single-element array', () => {
    const rng = new SeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(rng.pick([42])).toBe(42);
    }
  });

  it('produces deterministic picks with same seed', () => {
    const rng1 = new SeededRandom(100);
    const rng2 = new SeededRandom(100);
    const items = [10, 20, 30, 40, 50];

    const picks1 = Array.from({ length: 20 }, () => rng1.pick(items));
    const picks2 = Array.from({ length: 20 }, () => rng2.pick(items));

    expect(picks1).toEqual(picks2);
  });
});

describe('SeededRandom.weightedPick() — Only returns valid items', () => {
  it('always returns an item from the weighted array', () => {
    const rng = new SeededRandom(42);
    const items: WeightedItem<string>[] = [
      { item: 'common', weight: 10 },
      { item: 'rare', weight: 3 },
      { item: 'epic', weight: 1 },
    ];

    const validItems = items.map((i) => i.item);
    for (let i = 0; i < 1000; i++) {
      const picked = rng.weightedPick(items);
      expect(validItems).toContain(picked);
    }
  });

  it('throws on empty array', () => {
    const rng = new SeededRandom(1);
    expect(() => rng.weightedPick([])).toThrow();
  });

  it('throws when all weights are 0', () => {
    const rng = new SeededRandom(1);
    expect(() =>
      rng.weightedPick([{ item: 'x', weight: 0 }]),
    ).toThrow();
  });

  it('heavily favors high-weight items over many samples', () => {
    const rng = new SeededRandom(999);
    const items: WeightedItem<string>[] = [
      { item: 'heavy', weight: 100 },
      { item: 'light', weight: 1 },
    ];

    let heavyCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (rng.weightedPick(items) === 'heavy') heavyCount++;
    }
    // Should be ~99% heavy
    expect(heavyCount).toBeGreaterThan(900);
  });

  it('is deterministic with same seed', () => {
    const items: WeightedItem<number>[] = [
      { item: 1, weight: 5 },
      { item: 2, weight: 3 },
      { item: 3, weight: 2 },
    ];
    const rng1 = new SeededRandom(50);
    const rng2 = new SeededRandom(50);

    const picks1 = Array.from({ length: 30 }, () => rng1.weightedPick(items));
    const picks2 = Array.from({ length: 30 }, () => rng2.weightedPick(items));

    expect(picks1).toEqual(picks2);
  });
});

describe('SeededRandom.chance() — Boolean probability', () => {
  it('chance(0) always returns false', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
    }
  });

  it('chance(1) always returns true', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('chance(0.5) produces roughly balanced results', () => {
    const rng = new SeededRandom(42);
    let trueCount = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.5)) trueCount++;
    }
    // Expect roughly 50% ± 5%
    expect(trueCount).toBeGreaterThan(trials * 0.45);
    expect(trueCount).toBeLessThan(trials * 0.55);
  });
});

describe('SeededRandom.shuffle() — Deterministic Fisher-Yates', () => {
  it('produces same permutation for same seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    expect(rng1.shuffle(items)).toEqual(rng2.shuffle(items));
  });

  it('does not mutate the original array', () => {
    const rng = new SeededRandom(42);
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    rng.shuffle(items);
    expect(items).toEqual(copy);
  });

  it('contains all original elements', () => {
    const rng = new SeededRandom(42);
    const items = [10, 20, 30, 40, 50];
    const shuffled = rng.shuffle(items);
    expect(shuffled.sort()).toEqual(items.sort());
  });
});

describe('SeededRandom — No Math.random() usage', () => {
  it('produces consistent output even if Math.random is stubbed', () => {
    // Override Math.random to return a constant
    const originalRandom = Math.random;
    Math.random = () => 0.999;

    const rng1 = new SeededRandom(42);
    const seq = Array.from({ length: 10 }, () => rng1.next());

    // Restore
    Math.random = originalRandom;

    // Generate again without the stub
    const rng2 = new SeededRandom(42);
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    // Should be identical — Math.random has no effect
    expect(seq).toEqual(seq2);
  });
});
