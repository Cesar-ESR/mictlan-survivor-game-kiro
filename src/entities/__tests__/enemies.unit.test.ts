import { describe, it, expect } from 'vitest';
import {
  calculateZigzagOffset,
  calculateChaseDirection,
  calculateAcceleration,
  calculateDistance,
} from '../enemies/enemy-movement.pure';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Unit tests for enemy archetypes.
 * **Validates: Requirements 9.1**
 */

describe('Enemy Archetypes Unit Tests', () => {
  describe('Murciélago - zigzag oscillation', () => {
    it('generates oscillation perpendicular to direction of advance', () => {
      // Direction of advance: straight right (1, 0)
      const direction = { x: 1, y: 0 };
      const phase = Math.PI / 6; // some phase value
      const amplitude = 40;
      const frequency = 3;

      const offset = calculateZigzagOffset(direction, phase, amplitude, frequency);

      // Perpendicular to (1, 0) is (0, 1) or (0, -1)
      // The offset should be along the y-axis only (no x component)
      expect(offset.x).toBeCloseTo(0, 10);
      // The y component should be non-zero (sin(PI/6 * 3) = sin(PI/2) = 1) × 40
      expect(offset.y).toBeCloseTo(40, 5);
    });

    it('zigzag offset is perpendicular to advance direction for arbitrary directions', () => {
      // Direction at 45 degrees
      const dir = calculateChaseDirection({ x: 0, y: 0 }, { x: 1, y: 1 });
      const phase = 1;
      const amplitude = 40;
      const frequency = 3;

      const offset = calculateZigzagOffset(dir, phase, amplitude, frequency);

      // Dot product of offset with direction should be ~0 (perpendicular)
      const dot = offset.x * dir.x + offset.y * dir.y;
      expect(dot).toBeCloseTo(0, 10);
    });
  });

  describe('CalaveraLlameante - explosion on defeat', () => {
    it('applies 15 damage if player within 100px on death', () => {
      const enemyPos = { x: 100, y: 100 };
      const playerPos = { x: 150, y: 100 }; // 50px away

      const distance = calculateDistance(enemyPos, playerPos);
      expect(distance).toBeLessThanOrEqual(GAME_CONSTANTS.EXPLOSION_RADIUS);

      // Simulate explosion logic
      const shouldExplode = distance <= GAME_CONSTANTS.EXPLOSION_RADIUS;
      expect(shouldExplode).toBe(true);
      expect(GAME_CONSTANTS.EXPLOSION_DAMAGE).toBe(15);
    });

    it('does NOT apply damage if player beyond 100px', () => {
      const enemyPos = { x: 100, y: 100 };
      const playerPos = { x: 300, y: 100 }; // 200px away

      const distance = calculateDistance(enemyPos, playerPos);
      expect(distance).toBeGreaterThan(GAME_CONSTANTS.EXPLOSION_RADIUS);

      const shouldExplode = distance <= GAME_CONSTANTS.EXPLOSION_RADIUS;
      expect(shouldExplode).toBe(false);
    });

    it('boundary: exactly 100px triggers explosion', () => {
      const enemyPos = { x: 0, y: 0 };
      const playerPos = { x: 100, y: 0 }; // exactly 100px

      const distance = calculateDistance(enemyPos, playerPos);
      expect(distance).toBe(100);

      const shouldExplode = distance <= GAME_CONSTANTS.EXPLOSION_RADIUS;
      expect(shouldExplode).toBe(true);
    });
  });

  describe('SerpienteEmplumada - progressive acceleration', () => {
    it('progressively accelerates speed', () => {
      let currentSpeed = 100;
      const acceleration = 30;
      const maxSpeed = 250;
      const deltaSeconds = 1; // 1 second

      // After 1 second: 100 + 30*1 = 130
      currentSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds);
      expect(currentSpeed).toBe(130);

      // After another second: 130 + 30*1 = 160
      currentSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds);
      expect(currentSpeed).toBe(160);

      // After another second: 160 + 30*1 = 190
      currentSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds);
      expect(currentSpeed).toBe(190);
    });

    it('does not exceed maxSpeed', () => {
      const currentSpeed = 240;
      const acceleration = 30;
      const maxSpeed = 250;
      const deltaSeconds = 1; // would go to 270 without cap

      const newSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds);
      expect(newSpeed).toBe(250);
      expect(newSpeed).toBeLessThanOrEqual(maxSpeed);
    });

    it('stays at maxSpeed once reached', () => {
      const currentSpeed = 250;
      const acceleration = 30;
      const maxSpeed = 250;
      const deltaSeconds = 1;

      const newSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, deltaSeconds);
      expect(newSpeed).toBe(250);
    });

    it('accelerates proportionally to delta time', () => {
      const currentSpeed = 100;
      const acceleration = 30;
      const maxSpeed = 250;

      // Small delta: 16ms frame
      const newSpeed = calculateAcceleration(currentSpeed, acceleration, maxSpeed, 0.016);
      expect(newSpeed).toBeCloseTo(100.48, 2);
    });
  });
});
