import { describe, it, expect } from 'vitest';
import { calculateDirection, applyMovement } from '../movement.pure';
import type { DirectionInput } from '../movement.pure';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Unit tests for the movement system (PlayerManager pure logic).
 * Validates: Requirements 2.1, 2.2, 2.3
 */

const SPEED = GAME_CONSTANTS.PLAYER_BASE_SPEED; // 200 px/s

describe('PlayerManager - Movement Unit Tests', () => {
  /**
   * Test: immediate stop when releasing keys (1 frame).
   * When no keys are pressed, direction should be (0, 0).
   * Validates: Requirement 2.3
   */
  describe('Immediate stop on key release', () => {
    it('returns zero vector when no keys are pressed', () => {
      const input: DirectionInput = { up: false, down: false, left: false, right: false };
      const dir = calculateDirection(input);
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('position does not change when direction is zero', () => {
      const pos = { x: 1600, y: 1600 };
      const dir = { x: 0, y: 0 };
      const newPos = applyMovement(pos, dir, SPEED, 16.67); // ~60fps frame
      expect(newPos.x).toBe(1600);
      expect(newPos.y).toBe(1600);
    });
  });

  /**
   * Test: 8 cardinal and diagonal directions produce correct velocity.
   * Validates: Requirements 2.1, 2.2
   */
  describe('8 directions produce correct velocity', () => {
    const cases: { name: string; input: DirectionInput; expectedDir: { x: number; y: number } }[] = [
      // Cardinal directions
      { name: 'Right (D)', input: { up: false, down: false, left: false, right: true }, expectedDir: { x: 1, y: 0 } },
      { name: 'Left (A)', input: { up: false, down: false, left: true, right: false }, expectedDir: { x: -1, y: 0 } },
      { name: 'Up (W)', input: { up: true, down: false, left: false, right: false }, expectedDir: { x: 0, y: -1 } },
      { name: 'Down (S)', input: { up: false, down: true, left: false, right: false }, expectedDir: { x: 0, y: 1 } },
      // Diagonal directions (normalized to magnitude 1)
      { name: 'Up-Right (W+D)', input: { up: true, down: false, left: false, right: true }, expectedDir: { x: Math.SQRT1_2, y: -Math.SQRT1_2 } },
      { name: 'Up-Left (W+A)', input: { up: true, down: false, left: true, right: false }, expectedDir: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } },
      { name: 'Down-Right (S+D)', input: { up: false, down: true, left: false, right: true }, expectedDir: { x: Math.SQRT1_2, y: Math.SQRT1_2 } },
      { name: 'Down-Left (S+A)', input: { up: false, down: true, left: true, right: false }, expectedDir: { x: -Math.SQRT1_2, y: Math.SQRT1_2 } },
    ];

    for (const { name, input, expectedDir } of cases) {
      it(`direction ${name} produces correct normalized vector`, () => {
        const dir = calculateDirection(input);
        expect(dir.x).toBeCloseTo(expectedDir.x, 10);
        expect(dir.y).toBeCloseTo(expectedDir.y, 10);
      });

      it(`direction ${name} velocity has correct magnitude`, () => {
        const dir = calculateDirection(input);
        const vx = dir.x * SPEED;
        const vy = dir.y * SPEED;
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        expect(magnitude).toBeCloseTo(SPEED, 5);
      });
    }
  });

  /**
   * Test: diagonal input produces normalized magnitude equal to base speed.
   * Validates: Requirements 2.1, 2.2
   */
  describe('Diagonal normalization', () => {
    it('diagonal movement has same speed as cardinal', () => {
      const cardinal: DirectionInput = { up: false, down: false, left: false, right: true };
      const diagonal: DirectionInput = { up: true, down: false, left: false, right: true };

      const cardinalDir = calculateDirection(cardinal);
      const diagonalDir = calculateDirection(diagonal);

      const cardinalMag = Math.sqrt(cardinalDir.x ** 2 + cardinalDir.y ** 2);
      const diagonalMag = Math.sqrt(diagonalDir.x ** 2 + diagonalDir.y ** 2);

      expect(cardinalMag).toBeCloseTo(1, 10);
      expect(diagonalMag).toBeCloseTo(1, 10);
    });

    it('diagonal displacement in one frame equals cardinal displacement', () => {
      const delta = 16.67; // ~60fps
      const startPos = { x: 1600, y: 1600 };

      // Cardinal right
      const cardinalDir = calculateDirection({ up: false, down: false, left: false, right: true });
      const cardinalPos = applyMovement(startPos, cardinalDir, SPEED, delta);
      const cardinalDist = Math.sqrt((cardinalPos.x - startPos.x) ** 2 + (cardinalPos.y - startPos.y) ** 2);

      // Diagonal up-right
      const diagonalDir = calculateDirection({ up: true, down: false, left: false, right: true });
      const diagonalPos = applyMovement(startPos, diagonalDir, SPEED, delta);
      const diagonalDist = Math.sqrt((diagonalPos.x - startPos.x) ** 2 + (diagonalPos.y - startPos.y) ** 2);

      expect(cardinalDist).toBeCloseTo(diagonalDist, 5);
    });
  });

  /**
   * Axis-independent cancellation examples.
   */
  describe('Axis-independent cancellation', () => {
    it('W+S cancels vertical, no horizontal → zero vector', () => {
      const input: DirectionInput = { up: true, down: true, left: false, right: false };
      const dir = calculateDirection(input);
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('W+S+D → moves only right at full speed', () => {
      const input: DirectionInput = { up: true, down: true, left: false, right: true };
      const dir = calculateDirection(input);
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(0);
    });

    it('A+D cancels horizontal, no vertical → zero vector', () => {
      const input: DirectionInput = { up: false, down: false, left: true, right: true };
      const dir = calculateDirection(input);
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('A+D+W → moves only up at full speed', () => {
      const input: DirectionInput = { up: true, down: false, left: true, right: true };
      const dir = calculateDirection(input);
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(-1);
    });
  });
});
