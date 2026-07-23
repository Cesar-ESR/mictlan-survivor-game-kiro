import { describe, it, expect } from 'vitest';
import {
  canApplyContactDamage,
  applyContactDamage,
  updateCooldowns,
  shouldApplyExplosionDamage,
  type CooldownState,
} from '../damage-utils';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Unit tests for the DamageSystem pure utility functions.
 * **Validates: Requirements 4.4, 4.5, 9.1**
 */
describe('DamageSystem Unit Tests', () => {
  /**
   * CalaveraLlameante explodes and damages player if ≤100px.
   * Validates: Requirement 9.1
   */
  describe('CalaveraLlameante explosion damage within radius', () => {
    it('should apply explosion damage when player is at exactly 100px (boundary)', () => {
      const playerPos = { x: 100, y: 0 };
      const explosionPos = { x: 0, y: 0 };
      // Distance = 100, radius = 100 → should apply
      expect(shouldApplyExplosionDamage(playerPos, explosionPos, GAME_CONSTANTS.EXPLOSION_RADIUS)).toBe(true);
    });

    it('should apply explosion damage when player is within 100px', () => {
      const playerPos = { x: 50, y: 30 };
      const explosionPos = { x: 0, y: 0 };
      // Distance ≈ 58.3px < 100 → should apply
      expect(shouldApplyExplosionDamage(playerPos, explosionPos, GAME_CONSTANTS.EXPLOSION_RADIUS)).toBe(true);
    });

    it('should apply explosion damage when player is at same position', () => {
      const playerPos = { x: 200, y: 300 };
      const explosionPos = { x: 200, y: 300 };
      // Distance = 0 → should apply
      expect(shouldApplyExplosionDamage(playerPos, explosionPos, GAME_CONSTANTS.EXPLOSION_RADIUS)).toBe(true);
    });
  });

  /**
   * CalaveraLlameante does NOT damage if >100px.
   * Validates: Requirement 9.1
   */
  describe('CalaveraLlameante explosion damage outside radius', () => {
    it('should NOT apply explosion damage when player is at 101px', () => {
      const playerPos = { x: 101, y: 0 };
      const explosionPos = { x: 0, y: 0 };
      // Distance = 101 > 100 → should NOT apply
      expect(shouldApplyExplosionDamage(playerPos, explosionPos, GAME_CONSTANTS.EXPLOSION_RADIUS)).toBe(false);
    });

    it('should NOT apply explosion damage when player is at 200px', () => {
      const playerPos = { x: 200, y: 0 };
      const explosionPos = { x: 0, y: 0 };
      // Distance = 200 > 100 → should NOT apply
      expect(shouldApplyExplosionDamage(playerPos, explosionPos, GAME_CONSTANTS.EXPLOSION_RADIUS)).toBe(false);
    });

    it('should NOT apply explosion damage when player is far away diagonally', () => {
      const playerPos = { x: 100, y: 100 };
      const explosionPos = { x: 0, y: 0 };
      // Distance ≈ 141.4 > 100 → should NOT apply
      expect(shouldApplyExplosionDamage(playerPos, explosionPos, GAME_CONSTANTS.EXPLOSION_RADIUS)).toBe(false);
    });
  });

  /**
   * Player HP=0 triggers defeat.
   * Validates: Requirement 4.5
   */
  describe('Player defeat on HP=0', () => {
    it('should reduce HP to 0 when damage equals current HP', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      const { newHp } = applyContactDamage(100, 100, 'enemy_1', state);
      expect(newHp).toBe(0);
    });

    it('should reduce HP to 0 when damage exceeds current HP', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      const { newHp } = applyContactDamage(50, 100, 'enemy_1', state);
      expect(newHp).toBe(0);
    });

    it('HP never goes below 0', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      const { newHp } = applyContactDamage(10, 999, 'enemy_1', state);
      expect(newHp).toBe(0);
    });
  });

  /**
   * Cooldown respected regardless of frame rate.
   * Validates: Requirement 4.4
   */
  describe('Contact damage cooldown respects frame rate', () => {
    it('should not allow second damage within 160ms (10 frames of 16ms)', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      const enemyId = 'enemy_fast_frames';

      // First damage application
      expect(canApplyContactDamage(enemyId, state)).toBe(true);
      applyContactDamage(100, 10, enemyId, state);

      // Simulate 10 frames at 16ms each (160ms total)
      for (let i = 0; i < 10; i++) {
        updateCooldowns(state, 16);
        expect(canApplyContactDamage(enemyId, state)).toBe(false);
      }
    });

    it('should allow damage again after full 1000ms has elapsed', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      const enemyId = 'enemy_wait';

      // First damage
      applyContactDamage(100, 10, enemyId, state);

      // 10 frames × 16ms = 160ms — still cooling
      for (let i = 0; i < 10; i++) {
        updateCooldowns(state, 16);
      }
      expect(canApplyContactDamage(enemyId, state)).toBe(false);

      // Advance 840ms more (total: 160 + 840 = 1000ms)
      updateCooldowns(state, 840);
      expect(canApplyContactDamage(enemyId, state)).toBe(true);
    });

    it('should work the same with large delta (single frame at 1000ms)', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      const enemyId = 'enemy_slow_frame';

      // Apply damage
      applyContactDamage(100, 10, enemyId, state);
      expect(canApplyContactDamage(enemyId, state)).toBe(false);

      // Single large frame of 1000ms
      updateCooldowns(state, 1000);
      expect(canApplyContactDamage(enemyId, state)).toBe(true);
    });

    it('multiple enemies have independent cooldowns', () => {
      const state: CooldownState = {
        cooldowns: new Map(),
        cooldownMs: GAME_CONSTANTS.CONTACT_DAMAGE_COOLDOWN,
      };

      // Apply damage from enemy A
      applyContactDamage(100, 10, 'enemyA', state);

      // Advance 500ms
      updateCooldowns(state, 500);

      // Apply damage from enemy B (first contact, should succeed)
      expect(canApplyContactDamage('enemyB', state)).toBe(true);
      applyContactDamage(90, 10, 'enemyB', state);

      // Enemy A still on cooldown
      expect(canApplyContactDamage('enemyA', state)).toBe(false);

      // Advance 500ms more (total 1000ms for A, 500ms for B)
      updateCooldowns(state, 500);

      // Enemy A cooldown expired
      expect(canApplyContactDamage('enemyA', state)).toBe(true);
      // Enemy B still on cooldown
      expect(canApplyContactDamage('enemyB', state)).toBe(false);

      // Advance 500ms more (total 1000ms for B)
      updateCooldowns(state, 500);
      expect(canApplyContactDamage('enemyB', state)).toBe(true);
    });
  });
});
