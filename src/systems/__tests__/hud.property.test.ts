import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateHealthFill, calculateXPFill, formatTimerMMSS } from '../hud-utils';

/**
 * Property-based tests for HUD utility functions.
 * Validates: Requirements 7.1, 7.2, 7.3, 7.6, 5.10
 */

describe('HUD Property Tests', () => {
  /**
   * Property 20: Health Bar Proportional Fill
   * fillRatio = hp/maxHp clamped [0,1]; never negative, never > 1.
   *
   * **Validates: Requirements 7.1**
   */
  describe('Property 20: Health Bar Proportional Fill', () => {
    it('fill ratio is always between 0 and 1 inclusive', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          (hp, maxHp) => {
            const fill = calculateHealthFill(hp, maxHp);
            expect(fill).toBeGreaterThanOrEqual(0);
            expect(fill).toBeLessThanOrEqual(1);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('fill ratio equals hp/maxHp when hp is in valid range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          (hp, maxHp) => {
            const clampedHp = Math.min(hp, maxHp);
            const fill = calculateHealthFill(clampedHp, maxHp);
            expect(fill).toBeCloseTo(clampedHp / maxHp, 5);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('fill is 0 when hp <= 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -500, max: 0, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          (hp, maxHp) => {
            const fill = calculateHealthFill(hp, maxHp);
            expect(fill).toBe(0);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('fill is 1 when hp >= maxHp', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 500, noNaN: true }),
          (maxHp) => {
            const hp = maxHp + Math.abs(maxHp) * 0.5; // hp > maxHp
            const fill = calculateHealthFill(hp, maxHp);
            expect(fill).toBe(1);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('fill is never negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          (hp, maxHp) => {
            const fill = calculateHealthFill(hp, maxHp);
            expect(fill).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 1000 },
      );
    });
  });

  /**
   * Property 21: XP Bar Proportional Fill with Level-Up Excess
   * levelXp/threshold clamped [0,1]; at max level always 1.
   *
   * **Validates: Requirements 7.2, 7.6**
   */
  describe('Property 21: XP Bar Proportional Fill with Level-Up Excess', () => {
    it('fill ratio is always between 0 and 1 inclusive', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          fc.boolean(),
          (levelXp, threshold, isMaxLevel) => {
            const fill = calculateXPFill(levelXp, threshold, isMaxLevel);
            expect(fill).toBeGreaterThanOrEqual(0);
            expect(fill).toBeLessThanOrEqual(1);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('at max level, fill is always 1 regardless of levelXp/threshold', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          (levelXp, threshold) => {
            const fill = calculateXPFill(levelXp, threshold, true);
            expect(fill).toBe(1);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('normal mode: fill equals levelXp/threshold when in valid range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          (levelXp, threshold) => {
            const clampedXp = Math.min(levelXp, threshold);
            const fill = calculateXPFill(clampedXp, threshold, false);
            expect(fill).toBeCloseTo(clampedXp / threshold, 5);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('fill is never negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.boolean(),
          (levelXp, threshold, isMaxLevel) => {
            const fill = calculateXPFill(levelXp, threshold, isMaxLevel);
            expect(fill).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 1000 },
      );
    });
  });

  /**
   * Property 22: Timer Format MM:SS
   * Format is always XX:XX with proper padding, minutes and seconds never negative.
   *
   * **Validates: Requirements 7.3**
   */
  describe('Property 22: Timer Format MM:SS', () => {
    it('format always matches MM:SS pattern (two digits colon two digits)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 100000, noNaN: true }),
          (elapsedSeconds) => {
            const result = formatTimerMMSS(elapsedSeconds);
            // Pattern: digits (2+):digits (exactly 2)
            expect(result).toMatch(/^\d{2,}:\d{2}$/);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('seconds part is always 00-59', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100000, noNaN: true }),
          (elapsedSeconds) => {
            const result = formatTimerMMSS(elapsedSeconds);
            const parts = result.split(':');
            const seconds = parseInt(parts[1], 10);
            expect(seconds).toBeGreaterThanOrEqual(0);
            expect(seconds).toBeLessThanOrEqual(59);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('minutes part is never negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 100000, noNaN: true }),
          (elapsedSeconds) => {
            const result = formatTimerMMSS(elapsedSeconds);
            const parts = result.split(':');
            const minutes = parseInt(parts[0], 10);
            expect(minutes).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('negative input results in 00:00', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -10000, max: Math.fround(-0.001), noNaN: true }),
          (elapsedSeconds) => {
            const result = formatTimerMMSS(elapsedSeconds);
            expect(result).toBe('00:00');
          },
        ),
        { numRuns: 500 },
      );
    });

    it('correct minutes and seconds decomposition', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 36000 }),
          (elapsedSeconds) => {
            const result = formatTimerMMSS(elapsedSeconds);
            const parts = result.split(':');
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);

            expect(minutes).toBe(Math.floor(elapsedSeconds / 60));
            expect(seconds).toBe(Math.floor(elapsedSeconds % 60));
          },
        ),
        { numRuns: 1000 },
      );
    });
  });
});
