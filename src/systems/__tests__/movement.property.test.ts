import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateDirection, applyMovement } from '../movement.pure';
import type { DirectionInput } from '../movement.pure';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Property tests for the movement system.
 * Validates: Requirements 2.1, 2.2, 2.5, 2.6
 */

/**
 * Arbitrary that generates valid direction inputs where at least one key is pressed
 * and no full axis cancellation on both axes simultaneously results in zero movement
 * (i.e., generates inputs that produce actual movement).
 */
const validMovementInput = fc.record({
  up: fc.boolean(),
  down: fc.boolean(),
  left: fc.boolean(),
  right: fc.boolean(),
}).filter((input) => {
  // At least one active direction that doesn't fully cancel
  const dx = (input.left && !input.right) ? -1 : (input.right && !input.left) ? 1 : 0;
  const dy = (input.up && !input.down) ? -1 : (input.down && !input.up) ? 1 : 0;
  return dx !== 0 || dy !== 0;
});

describe('Movement Property Tests', () => {
  /**
   * Property 1: Movement Speed Normalization
   * For any valid direction input (single cardinal or diagonal), the resulting
   * velocity vector magnitude always equals 1 (unit vector).
   * When multiplied by speed (200), magnitude = 200 px/s.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it('Property 1: magnitude always equals 1 for any valid input producing movement', () => {
    fc.assert(
      fc.property(validMovementInput, (input: DirectionInput) => {
        const dir = calculateDirection(input);
        const magnitude = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        // Magnitude should be exactly 1 (unit vector) within floating point tolerance
        expect(magnitude).toBeCloseTo(1, 10);
      })
    );
  });

  it('Property 1: velocity magnitude always equals base speed (200) for any valid input', () => {
    fc.assert(
      fc.property(validMovementInput, (input: DirectionInput) => {
        const dir = calculateDirection(input);
        const speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;
        const vx = dir.x * speed;
        const vy = dir.y * speed;
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        expect(magnitude).toBeCloseTo(speed, 5);
      })
    );
  });

  /**
   * Property 2: Axis-Independent Opposing Key Cancellation
   * W+S+D → (1, 0) direction (magnitude 200 on X, 0 on Y)
   * A+D → (0, 0) direction (no movement)
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 2: opposing keys cancel only their axis, preserving the other', () => {
    fc.assert(
      fc.property(
        fc.record({ up: fc.boolean(), down: fc.boolean(), left: fc.boolean(), right: fc.boolean() }),
        (input: DirectionInput) => {
          const dir = calculateDirection(input);

          // If both up and down are pressed, vertical component should be 0
          if (input.up && input.down) {
            // Y-axis should be cancelled to 0 (before normalization it would be 0)
            // After normalization, if X has movement, the vector adjusts
            // But since dy was 0 before normalization, it stays 0
            expect(dir.y).toBe(0);
          }

          // If both left and right are pressed, horizontal component should be 0
          if (input.left && input.right) {
            expect(dir.x).toBe(0);
          }
        }
      )
    );
  });

  it('Property 2: W+S+D produces movement only on X axis at speed 200', () => {
    const input: DirectionInput = { up: true, down: true, left: false, right: true };
    const dir = calculateDirection(input);
    const speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;

    expect(dir.x * speed).toBeCloseTo(200, 5);
    expect(dir.y * speed).toBeCloseTo(0, 5);
  });

  it('Property 2: A+D produces zero velocity', () => {
    const input: DirectionInput = { up: false, down: false, left: true, right: true };
    const dir = calculateDirection(input);

    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });

  /**
   * Property 3: Player Boundary Clamping
   * For any position and movement vector applied over any delta time,
   * the resulting position is always within [0, 3200] × [0, 3200].
   *
   * **Validates: Requirements 2.5**
   */
  it('Property 3: position always within map boundaries after movement', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -500, max: 3700, noNaN: true }),  // x position (can be out of bounds initially)
        fc.float({ min: -500, max: 3700, noNaN: true }),  // y position
        fc.record({ up: fc.boolean(), down: fc.boolean(), left: fc.boolean(), right: fc.boolean() }),
        fc.float({ min: 1, max: 1000, noNaN: true }),  // delta in ms
        (x: number, y: number, input: DirectionInput, delta: number) => {
          const dir = calculateDirection(input);
          const speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;
          const newPos = applyMovement({ x, y }, dir, speed, delta);

          expect(newPos.x).toBeGreaterThanOrEqual(0);
          expect(newPos.x).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_WIDTH);
          expect(newPos.y).toBeGreaterThanOrEqual(0);
          expect(newPos.y).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_HEIGHT);
        }
      )
    );
  });

  it('Property 3: extreme positions are clamped correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10000, max: 10000, noNaN: true }),
        fc.float({ min: -10000, max: 10000, noNaN: true }),
        fc.float({ min: 1, max: 5000, noNaN: true }),
        (x: number, y: number, delta: number) => {
          // Moving left from any position
          const newPos = applyMovement({ x, y }, { x: -1, y: -1 }, 200, delta);

          expect(newPos.x).toBeGreaterThanOrEqual(0);
          expect(newPos.x).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_WIDTH);
          expect(newPos.y).toBeGreaterThanOrEqual(0);
          expect(newPos.y).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_HEIGHT);
        }
      )
    );
  });
});
