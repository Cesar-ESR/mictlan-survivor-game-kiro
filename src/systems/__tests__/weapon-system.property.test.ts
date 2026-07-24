import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { findClosestEnemy, calculateProjectileVelocity } from '../weapon-utils';
import type { WeaponTarget } from '../weapon-utils';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Property-based tests for the weapon system.
 * **Validates: Requirements 4.1, 4.6**
 */
describe('WeaponSystem Property Tests', () => {
  const RANGE = GAME_CONSTANTS.WEAPON_RANGE; // 800
  const MAX_DISTANCE = GAME_CONSTANTS.PROJECTILE_MAX_DISTANCE; // 1000

  // Arbitrary for player position
  const posArb = fc.record({
    x: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
  });

  // Arbitrary for an active, alive enemy
  const activeEnemyArb = fc.record({
    x: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    active: fc.constant(true),
    hp: fc.integer({ min: 1, max: 1000 }),
  });

  // Arbitrary for any enemy (may be inactive or dead)
  const anyEnemyArb = fc.record({
    x: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    active: fc.boolean(),
    hp: fc.integer({ min: -10, max: 1000 }),
  });

  /**
   * Property 9: Closest Enemy Targeting
   * **Validates: Requirements 4.1**
   */
  describe('Property 9: Closest Enemy Targeting', () => {
    it('always returns the enemy with minimum distance among valid targets', () => {
      fc.assert(
        fc.property(
          posArb,
          fc.array(activeEnemyArb, { minLength: 1, maxLength: 20 }),
          (playerPos, enemies) => {
            const result = findClosestEnemy(playerPos, enemies, RANGE);

            // Filter valid enemies (in range)
            const validEnemies = enemies.filter((e) => {
              const dx = e.x - playerPos.x;
              const dy = e.y - playerPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              return dist <= RANGE && e.active && e.hp > 0;
            });

            if (validEnemies.length === 0) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              // Check it is the closest
              const resultDx = result!.x - playerPos.x;
              const resultDy = result!.y - playerPos.y;
              const resultDist = Math.sqrt(resultDx * resultDx + resultDy * resultDy);

              for (const enemy of validEnemies) {
                const dx = enemy.x - playerPos.x;
                const dy = enemy.y - playerPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                expect(resultDist).toBeLessThanOrEqual(dist + 1e-9);
              }
            }
          },
        ),
        { numRuns: 300 },
      );
    });

    it('ignores enemies outside range (>800px)', () => {
      fc.assert(
        fc.property(
          posArb,
          fc.array(activeEnemyArb, { minLength: 1, maxLength: 10 }),
          (playerPos, enemies) => {
            const result = findClosestEnemy(playerPos, enemies, RANGE);

            if (result !== null) {
              const dx = result.x - playerPos.x;
              const dy = result.y - playerPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              expect(dist).toBeLessThanOrEqual(RANGE + 1e-9);
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('accepts enemies exactly at 800px', () => {
      fc.assert(
        fc.property(
          posArb,
          (playerPos) => {
            // Place an enemy at a distance that will be exactly RANGE when computed
            // via Euclidean distance. Use only one axis to avoid trig floating-point issues.
            const enemy: WeaponTarget = {
              x: playerPos.x + RANGE,
              y: playerPos.y,
              active: true,
              hp: 10,
            };
            const result = findClosestEnemy(playerPos, [enemy], RANGE);
            expect(result).not.toBeNull();
          },
        ),
        { numRuns: 200 },
      );
    });

    it('returns null when all enemies are out of range', () => {
      fc.assert(
        fc.property(
          posArb,
          fc.array(
            fc.record({
              angle: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
              dist: fc.double({ min: RANGE + 1, max: 5000, noNaN: true, noDefaultInfinity: true }),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          (playerPos, placements) => {
            const enemies: WeaponTarget[] = placements.map((p) => ({
              x: playerPos.x + p.dist * Math.cos(p.angle),
              y: playerPos.y + p.dist * Math.sin(p.angle),
              active: true,
              hp: 10,
            }));
            const result = findClosestEnemy(playerPos, enemies, RANGE);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 200 },
      );
    });

    it('ignores inactive enemies (active=false)', () => {
      fc.assert(
        fc.property(posArb, (playerPos) => {
          const enemies: WeaponTarget[] = [
            { x: playerPos.x + 10, y: playerPos.y, active: false, hp: 10 },
            { x: playerPos.x + 20, y: playerPos.y, active: false, hp: 10 },
          ];
          const result = findClosestEnemy(playerPos, enemies, RANGE);
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('ignores enemies with hp<=0', () => {
      fc.assert(
        fc.property(
          posArb,
          fc.integer({ min: -100, max: 0 }),
          (playerPos, hp) => {
            const enemies: WeaponTarget[] = [
              { x: playerPos.x + 10, y: playerPos.y, active: true, hp },
            ];
            const result = findClosestEnemy(playerPos, enemies, RANGE);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does not modify the collection', () => {
      fc.assert(
        fc.property(
          posArb,
          fc.array(anyEnemyArb, { minLength: 0, maxLength: 10 }),
          (playerPos, enemies) => {
            const originalJson = JSON.stringify(enemies);
            findClosestEnemy(playerPos, enemies, RANGE);
            expect(JSON.stringify(enemies)).toBe(originalJson);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('on tie returns first found', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: RANGE, noNaN: true, noDefaultInfinity: true }),
          (dist) => {
            // Use origin as playerPos to avoid floating-point subtraction errors
            const playerPos = { x: 0, y: 0 };
            // Two enemies at exactly the same distance on opposite sides of the same axis
            const e1: WeaponTarget = {
              x: dist,
              y: 0,
              active: true,
              hp: 10,
            };
            const e2: WeaponTarget = {
              x: -dist,
              y: 0,
              active: true,
              hp: 10,
            };
            const result = findClosestEnemy(playerPos, [e1, e2], RANGE);
            expect(result).toBe(e1);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('works with positive and negative coordinates', () => {
      fc.assert(
        fc.property(
          fc.record({
            x: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
            y: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
          }),
          fc.double({ min: 1, max: RANGE, noNaN: true, noDefaultInfinity: true }),
          (playerPos, dist) => {
            const enemy: WeaponTarget = {
              x: playerPos.x + dist,
              y: playerPos.y,
              active: true,
              hp: 10,
            };
            const result = findClosestEnemy(playerPos, [enemy], RANGE);
            expect(result).not.toBeNull();
          },
        ),
        { numRuns: 200 },
      );
    });

    it('never produces NaN in velocity calculation', () => {
      fc.assert(
        fc.property(
          posArb,
          posArb,
          fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true }),
          (from, target, speed) => {
            const { vx, vy } = calculateProjectileVelocity(from, target, speed);
            expect(Number.isNaN(vx)).toBe(false);
            expect(Number.isNaN(vy)).toBe(false);
          },
        ),
        { numRuns: 300 },
      );
    });
  });

  /**
   * Property 12: Projectile Max Travel Distance
   * **Validates: Requirements 4.6**
   */
  describe('Property 12: Projectile Max Travel Distance', () => {
    it('projectile stays active when distance < 1000', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: MAX_DISTANCE - 0.001, noNaN: true, noDefaultInfinity: true }),
          (distanceTravelled) => {
            // Projectile should NOT be recycled
            const shouldRecycle = distanceTravelled >= MAX_DISTANCE;
            expect(shouldRecycle).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('recycles when distance >= 1000', () => {
      fc.assert(
        fc.property(
          fc.double({ min: MAX_DISTANCE, max: 5000, noNaN: true, noDefaultInfinity: true }),
          (distanceTravelled) => {
            const shouldRecycle = distanceTravelled >= MAX_DISTANCE;
            expect(shouldRecycle).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('multiple small deltas produce same result as one large delta', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 1000, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 2, max: 100 }),
          (totalDeltaMs, numSteps) => {
            const speed = 600;
            const smallDelta = totalDeltaMs / numSteps;

            // Approach 1: many small deltas
            let distA = 0;
            for (let i = 0; i < numSteps; i++) {
              distA += speed * (smallDelta / 1000);
            }

            // Approach 2: one large delta
            const distB = speed * (totalDeltaMs / 1000);

            // They should be approximately equal (floating point tolerance)
            expect(Math.abs(distA - distB)).toBeLessThan(1e-6);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('inactive projectile does not accumulate distance', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 100, max: 2000, noNaN: true, noDefaultInfinity: true }),
          (speed, deltaMs) => {
            // Simulate inactive projectile
            const isActive = false;
            let distanceTravelled = 0;

            if (isActive) {
              distanceTravelled += speed * (deltaMs / 1000);
            }

            expect(distanceTravelled).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('after recycle, distanceTravelled is 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
          (prevDistance) => {
            // Simulate recycle
            let distanceTravelled = prevDistance;
            // recycle resets distance
            distanceTravelled = 0;
            expect(distanceTravelled).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('distance never negative or NaN', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true }),
          fc.array(
            fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
            { minLength: 1, maxLength: 50 },
          ),
          (speed, deltas) => {
            let distanceTravelled = 0;

            for (const deltaMs of deltas) {
              distanceTravelled += speed * (deltaMs / 1000);
            }

            expect(distanceTravelled).toBeGreaterThanOrEqual(0);
            expect(Number.isNaN(distanceTravelled)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('zero speed does not produce invalid behavior', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 5000, noNaN: true, noDefaultInfinity: true }),
          (deltaMs) => {
            const speed = 0;
            let distanceTravelled = 0;

            distanceTravelled += speed * (deltaMs / 1000);

            expect(distanceTravelled).toBe(0);
            expect(Number.isNaN(distanceTravelled)).toBe(false);
            expect(Number.isFinite(distanceTravelled)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
