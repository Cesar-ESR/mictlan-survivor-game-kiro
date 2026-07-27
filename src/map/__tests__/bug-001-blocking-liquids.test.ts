/**
 * BUG-001 Regression Tests: ALL liquids must block player and enemies.
 *
 * Design decision: The Player cannot swim. No liquid in the game is walkable.
 * ALL liquid types (water, lava, spectral) must be blocking.
 *
 * Validates that:
 * 1. ALL cells with liquid have walkable=false
 * 2. Water regions always have behavior='blocking'
 * 3. Lava regions always have behavior='blocking'
 * 4. Spectral regions always have behavior='blocking'
 * 5. Safe zone has no liquids at all
 * 6. MapValidator excludes ALL liquid cells from walkable count
 * 7. Walkability checker rejects ANY liquid cell position
 * 8. Walkability checker accepts ground-only positions
 * 9. Walkability checker rejects out-of-bounds
 * 10. Mixed liquid types (generated with default config) — ALL are blocking
 * 11. Generation remains deterministic
 * 12. Accessibility minimum still passes
 */

import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { createEmptyGrid } from '../MapCell';
import type { LogicalMapGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import { generateGround, markSafeZone } from '../GroundGenerator';
import {
  generateLiquidRegions,
  clearLiquidsFromSafeZone,
  DEFAULT_LIQUID_CONFIG,
} from '../LiquidRegionGenerator';
import { generateSpectralRegions } from '../SpectralRegionGenerator';
import { MapValidator } from '../MapValidator';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';

const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);

/** Creates a grid with default liquid generation (all blocking). */
function makeGridWithLiquids(seed: string | number = 'bug001-all-blocking') {
  const config = createMapGenerationConfig(seed, { liquidDensity: 0.08 });
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);
  const rng2 = new SeededRandom(`${seed}-liquid`);
  generateLiquidRegions(grid, config, rng2, catalog);
  clearLiquidsFromSafeZone(grid);
  return { grid, config };
}

/** Creates a grid that also includes spectral regions. */
function makeGridWithSpectral(seed: string | number = 'bug001-spectral') {
  const config = createMapGenerationConfig(seed, { liquidDensity: 0.06 });
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);
  const rng2 = new SeededRandom(`${seed}-liquid`);
  generateLiquidRegions(grid, config, rng2, catalog);
  const rng3 = new SeededRandom(`${seed}-spectral`);
  generateSpectralRegions(grid, config, rng3);
  clearLiquidsFromSafeZone(grid);
  return { grid, config };
}

/** Simulates the walkability checker that GameScene provides to SpawnManager. */
function createWalkabilityChecker(grid: LogicalMapGrid) {
  const gridHeight = grid.length;
  const gridWidth = gridHeight > 0 ? grid[0].length : 0;
  return (x: number, y: number): boolean => {
    const col = Math.floor(x / 32);
    const row = Math.floor(y / 32);
    if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) return false;
    return grid[row][col].walkable;
  };
}

describe('BUG-001: ALL cells with liquid have walkable=false', () => {
  it('every liquid cell is non-walkable regardless of behavior field', () => {
    const { grid } = makeGridWithLiquids();
    let liquidCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null) {
          expect(cell.walkable, `Cell (${row},${col}) with liquid must be non-walkable`).toBe(false);
          liquidCount++;
        }
      }
    }

    // Sanity: ensure some liquids were actually generated
    expect(liquidCount).toBeGreaterThan(0);
  });

  it('liquid count is reasonable for 8% density', () => {
    const { grid } = makeGridWithLiquids();
    let liquidCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquid !== null) {
          liquidCount++;
        }
      }
    }

    // With 8% density on 10000 cells, expect roughly 800 ± tolerance
    expect(liquidCount).toBeGreaterThan(100);
    expect(liquidCount).toBeLessThan(2000);
  });
});

describe('BUG-001: Water regions always have behavior=blocking', () => {
  it('all water liquid configs have blocking behavior', () => {
    const { grid } = makeGridWithLiquids();
    let waterCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquidConfig && cell.liquidConfig.type === 'water') {
          expect(cell.liquidConfig.behavior).toBe('blocking');
          waterCount++;
        }
      }
    }

    // Water family may or may not be selected, but if present must be blocking
    // (the family is picked randomly, so we just verify any that exist)
    // No assertion on count — just verify all found are blocking
  });
});

describe('BUG-001: Lava regions always have behavior=blocking', () => {
  it('all lava liquid configs have blocking behavior', () => {
    const { grid } = makeGridWithLiquids('bug001-lava-check');
    let lavaCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquidConfig && cell.liquidConfig.type === 'lava') {
          expect(cell.liquidConfig.behavior).toBe('blocking');
          expect(cell.walkable).toBe(false);
          lavaCount++;
        }
      }
    }
    // Lava may or may not appear depending on random family pick
  });
});

describe('BUG-001: Spectral regions always have behavior=blocking', () => {
  it('all spectral liquid configs have blocking behavior and walkable=false', () => {
    const { grid } = makeGridWithSpectral();
    let spectralCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquidConfig && cell.liquidConfig.type === 'spectral') {
          expect(cell.liquidConfig.behavior, `Spectral at (${row},${col}) must be blocking`).toBe('blocking');
          expect(cell.walkable, `Spectral at (${row},${col}) must be non-walkable`).toBe(false);
          spectralCount++;
        }
      }
    }

    // Spectral may not appear if templates fail placement, but verify all found
    // Use a seed known to produce spectral regions (or accept 0)
  });
});

describe('BUG-001: Safe zone has no liquids at all', () => {
  it('safe zone cells have no liquid after generation', () => {
    const { grid, config } = makeGridWithLiquids();
    const centerRow = Math.floor(config.heightInTiles / 2);
    const centerCol = Math.floor(config.widthInTiles / 2);
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        if (row >= 0 && row < 100 && col >= 0 && col < 100) {
          const cell = grid[row][col];
          if (cell.inSafeZone) {
            expect(cell.liquid, `Safe zone cell (${row},${col}) must not have liquid`).toBeNull();
            expect(cell.liquidConfig).toBeNull();
            expect(cell.walkable, `Safe zone cell (${row},${col}) must be walkable`).toBe(true);
          }
        }
      }
    }
  });

  it('safe zone has no spectral liquids either', () => {
    const { grid, config } = makeGridWithSpectral();
    const centerRow = Math.floor(config.heightInTiles / 2);
    const centerCol = Math.floor(config.widthInTiles / 2);
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        if (row >= 0 && row < 100 && col >= 0 && col < 100) {
          const cell = grid[row][col];
          if (cell.inSafeZone) {
            expect(cell.liquid).toBeNull();
            expect(cell.liquidConfig).toBeNull();
          }
        }
      }
    }
  });
});

describe('BUG-001: MapValidator excludes ALL liquid cells from walkable count', () => {
  it('liquid cells are not counted as walkable by validator', () => {
    const { grid, config } = makeGridWithLiquids();
    const validator = new MapValidator();
    const result = validator.validate(grid, config);

    // Count walkable tiles manually
    let totalWalkable = 0;
    let liquidNonWalkable = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.walkable) totalWalkable++;
        if (cell.liquid !== null) {
          expect(cell.walkable).toBe(false);
          liquidNonWalkable++;
        }
      }
    }

    // totalWalkableTiles from validator must match our count
    expect(result.totalWalkableTiles).toBe(totalWalkable);
    // No liquid cell should be walkable
    expect(liquidNonWalkable).toBeGreaterThan(0);
  });
});

describe('BUG-001: Walkability checker rejects ANY liquid cell position', () => {
  it('rejects positions on any liquid tile', () => {
    const { grid } = makeGridWithLiquids();
    const checker = createWalkabilityChecker(grid);

    let foundLiquid = false;
    for (let row = 0; row < 100 && !foundLiquid; row++) {
      for (let col = 0; col < 100 && !foundLiquid; col++) {
        if (grid[row][col].liquid !== null) {
          const pixelX = col * 32 + 16;
          const pixelY = row * 32 + 16;
          expect(checker(pixelX, pixelY)).toBe(false);
          foundLiquid = true;
        }
      }
    }

    expect(foundLiquid).toBe(true);
  });
});

describe('BUG-001: Walkability checker accepts ground-only positions', () => {
  it('accepts positions on normal ground tiles without liquid', () => {
    const { grid } = makeGridWithLiquids();
    const checker = createWalkabilityChecker(grid);

    // Center of map (safe zone) should always be walkable ground
    const centerPixelX = 50 * 32 + 16;
    const centerPixelY = 50 * 32 + 16;
    expect(checker(centerPixelX, centerPixelY)).toBe(true);
  });
});

describe('BUG-001: Walkability checker rejects out-of-bounds', () => {
  it('rejects negative coordinates', () => {
    const { grid } = makeGridWithLiquids();
    const checker = createWalkabilityChecker(grid);
    expect(checker(-10, -10)).toBe(false);
  });

  it('rejects coordinates beyond map bounds', () => {
    const { grid } = makeGridWithLiquids();
    const checker = createWalkabilityChecker(grid);
    expect(checker(3200, 3200)).toBe(false);
  });

  it('rejects partially out-of-bounds coordinates', () => {
    const { grid } = makeGridWithLiquids();
    const checker = createWalkabilityChecker(grid);
    expect(checker(50 * 32, -1)).toBe(false);
  });
});

describe('BUG-001: Mixed liquid types — ALL are blocking', () => {
  it('default config produces only blocking liquids', () => {
    const { grid } = makeGridWithLiquids('bug001-mixed-types');
    let liquidCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null) {
          expect(cell.walkable, `Cell (${row},${col}) must be non-walkable`).toBe(false);
          expect(cell.liquidConfig?.behavior, `Cell (${row},${col}) behavior must be blocking`).toBe('blocking');
          liquidCount++;
        }
      }
    }

    expect(liquidCount).toBeGreaterThan(0);
  });

  it('even if custom config passes walkable weight, cell is still non-walkable', () => {
    // The implementation now forces walkable=false regardless of behavior
    const config = createMapGenerationConfig('bug001-custom-walkable', { liquidDensity: 0.05 });
    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
    const rng = new SeededRandom('bug001-custom-walkable');
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);
    const rng2 = new SeededRandom('bug001-custom-walkable-liquid');
    generateLiquidRegions(grid, config, rng2, catalog, {
      ...DEFAULT_LIQUID_CONFIG,
      behaviorWeights: [{ behavior: 'walkable', weight: 1 }],
    });
    clearLiquidsFromSafeZone(grid);

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null) {
          // Even though behavior='walkable' is set, the cell must be non-walkable
          expect(cell.walkable, `Cell (${row},${col}) must be non-walkable regardless of behavior field`).toBe(false);
        }
      }
    }
  });
});

describe('BUG-001: Generation remains deterministic', () => {
  it('same seed produces identical liquid distribution', () => {
    const { grid: grid1 } = makeGridWithLiquids('determ-bug001');
    const { grid: grid2 } = makeGridWithLiquids('determ-bug001');

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const c1 = grid1[row][col];
        const c2 = grid2[row][col];
        expect(c1.liquid).toEqual(c2.liquid);
        expect(c1.liquidConfig).toEqual(c2.liquidConfig);
        expect(c1.walkable).toEqual(c2.walkable);
      }
    }
  });
});

describe('BUG-001: Accessibility minimum still passes', () => {
  it('reachableRatio meets minimumReachableRatio with all liquids blocking', () => {
    const { grid, config } = makeGridWithLiquids();
    const validator = new MapValidator();
    const result = validator.validate(grid, config);

    expect(result.reachableRatio).toBeGreaterThanOrEqual(config.minimumReachableRatio);
    expect(result.valid).toBe(true);
  });

  it('accessibility passes with spectral regions too', () => {
    const { grid, config } = makeGridWithSpectral();
    const validator = new MapValidator();
    const result = validator.validate(grid, config);

    expect(result.reachableRatio).toBeGreaterThanOrEqual(config.minimumReachableRatio);
  });
});
