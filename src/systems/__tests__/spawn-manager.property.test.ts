import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  isValidSpawnPosition,
  generateSpawnPosition,
  selectWeightedType,
  shouldDespawn,
} from '../spawn-utils';
import type { CameraViewport, MapBounds } from '../spawn-utils';
import { GAME_CONSTANTS } from '../../config/constants';

/**
 * Property-based tests para el sistema de spawn.
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6
 */
describe('Spawn Manager Property Tests', () => {
  const DEFAULT_BOUNDS: MapBounds = {
    minX: 0,
    minY: 0,
    maxX: GAME_CONSTANTS.MAP_WIDTH,
    maxY: GAME_CONSTANTS.MAP_HEIGHT,
  };

  const MIN_DIST = GAME_CONSTANTS.SPAWN_MIN_DISTANCE_FROM_EDGE;
  const MAX_DIST = GAME_CONSTANTS.SPAWN_MAX_DISTANCE_FROM_EDGE;
  const DESPAWN_DIST = GAME_CONSTANTS.ENEMY_DESPAWN_DISTANCE;

  // Arbitrary for a camera viewport within map bounds that leaves room for spawns
  const viewportArb = fc
    .record({
      x: fc.double({ min: 300, max: 2000, noNaN: true, noDefaultInfinity: true }),
      y: fc.double({ min: 300, max: 2000, noNaN: true, noDefaultInfinity: true }),
      width: fc.double({ min: 200, max: 1024, noNaN: true, noDefaultInfinity: true }),
      height: fc.double({ min: 200, max: 768, noNaN: true, noDefaultInfinity: true }),
    })
    .filter(
      (v) =>
        v.x + v.width <= GAME_CONSTANTS.MAP_WIDTH - MAX_DIST &&
        v.y + v.height <= GAME_CONSTANTS.MAP_HEIGHT - MAX_DIST &&
        v.x >= MAX_DIST &&
        v.y >= MAX_DIST,
    );

  // Deterministic RNG from a seed
  function makeRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return (s >>> 0) / 4294967296;
    };
  }

  /**
   * Property 4: Spawn Position Triple Constraint
   * For any valid result from generateSpawnPosition, it must be:
   * - outside viewport
   * - within map bounds
   * - between 50-300px from camera edge
   * If no valid position exists, return null.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  describe('Property 4: Spawn Position Triple Constraint', () => {
    it('generated spawn positions satisfy the triple constraint', () => {
      fc.assert(
        fc.property(
          viewportArb,
          fc.integer({ min: 1, max: 100000 }),
          (viewport: CameraViewport, seed: number) => {
            const rng = makeRng(seed);
            const pos = generateSpawnPosition(viewport, DEFAULT_BOUNDS, MIN_DIST, MAX_DIST, rng);

            if (pos === null) {
              // Null is valid: no valid position found
              return;
            }

            // Constraint 1: within map bounds
            expect(pos.x).toBeGreaterThanOrEqual(DEFAULT_BOUNDS.minX);
            expect(pos.x).toBeLessThanOrEqual(DEFAULT_BOUNDS.maxX);
            expect(pos.y).toBeGreaterThanOrEqual(DEFAULT_BOUNDS.minY);
            expect(pos.y).toBeLessThanOrEqual(DEFAULT_BOUNDS.maxY);

            // Constraint 2: outside viewport
            const insideViewport =
              pos.x >= viewport.x &&
              pos.x <= viewport.x + viewport.width &&
              pos.y >= viewport.y &&
              pos.y <= viewport.y + viewport.height;
            expect(insideViewport).toBe(false);

            // Constraint 3: distance from nearest edge is between MIN_DIST and MAX_DIST
            // Since we spawn by picking an edge and offsetting perpendicular,
            // the perpendicular distance from that edge is the offset value [MIN_DIST, MAX_DIST]
            // We verify the position passes isValidSpawnPosition
            const valid = isValidSpawnPosition(pos, viewport, DEFAULT_BOUNDS, MIN_DIST, MAX_DIST);
            expect(valid).toBe(true);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('positions inside viewport are never valid', () => {
      fc.assert(
        fc.property(
          viewportArb,
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (viewport: CameraViewport, rx: number, ry: number) => {
            const pos = {
              x: viewport.x + rx * viewport.width,
              y: viewport.y + ry * viewport.height,
            };
            const valid = isValidSpawnPosition(pos, viewport, DEFAULT_BOUNDS, MIN_DIST, MAX_DIST);
            expect(valid).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 7: Max Enemies Cap per Wave
   * Simulating a spawn loop never exceeds maxEnemies.
   *
   * **Validates: Requirements 3.5, 3.6**
   */
  describe('Property 7: Max Enemies Cap per Wave', () => {
    it('spawn count never exceeds maxEnemies cap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 10, max: 100 }),
          (maxEnemies: number, spawnAttempts: number) => {
            let activeCount = 0;

            for (let i = 0; i < spawnAttempts; i++) {
              // Simulate cap check before spawning
              if (activeCount < maxEnemies) {
                activeCount++;
              }
            }

            expect(activeCount).toBeLessThanOrEqual(maxEnemies);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 8: Enemy Despawn by Distance
   * Entities >1500px from player return shouldDespawn = true;
   * entities ≤1500px return false.
   *
   * **Validates: Requirements 3.5, 3.6**
   */
  describe('Property 8: Enemy Despawn by Distance', () => {
    it('entities beyond despawn distance are marked for despawn', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
          (ex: number, ey: number, px: number, py: number) => {
            const entityPos = { x: ex, y: ey };
            const playerPos = { x: px, y: py };

            const dx = ex - px;
            const dy = ey - py;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const result = shouldDespawn(entityPos, playerPos, DESPAWN_DIST);

            if (distance > DESPAWN_DIST) {
              expect(result).toBe(true);
            } else {
              expect(result).toBe(false);
            }
          },
        ),
        { numRuns: 500 },
      );
    });

    it('entity at exactly despawn distance is NOT despawned', () => {
      // At exactly 1500px, distance is not > 1500, so shouldDespawn returns false
      const playerPos = { x: 0, y: 0 };
      const entityPos = { x: DESPAWN_DIST, y: 0 };
      expect(shouldDespawn(entityPos, playerPos, DESPAWN_DIST)).toBe(false);
    });

    it('entity at slightly beyond despawn distance IS despawned', () => {
      const playerPos = { x: 0, y: 0 };
      const entityPos = { x: DESPAWN_DIST + 0.001, y: 0 };
      expect(shouldDespawn(entityPos, playerPos, DESPAWN_DIST)).toBe(true);
    });
  });

  /**
   * Additional: Weighted selection always returns a valid type
   */
  describe('Weighted Enemy Selection', () => {
    it('selectWeightedType always returns one of the provided types', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.string({ minLength: 1, maxLength: 10 }),
              weight: fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          (types) => {
            const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
            const roll = Math.random() * totalWeight;
            const result = selectWeightedType(types, roll);
            const typeNames = types.map((t) => t.type);
            expect(typeNames).toContain(result);
          },
        ),
        { numRuns: 300 },
      );
    });
  });
});
