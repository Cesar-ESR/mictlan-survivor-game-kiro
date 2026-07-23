import { describe, it, expect } from 'vitest';
import {
  createMapGenerationConfig,
} from '../MapGenerationConfig';
import { createEmptyGrid, createEmptyCell } from '../MapCell';

describe('MapGenerationConfig — Defaults and validation (Task 3.7)', () => {
  it('creates config with correct defaults', () => {
    const config = createMapGenerationConfig('test-seed');

    expect(config.widthInTiles).toBe(100);
    expect(config.heightInTiles).toBe(100);
    expect(config.tileSize).toBe(32);
    expect(config.seed).toBe('test-seed');
    expect(config.safeZoneRadius).toBe(5);
    expect(config.minimumReachableRatio).toBe(0.85);
    expect(config.maxGenerationAttempts).toBe(5);
    expect(config.maxGenerationTimeMs).toBe(3000);
  });

  it('accepts numeric seed', () => {
    const config = createMapGenerationConfig(12345);
    expect(config.seed).toBe(12345);
  });

  it('allows overriding individual fields', () => {
    const config = createMapGenerationConfig('seed', {
      widthInTiles: 50,
      wallDensity: 0.2,
    });
    expect(config.widthInTiles).toBe(50);
    expect(config.wallDensity).toBe(0.2);
    expect(config.heightInTiles).toBe(100); // default preserved
  });

  it('computes correct world dimensions from defaults', () => {
    const config = createMapGenerationConfig('x');
    const worldWidth = config.widthInTiles * config.tileSize;
    const worldHeight = config.heightInTiles * config.tileSize;
    expect(worldWidth).toBe(3200);
    expect(worldHeight).toBe(3200);
  });

  describe('rejects invalid configurations', () => {
    it('rejects widthInTiles <= 0', () => {
      expect(() => createMapGenerationConfig('s', { widthInTiles: 0 })).toThrow();
      expect(() => createMapGenerationConfig('s', { widthInTiles: -1 })).toThrow();
    });

    it('rejects non-integer widthInTiles', () => {
      expect(() => createMapGenerationConfig('s', { widthInTiles: 10.5 })).toThrow();
    });

    it('rejects heightInTiles <= 0', () => {
      expect(() => createMapGenerationConfig('s', { heightInTiles: 0 })).toThrow();
    });

    it('rejects tileSize <= 0', () => {
      expect(() => createMapGenerationConfig('s', { tileSize: 0 })).toThrow();
    });

    it('rejects negative safeZoneRadius', () => {
      expect(() => createMapGenerationConfig('s', { safeZoneRadius: -1 })).toThrow();
    });

    it('rejects minimumReachableRatio outside [0, 1]', () => {
      expect(() => createMapGenerationConfig('s', { minimumReachableRatio: -0.1 })).toThrow();
      expect(() => createMapGenerationConfig('s', { minimumReachableRatio: 1.1 })).toThrow();
    });

    it('rejects density values outside [0, 1)', () => {
      expect(() => createMapGenerationConfig('s', { wallDensity: 1.0 })).toThrow();
      expect(() => createMapGenerationConfig('s', { wallDensity: -0.01 })).toThrow();
      expect(() => createMapGenerationConfig('s', { obstacleDensity: 1.0 })).toThrow();
      expect(() => createMapGenerationConfig('s', { liquidDensity: -1 })).toThrow();
      expect(() => createMapGenerationConfig('s', { decorationDensity: 2.0 })).toThrow();
    });

    it('rejects maxGenerationAttempts < 1', () => {
      expect(() => createMapGenerationConfig('s', { maxGenerationAttempts: 0 })).toThrow();
    });

    it('rejects maxGenerationTimeMs < 1', () => {
      expect(() => createMapGenerationConfig('s', { maxGenerationTimeMs: 0 })).toThrow();
    });
  });

  it('accepts edge-case valid values', () => {
    // All at boundary
    expect(() =>
      createMapGenerationConfig('s', {
        minimumReachableRatio: 0,
        wallDensity: 0,
        obstacleDensity: 0,
        liquidDensity: 0,
        decorationDensity: 0,
        safeZoneRadius: 0,
      }),
    ).not.toThrow();

    expect(() =>
      createMapGenerationConfig('s', { minimumReachableRatio: 1 }),
    ).not.toThrow();
  });
});

describe('MapCell — Grid creation (Task 3.8, Property 27)', () => {
  it('createEmptyCell returns correct default values', () => {
    const cell = createEmptyCell();
    expect(cell.walkable).toBe(true);
    expect(cell.ground).toBeNull();
    expect(cell.liquid).toBeNull();
    expect(cell.liquidConfig).toBeNull();
    expect(cell.wall).toBeNull();
    expect(cell.obstacle).toBeNull();
    expect(cell.decoration).toBeNull();
    expect(cell.border).toBeNull();
    expect(cell.inSafeZone).toBe(false);
  });

  it('createEmptyGrid produces exactly 100×100 grid with defaults', () => {
    const grid = createEmptyGrid(100, 100);

    expect(grid.length).toBe(100);
    for (let row = 0; row < 100; row++) {
      expect(grid[row].length).toBe(100);
    }
  });

  it('all cells in a new grid are walkable with null references', () => {
    const grid = createEmptyGrid(100, 100);

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        expect(cell.walkable).toBe(true);
        expect(cell.ground).toBeNull();
        expect(cell.wall).toBeNull();
        expect(cell.obstacle).toBeNull();
        expect(cell.inSafeZone).toBe(false);
      }
    }
  });

  it('each cell is an independent object (no shared references)', () => {
    const grid = createEmptyGrid(10, 10);
    grid[0][0].walkable = false;
    grid[0][0].inSafeZone = true;

    expect(grid[0][1].walkable).toBe(true);
    expect(grid[1][0].walkable).toBe(true);
    expect(grid[0][1].inSafeZone).toBe(false);
  });

  it('supports arbitrary dimensions', () => {
    const grid = createEmptyGrid(5, 3);
    expect(grid.length).toBe(3);   // rows = height
    expect(grid[0].length).toBe(5); // cols = width
  });

  it('rejects invalid dimensions', () => {
    expect(() => createEmptyGrid(0, 10)).toThrow();
    expect(() => createEmptyGrid(10, 0)).toThrow();
    expect(() => createEmptyGrid(-1, 5)).toThrow();
    expect(() => createEmptyGrid(5, -1)).toThrow();
    expect(() => createEmptyGrid(5.5, 10)).toThrow();
    expect(() => createEmptyGrid(10, 3.7)).toThrow();
  });

  it('grid dimensions match MapGenerationConfig defaults (100×100)', () => {
    const config = createMapGenerationConfig('test');
    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);

    expect(grid.length).toBe(config.heightInTiles);
    expect(grid[0].length).toBe(config.widthInTiles);

    // World dimensions
    const worldWidth = config.widthInTiles * config.tileSize;
    const worldHeight = config.heightInTiles * config.tileSize;
    expect(worldWidth).toBe(3200);
    expect(worldHeight).toBe(3200);
  });
});
