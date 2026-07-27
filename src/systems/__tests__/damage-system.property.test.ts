import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  canApplyContactDamage,
  applyContactDamage,
  updateCooldowns,
  shouldApplyExplosionDamage,
  type CooldownState,
} from '../damage-utils';

/**
 * Property-based tests for the DamageSystem.
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */
describe('DamageSystem Property Tests', () => {
  /**
   * Property 10: Damage Application and Defeat Trigger
   * HP always reduces by exactly enemyDamage; defeat triggered iff HP ≤ 0.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 10: Damage Application and Defeat Trigger', () => {
    it('HP reduces by exactly enemyDamage and defeat iff HP <= 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),  // currentHp
          fc.integer({ min: 1, max: 500 }),     // enemyDamage
          fc.string({ minLength: 1, maxLength: 10 }), // enemyId
          (currentHp, enemyDamage, enemyId) => {
            const state: CooldownState = {
              cooldowns: new Map(),
              cooldownMs: 1000,
            };

            const { newHp } = applyContactDamage(currentHp, enemyDamage, enemyId, state);

            // HP reduces by exactly enemyDamage, clamped to 0
            const expectedHp = Math.max(0, currentHp - enemyDamage);
            expect(newHp).toBe(expectedHp);

            // Defeat triggered iff HP <= 0
            const shouldBeDefeated = currentHp - enemyDamage <= 0;
            expect(newHp <= 0).toBe(shouldBeDefeated);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('applying damage always resets cooldown to cooldownMs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),  // currentHp
          fc.integer({ min: 1, max: 500 }),     // enemyDamage
          fc.string({ minLength: 1, maxLength: 10 }), // enemyId
          fc.integer({ min: 100, max: 5000 }),  // cooldownMs
          (currentHp, enemyDamage, enemyId, cooldownMs) => {
            const state: CooldownState = {
              cooldowns: new Map(),
              cooldownMs,
            };

            applyContactDamage(currentHp, enemyDamage, enemyId, state);

            // Cooldown must be set to cooldownMs after damage application
            expect(state.cooldowns.get(enemyId)).toBe(cooldownMs);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 11: Contact Damage Cooldown
   * For any sequence of frames, maximum 1 damage application per enemy per 1000ms window.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 11: Contact Damage Cooldown', () => {
    it('at most 1 damage application per enemy per cooldownMs window', () => {
      fc.assert(
        fc.property(
          // Generate a sequence of frame deltas (simulating game frames)
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 5, maxLength: 100 }),
          fc.integer({ min: 500, max: 2000 }), // cooldownMs
          (deltas, cooldownMs) => {
            const state: CooldownState = {
              cooldowns: new Map(),
              cooldownMs,
            };

            const enemyId = 'test_enemy';
            let damageCount = 0;
            let elapsedSinceLastDamage = cooldownMs; // Start as if cooldown already expired

            for (const delta of deltas) {
              updateCooldowns(state, delta);
              elapsedSinceLastDamage += delta;

              if (canApplyContactDamage(enemyId, state)) {
                // Apply damage
                applyContactDamage(100, 10, enemyId, state);
                damageCount++;

                // Verify: elapsed time since last damage must be >= cooldownMs
                // (or this is the first damage)
                if (damageCount > 1) {
                  expect(elapsedSinceLastDamage).toBeGreaterThanOrEqual(cooldownMs);
                }

                elapsedSinceLastDamage = 0;
              }
            }
          },
        ),
        { numRuns: 300 },
      );
    });

    it('canApplyContactDamage returns false immediately after damage is applied', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }), // enemyId
          fc.integer({ min: 100, max: 5000 }),          // cooldownMs
          (enemyId, cooldownMs) => {
            const state: CooldownState = {
              cooldowns: new Map(),
              cooldownMs,
            };

            // Initially should be able to apply damage
            expect(canApplyContactDamage(enemyId, state)).toBe(true);

            // Apply damage
            applyContactDamage(100, 10, enemyId, state);

            // Immediately after, should NOT be able to apply again
            expect(canApplyContactDamage(enemyId, state)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('canApplyContactDamage returns true after cooldownMs has elapsed', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }), // enemyId
          fc.integer({ min: 100, max: 5000 }),          // cooldownMs
          (enemyId, cooldownMs) => {
            const state: CooldownState = {
              cooldowns: new Map(),
              cooldownMs,
            };

            // Apply damage to set cooldown
            applyContactDamage(100, 10, enemyId, state);

            // Advance time by exactly cooldownMs
            updateCooldowns(state, cooldownMs);

            // Should be able to apply damage again
            expect(canApplyContactDamage(enemyId, state)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Additional property: Explosion damage respects radius boundary.
   *
   * **Validates: Requirements 4.3**
   */
  describe('Explosion damage radius boundary', () => {
    it('shouldApplyExplosionDamage returns true iff distance <= radius', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: 1, max: 500, noNaN: true }),
          (px, py, ex, ey, radius) => {
            const playerPos = { x: px, y: py };
            const explosionPos = { x: ex, y: ey };

            const dx = px - ex;
            const dy = py - ey;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const result = shouldApplyExplosionDamage(playerPos, explosionPos, radius);
            expect(result).toBe(dist <= radius);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
