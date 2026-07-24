import { describe, it, expect } from 'vitest';
import { XPSystem } from '../XPSystem';
import { GAME_CONSTANTS } from '../../config/constants';
import type { LevelUpResult, Upgrade } from '../../types/interfaces';

/**
 * Unit tests for XPSystem.
 * Validates: Requirements 5.8, 5.9, 5.10, 5.11, 7.6
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

describe('XPSystem Unit Tests', () => {
  describe('Level 20 no incrementa level, no muestra panel', () => {
    it('player at level 20 does not level up and does not show panel', () => {
      const player = createMockPlayer(20, 0, 500);
      const pool = [createUpgrade('u1'), createUpgrade('u2'), createUpgrade('u3')];
      const xpSystem = new XPSystem(pool);

      const result = xpSystem.addXP(player, 50);

      expect(result.leveledUp).toBe(false);
      expect(result.showPanel).toBe(false);
      expect(result.reachedMaxLevel).toBe(true);
      expect(result.newLevel).toBe(20);
    });
  });

  describe('Pool vacío → omite panel', () => {
    it('player levels up but pool is empty, showPanel is false', () => {
      // Level 1, threshold = 15. Add 20 XP → level up
      const player = createMockPlayer(1, 0, 0);
      const xpSystem = new XPSystem([]);

      const result = xpSystem.addXP(player, 20);

      expect(result.leveledUp).toBe(true);
      expect(result.showPanel).toBe(false);
      expect(result.newLevel).toBe(2);
    });
  });

  describe('Pool con 1-2 opciones → muestra todas', () => {
    it('getRandomUpgrades(3) with 2 in pool returns 2 upgrades', () => {
      const pool = [createUpgrade('u1'), createUpgrade('u2')];
      const xpSystem = new XPSystem(pool);

      const result = xpSystem.getRandomUpgrades(3);

      expect(result.length).toBe(2);
      const ids = result.map((u) => u.id);
      expect(ids).toContain('u1');
      expect(ids).toContain('u2');
    });

    it('getRandomUpgrades(3) with 1 in pool returns 1 upgrade', () => {
      const pool = [createUpgrade('only')];
      const xpSystem = new XPSystem(pool);

      const result = xpSystem.getRandomUpgrades(3);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('only');
    });
  });

  describe('Carry-over correcto', () => {
    it('threshold=15, add 20 XP → excess=5, levelXp=5', () => {
      // Level 1: threshold = 1*10+5 = 15
      const player = createMockPlayer(1, 0, 0);
      const pool = [createUpgrade('u1')];
      const xpSystem = new XPSystem(pool);

      const result = xpSystem.addXP(player, 20);

      expect(result.leveledUp).toBe(true);
      expect(result.excessXp).toBe(5);
      expect(player.levelXp).toBe(5);
      expect(result.newLevel).toBe(2);
    });
  });

  describe('Barra XP no se reinicia a 0%', () => {
    it('after level-up, levelXp equals excess (not 0)', () => {
      // Level 3: threshold = 3*10+5 = 35. Start with 30 levelXp, add 10 → total 40, excess 5
      const player = createMockPlayer(3, 30, 100);
      const pool = [createUpgrade('u1'), createUpgrade('u2')];
      const xpSystem = new XPSystem(pool);

      const result = xpSystem.addXP(player, 10);

      expect(result.leveledUp).toBe(true);
      expect(result.excessXp).toBe(5); // 40 - 35 = 5
      expect(player.levelXp).toBe(5); // Not 0
      expect(player.level).toBe(4);
    });
  });

  describe('applyUpgrade and removeUpgradeFromPool', () => {
    it('applyUpgrade calls upgrade.apply with the player', () => {
      let called = false;
      const upgrade: Upgrade = {
        id: 'test',
        name: 'Test',
        description: 'Test upgrade',
        apply: (_p) => { called = true; },
      };
      const xpSystem = new XPSystem([upgrade]);

      xpSystem.applyUpgrade({}, upgrade);
      expect(called).toBe(true);
    });

    it('removeUpgradeFromPool reduces pool size', () => {
      const pool = [createUpgrade('u1'), createUpgrade('u2'), createUpgrade('u3')];
      const xpSystem = new XPSystem(pool);

      expect(xpSystem.getPoolSize()).toBe(3);
      xpSystem.removeUpgradeFromPool('u2');
      expect(xpSystem.getPoolSize()).toBe(2);
    });

    it('removeUpgradeFromPool with nonexistent ID does nothing', () => {
      const pool = [createUpgrade('u1')];
      const xpSystem = new XPSystem(pool);

      xpSystem.removeUpgradeFromPool('nonexistent');
      expect(xpSystem.getPoolSize()).toBe(1);
    });
  });

  describe('showPanel logic', () => {
    it('showPanel is true when leveling up below max with upgrades available', () => {
      const player = createMockPlayer(1, 0, 0);
      const pool = [createUpgrade('u1'), createUpgrade('u2'), createUpgrade('u3')];
      const xpSystem = new XPSystem(pool);

      // Threshold at level 1 = 15, add enough to level up
      const result = xpSystem.addXP(player, 15);

      expect(result.leveledUp).toBe(true);
      expect(result.showPanel).toBe(true);
      expect(result.newLevel).toBe(2);
    });

    it('showPanel is false when reaching level 20', () => {
      // Level 19, threshold = 19*10+5 = 195. Add 200 to level up to 20
      const player = createMockPlayer(19, 0, 0);
      const pool = [createUpgrade('u1')];
      const xpSystem = new XPSystem(pool);

      const result = xpSystem.addXP(player, 200);

      expect(result.leveledUp).toBe(true);
      expect(result.showPanel).toBe(false);
      expect(result.newLevel).toBe(20);
      expect(result.reachedMaxLevel).toBe(true);
    });
  });
});
