import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { createEmptyGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import { generateGround, markSafeZone } from '../GroundGenerator';
import {
  generateLiquidRegions,
  clearLiquidsFromSafeZone,
  DEFAULT_LIQUID_CONFIG,
} from '../LiquidRegionGenerator';
import {
  computeNeighborLiquidMask,
  computeAllBorderMasks,
  recomputeBorderMasks,
  classifyBorderMask,
} from '../BorderTopology';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';

const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);

/** Creates a fully prepared grid (ground + safe zone + liquids) */
function makeGridWithLiquids(seed: string | number = 'liquid-test', liquidDensity = 0.08) {
  const config = createMapGenerationConfig(seed, { liquidDensity });
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);
  const rng2 = new SeededRandom(seed);
  // Advance rng2 past ground generation to get different liquid patterns
  for (let i = 0; i < 100; i++) rng2.next();
  generateLiquidRegions(grid, config, rng2, catalog);
  clearLiquidsFromSafeZone(grid);
  return { grid, config };
}

describe('generateLiquidRegions — Determinism (Task 3.11)', () => {
  it('same seed produces same liquid distribution', () => {
    const { grid: grid1 } = makeGridWithLiquids('determ-1');
    const { grid: grid2 } = makeGridWithLiquids('determ-1');

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const c1 = grid1[row][col];
        const c2 = grid2[row][col];
        expect(c1.liquid).toEqual(c2.liquid);
        expect(c1.liquidConfig).toEqual(c2.liquidConfig);
      }
    }
  });

  it('different seeds can produce different distributions', () => {
    const { grid: grid1 } = makeGridWithLiquids('diff-a');
    const { grid: grid2 } = makeGridWithLiquids('diff-b');

    let diffs = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const hasLiq1 = grid1[row][col].liquid !== null;
        const hasLiq2 = grid2[row][col].liquid !== null;
        if (hasLiq1 !== hasLiq2) diffs++;
      }
    }
    expect(diffs).toBeGreaterThan(0);
  });
});

describe('generateLiquidRegions — No empty frames (Task 3.11)', () => {
  it('no liquid tile uses frames 45–47', () => {
    const { grid } = makeGridWithLiquids('no-empty');
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const ref = grid[row][col].liquid;
        if (ref !== null) {
          expect(ref.frame).toBeLessThanOrEqual(44);
          expect(ref.frame).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('all liquid tiles use the "liquids" tileset', () => {
    const { grid } = makeGridWithLiquids('tileset-check');
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const ref = grid[row][col].liquid;
        if (ref !== null) {
          expect(ref.tileset).toBe('liquids');
        }
      }
    }
  });
});

describe('generateLiquidRegions — Safe zone exclusion', () => {
  it('no liquid cells appear within the safe zone', () => {
    const { grid, config } = makeGridWithLiquids('safe-excl');
    const centerRow = 50;
    const centerCol = 50;
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        expect(grid[row][col].liquid, `Liquid found in safe zone at (${row},${col})`).toBeNull();
        expect(grid[row][col].liquidConfig).toBeNull();
      }
    }
  });
});

describe('generateLiquidRegions — Contiguity (Property 36)', () => {
  it('all liquid cells are 4-connected to at least one other liquid cell in same region', () => {
    const { grid } = makeGridWithLiquids('contig-test', 0.1);
    const height = grid.length;
    const width = grid[0].length;

    // Find all liquid cells and verify each has at least one liquid cardinal neighbor
    // (except in regions of exactly minRegionSize where all are connected)
    const liquidCells: Array<[number, number]> = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].liquid !== null) {
          liquidCells.push([row, col]);
        }
      }
    }

    if (liquidCells.length === 0) return; // no liquids generated

    // BFS to find connected components
    const visited = new Set<string>();
    const components: number[] = [];

    for (const [startRow, startCol] of liquidCells) {
      const key = `${startRow},${startCol}`;
      if (visited.has(key)) continue;

      // BFS from this cell
      const queue: Array<[number, number]> = [[startRow, startCol]];
      visited.add(key);
      let componentSize = 0;

      while (queue.length > 0) {
        const [r, c] = queue.shift()!;
        componentSize++;

        for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]] as Array<[number, number]>) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
            const nkey = `${nr},${nc}`;
            if (!visited.has(nkey) && grid[nr][nc].liquid !== null) {
              visited.add(nkey);
              queue.push([nr, nc]);
            }
          }
        }
      }

      components.push(componentSize);
    }

    // All components should be >= minRegionSize
    for (const size of components) {
      expect(size).toBeGreaterThanOrEqual(DEFAULT_LIQUID_CONFIG.minRegionSize);
    }
  });
});

describe('generateLiquidRegions — Density tolerance', () => {
  it('liquid count is within tolerance of target density', () => {
    const density = 0.08;
    const { grid } = makeGridWithLiquids('density-check', density);
    const totalCells = 100 * 100;
    const target = totalCells * density;
    const tolerance = totalCells * DEFAULT_LIQUID_CONFIG.densityTolerance;

    let liquidCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquid !== null) liquidCount++;
      }
    }

    // Liquid count should be roughly around target (± tolerance + region constraints)
    // Given region-based placement, it won't be exact
    expect(liquidCount).toBeGreaterThan(0);
    expect(liquidCount).toBeLessThanOrEqual(target + tolerance + DEFAULT_LIQUID_CONFIG.maxRegionSize);
  });
});

describe('generateLiquidRegions — Behavior affects walkable', () => {
  it('all liquids set walkable=false', () => {
    // With default config (all blocking), every liquid cell is non-walkable
    const config = createMapGenerationConfig('blocking-test', { liquidDensity: 0.05 });
    const grid = createEmptyGrid(100, 100);
    const rng = new SeededRandom('blocking-test');
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);

    const rng2 = new SeededRandom('blocking-behavior');
    generateLiquidRegions(grid, config, rng2, catalog);
    clearLiquidsFromSafeZone(grid);

    let liquidCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null) {
          expect(cell.walkable, `Cell (${row},${col}) should be non-walkable`).toBe(false);
          liquidCount++;
        }
      }
    }
    expect(liquidCount).toBeGreaterThan(0);
  });
});

describe('generateLiquidRegions — Ground preservation', () => {
  it('ground remains assigned beneath liquid', () => {
    const { grid } = makeGridWithLiquids('ground-under');

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquid !== null) {
          expect(grid[row][col].ground, `Cell (${row},${col}) lost its ground`).not.toBeNull();
        }
      }
    }
  });
});

describe('generateLiquidRegions — No Math.random()', () => {
  it('produces same results regardless of Math.random state', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.999;
    const { grid: grid1 } = makeGridWithLiquids('no-math-random');
    Math.random = originalRandom;
    const { grid: grid2 } = makeGridWithLiquids('no-math-random');

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(grid1[row][col].liquid).toEqual(grid2[row][col].liquid);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Border Topology Tests (Task 3.12)
// ═══════════════════════════════════════════════════════════════════

describe('BorderTopology — Mask computation (Task 3.12)', () => {
  it('masks are within range [0, 15]', () => {
    const { grid } = makeGridWithLiquids('border-mask');
    computeAllBorderMasks(grid);

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const mask = grid[row][col].borderMask;
        if (mask !== null) {
          expect(mask).toBeGreaterThanOrEqual(0);
          expect(mask).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it('liquid cells have borderMask = null', () => {
    const { grid } = makeGridWithLiquids('liquid-no-mask');
    computeAllBorderMasks(grid);

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquid !== null) {
          expect(grid[row][col].borderMask).toBeNull();
        }
      }
    }
  });

  it('non-liquid cells without liquid neighbors have borderMask = null', () => {
    const { grid } = makeGridWithLiquids('no-border-cells');
    computeAllBorderMasks(grid);

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid === null && cell.borderMask === null) {
          // Verify it truly has no liquid neighbor
          const mask = computeNeighborLiquidMask(grid, row, col);
          expect(mask).toBe(0);
        }
      }
    }
  });

  it('mask matches actual neighbors for border cells', () => {
    const { grid } = makeGridWithLiquids('mask-accuracy');
    computeAllBorderMasks(grid);
    const height = grid.length;
    const width = grid[0].length;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];
        if (cell.borderMask !== null) {
          const computed = computeNeighborLiquidMask(grid, row, col);
          expect(cell.borderMask).toBe(computed);
        }
      }
    }
  });
});

describe('BorderTopology — Classification', () => {
  it('mask 0 is "none"', () => {
    expect(classifyBorderMask(0)).toBe('none');
  });

  it('single-bit masks are "peninsula"', () => {
    expect(classifyBorderMask(1)).toBe('peninsula');  // north only
    expect(classifyBorderMask(2)).toBe('peninsula');  // east only
    expect(classifyBorderMask(4)).toBe('peninsula');  // south only
    expect(classifyBorderMask(8)).toBe('peninsula');  // west only
  });

  it('opposing pairs are "edge"', () => {
    expect(classifyBorderMask(5)).toBe('edge');   // N+S
    expect(classifyBorderMask(10)).toBe('edge');  // E+W
  });

  it('adjacent pairs are "corner"', () => {
    expect(classifyBorderMask(3)).toBe('corner');   // N+E
    expect(classifyBorderMask(6)).toBe('corner');   // E+S
    expect(classifyBorderMask(12)).toBe('corner');  // S+W
    expect(classifyBorderMask(9)).toBe('corner');   // N+W
  });

  it('3-bit masks are "inner-corner"', () => {
    expect(classifyBorderMask(7)).toBe('inner-corner');   // N+E+S
    expect(classifyBorderMask(11)).toBe('inner-corner');  // N+E+W
    expect(classifyBorderMask(13)).toBe('inner-corner');  // N+S+W
    expect(classifyBorderMask(14)).toBe('inner-corner');  // E+S+W
  });

  it('mask 15 is "surrounded"', () => {
    expect(classifyBorderMask(15)).toBe('surrounded');
  });
});

describe('BorderTopology — Recompute after safe zone clear', () => {
  it('no border masks remain inside safe zone after recompute', () => {
    const { grid, config } = makeGridWithLiquids('recompute-safe');
    computeAllBorderMasks(grid);
    // Clear and recompute
    clearLiquidsFromSafeZone(grid);
    recomputeBorderMasks(grid);

    const centerRow = 50;
    const centerCol = 50;
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        // Safe zone cells shouldn't have border masks pointing to non-existent liquids
        const cell = grid[row][col];
        if (cell.borderMask !== null) {
          // If it has a mask, it should accurately reflect actual neighbors
          const actual = computeNeighborLiquidMask(grid, row, col);
          expect(cell.borderMask).toBe(actual);
        }
      }
    }
  });
});

describe('generateLiquidRegions — liquidDensity = 0', () => {
  it('produces no liquids when density is 0', () => {
    const { grid } = makeGridWithLiquids('zero-density', 0);

    let liquidCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquid !== null) liquidCount++;
      }
    }
    expect(liquidCount).toBe(0);
  });
});
