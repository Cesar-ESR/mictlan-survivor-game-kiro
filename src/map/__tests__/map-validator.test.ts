/**
 * Tests for MapValidator — BFS/flood-fill validation of logical map grids.
 *
 * Requirements: 10.9, 10.10, Property 33
 */

import { describe, it, expect } from 'vitest';
import { MapValidator } from '../MapValidator';
import { createEmptyGrid } from '../MapCell';
import type { LogicalMapGrid } from '../MapCell';
import type { MapGenerationConfig } from '../MapGenerationConfig';
import { createMapGenerationConfig } from '../MapGenerationConfig';

// ─── Helpers ───

function makeConfig(overrides?: Partial<Omit<MapGenerationConfig, 'seed'>>): MapGenerationConfig {
  return createMapGenerationConfig('test-seed', {
    widthInTiles: 10,
    heightInTiles: 10,
    safeZoneRadius: 1,
    minimumReachableRatio: 0.85,
    wallDensity: 0,
    obstacleDensity: 0,
    liquidDensity: 0,
    decorationDensity: 0,
    ...overrides,
  });
}

function make100x100Config(overrides?: Partial<Omit<MapGenerationConfig, 'seed'>>): MapGenerationConfig {
  return createMapGenerationConfig('test-seed', {
    widthInTiles: 100,
    heightInTiles: 100,
    safeZoneRadius: 5,
    minimumReachableRatio: 0.85,
    wallDensity: 0,
    obstacleDensity: 0,
    liquidDensity: 0,
    decorationDensity: 0,
    ...overrides,
  });
}

function fillGridWithGround(grid: LogicalMapGrid): void {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      grid[row][col].ground = { tileset: 'ground', frame: 0 };
    }
  }
}

function markSafeZone(grid: LogicalMapGrid, config: MapGenerationConfig): void {
  const centerRow = Math.floor(config.heightInTiles / 2);
  const centerCol = Math.floor(config.widthInTiles / 2);
  const radius = config.safeZoneRadius;
  for (let row = centerRow - radius; row <= centerRow + radius; row++) {
    for (let col = centerCol - radius; col <= centerCol + radius; col++) {
      if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
        grid[row][col].inSafeZone = true;
      }
    }
  }
}

// ─── Tests ───

describe('MapValidator', () => {
  const validator = new MapValidator();

  it('1. Fully open map → reachableRatio = 1.0', () => {
    const config = makeConfig();
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    const result = validator.validate(grid, config);

    expect(result.valid).toBe(true);
    expect(result.reachableRatio).toBe(1.0);
    expect(result.reachableTiles).toBe(100);
    expect(result.totalWalkableTiles).toBe(100);
    expect(result.errors).toHaveLength(0);
  });

  it('2. Isolated walkable region → reduced ratio', () => {
    const config = makeConfig({ minimumReachableRatio: 0.5 });
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Block a row completely to isolate bottom portion
    for (let col = 0; col < 10; col++) {
      grid[3][col].walkable = false;
      grid[3][col].wall = { tileset: 'walls', frame: 0 };
    }

    const result = validator.validate(grid, config);
    // Center is at (5, 5) — can reach rows 4-9 and rows 0-2 are isolated
    expect(result.reachableRatio).toBeLessThan(1.0);
    expect(result.reachableTiles).toBeLessThan(result.totalWalkableTiles);
  });

  it('3. Blocked cells not in totalWalkableTiles denominator', () => {
    const config = makeConfig({ minimumReachableRatio: 0.5 });
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Make 20 cells non-walkable (walls)
    for (let col = 0; col < 10; col++) {
      grid[0][col].walkable = false;
      grid[0][col].wall = { tileset: 'walls', frame: 0 };
      grid[1][col].walkable = false;
      grid[1][col].wall = { tileset: 'walls', frame: 0 };
    }

    const result = validator.validate(grid, config);
    // totalWalkableTiles should be 80, not 100
    expect(result.totalWalkableTiles).toBe(80);
  });

  it('4. Blocked start → START_POSITION_BLOCKED error', () => {
    const config = makeConfig();
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);

    // Block center (5, 5)
    grid[5][5].walkable = false;
    grid[5][5].wall = { tileset: 'walls', frame: 0 };

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'START_POSITION_BLOCKED')).toBe(true);
  });

  it('5. Start out of bounds → INVALID_START_POSITION error (via dimension mismatch)', () => {
    // Create a 3x3 grid but config says 10x10 — center at (5,5) is out of bounds
    const config = makeConfig();
    const grid = createEmptyGrid(3, 3);
    fillGridWithGround(grid);

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_DIMENSIONS')).toBe(true);
  });

  it('6. Blocked safe zone → SAFE_ZONE_BLOCKED error', () => {
    const config = makeConfig();
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Block a cell in the safe zone
    const centerRow = 5;
    const centerCol = 5;
    grid[centerRow + 1][centerCol].walkable = false;
    grid[centerRow + 1][centerCol].wall = { tileset: 'walls', frame: 0 };
    grid[centerRow + 1][centerCol].inSafeZone = true;

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SAFE_ZONE_BLOCKED')).toBe(true);
  });

  it('7. Missing ground → MISSING_GROUND error', () => {
    const config = makeConfig();
    const grid = createEmptyGrid(10, 10);
    markSafeZone(grid, config);
    // Don't fill ground — all cells have ground=null

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_GROUND')).toBe(true);
  });

  it('8. Inconsistent state (walkable=true + wall) → INVALID_CELL_STATE', () => {
    const config = makeConfig();
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Inconsistent: walkable but has a wall
    grid[0][0].walkable = true;
    grid[0][0].wall = { tileset: 'walls', frame: 0 };

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_CELL_STATE')).toBe(true);
  });

  it('9. BFS does not modify grid', () => {
    const config = makeConfig();
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Take a snapshot of walkable states
    const walkableSnapshot: boolean[][] = grid.map(row => row.map(cell => cell.walkable));

    validator.validate(grid, config);

    // Verify grid unchanged
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        expect(grid[row][col].walkable).toBe(walkableSnapshot[row][col]);
      }
    }
  });

  it('10. BFS works on 100×100', () => {
    const config = make100x100Config();
    const grid = createEmptyGrid(100, 100);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(true);
    expect(result.reachableTiles).toBe(10000);
    expect(result.reachableRatio).toBe(1.0);
  });

  it('11. reachableRatio exact (no rounding before comparison)', () => {
    // Create grid where ratio is exactly at threshold
    const config = makeConfig({ minimumReachableRatio: 0.8 });
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Block 2 cells in corner to isolate them (they're not reachable from center)
    // Make a small L-shaped wall to isolate corner cells
    grid[0][0].walkable = false;
    grid[0][0].wall = { tileset: 'walls', frame: 0 };
    grid[0][1].walkable = false;
    grid[0][1].wall = { tileset: 'walls', frame: 0 };
    grid[1][0].walkable = false;
    grid[1][0].wall = { tileset: 'walls', frame: 0 };

    const result = validator.validate(grid, config);
    // reachableRatio should be calculated exactly without rounding
    expect(typeof result.reachableRatio).toBe('number');
    expect(result.reachableRatio).toBe(result.reachableTiles / result.totalWalkableTiles);
  });

  it('12. Ratio exactly at threshold → valid', () => {
    // We need a scenario where ratio == minimumReachableRatio exactly
    // With 10x10 grid: make 100 cells total walkable = 100
    // If we isolate exactly 15 cells, ratio = 85/100 = 0.85
    const config = makeConfig({ minimumReachableRatio: 0.85 });
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // To isolate 15 walkable cells from center, wall-off the top 2 rows minus some
    // Actually, let's block a row to create two sections. Isolate top section
    // Block row 2 entirely
    for (let col = 0; col < 10; col++) {
      grid[2][col].walkable = false;
      grid[2][col].wall = { tileset: 'walls', frame: 0 };
    }
    // Top section: rows 0-1 = 20 walkable cells (isolated)
    // Wall: row 2 = 10 non-walkable cells
    // Bottom: rows 3-9 = 70 walkable cells (reachable from center at 5,5)
    // totalWalkable = 90, reachable = 70, ratio = 70/90 ≈ 0.778 (below 0.85)
    // That's below threshold. Let's use a different approach.

    // Instead: just verify that exactly at threshold is valid
    // Use minimumReachableRatio = 0.7 and create the right isolation
    const config2 = makeConfig({ minimumReachableRatio: 70 / 90 });
    const grid2 = createEmptyGrid(10, 10);
    fillGridWithGround(grid2);
    markSafeZone(grid2, config2);

    for (let col = 0; col < 10; col++) {
      grid2[2][col].walkable = false;
      grid2[2][col].wall = { tileset: 'walls', frame: 0 };
    }

    const result2 = validator.validate(grid2, config2);
    // ratio = 70/90, threshold = 70/90 → should be valid (>= not >)
    expect(result2.reachableRatio).toBeCloseTo(70 / 90, 10);
    expect(result2.valid).toBe(true);
  });

  it('13. Ratio below threshold → invalid', () => {
    const config = makeConfig({ minimumReachableRatio: 0.95 });
    const grid = createEmptyGrid(10, 10);
    fillGridWithGround(grid);
    markSafeZone(grid, config);

    // Block row 2 entirely (isolates 20 walkable cells)
    for (let col = 0; col < 10; col++) {
      grid[2][col].walkable = false;
      grid[2][col].wall = { tileset: 'walls', frame: 0 };
    }
    // totalWalkable = 90, reachable from center (5,5) = 70, ratio ≈ 0.778

    const result = validator.validate(grid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'REACHABLE_RATIO_TOO_LOW')).toBe(true);
  });
});
