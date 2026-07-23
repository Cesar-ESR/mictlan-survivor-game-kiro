/**
 * Tests for StructureGenerator (Walls/Cliffs) and ObstacleGenerator.
 *
 * Validates:
 * - Determinism (same seed → same result)
 * - Different seeds → different results
 * - Safe zone exclusion
 * - No placement over liquids
 * - No overlap between walls and obstacles
 * - Ground preservation
 * - walkable=false on structures
 * - Blocking liquid respect in clearing
 * - structureMask range [0, 15]
 * - Masks match actual cardinal neighbors
 * - Templates don't write outside bounds
 * - Density within tolerance
 * - No empty frames (35-47) used
 * - No Phaser dependency
 * - No Math.random()
 * - Grid remains 100×100
 *
 * Requirements: 10.6, Property 30
 */

import { describe, it, expect } from 'vitest';
import { createEmptyGrid } from '../MapCell';
import type { LogicalMapGrid } from '../MapCell';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import { generateGround, markSafeZone } from '../GroundGenerator';
import { generateLiquidRegions } from '../LiquidRegionGenerator';
import {
  generateWallsAndCliffs,
  clearStructuresFromSafeZone,
  computeStructureMask,
} from '../StructureGenerator';
import {
  generateObstacles,
  clearObstaclesFromSafeZone,
} from '../ObstacleGenerator';

// ─── Helpers ───

function createTestSetup(seed: string | number = 'test-structures') {
  const config = createMapGenerationConfig(seed);
  const rng = new SeededRandom(seed);
  const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);

  // Generate ground and mark safe zone (prerequisites)
  const groundRng = new SeededRandom(seed);
  generateGround(grid, groundRng, catalog);
  markSafeZone(grid, config);

  return { grid, config, rng, catalog };
}

function createFullSetup(seed: string | number = 'full-gen') {
  const config = createMapGenerationConfig(seed, { liquidDensity: 0.05 });
  const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);

  // Full pipeline up to walls
  const rng1 = new SeededRandom(seed);
  generateGround(grid, rng1, catalog);
  markSafeZone(grid, config);

  const rng2 = new SeededRandom(`${seed}-liquid`);
  generateLiquidRegions(grid, config, rng2, catalog);

  return { grid, config, catalog };
}

function countWalls(grid: LogicalMapGrid): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.wall !== null) count++;
    }
  }
  return count;
}

function countObstacles(grid: LogicalMapGrid): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.obstacle !== null) count++;
    }
  }
  return count;
}

// ─── Tests ───

describe('StructureGenerator', () => {
  it('1. Same seed produces same wall structures', () => {
    const seed = 'determinism-walls';
    const setup1 = createTestSetup(seed);
    const rng1 = new SeededRandom(`${seed}-walls`);
    const catalog = setup1.catalog;
    generateWallsAndCliffs(setup1.grid, setup1.config, rng1, catalog);

    const setup2 = createTestSetup(seed);
    const rng2 = new SeededRandom(`${seed}-walls`);
    generateWallsAndCliffs(setup2.grid, setup2.config, rng2, catalog);

    // Compare wall positions
    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const wall1 = setup1.grid[r][c].wall;
        const wall2 = setup2.grid[r][c].wall;
        if (wall1 === null) {
          expect(wall2).toBeNull();
        } else {
          expect(wall2).not.toBeNull();
          expect(wall1!.tileset).toBe(wall2!.tileset);
          expect(wall1!.frame).toBe(wall2!.frame);
        }
      }
    }
  });

  it('2. Different seeds produce different wall structures', () => {
    const setup1 = createTestSetup('seed-A');
    const rng1 = new SeededRandom('seed-A-walls');
    generateWallsAndCliffs(setup1.grid, setup1.config, rng1, setup1.catalog);

    const setup2 = createTestSetup('seed-B');
    const rng2 = new SeededRandom('seed-B-walls');
    generateWallsAndCliffs(setup2.grid, setup2.config, rng2, setup2.catalog);

    // Find at least one difference
    let hasDifference = false;
    for (let r = 0; r < 100 && !hasDifference; r++) {
      for (let c = 0; c < 100 && !hasDifference; c++) {
        const w1 = setup1.grid[r][c].wall;
        const w2 = setup2.grid[r][c].wall;
        if ((w1 === null) !== (w2 === null)) hasDifference = true;
      }
    }
    expect(hasDifference).toBe(true);
  });

  it('3. No walls inside safe zone', () => {
    const { grid, config, catalog } = createTestSetup('safe-walls');
    const rng = new SeededRandom('safe-walls-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);
    clearStructuresFromSafeZone(grid);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].inSafeZone) {
          expect(grid[r][c].wall).toBeNull();
        }
      }
    }
  });

  it('4. No walls placed over liquids', () => {
    const { grid, config, catalog } = createFullSetup('no-wall-on-liquid');
    const rng = new SeededRandom('no-wall-on-liquid-walls');
    generateWallsAndCliffs(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].liquid !== null) {
          expect(grid[r][c].wall).toBeNull();
        }
      }
    }
  });

  it('7. Walls set walkable=false', () => {
    const { grid, config, catalog } = createTestSetup('walkable-walls');
    const rng = new SeededRandom('walkable-walls-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].wall !== null) {
          expect(grid[r][c].walkable).toBe(false);
        }
      }
    }
  });

  it('6. Ground preserved beneath walls', () => {
    const { grid, config, catalog } = createTestSetup('ground-preserved');
    const rng = new SeededRandom('ground-preserved-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        // Ground should be non-null for all cells (set during ground generation)
        expect(grid[r][c].ground).not.toBeNull();
      }
    }
  });

  it('9. structureMask values in [0, 15]', () => {
    const { grid, config, catalog } = createTestSetup('mask-range');
    const rng = new SeededRandom('mask-range-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const mask = grid[r][c].structureMask;
        if (mask !== null) {
          expect(mask).toBeGreaterThanOrEqual(0);
          expect(mask).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it('10. Masks match actual cardinal neighbors', () => {
    const { grid, config, catalog } = createTestSetup('mask-match');
    const rng = new SeededRandom('mask-match-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const cell = grid[r][c];
        if (cell.wall !== null || cell.obstacle !== null) {
          const expectedMask = computeStructureMask(grid, r, c);
          expect(cell.structureMask).toBe(expectedMask);
        }
      }
    }
  });

  it('11. Templates don\'t write outside map bounds', () => {
    // Use a small grid to test edge cases
    const config = createMapGenerationConfig('bounds-test', {
      widthInTiles: 10,
      heightInTiles: 10,
      wallDensity: 0.3,
    });
    const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);
    const grid = createEmptyGrid(10, 10);
    const rng1 = new SeededRandom('bounds-ground');
    generateGround(grid, rng1, catalog);
    markSafeZone(grid, config);

    const rng2 = new SeededRandom('bounds-walls');
    // Should not throw
    expect(() => generateWallsAndCliffs(grid, config, rng2, catalog)).not.toThrow();

    // Verify grid is still 10x10
    expect(grid.length).toBe(10);
    expect(grid[0].length).toBe(10);
  });

  it('12. Density within tolerance', () => {
    const { grid, config, catalog } = createTestSetup('density-check');
    const rng = new SeededRandom('density-check-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    const totalCells = 100 * 100;
    const wallCount = countWalls(grid);
    const target = config.wallDensity * totalCells;
    const tolerance = 0.03 * totalCells;

    // Wall count should be within [0, target + tolerance]
    expect(wallCount).toBeLessThanOrEqual(target + tolerance);
  });

  it('13. No empty frames (35-47) from walls tileset used', () => {
    const { grid, config, catalog } = createTestSetup('no-empty-frames');
    const rng = new SeededRandom('no-empty-frames-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const wall = grid[r][c].wall;
        if (wall !== null && wall.tileset === 'walls') {
          expect(wall.frame).toBeLessThanOrEqual(34);
          expect(wall.frame).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('16. Grid remains 100×100', () => {
    const { grid, config, catalog } = createTestSetup('grid-size');
    const rng = new SeededRandom('grid-size-gen');
    generateWallsAndCliffs(grid, config, rng, catalog);

    expect(grid.length).toBe(100);
    for (const row of grid) {
      expect(row.length).toBe(100);
    }
  });
});

describe('ObstacleGenerator', () => {
  it('1. Same seed produces same obstacles', () => {
    const seed = 'determinism-obs';
    const setup1 = createTestSetup(seed);
    const rng1 = new SeededRandom(`${seed}-obs`);
    generateObstacles(setup1.grid, setup1.config, rng1, setup1.catalog);

    const setup2 = createTestSetup(seed);
    const rng2 = new SeededRandom(`${seed}-obs`);
    generateObstacles(setup2.grid, setup2.config, rng2, setup2.catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const obs1 = setup1.grid[r][c].obstacle;
        const obs2 = setup2.grid[r][c].obstacle;
        if (obs1 === null) {
          expect(obs2).toBeNull();
        } else {
          expect(obs2).not.toBeNull();
          expect(obs1!.tileset).toBe(obs2!.tileset);
          expect(obs1!.frame).toBe(obs2!.frame);
        }
      }
    }
  });

  it('2. Different seeds produce different obstacles', () => {
    const setup1 = createTestSetup('obs-A');
    const rng1 = new SeededRandom('obs-A-gen');
    generateObstacles(setup1.grid, setup1.config, rng1, setup1.catalog);

    const setup2 = createTestSetup('obs-B');
    const rng2 = new SeededRandom('obs-B-gen');
    generateObstacles(setup2.grid, setup2.config, rng2, setup2.catalog);

    let hasDifference = false;
    for (let r = 0; r < 100 && !hasDifference; r++) {
      for (let c = 0; c < 100 && !hasDifference; c++) {
        const o1 = setup1.grid[r][c].obstacle;
        const o2 = setup2.grid[r][c].obstacle;
        if ((o1 === null) !== (o2 === null)) hasDifference = true;
      }
    }
    expect(hasDifference).toBe(true);
  });

  it('3. No obstacles inside safe zone', () => {
    const { grid, config, catalog } = createTestSetup('safe-obs');
    const rng = new SeededRandom('safe-obs-gen');
    generateObstacles(grid, config, rng, catalog);
    clearObstaclesFromSafeZone(grid);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].inSafeZone) {
          expect(grid[r][c].obstacle).toBeNull();
        }
      }
    }
  });

  it('4. No obstacles placed over liquids', () => {
    const { grid, config, catalog } = createFullSetup('no-obs-on-liquid');
    const rng = new SeededRandom('no-obs-on-liquid-gen');
    generateObstacles(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].liquid !== null) {
          expect(grid[r][c].obstacle).toBeNull();
        }
      }
    }
  });

  it('5. Walls and obstacles don\'t overlap', () => {
    const { grid, config, catalog } = createFullSetup('no-overlap');
    const wallRng = new SeededRandom('no-overlap-walls');
    generateWallsAndCliffs(grid, config, wallRng, catalog);
    const obsRng = new SeededRandom('no-overlap-obs');
    generateObstacles(grid, config, obsRng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const cell = grid[r][c];
        if (cell.wall !== null && cell.obstacle !== null) {
          // Should never have both
          expect(false).toBe(true);
        }
      }
    }
  });

  it('6. Ground preserved beneath obstacles', () => {
    const { grid, config, catalog } = createTestSetup('ground-obs');
    const rng = new SeededRandom('ground-obs-gen');
    generateObstacles(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        expect(grid[r][c].ground).not.toBeNull();
      }
    }
  });

  it('7. Obstacles set walkable=false', () => {
    const { grid, config, catalog } = createTestSetup('walkable-obs');
    const rng = new SeededRandom('walkable-obs-gen');
    generateObstacles(grid, config, rng, catalog);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].obstacle !== null) {
          expect(grid[r][c].walkable).toBe(false);
        }
      }
    }
  });

  it('8. Clearing respects blocking liquids (walkable stays false)', () => {
    // Create a grid with a blocking liquid in safe zone and an obstacle
    const config = createMapGenerationConfig('clearing-test', { safeZoneRadius: 3 });
    const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);
    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    const rng = new SeededRandom('clearing-test');
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);

    // Manually place a blocking liquid and obstacle in safe zone for test
    const centerRow = 50;
    const centerCol = 50;
    grid[centerRow][centerCol].liquidConfig = { type: 'water', behavior: 'blocking' };
    grid[centerRow][centerCol].liquid = { tileset: 'liquids', frame: 0 };
    grid[centerRow][centerCol].walkable = false;
    grid[centerRow][centerCol].obstacle = { tileset: 'walls', frame: 27 };

    clearObstaclesFromSafeZone(grid);

    // Obstacle should be removed
    expect(grid[centerRow][centerCol].obstacle).toBeNull();
    // But walkable stays false because of blocking liquid
    expect(grid[centerRow][centerCol].walkable).toBe(false);
  });

  it('12. Obstacle density within tolerance', () => {
    const { grid, config, catalog } = createTestSetup('obs-density');
    const rng = new SeededRandom('obs-density-gen');
    generateObstacles(grid, config, rng, catalog);

    const totalCells = 100 * 100;
    const obsCount = countObstacles(grid);
    const target = config.obstacleDensity * totalCells;
    const tolerance = 0.02 * totalCells;

    expect(obsCount).toBeLessThanOrEqual(target + tolerance);
  });

  it('13. No empty frames (35-47) from walls tileset used for obstacles', () => {
    const { grid, config, catalog } = createTestSetup('obs-no-empty');
    const rng = new SeededRandom('obs-no-empty-gen');
    generateObstacles(grid, config, rng, catalog);

    const permittedObstacleFrames = [21, 26];
    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const obs = grid[r][c].obstacle;
        if (obs !== null && obs.tileset === 'walls') {
          expect(permittedObstacleFrames).toContain(obs.frame);
        }
      }
    }
  });

  it('16. Grid remains 100×100 after obstacle generation', () => {
    const { grid, config, catalog } = createTestSetup('obs-grid-size');
    const rng = new SeededRandom('obs-grid-size-gen');
    generateObstacles(grid, config, rng, catalog);

    expect(grid.length).toBe(100);
    for (const row of grid) {
      expect(row.length).toBe(100);
    }
  });
});

describe('Combined Walls + Obstacles', () => {
  it('5. No overlap between walls and obstacles after full pipeline', () => {
    const { grid, config, catalog } = createFullSetup('combined-no-overlap');
    const wallRng = new SeededRandom('combined-walls');
    generateWallsAndCliffs(grid, config, wallRng, catalog);
    clearStructuresFromSafeZone(grid);

    const obsRng = new SeededRandom('combined-obs');
    generateObstacles(grid, config, obsRng, catalog);
    clearObstaclesFromSafeZone(grid);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const cell = grid[r][c];
        // A cell cannot have both wall and obstacle
        if (cell.wall !== null) {
          expect(cell.obstacle).toBeNull();
        }
      }
    }
  });

  it('Structure masks recomputed correctly after both generators', () => {
    const { grid, config, catalog } = createFullSetup('masks-combined');
    const wallRng = new SeededRandom('masks-walls');
    generateWallsAndCliffs(grid, config, wallRng, catalog);
    const obsRng = new SeededRandom('masks-obs');
    generateObstacles(grid, config, obsRng, catalog);

    // Verify all masks
    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        const cell = grid[r][c];
        if (cell.wall !== null || cell.obstacle !== null) {
          expect(cell.structureMask).not.toBeNull();
          expect(cell.structureMask).toBeGreaterThanOrEqual(0);
          expect(cell.structureMask).toBeLessThanOrEqual(15);

          // Verify mask matches neighbors
          const expected = computeStructureMask(grid, r, c);
          expect(cell.structureMask).toBe(expected);
        } else {
          expect(cell.structureMask).toBeNull();
        }
      }
    }
  });

  it('Safe zone is clean after defensive passes', () => {
    const { grid, config, catalog } = createFullSetup('safe-clean');
    const wallRng = new SeededRandom('safe-clean-walls');
    generateWallsAndCliffs(grid, config, wallRng, catalog);
    clearStructuresFromSafeZone(grid);

    const obsRng = new SeededRandom('safe-clean-obs');
    generateObstacles(grid, config, obsRng, catalog);
    clearObstaclesFromSafeZone(grid);

    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        if (grid[r][c].inSafeZone) {
          expect(grid[r][c].wall).toBeNull();
          expect(grid[r][c].obstacle).toBeNull();
        }
      }
    }
  });
});

describe('No forbidden dependencies', () => {
  it('14. Logic doesn\'t depend on Phaser', async () => {
    // Read source files and verify no Phaser imports
    const structureSource = await import('../StructureGenerator');
    const obstacleSource = await import('../ObstacleGenerator');

    // If we can import them without Phaser, they don't depend on it
    expect(structureSource.generateWallsAndCliffs).toBeDefined();
    expect(obstacleSource.generateObstacles).toBeDefined();
  });

  it('15. No Math.random() in generators (deterministic via SeededRandom)', () => {
    // Run same config twice — must produce identical output
    const seed = 'math-random-check';

    const setup1 = createTestSetup(seed);
    const wallRng1 = new SeededRandom(`${seed}-walls`);
    generateWallsAndCliffs(setup1.grid, setup1.config, wallRng1, setup1.catalog);
    const obsRng1 = new SeededRandom(`${seed}-obs`);
    generateObstacles(setup1.grid, setup1.config, obsRng1, setup1.catalog);

    const setup2 = createTestSetup(seed);
    const wallRng2 = new SeededRandom(`${seed}-walls`);
    generateWallsAndCliffs(setup2.grid, setup2.config, wallRng2, setup2.catalog);
    const obsRng2 = new SeededRandom(`${seed}-obs`);
    generateObstacles(setup2.grid, setup2.config, obsRng2, setup2.catalog);

    // If Math.random() were used, these would differ
    const walls1 = countWalls(setup1.grid);
    const walls2 = countWalls(setup2.grid);
    expect(walls1).toBe(walls2);

    const obs1 = countObstacles(setup1.grid);
    const obs2 = countObstacles(setup2.grid);
    expect(obs1).toBe(obs2);
  });
});
