import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { XPSystem } from '../XPSystem';
import { GAME_CONSTANTS } from '../../config/constants';
import type { LevelUpResult, Upgrade } from '../../types/interfaces';

/**
 * Property-based tests for XPSystem.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 8.3, 8.6
 */

// --- Mock Player Helper ---

function createMockPlayer(level = 1, levelXp = 0, totalXp = 0) {
  const state = { level, levelXp, totalXp, xpThreshold: level * 10 + 5 };
  return {
    get level() { return state.level; },
    get levelXp() { return state.levelXp; },
    get totalXp() { return state.totalXp; },
    get xpThreshold() { return state.xpThreshold; },
    addXP(value: number): LevelUpResult {
      state.totalXp += value;

      if (state.level >= GAME_CONSTANTS.MAX_LEVEL) {
        state.levelXp = state.xpThreshold;
        return { leveledUp: false, newLevel: state.level, excessXp: 0, reachedMaxLevel: true };
      }

      state.levelXp += value;

      if (state.levelXp >= state.xpThreshold) {
        const excess = state.levelXp - state.xpThreshold;
        state.level++;
        state.xpThreshold = state.level * 10 + 5;
        state.levelXp = excess;

        const reachedMax = state.level >= GAME_CONSTANTS.MAX_LEVEL;
        if (reachedMax) {
          state.levelXp = state.xpThreshold;
        }

        return { leveledUp: true, newLevel: state.level, excessXp: excess, reachedMaxLevel: reachedMax };
      }

      return { leveledUp: false, newLevel: state.level, excessXp: 0, reachedMaxLevel: false };
    },
  };
}

// --- Upgrade Factory Helper ---

function createUpgrade(id: string): Upgrade {
  return {
    id,
    name: `Upgrade ${id}`,
    description: `Description for ${id}`,
    apply: () => {},
  };
}

// --- Arbitraries ---

const xpValueArb = fc.integer({ min: 1, max: 500 });
const levelBelowMaxArb = fc.integer({ min: 1, max: 19 });
const poolSizeArb = fc.integer({ min: 0, max: 20 });

describe('XPSystem Property Tests', () => {
  /**
   * Property 13: XP Dual Counter Increment
   * totalXp always increases by value; at level 20, levelXp stays clamped.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 13: XP Dual Counter Increment', () => {
    it('totalXp always increases by the added value', () => {
      fc.assert(
        fc.property(levelBelowMaxArb, xpValueArb, (startLevel, xpValue) => {
          const player = createMockPlayer(startLevel, 0, 0);
          const pool = [createUpgrade('u1')];
          const xpSystem = new XPSystem(pool);

          const totalBefore = player.totalXp;
          xpSystem.addXP(player, xpValue);

          expect(player.totalXp).toBe(totalBefore + xpValue);
        }),
        { numRuns: 500 },
      );
    });

    it('at level 20, levelXp stays clamped to threshold', () => {
      fc.assert(
        fc.property(xpValueArb, (xpValue) => {
          const player = createMockPlayer(20, 0, 1000);
          const pool = [createUpgrade('u1')];
          const xpSystem = new XPSystem(pool);

          xpSystem.addXP(player, xpValue);

          // levelXp should be clamped to threshold (20 * 10 + 5 = 205)
          expect(player.levelXp).toBe(player.xpThreshold);
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 14: Level-Up Excess Carry-Over
   * When levelXp >= threshold, excess = levelXp - threshold is preserved as new levelXp.
   *
   * **Validates: Requirements 5.6, 5.7**
   */
  describe('Property 14: Level-Up Excess Carry-Over', () => {
    it('excess XP is carried over after level-up', () => {
      fc.assert(
        fc.property(
          levelBelowMaxArb,
          fc.integer({ min: 0, max: 100 }),
          xpValueArb,
          (startLevel, startLevelXp, xpValue) => {
            const threshold = startLevel * 10 + 5;
            // Ensure startLevelXp is below threshold
            const clampedLevelXp = startLevelXp % threshold;

            const player = createMockPlayer(startLevel, clampedLevelXp, 0);
            const pool = [createUpgrade('u1')];
            const xpSystem = new XPSystem(pool);

            const totalLevelXp = clampedLevelXp + xpValue;

            const result = xpSystem.addXP(player, xpValue);

            if (totalLevelXp >= threshold && startLevel < 19) {
              // Level-up occurred, not reaching max
              const expectedExcess = totalLevelXp - threshold;
              expect(result.leveledUp).toBe(true);
              expect(result.excessXp).toBe(expectedExcess);
              expect(player.levelXp).toBe(expectedExcess);
            }
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 15: Upgrade Selection Uniqueness and Count
   * getRandomUpgrades returns min(count, pool.length) unique upgrades with no duplicates.
   *
   * **Validates: Requirements 5.8, 5.9**
   */
  describe('Property 15: Upgrade Selection Uniqueness and Count', () => {
    it('returns min(count, pool.length) unique upgrades', () => {
      fc.assert(
        fc.property(poolSizeArb, fc.integer({ min: 1, max: 10 }), (poolSize, requestCount) => {
          const upgrades = Array.from({ length: poolSize }, (_, i) => createUpgrade(`u${i}`));
          const xpSystem = new XPSystem(upgrades);

          const result = xpSystem.getRandomUpgrades(requestCount);
          const expectedCount = Math.min(requestCount, poolSize);

          expect(result.length).toBe(expectedCount);

          // Check uniqueness by ID
          const ids = result.map((u) => u.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(result.length);
        }),
        { numRuns: 500 },
      );
    });

    it('empty pool always returns empty array', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (requestCount) => {
          const xpSystem = new XPSystem([]);
          const result = xpSystem.getRandomUpgrades(requestCount);
          expect(result).toEqual([]);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 16: XP Threshold Formula
   * calculateThreshold(level) === level * 10 + 5 for any level.
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 16: XP Threshold Formula', () => {
    it('threshold equals level * 10 + 5 for any level', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (level) => {
          const xpSystem = new XPSystem([]);
          const threshold = xpSystem.calculateThreshold(level);
          expect(threshold).toBe(level * 10 + 5);
        }),
        { numRuns: 500 },
      );
    });
  });
});
