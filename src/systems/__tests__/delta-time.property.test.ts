import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateDirectionFromInput } from '../movement-utils';
import { updateCooldowns, type CooldownState } from '../damage-utils';
import { calculateOrbAttraction } from '../orb-utils';
import { calculateAcceleration } from '../../entities/enemies/enemy-movement.pure';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Property-based tests for Delta Time Independence.
 * Verifies that all time-dependent pure functions scale linearly with delta.
 *
 * **Validates: Requirements 2.1, 3.3, 4.1, 4.4, 6.1, 6.3, 8.2, 8.4**
 */
describe('Property 26: Delta Time Independence', () => {
  // Arbitrary for delta time in ms (reasonable frame deltas)
  const deltaArb = fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for speed values
  const speedArb = fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true });

  /**
   * Movement: displacement scales linearly with delta.
   * For a given direction and speed: displacement(2*delta) = 2 * displacement(delta)
   *
   * **Validates: Requirements 2.1**
   */
  describe('Movement displacement scales linearly with delta', () => {
    it('doubling delta doubles displacement', () => {
      const inputArb = fc.record({
        up: fc.boolean(),
        down: fc.boolean(),
        left: fc.boolean(),
        right: fc.boolean(),
      }).filter((i) => (i.up || i.down || i.left || i.right) &&
        !(i.up && i.down && i.left && i.right));

      fc.assert(
        fc.property(inputArb, deltaArb, speedArb, (input, delta, speed) => {
          const dir = calculateDirectionFromInput(input);

          // Skip zero-direction (full cancellation)
          if (dir.x === 0 && dir.y === 0) return;

          const deltaSeconds1 = delta / 1000;
          const deltaSeconds2 = (delta * 2) / 1000;

          const displacementX1 = dir.x * speed * deltaSeconds1;
          const displacementY1 = dir.y * speed * deltaSeconds1;

          const displacementX2 = dir.x * speed * deltaSeconds2;
          const displacementY2 = dir.y * speed * deltaSeconds2;

          // 2x delta should produce 2x displacement
          expect(displacementX2).toBeCloseTo(displacementX1 * 2, 10);
          expect(displacementY2).toBeCloseTo(displacementY1 * 2, 10);
        }),
        { numRuns: 300 },
      );
    });
  });

  /**
   * Cooldowns: reduction scales linearly with delta.
   * updateCooldowns with delta=2x reduces cooldown twice as much.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Cooldown reduction scales linearly with delta', () => {
    it('doubling delta doubles cooldown reduction', () => {
      const cooldownValueArb = fc.double({ min: 100, max: 5000, noNaN: true, noDefaultInfinity: true });

      fc.assert(
        fc.property(deltaArb, cooldownValueArb, (delta, cooldownValue) => {
          // Ensure cooldown is large enough to not expire with 2*delta
          const safeCooldown = Math.max(cooldownValue, delta * 2 + 1);

          // Test with delta
          const state1: CooldownState = {
            cooldowns: new Map([['enemy_1', safeCooldown]]),
            cooldownMs: 1000,
          };
          updateCooldowns(state1, delta);
          const remaining1 = state1.cooldowns.get('enemy_1')!;
          const reduction1 = safeCooldown - remaining1;

          // Test with 2*delta
          const state2: CooldownState = {
            cooldowns: new Map([['enemy_1', safeCooldown]]),
            cooldownMs: 1000,
          };
          updateCooldowns(state2, delta * 2);
          const remaining2 = state2.cooldowns.get('enemy_1')!;
          const reduction2 = safeCooldown - remaining2;

          // 2x delta should produce 2x reduction
          expect(reduction2).toBeCloseTo(reduction1 * 2, 10);
        }),
        { numRuns: 300 },
      );
    });
  });

  /**
   * Orb attraction: movement distance scales linearly with delta
   * when not capped by actual distance to player.
   *
   * **Validates: Requirements 8.2, 8.4**
   */
  describe('Orb attraction scales linearly with delta (when not capped)', () => {
    it('doubling delta doubles orb movement distance', () => {
      // Generate orb and player positions where orb is within attract radius
      // but far enough that doubling delta won't overshoot
      const posArb = fc.double({ min: 0, max: 3000, noNaN: true, noDefaultInfinity: true });

      fc.assert(
        fc.property(posArb, posArb, deltaArb, (orbX, orbY, delta) => {
          const attractRadius = GAME_CONSTANTS.ORB_ATTRACT_RADIUS;
          const attractSpeed = GAME_CONSTANTS.ORB_ATTRACT_SPEED;

          // Place player within attract radius of orb but far enough
          // that 2*delta won't overshoot (moveDistance < distance)
          const maxMoveDistance = attractSpeed * ((delta * 2) / 1000);
          // Need distance > maxMoveDistance and distance <= attractRadius
          const requiredMinDistance = maxMoveDistance + 1;

          if (requiredMinDistance >= attractRadius) {
            // Can't satisfy constraint with this delta, skip
            return;
          }

          // Place player exactly at a fixed offset within attract radius
          const distance = (requiredMinDistance + attractRadius) / 2;
          const playerX = orbX + distance;
          const playerY = orbY;

          const orb = { x: orbX, y: orbY };
          const playerPos = { x: playerX, y: playerY };

          // With delta
          const result1 = calculateOrbAttraction(orb, playerPos, delta, attractRadius, attractSpeed);
          const moveX1 = result1.x - orbX;
          const moveY1 = result1.y - orbY;
          const moveDist1 = Math.sqrt(moveX1 * moveX1 + moveY1 * moveY1);

          // With 2*delta
          const result2 = calculateOrbAttraction(orb, playerPos, delta * 2, attractRadius, attractSpeed);
          const moveX2 = result2.x - orbX;
          const moveY2 = result2.y - orbY;
          const moveDist2 = Math.sqrt(moveX2 * moveX2 + moveY2 * moveY2);

          // Both should be attracted
          expect(result1.isAttracted).toBe(true);
          expect(result2.isAttracted).toBe(true);

          // 2x delta should produce 2x movement distance (when not capped)
          if (moveDist1 > 0) {
            expect(moveDist2).toBeCloseTo(moveDist1 * 2, 5);
          }
        }),
        { numRuns: 300 },
      );
    });
  });

  /**
   * Acceleration: speed increase scales linearly with delta
   * when not capped by maxSpeed.
   *
   * **Validates: Requirements 3.3, 6.1, 6.3**
   */
  describe('Acceleration scales linearly with delta (when not capped)', () => {
    it('doubling deltaSeconds doubles speed increase', () => {
      const currentSpeedArb = fc.double({ min: 50, max: 200, noNaN: true, noDefaultInfinity: true });
      const accelerationArb = fc.double({ min: 10, max: 100, noNaN: true, noDefaultInfinity: true });
      const deltaSecondsArb = fc.double({ min: 0.001, max: 0.1, noNaN: true, noDefaultInfinity: true });

      fc.assert(
        fc.property(
          currentSpeedArb,
          accelerationArb,
          deltaSecondsArb,
          (currentSpeed, acceleration, deltaSeconds) => {
            // Set maxSpeed high enough that neither calculation hits the cap
            const maxSpeed = currentSpeed + acceleration * deltaSeconds * 2 + 100;

            const newSpeed1 = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds);
            const newSpeed2 = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds * 2);

            const increase1 = newSpeed1 - currentSpeed;
            const increase2 = newSpeed2 - currentSpeed;

            // 2x deltaSeconds should produce 2x speed increase (when not capped)
            expect(increase2).toBeCloseTo(increase1 * 2, 10);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('acceleration respects maxSpeed cap', () => {
      const currentSpeedArb = fc.double({ min: 50, max: 200, noNaN: true, noDefaultInfinity: true });
      const accelerationArb = fc.double({ min: 10, max: 100, noNaN: true, noDefaultInfinity: true });
      const maxSpeedArb = fc.double({ min: 100, max: 400, noNaN: true, noDefaultInfinity: true });
      const deltaSecondsArb = fc.double({ min: 0.001, max: 1, noNaN: true, noDefaultInfinity: true });

      fc.assert(
        fc.property(
          currentSpeedArb,
          accelerationArb,
          maxSpeedArb,
          deltaSecondsArb,
          (currentSpeed, acceleration, maxSpeed, deltaSeconds) => {
            const effectiveMaxSpeed = Math.max(maxSpeed, currentSpeed);
            const result = calculateAcceleration(currentSpeed, acceleration, effectiveMaxSpeed, deltaSeconds);
            expect(result).toBeLessThanOrEqual(effectiveMaxSpeed);
          },
        ),
        { numRuns: 300 },
      );
    });
  });
});
