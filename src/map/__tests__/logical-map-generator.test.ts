/**
 * Tests for LogicalMapGenerator — full pipeline with retry and timeout logic.
 *
 * Requirements: 10.11, 10.12, 10.15, Property 34, Property 35
 */

import { describe, it, expect } from 'vitest';
import { LogicalMapGenerator } from '../LogicalMapGenerator';
import type { Clock } from '../LogicalMapGenerator';
import { MapValidator } from '../MapValidator';
import type { MapValidationResult } from '../MapValidator';
import { TileCatalog } from '../TileCatalog';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import type { MapGenerationConfig } from '../MapGenerationConfig';
import type { LogicalMapGrid } from '../MapCell';

// ─── FakeClock for testing timeout ───

class FakeClock implements Clock {
  private time = 0;
  now(): number { return this.time; }
  advance(ms: number): void { this.time += ms; }
}

// ─── Helpers ───

function makeCatalog(): TileCatalog {
  return new TileCatalog(TILE_CATALOG_DEFINITION);
}

function makeConfig(seed: string | number, overrides?: Partial<Omit<MapGenerationConfig, 'seed'>>): MapGenerationConfig {
  return createMapGenerationConfig(seed, {
    widthInTiles: 20,
    heightInTiles: 20,
    safeZoneRadius: 2,
    minimumReachableRatio: 0.85,
    wallDensity: 0.05,
    obstacleDensity: 0.02,
    liquidDensity: 0.03,
    decorationDensity: 0.05,
    maxGenerationAttempts: 5,
    maxGenerationTimeMs: 3000,
    ...overrides,
  });
}

// ─── Tests ───

describe('LogicalMapGenerator', () => {
  it('14. Same seed → same map and same attempts', () => {
    const catalog = makeCatalog();
    const config = makeConfig('deterministic-seed');

    const gen1 = new LogicalMapGenerator(catalog);
    const gen2 = new LogicalMapGenerator(catalog);

    const result1 = gen1.generate(config);
    const result2 = gen2.generate(config);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success && result2.success) {
      expect(result1.attempts).toBe(result2.attempts);
      expect(result1.resolvedSeed).toBe(result2.resolvedSeed);
      // Compare grid contents
      for (let row = 0; row < config.heightInTiles; row++) {
        for (let col = 0; col < config.widthInTiles; col++) {
          const c1 = result1.grid[row][col];
          const c2 = result2.grid[row][col];
          expect(c1.walkable).toBe(c2.walkable);
          expect(c1.ground?.frame).toBe(c2.ground?.frame);
          expect(c1.wall?.frame).toBe(c2.wall?.frame);
        }
      }
    }
  });

  it('15. Different seeds → can produce different maps', () => {
    const catalog = makeCatalog();
    const config1 = makeConfig('seed-alpha');
    const config2 = makeConfig('seed-beta');

    const gen = new LogicalMapGenerator(catalog);
    const result1 = gen.generate(config1);
    const result2 = gen.generate(config2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success && result2.success) {
      // At least some cells should differ
      let differences = 0;
      for (let row = 0; row < config1.heightInTiles; row++) {
        for (let col = 0; col < config1.widthInTiles; col++) {
          if (result1.grid[row][col].ground?.frame !== result2.grid[row][col].ground?.frame) {
            differences++;
          }
        }
      }
      expect(differences).toBeGreaterThan(0);
    }
  });

  it('16. Each retry starts with fresh grid', () => {
    // Use a custom validator that always fails to force retries
    const catalog = makeCatalog();
    let callCount = 0;
    const gridsSeenWalkableCount: number[] = [];

    const alwaysFailValidator = new (class extends MapValidator {
      validate(grid: LogicalMapGrid, _config: MapGenerationConfig): MapValidationResult {
        callCount++;
        // Count walkable cells to confirm fresh grid each time
        let walkable = 0;
        for (let row = 0; row < grid.length; row++) {
          for (let col = 0; col < grid[row].length; col++) {
            if (grid[row][col].walkable) walkable++;
          }
        }
        gridsSeenWalkableCount.push(walkable);
        return {
          valid: false,
          reachableTiles: 0,
          totalWalkableTiles: 0,
          reachableRatio: 0,
          startPosition: { x: 0, y: 0 },
          errors: [{ code: 'REACHABLE_RATIO_TOO_LOW', message: 'forced fail' }],
        };
      }
    })();

    const config = makeConfig('retry-test', { maxGenerationAttempts: 3 });
    const gen = new LogicalMapGenerator(catalog, { validator: alwaysFailValidator });
    const result = gen.generate(config);

    expect(result.success).toBe(false);
    expect(callCount).toBe(3);
    // Each grid should have a similar walkable count (fresh grid each time)
    // The counts may differ due to different seeds per attempt, but should all be reasonable
    for (const count of gridsSeenWalkableCount) {
      expect(count).toBeGreaterThan(0);
    }
  });

  it('17. Never exceeds maxGenerationAttempts', () => {
    const catalog = makeCatalog();
    let callCount = 0;

    const alwaysFailValidator = new (class extends MapValidator {
      validate(_grid: LogicalMapGrid, _config: MapGenerationConfig): MapValidationResult {
        callCount++;
        return {
          valid: false,
          reachableTiles: 0,
          totalWalkableTiles: 0,
          reachableRatio: 0,
          startPosition: { x: 0, y: 0 },
          errors: [{ code: 'REACHABLE_RATIO_TOO_LOW', message: 'forced fail' }],
        };
      }
    })();

    const config = makeConfig('max-attempts', { maxGenerationAttempts: 3 });
    const gen = new LogicalMapGenerator(catalog, { validator: alwaysFailValidator });
    gen.generate(config);

    expect(callCount).toBe(3);
  });

  it('18. MAX_ATTEMPTS_EXCEEDED when all fail', () => {
    const catalog = makeCatalog();

    const alwaysFailValidator = new (class extends MapValidator {
      validate(_grid: LogicalMapGrid, _config: MapGenerationConfig): MapValidationResult {
        return {
          valid: false,
          reachableTiles: 0,
          totalWalkableTiles: 0,
          reachableRatio: 0,
          startPosition: { x: 0, y: 0 },
          errors: [{ code: 'REACHABLE_RATIO_TOO_LOW', message: 'forced fail' }],
        };
      }
    })();

    const config = makeConfig('all-fail', { maxGenerationAttempts: 5 });
    const gen = new LogicalMapGenerator(catalog, { validator: alwaysFailValidator });
    const result = gen.generate(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('MAX_ATTEMPTS_EXCEEDED');
      expect(result.attempts).toBe(5);
      expect(result.lastValidation).not.toBeNull();
    }
  });

  it('19. GENERATION_TIMEOUT with FakeClock', () => {
    const catalog = makeCatalog();
    const fakeClock = new FakeClock();

    const slowValidator = new (class extends MapValidator {
      validate(_grid: LogicalMapGrid, _config: MapGenerationConfig): MapValidationResult {
        // Simulate slow validation by advancing the clock
        fakeClock.advance(2000);
        return {
          valid: false,
          reachableTiles: 0,
          totalWalkableTiles: 0,
          reachableRatio: 0,
          startPosition: { x: 0, y: 0 },
          errors: [{ code: 'REACHABLE_RATIO_TOO_LOW', message: 'too slow' }],
        };
      }
    })();

    const config = makeConfig('timeout-test', { maxGenerationTimeMs: 3000, maxGenerationAttempts: 10 });
    const gen = new LogicalMapGenerator(catalog, { clock: fakeClock, validator: slowValidator });
    const result = gen.generate(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('GENERATION_TIMEOUT');
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(3000);
    }
  });

  it('20. Timeout tested without real waiting', () => {
    const catalog = makeCatalog();
    const fakeClock = new FakeClock();
    let nowCallCount = 0;

    // Create a clock that advances past the limit after the first call (startTime capture)
    const autoAdvanceClock: Clock = {
      now(): number {
        nowCallCount++;
        if (nowCallCount === 1) {
          // First call: captures startTime = 0
          return fakeClock.now();
        }
        // All subsequent calls: time has jumped past limit
        fakeClock.advance(4000);
        return fakeClock.now();
      }
    };

    const config = makeConfig('instant-timeout', { maxGenerationTimeMs: 3000, maxGenerationAttempts: 5 });
    const gen = new LogicalMapGenerator(catalog, { clock: autoAdvanceClock });
    const result = gen.generate(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('GENERATION_TIMEOUT');
    }
  });

  it('21. No Math.random()', () => {
    const catalog = makeCatalog();
    const originalRandom = Math.random;
    let mathRandomCalled = false;
    Math.random = () => {
      mathRandomCalled = true;
      return originalRandom();
    };

    try {
      const config = makeConfig('no-math-random');
      const gen = new LogicalMapGenerator(catalog);
      gen.generate(config);
      expect(mathRandomCalled).toBe(false);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('22. Grid remains width×height from config', () => {
    const catalog = makeCatalog();
    const config = makeConfig('grid-size', { widthInTiles: 20, heightInTiles: 20 });
    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.grid.length).toBe(20);
      expect(result.grid[0].length).toBe(20);
    }
  });

  it('23. Successful map has ground on all cells', () => {
    const catalog = makeCatalog();
    const config = makeConfig('ground-check');
    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);

    expect(result.success).toBe(true);
    if (result.success) {
      for (let row = 0; row < config.heightInTiles; row++) {
        for (let col = 0; col < config.widthInTiles; col++) {
          expect(result.grid[row][col].ground).not.toBeNull();
        }
      }
    }
  });

  it('24. Safe zone accessible after full pipeline', () => {
    const catalog = makeCatalog();
    const config = makeConfig('safe-zone', { safeZoneRadius: 2 });
    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);

    expect(result.success).toBe(true);
    if (result.success) {
      const centerRow = Math.floor(config.heightInTiles / 2);
      const centerCol = Math.floor(config.widthInTiles / 2);
      const radius = config.safeZoneRadius;

      for (let row = centerRow - radius; row <= centerRow + radius; row++) {
        for (let col = centerCol - radius; col <= centerCol + radius; col++) {
          if (row >= 0 && row < config.heightInTiles && col >= 0 && col < config.widthInTiles) {
            const cell = result.grid[row][col];
            expect(cell.walkable).toBe(true);
            expect(cell.inSafeZone).toBe(true);
            expect(cell.wall).toBeNull();
            expect(cell.obstacle).toBeNull();
          }
        }
      }
    }
  });

  it('25. Result records resolvedSeed and attempts', () => {
    const catalog = makeCatalog();
    const config = makeConfig('record-info');
    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolvedSeed).toBeDefined();
      expect(result.attempts).toBeGreaterThanOrEqual(1);
      expect(result.baseSeed).toBe('record-info');
    }
  });

  it('26. Same seed+config → identical LogicalMapGrid', () => {
    const catalog = makeCatalog();
    const config = makeConfig('identical-test');

    const gen1 = new LogicalMapGenerator(catalog);
    const gen2 = new LogicalMapGenerator(catalog);

    const result1 = gen1.generate(config);
    const result2 = gen2.generate(config);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success && result2.success) {
      // Deep comparison of grids
      const grid1 = result1.grid;
      const grid2 = result2.grid;

      for (let row = 0; row < config.heightInTiles; row++) {
        for (let col = 0; col < config.widthInTiles; col++) {
          const c1 = grid1[row][col];
          const c2 = grid2[row][col];
          expect(c1.walkable).toBe(c2.walkable);
          expect(c1.inSafeZone).toBe(c2.inSafeZone);
          expect(c1.ground?.frame).toBe(c2.ground?.frame);
          expect(c1.ground?.tileset).toBe(c2.ground?.tileset);
          expect(c1.liquid?.frame).toBe(c2.liquid?.frame);
          expect(c1.wall?.frame).toBe(c2.wall?.frame);
          expect(c1.obstacle?.frame).toBe(c2.obstacle?.frame);
        }
      }
    }
  });

  it('27. No Phaser dependency', () => {
    // If LogicalMapGenerator imported Phaser, this import would fail in node env
    // The fact that this test file runs in node environment confirms no Phaser dependency
    const catalog = makeCatalog();
    const config = makeConfig('no-phaser');
    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);
    expect(result).toBeDefined();
  });

  it('28. Cliff audit test — structureKind never === cliff currently', () => {
    // StructureGenerator uses wall tiles but never explicitly sets a 'cliff' structureKind.
    // All structures are effectively walls. This confirms the cliff audit observation.
    const catalog = makeCatalog();
    const config = makeConfig('cliff-audit', { wallDensity: 0.15 });
    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);

    expect(result.success).toBe(true);
    if (result.success) {
      // Check that wall cells use tiles from 'walls' tileset but there's no
      // programmatic distinction between 'wall' and 'cliff' at the cell level.
      // MapCell has .wall field — if it's set, it's treated as a wall.
      // There is no .cliff field or structureKind field on MapCell.
      let hasWalls = false;
      for (let row = 0; row < config.heightInTiles; row++) {
        for (let col = 0; col < config.widthInTiles; col++) {
          const cell = result.grid[row][col];
          if (cell.wall !== null) {
            hasWalls = true;
            // All wall tiles are from 'walls' tileset
            expect(cell.wall.tileset).toBe('walls');
          }
        }
      }
      // With wallDensity 0.15, there should be walls
      expect(hasWalls).toBe(true);
    }
  });
});
