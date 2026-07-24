/**
 * Tests for DecorationGenerator and SafeZoneCleaner.
 *
 * Requirements: 10.7, 10.8, 10.11, Property 30
 */

import { describe, it, expect } from 'vitest';
import { createEmptyGrid } from '../MapCell';
import type { LogicalMapGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import type { MapGenerationConfig } from '../MapGenerationConfig';
import { TileCatalog } from '../TileCatalog';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';
import { SeededRandom } from '../SeededRandom';
import { generateGround, markSafeZone } from '../GroundGenerator';
import { generateLiquidRegions } from '../LiquidRegionGenerator';
import { computeAllBorderMasks } from '../BorderTopology';
import { generateWallsAndCliffs } from '../StructureGenerator';
import { generateObstacles } from '../ObstacleGenerator';
import { generateDecorations } from '../DecorationGenerator';
import { clearSafeZone } from '../SafeZoneCleaner';
import { LogicalMapGenerator } from '../LogicalMapGenerator';
import { MapValidator } from '../MapValidator';

// ─── Helpers ───

function makeCatalog(): TileCatalog {
  return new TileCatalog(TILE_CATALOG_DEFINITION);
}

function makeConfig(seed: string | number, overrides?: Partial<Omit<MapGenerationConfig, 'seed'>>): MapGenerationConfig {
  return createMapGenerationConfig(seed, {
    widthInTiles: 100,
    heightInTiles: 100,
    safeZoneRadius: 5,
    minimumReachableRatio: 0.85,
    wallDensity: 0.1,
    obstacleDensity: 0.05,
    liquidDensity: 0.08,
    decorationDensity: 0.1,
    maxGenerationAttempts: 5,
    maxGenerationTimeMs: 5000,
    ...overrides,
  });
}

/**
 * Runs the full pipeline manually (without LogicalMapGenerator)
 * to test individual components in isolation.
 */
function runFullPipeline(seed: string | number): { grid: LogicalMapGrid; config: MapGenerationConfig } {
  const catalog = makeCatalog();
  const config = makeConfig(seed);
  const rng = new SeededRandom(config.seed);

  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);
  generateLiquidRegions(grid, config, rng, catalog);
  computeAllBorderMasks(grid);
  generateWallsAndCliffs(grid, config, rng, catalog);
  generateObstacles(grid, config, rng, catalog);
  generateDecorations(grid, config, rng, catalog);
  clearSafeZone(grid);

  return { grid, config };
}

// ─── DecorationGenerator Tests ───

describe('DecorationGenerator', () => {
  it('1. Same seed → same decorations', () => {
    const catalog = makeCatalog();
    const config = makeConfig('deco-determinism');

    const rng1 = new SeededRandom(config.seed);
    const grid1 = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid1, rng1, catalog);
    markSafeZone(grid1, config);
    generateLiquidRegions(grid1, config, rng1, catalog);
    computeAllBorderMasks(grid1);
    generateWallsAndCliffs(grid1, config, rng1, catalog);
    generateObstacles(grid1, config, rng1, catalog);
    generateDecorations(grid1, config, rng1, catalog);

    const rng2 = new SeededRandom(config.seed);
    const grid2 = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid2, rng2, catalog);
    markSafeZone(grid2, config);
    generateLiquidRegions(grid2, config, rng2, catalog);
    computeAllBorderMasks(grid2);
    generateWallsAndCliffs(grid2, config, rng2, catalog);
    generateObstacles(grid2, config, rng2, catalog);
    generateDecorations(grid2, config, rng2, catalog);

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        expect(grid1[row][col].decoration?.frame).toBe(grid2[row][col].decoration?.frame);
        expect(grid1[row][col].decoration?.tileset).toBe(grid2[row][col].decoration?.tileset);
      }
    }
  });

  it('2. Different seeds → different decorations', () => {
    const catalog = makeCatalog();
    const config1 = makeConfig('deco-seed-a');
    const config2 = makeConfig('deco-seed-b');

    const rng1 = new SeededRandom(config1.seed);
    const grid1 = createEmptyGrid(config1.widthInTiles, config1.heightInTiles);
    generateGround(grid1, rng1, catalog);
    markSafeZone(grid1, config1);
    generateDecorations(grid1, config1, rng1, catalog);

    const rng2 = new SeededRandom(config2.seed);
    const grid2 = createEmptyGrid(config2.widthInTiles, config2.heightInTiles);
    generateGround(grid2, rng2, catalog);
    markSafeZone(grid2, config2);
    generateDecorations(grid2, config2, rng2, catalog);

    let differences = 0;
    for (let row = 0; row < config1.heightInTiles; row++) {
      for (let col = 0; col < config1.widthInTiles; col++) {
        if (grid1[row][col].decoration?.frame !== grid2[row][col].decoration?.frame) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('3. Only frames 0–51 used', () => {
    const { grid, config } = runFullPipeline('frames-valid');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const deco = grid[row][col].decoration;
        if (deco !== null) {
          expect(deco.frame).toBeGreaterThanOrEqual(0);
          expect(deco.frame).toBeLessThanOrEqual(51);
          expect(deco.tileset).toBe('decorations');
        }
      }
    }
  });

  it('4. Never frames 52–255', () => {
    const { grid, config } = runFullPipeline('frames-invalid-check');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const deco = grid[row][col].decoration;
        if (deco !== null) {
          expect(deco.frame).toBeLessThan(52);
        }
      }
    }
  });

  it('5. No decoration on liquids', () => {
    const { grid, config } = runFullPipeline('no-deco-on-liquid');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null) {
          expect(cell.decoration).toBeNull();
        }
      }
    }
  });

  it('6. No decoration on walls', () => {
    const { grid, config } = runFullPipeline('no-deco-on-walls');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (cell.wall !== null) {
          expect(cell.decoration).toBeNull();
        }
      }
    }
  });

  it('7. No decoration on obstacles', () => {
    const { grid, config } = runFullPipeline('no-deco-on-obstacles');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (cell.obstacle !== null) {
          expect(cell.decoration).toBeNull();
        }
      }
    }
  });

  it('8. No decoration in safe zone (after clearSafeZone)', () => {
    const { grid, config } = runFullPipeline('no-deco-in-safezone');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (cell.inSafeZone) {
          expect(cell.decoration).toBeNull();
        }
      }
    }
  });

  it('9. Ground preserved after decorations', () => {
    const { grid, config } = runFullPipeline('ground-preserved');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        expect(grid[row][col].ground).not.toBeNull();
      }
    }
  });

  it('10. walkable NOT modified by decorations', () => {
    const catalog = makeCatalog();
    const config = makeConfig('walkable-unchanged');
    const rng = new SeededRandom(config.seed);

    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);
    generateLiquidRegions(grid, config, rng, catalog);
    computeAllBorderMasks(grid);
    generateWallsAndCliffs(grid, config, rng, catalog);
    generateObstacles(grid, config, rng, catalog);

    // Snapshot walkable state BEFORE decorations
    const walkableBefore: boolean[][] = [];
    for (let row = 0; row < config.heightInTiles; row++) {
      walkableBefore.push([]);
      for (let col = 0; col < config.widthInTiles; col++) {
        walkableBefore[row].push(grid[row][col].walkable);
      }
    }

    generateDecorations(grid, config, rng, catalog);

    // walkable must be unchanged
    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        expect(grid[row][col].walkable).toBe(walkableBefore[row][col]);
      }
    }
  });

  it('11. structureMask NOT modified by decorations', () => {
    const catalog = makeCatalog();
    const config = makeConfig('structuremask-unchanged');
    const rng = new SeededRandom(config.seed);

    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);
    generateLiquidRegions(grid, config, rng, catalog);
    computeAllBorderMasks(grid);
    generateWallsAndCliffs(grid, config, rng, catalog);
    generateObstacles(grid, config, rng, catalog);

    // Snapshot structureMask BEFORE decorations
    const maskBefore: (number | null)[][] = [];
    for (let row = 0; row < config.heightInTiles; row++) {
      maskBefore.push([]);
      for (let col = 0; col < config.widthInTiles; col++) {
        maskBefore[row].push(grid[row][col].structureMask);
      }
    }

    generateDecorations(grid, config, rng, catalog);

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        expect(grid[row][col].structureMask).toBe(maskBefore[row][col]);
      }
    }
  });

  it('12. borderMask NOT modified by decorations', () => {
    const catalog = makeCatalog();
    const config = makeConfig('bordermask-unchanged');
    const rng = new SeededRandom(config.seed);

    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);
    generateLiquidRegions(grid, config, rng, catalog);
    computeAllBorderMasks(grid);
    generateWallsAndCliffs(grid, config, rng, catalog);
    generateObstacles(grid, config, rng, catalog);

    // Snapshot borderMask BEFORE decorations
    const maskBefore: (number | null)[][] = [];
    for (let row = 0; row < config.heightInTiles; row++) {
      maskBefore.push([]);
      for (let col = 0; col < config.widthInTiles; col++) {
        maskBefore[row].push(grid[row][col].borderMask);
      }
    }

    generateDecorations(grid, config, rng, catalog);

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        expect(grid[row][col].borderMask).toBe(maskBefore[row][col]);
      }
    }
  });

  it('13. Density within tolerance', () => {
    const catalog = makeCatalog();
    const config = makeConfig('density-check');
    const rng = new SeededRandom(config.seed);

    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);
    generateDecorations(grid, config, rng, catalog);

    const totalCells = config.widthInTiles * config.heightInTiles;
    const target = Math.floor(totalCells * config.decorationDensity);
    const tolerance = Math.floor(totalCells * 0.02);

    let decorationCount = 0;
    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        if (grid[row][col].decoration !== null) {
          decorationCount++;
        }
      }
    }

    // Decorations placed should be near target (within tolerance)
    // May be less than target if not enough valid cells, but should not exceed max
    expect(decorationCount).toBeLessThanOrEqual(target + tolerance);
    expect(decorationCount).toBeGreaterThan(0);
  });

  it('14. No Phaser dependency', () => {
    // If DecorationGenerator imported Phaser, this import would fail in node env
    const catalog = makeCatalog();
    const config = makeConfig('no-phaser-deco');
    const rng = new SeededRandom(config.seed);
    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    generateGround(grid, rng, catalog);
    generateDecorations(grid, config, rng, catalog);
    expect(grid).toBeDefined();
  });

  it('15. No Math.random()', () => {
    const catalog = makeCatalog();
    const originalRandom = Math.random;
    let mathRandomCalled = false;
    Math.random = () => {
      mathRandomCalled = true;
      return originalRandom();
    };

    try {
      const config = makeConfig('no-math-random-deco');
      const rng = new SeededRandom(config.seed);
      const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
      generateGround(grid, rng, catalog);
      markSafeZone(grid, config);
      generateDecorations(grid, config, rng, catalog);
      expect(mathRandomCalled).toBe(false);
    } finally {
      Math.random = originalRandom;
    }
  });
});

// ─── SafeZoneCleaner Tests ───

describe('SafeZoneCleaner', () => {
  it('16. Safe zone: no walls after clear', () => {
    const { grid, config } = runFullPipeline('sz-no-walls');

    const centerRow = Math.floor(config.heightInTiles / 2);
    const centerCol = Math.floor(config.widthInTiles / 2);
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        if (row >= 0 && row < config.heightInTiles && col >= 0 && col < config.widthInTiles) {
          expect(grid[row][col].wall).toBeNull();
        }
      }
    }
  });

  it('17. Safe zone: no obstacles after clear', () => {
    const { grid, config } = runFullPipeline('sz-no-obstacles');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        if (grid[row][col].inSafeZone) {
          expect(grid[row][col].obstacle).toBeNull();
        }
      }
    }
  });

  it('18. Safe zone: no blocking liquids after clear', () => {
    const { grid, config } = runFullPipeline('sz-no-blocking-liquids');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (cell.inSafeZone) {
          if (cell.liquidConfig !== null) {
            expect(cell.liquidConfig.behavior).not.toBe('blocking');
          }
        }
      }
    }
  });

  it('19. Safe zone: all cells walkable=true', () => {
    const { grid, config } = runFullPipeline('sz-all-walkable');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        if (grid[row][col].inSafeZone) {
          expect(grid[row][col].walkable).toBe(true);
        }
      }
    }
  });

  it('20. Safe zone: ground preserved (121 cells for radius=5)', () => {
    const { grid, config } = runFullPipeline('sz-ground-preserved');

    const centerRow = Math.floor(config.heightInTiles / 2);
    const centerCol = Math.floor(config.widthInTiles / 2);
    const radius = config.safeZoneRadius;

    let safeZoneCellCount = 0;
    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        if (row >= 0 && row < config.heightInTiles && col >= 0 && col < config.widthInTiles) {
          expect(grid[row][col].ground).not.toBeNull();
          safeZoneCellCount++;
        }
      }
    }
    // radius=5 → (2*5+1)^2 = 121 cells
    expect(safeZoneCellCount).toBe(121);
  });

  it('21. Safe zone: structureMask null', () => {
    const { grid, config } = runFullPipeline('sz-structuremask-null');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (cell.inSafeZone) {
          // Safe zone cells have no wall/obstacle, so structureMask should be null
          expect(cell.structureMask).toBeNull();
        }
      }
    }
  });

  it('22. Safe zone: decorations removed', () => {
    const { grid, config } = runFullPipeline('sz-no-decorations');

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        if (grid[row][col].inSafeZone) {
          expect(grid[row][col].decoration).toBeNull();
        }
      }
    }
  });

  it('23. Safe zone: borderMask consistent with actual neighbors', () => {
    const { grid, config } = runFullPipeline('sz-border-consistency');

    const CARDINAL: Array<[number, number, number]> = [
      [-1, 0, 1],
      [0, 1, 2],
      [1, 0, 4],
      [0, -1, 8],
    ];

    for (let row = 0; row < config.heightInTiles; row++) {
      for (let col = 0; col < config.widthInTiles; col++) {
        const cell = grid[row][col];
        if (!cell.inSafeZone) continue;

        // Compute expected mask manually (matches computeNeighborTransitionMask: liquid OR wall)
        let expectedMask = 0;
        for (const [dr, dc, bit] of CARDINAL) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < config.heightInTiles && nc >= 0 && nc < config.widthInTiles) {
            if (grid[nr][nc].liquid !== null || grid[nr][nc].wall !== null) {
              expectedMask |= bit;
            }
          }
        }

        if (cell.liquid !== null) {
          // Liquid cells get borderMask = null
          expect(cell.borderMask).toBeNull();
        } else {
          const expected = expectedMask > 0 ? expectedMask : null;
          expect(cell.borderMask).toBe(expected);
        }
      }
    }
  });

  it('24. Grid remains 100×100', () => {
    const { grid, config } = runFullPipeline('grid-size');

    expect(grid.length).toBe(config.heightInTiles);
    expect(grid[0].length).toBe(config.widthInTiles);
  });
});

// ─── Integration Tests ───

describe('LogicalMapGenerator integration', () => {
  it('25. LogicalMapGenerator uses real decorations (not no-op)', () => {
    const catalog = makeCatalog();
    const config = makeConfig('real-decorations', {
      widthInTiles: 50,
      heightInTiles: 50,
      decorationDensity: 0.1,
    });

    const gen = new LogicalMapGenerator(catalog);
    const result = gen.generate(config);

    expect(result.success).toBe(true);
    if (result.success) {
      // Count decorations — should be > 0 since we use real decorations now
      let decoCount = 0;
      for (let row = 0; row < config.heightInTiles; row++) {
        for (let col = 0; col < config.widthInTiles; col++) {
          if (result.grid[row][col].decoration !== null) {
            decoCount++;
          }
        }
      }
      expect(decoCount).toBeGreaterThan(0);
    }
  });

  it('26. MapValidator accepts clean safe zone', () => {
    const { grid, config } = runFullPipeline('validator-accepts');

    const validator = new MapValidator();
    const result = validator.validate(grid, config);

    // Safe zone should not cause validation errors
    const safeZoneErrors = result.errors.filter(e => e.code === 'SAFE_ZONE_BLOCKED');
    expect(safeZoneErrors).toHaveLength(0);

    // No invalid cell state (walkable + wall/obstacle)
    const invalidStateErrors = result.errors.filter(e => e.code === 'INVALID_CELL_STATE');
    expect(invalidStateErrors).toHaveLength(0);
  });
});
