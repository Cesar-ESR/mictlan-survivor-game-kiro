import { describe, it, expect } from 'vitest';
import { calculateDirectionFromInput } from '../movement-utils';
import type { DirectionInput } from '../movement-utils';

/**
 * Unit tests para el sistema de movimiento.
 * Validates: Requirements 2.1, 2.2, 2.3
 */
describe('Movement Unit Tests', () => {
  /**
   * Test: immediate stop — cuando no hay teclas presionadas, dirección es (0, 0).
   * **Validates: Requirements 2.3**
   */
  it('returns (0, 0) when no keys are pressed (immediate stop)', () => {
    const input: DirectionInput = { up: false, down: false, left: false, right: false };
    const dir = calculateDirectionFromInput(input);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });

  /**
   * Test: 8 cardinal/diagonal directions — todas las combinaciones producen dirección correcta.
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('8 cardinal and diagonal directions', () => {
    it('up → (0, -1)', () => {
      const dir = calculateDirectionFromInput({ up: true, down: false, left: false, right: false });
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(-1);
    });

    it('down → (0, 1)', () => {
      const dir = calculateDirectionFromInput({ up: false, down: true, left: false, right: false });
      expect(dir.x).toBe(0);
      expect(dir.y).toBe(1);
    });

    it('left → (-1, 0)', () => {
      const dir = calculateDirectionFromInput({ up: false, down: false, left: true, right: false });
      expect(dir.x).toBe(-1);
      expect(dir.y).toBe(0);
    });

    it('right → (1, 0)', () => {
      const dir = calculateDirectionFromInput({ up: false, down: false, left: false, right: true });
      expect(dir.x).toBe(1);
      expect(dir.y).toBe(0);
    });

    it('up+left → normalized (-√2/2, -√2/2)', () => {
      const dir = calculateDirectionFromInput({ up: true, down: false, left: true, right: false });
      const expected = -Math.SQRT2 / 2;
      expect(dir.x).toBeCloseTo(expected, 10);
      expect(dir.y).toBeCloseTo(expected, 10);
    });

    it('up+right → normalized (√2/2, -√2/2)', () => {
      const dir = calculateDirectionFromInput({ up: true, down: false, left: false, right: true });
      expect(dir.x).toBeCloseTo(Math.SQRT2 / 2, 10);
      expect(dir.y).toBeCloseTo(-Math.SQRT2 / 2, 10);
    });

    it('down+left → normalized (-√2/2, √2/2)', () => {
      const dir = calculateDirectionFromInput({ up: false, down: true, left: true, right: false });
      expect(dir.x).toBeCloseTo(-Math.SQRT2 / 2, 10);
      expect(dir.y).toBeCloseTo(Math.SQRT2 / 2, 10);
    });

    it('down+right → normalized (√2/2, √2/2)', () => {
      const dir = calculateDirectionFromInput({ up: false, down: true, left: false, right: true });
      expect(dir.x).toBeCloseTo(Math.SQRT2 / 2, 10);
      expect(dir.y).toBeCloseTo(Math.SQRT2 / 2, 10);
    });
  });

  /**
   * Test: diagonal magnitude normalized — la magnitud del vector diagonal es 1 (no √2).
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('diagonal magnitude is normalized to 1', () => {
    const diagonals: { name: string; input: DirectionInput }[] = [
      { name: 'up+left', input: { up: true, down: false, left: true, right: false } },
      { name: 'up+right', input: { up: true, down: false, left: false, right: true } },
      { name: 'down+left', input: { up: false, down: true, left: true, right: false } },
      { name: 'down+right', input: { up: false, down: true, left: false, right: true } },
    ];

    diagonals.forEach(({ name, input }) => {
      it(`${name} has magnitude = 1`, () => {
        const dir = calculateDirectionFromInput(input);
        const magnitude = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        expect(magnitude).toBeCloseTo(1, 10);
      });
    });
  });
});
