import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateDirectionFromInput, clampPosition } from '../movement-utils';
import type { DirectionInput } from '../movement-utils';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Property-based tests para el sistema de movimiento.
 * Validates: Requirements 2.1, 2.2, 2.5, 2.6
 */
describe('Movement Property Tests', () => {
  // Arbitrary que genera un DirectionInput con al menos una tecla presionada
  const activeInputArb = fc.record({
    up: fc.boolean(),
    down: fc.boolean(),
    left: fc.boolean(),
    right: fc.boolean(),
  }).filter((input) => input.up || input.down || input.left || input.right);

  // Arbitrary que genera cualquier DirectionInput (incluyendo ninguna tecla)
  const anyInputArb = fc.record({
    up: fc.boolean(),
    down: fc.boolean(),
    left: fc.boolean(),
    right: fc.boolean(),
  });

  /**
   * Property 1: Movement Speed Normalization
   * Para cualquier input válido (al menos 1 tecla presionada), si el vector resultante
   * no es (0,0) (caso de cancelación), su magnitud es exactamente 1.
   * Velocidad resultante = 200 (speed base).
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Property 1: Movement Speed Normalization', () => {
    it('direction vector magnitude is 1 for any non-cancelled input', () => {
      fc.assert(
        fc.property(activeInputArb, (input: DirectionInput) => {
          const dir = calculateDirectionFromInput(input);

          // Si hay cancelación total en ambos ejes, el vector es (0,0)
          const bothHorizontalCancelled = input.left && input.right;
          const bothVerticalCancelled = input.up && input.down;

          if (bothHorizontalCancelled && bothVerticalCancelled) {
            // Total cancellation — (0,0) is valid
            expect(dir.x).toBe(0);
            expect(dir.y).toBe(0);
            return;
          }

          // Si hay al menos un eje activo, magnitud debe ser 1
          const magnitude = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
          if (magnitude > 0) {
            expect(magnitude).toBeCloseTo(1, 10);
            // Speed after multiplication = 200
            const speed = magnitude * GAME_CONSTANTS.PLAYER_BASE_SPEED;
            expect(speed).toBeCloseTo(200, 10);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 2: Axis-Independent Opposing Key Cancellation
   * Las teclas opuestas se cancelan solo en su eje, sin afectar el otro.
   *
   * **Validates: Requirements 2.2, 2.6**
   */
  describe('Property 2: Axis-Independent Opposing Key Cancellation', () => {
    it('W+S+D produces direction (1, 0)', () => {
      const dir = calculateDirectionFromInput({ up: true, down: true, left: false, right: true });
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(0);
    });

    it('A+D produces direction (0, 0)', () => {
      const dir = calculateDirectionFromInput({ up: false, down: false, left: true, right: true });
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('W+S produces direction (0, 0)', () => {
      const dir = calculateDirectionFromInput({ up: true, down: true, left: false, right: false });
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(0);
    });

    it('opposing keys on one axis do not affect the other axis', () => {
      fc.assert(
        fc.property(anyInputArb, (input: DirectionInput) => {
          const dir = calculateDirectionFromInput(input);

          // If left and right are both pressed, x component must be 0
          if (input.left && input.right) {
            expect(dir.x).toBe(0);
          }

          // If up and down are both pressed, y component must be 0
          if (input.up && input.down) {
            expect(dir.y).toBe(0);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 3: Player Boundary Clamping
   * Para cualquier posición y movimiento, la posición resultante está siempre
   * dentro de [0, 3200] × [0, 3200].
   *
   * **Validates: Requirements 2.5, 2.6**
   */
  describe('Property 3: Player Boundary Clamping', () => {
    it('position is always within map bounds after clamping', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10000, max: 10000, noNaN: true }),
          fc.double({ min: -10000, max: 10000, noNaN: true }),
          (x: number, y: number) => {
            const clamped = clampPosition(x, y);
            expect(clamped.x).toBeGreaterThanOrEqual(0);
            expect(clamped.x).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_WIDTH);
            expect(clamped.y).toBeGreaterThanOrEqual(0);
            expect(clamped.y).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_HEIGHT);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('simulated movement + clamping always stays in bounds', () => {
      fc.assert(
        fc.property(
          // Posición inicial dentro del mapa
          fc.double({ min: 0, max: 3200, noNaN: true }),
          fc.double({ min: 0, max: 3200, noNaN: true }),
          // Dirección (cualquier input)
          anyInputArb,
          // Delta time (hasta 1 segundo)
          fc.double({ min: 1, max: 1000, noNaN: true }),
          (startX: number, startY: number, input: DirectionInput, delta: number) => {
            const dir = calculateDirectionFromInput(input);
            const speed = GAME_CONSTANTS.PLAYER_BASE_SPEED;
            const deltaSeconds = delta / 1000;

            const newX = startX + dir.x * speed * deltaSeconds;
            const newY = startY + dir.y * speed * deltaSeconds;

            const clamped = clampPosition(newX, newY);
            expect(clamped.x).toBeGreaterThanOrEqual(0);
            expect(clamped.x).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_WIDTH);
            expect(clamped.y).toBeGreaterThanOrEqual(0);
            expect(clamped.y).toBeLessThanOrEqual(GAME_CONSTANTS.MAP_HEIGHT);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
