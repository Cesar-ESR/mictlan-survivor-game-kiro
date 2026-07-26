import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateOrbAttraction,
  isOrbExpired,
  getOrbsToRemoveForCap,
} from '../orb-utils';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Property-based tests for XP Orb system utilities.
 * Validates: Requirements 8.2, 8.4, 8.5
 */
describe('Orb Collector Property Tests', () => {
  // Arbitraries
  const positionArb = fc.record({
    x: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
  });

  const deltaArb = fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true });

  const timestampArb = fc.integer({ min: 0, max: 2_000_000_000 });

  /**
   * Property 23: Orb Attraction Behavior
   * - Orb moves toward player at 400px/s if distance <= 100px
   * - Orb stays static if distance > 100px
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 23: Orb Attraction Behavior', () => {
    it('orb moves closer to player when within attract radius', () => {
      fc.assert(
        fc.property(positionArb, positionArb, deltaArb, (orbPos, playerPos, delta) => {
          const dx = playerPos.x - orbPos.x;
          const dy = playerPos.y - orbPos.y;
          const initialDistance = Math.sqrt(dx * dx + dy * dy);

          // Only test when orb is within attract radius and not at same position
          if (initialDistance <= GAME_CONSTANTS.ORB_ATTRACT_RADIUS && initialDistance > 0.01) {
            const result = calculateOrbAttraction(
              orbPos,
              playerPos,
              delta,
              GAME_CONSTANTS.ORB_ATTRACT_RADIUS,
              GAME_CONSTANTS.ORB_ATTRACT_SPEED,
            );

            expect(result.isAttracted).toBe(true);

            // New distance should be less than or equal to initial distance
            const newDx = playerPos.x - result.x;
            const newDy = playerPos.y - result.y;
            const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);

            expect(newDistance).toBeLessThanOrEqual(initialDistance + 0.001);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('orb stays static when outside attract radius', () => {
      fc.assert(
        fc.property(positionArb, positionArb, deltaArb, (orbPos, playerPos, delta) => {
          const dx = playerPos.x - orbPos.x;
          const dy = playerPos.y - orbPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Only test when orb is outside attract radius
          if (distance > GAME_CONSTANTS.ORB_ATTRACT_RADIUS) {
            const result = calculateOrbAttraction(
              orbPos,
              playerPos,
              delta,
              GAME_CONSTANTS.ORB_ATTRACT_RADIUS,
              GAME_CONSTANTS.ORB_ATTRACT_SPEED,
            );

            expect(result.isAttracted).toBe(false);
            expect(result.x).toBe(orbPos.x);
            expect(result.y).toBe(orbPos.y);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('attraction speed is bounded by 400px/s', () => {
      fc.assert(
        fc.property(positionArb, positionArb, deltaArb, (orbPos, playerPos, delta) => {
          const dx = playerPos.x - orbPos.x;
          const dy = playerPos.y - orbPos.y;
          const initialDistance = Math.sqrt(dx * dx + dy * dy);

          if (initialDistance <= GAME_CONSTANTS.ORB_ATTRACT_RADIUS && initialDistance > 0.01) {
            const result = calculateOrbAttraction(
              orbPos,
              playerPos,
              delta,
              GAME_CONSTANTS.ORB_ATTRACT_RADIUS,
              GAME_CONSTANTS.ORB_ATTRACT_SPEED,
            );

            // Distance moved should not exceed attractSpeed * delta/1000
            const movedDx = result.x - orbPos.x;
            const movedDy = result.y - orbPos.y;
            const movedDistance = Math.sqrt(movedDx * movedDx + movedDy * movedDy);

            const maxMove = GAME_CONSTANTS.ORB_ATTRACT_SPEED * (delta / 1000);
            expect(movedDistance).toBeLessThanOrEqual(maxMove + 0.001);
          }
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 24: Orb Lifetime Expiration
   * - Orbs expired after 30s return isOrbExpired = true
   * - Orbs within lifetime return isOrbExpired = false
   *
   * **Validates: Requirements 8.4**
   */
  describe('Property 24: Orb Lifetime Expiration', () => {
    const lifetimeMs = GAME_CONSTANTS.ORB_LIFETIME * 1000; // 30000ms

    it('orbs older than 30s are expired', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: 1_000_000 }),
          (creationTime, extraMs) => {
            const currentTime = creationTime + lifetimeMs + extraMs;
            expect(isOrbExpired(creationTime, currentTime, lifetimeMs)).toBe(true);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('orbs younger than 30s are not expired', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 0, max: lifetimeMs - 1 }),
          (creationTime, ageMs) => {
            const currentTime = creationTime + ageMs;
            expect(isOrbExpired(creationTime, currentTime, lifetimeMs)).toBe(false);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('orbs at exactly 30s are not expired (strict greater than)', () => {
      fc.assert(
        fc.property(timestampArb, (creationTime) => {
          const currentTime = creationTime + lifetimeMs;
          expect(isOrbExpired(creationTime, currentTime, lifetimeMs)).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 25: Orb Pool Cap with FIFO Removal
   * - After enforcing cap, active count <= 200
   * - Removed orbs are always the oldest (lowest creationTime)
   *
   * **Validates: Requirements 8.5**
   */
  describe('Property 25: Orb Pool Cap with FIFO Removal', () => {
    const orbStateArb = fc.record({
      creationTime: fc.integer({ min: 0, max: 2_000_000_000 }),
      active: fc.boolean(),
    });

    it('active count after cap enforcement is at most MAX_ORBS', () => {
      fc.assert(
        fc.property(
          fc.array(orbStateArb, { minLength: 0, maxLength: 500 }),
          (orbs) => {
            const indicesToRemove = getOrbsToRemoveForCap(orbs, GAME_CONSTANTS.MAX_ORBS);

            // Simulate removal
            const activeAfter = orbs.filter((orb, index) => {
              return orb.active && !indicesToRemove.includes(index);
            });

            expect(activeAfter.length).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_ORBS);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('removed orbs are the oldest active ones', () => {
      fc.assert(
        fc.property(
          fc.array(orbStateArb, { minLength: 0, maxLength: 500 }),
          (orbs) => {
            const indicesToRemove = getOrbsToRemoveForCap(orbs, GAME_CONSTANTS.MAX_ORBS);

            if (indicesToRemove.length === 0) return;

            // All removed orbs must be active
            for (const idx of indicesToRemove) {
              expect(orbs[idx].active).toBe(true);
            }

            // Get remaining active orbs
            const remainingActive = orbs
              .filter((orb, index) => orb.active && !indicesToRemove.includes(index))
              .map((orb) => orb.creationTime);

            // Get removed orbs' creation times
            const removedTimes = indicesToRemove.map((idx) => orbs[idx].creationTime);

            // Every removed orb should be older than or equal to the youngest remaining
            if (remainingActive.length > 0) {
              const youngestRemaining = Math.min(...remainingActive);
              for (const removedTime of removedTimes) {
                expect(removedTime).toBeLessThanOrEqual(youngestRemaining);
              }
            }
          },
        ),
        { numRuns: 500 },
      );
    });

    it('no orbs removed when active count is within cap', () => {
      fc.assert(
        fc.property(
          fc.array(orbStateArb, { minLength: 0, maxLength: GAME_CONSTANTS.MAX_ORBS }),
          (orbs) => {
            // Ensure at most MAX_ORBS active
            const activeCount = orbs.filter((o) => o.active).length;
            if (activeCount <= GAME_CONSTANTS.MAX_ORBS) {
              const indicesToRemove = getOrbsToRemoveForCap(orbs, GAME_CONSTANTS.MAX_ORBS);
              expect(indicesToRemove.length).toBe(0);
            }
          },
        ),
        { numRuns: 300 },
      );
    });
  });
});
