import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { createEmptyGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import { generateGround, markSafeZone } from '../GroundGenerator';
import { generateLiquidRegions, clearLiquidsFromSafeZone } from '../LiquidRegionGenerator';
import { generateWallsAndCliffs, clearStructuresFromSafeZone } from '../StructureGenerator';
import { generateBorders } from '../BorderGenerator';
import { computeNeighborTransitionMask } from '../BorderTopology';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';

const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);

/** Creates a fully prepared grid with ground + safe zone + liquids + walls */
function makeFullGrid(seed: string | number = 'border-gen-test') {
  const config = createMapGenerationConfig(seed, {
    liquidDensity: 0.08,
    wallDensity: 0.05,
  });
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);

  const rng2 = new SeededRandom(seed);
  for (let i = 0; i < 100; i++) rng2.next();
  generateLiquidRegions(grid, config, rng2, catalog);
  clearLiquidsFromSafeZone(grid);

  const rng3 = new SeededRandom(seed);
  for (let i = 0; i < 200; i++) rng3.next();
  generateWallsAndCliffs(grid, config, rng3, catalog);
  clearStructuresFromSafeZone(grid);

  return { grid, config };
}

describe('generateBorders — Basic functionality (Task 3.12)', () => {
  it('generates border tiles for cells adjacent to liquids or walls', () => {
    const { grid } = makeFullGrid('basic-borders');
    const result = generateBorders(grid, catalog);

    expect(result.borderCount).toBeGreaterThan(0);
  });

  it('border tiles use the "borders" tileset', () => {
    const { grid } = makeFullGrid('tileset-borders');
    generateBorders(grid, catalog);

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const ref = grid[row][col].border;
        if (ref !== null) {
          expect(ref.tileset).toBe('borders');
        }
      }
    }
  });

  it('border frames are within valid range [0, 15]', () => {
    const { grid } = makeFullGrid('frame-range');
    generateBorders(grid, catalog);

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const ref = grid[row][col].border;
        if (ref !== null) {
          expect(ref.frame).toBeGreaterThanOrEqual(0);
          expect(ref.frame).toBeLessThanOrEqual(15);
        }
      }
    }
  });
});

describe('generateBorders — Does NOT apply collision (Req 10.5)', () => {
  it('walkable state is not modified by border generation', () => {
    const { grid } = makeFullGrid('no-collision');

    // Capture walkable state before borders
    const walkableBefore: boolean[][] = [];
    for (let row = 0; row < grid.length; row++) {
      walkableBefore.push([]);
      for (let col = 0; col < grid[0].length; col++) {
        walkableBefore[row].push(grid[row][col].walkable);
      }
    }

    generateBorders(grid, catalog);

    // Verify walkable state unchanged
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        expect(
          grid[row][col].walkable,
          `Walkable changed at (${row},${col})`,
        ).toBe(walkableBefore[row][col]);
      }
    }
  });
});

describe('generateBorders — Does NOT replace ground (Req 10.5)', () => {
  it('ground remains assigned on cells with borders', () => {
    const { grid } = makeFullGrid('ground-preserved');
    generateBorders(grid, catalog);

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const cell = grid[row][col];
        if (cell.border !== null) {
          expect(
            cell.ground,
            `Ground removed at (${row},${col}) by border`,
          ).not.toBeNull();
        }
      }
    }
  });
});

describe('generateBorders — Only assigned to transition cells', () => {
  it('liquid cells do NOT have borders', () => {
    const { grid } = makeFullGrid('no-border-on-liquid');
    generateBorders(grid, catalog);

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null) {
          expect(cell.border, `Liquid cell (${row},${col}) has a border`).toBeNull();
        }
      }
    }
  });

  it('wall cells do NOT have borders', () => {
    const { grid } = makeFullGrid('no-border-on-wall');
    generateBorders(grid, catalog);

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const cell = grid[row][col];
        if (cell.wall !== null) {
          expect(cell.border, `Wall cell (${row},${col}) has a border`).toBeNull();
        }
      }
    }
  });

  it('cells without liquid/wall neighbors do NOT have borders', () => {
    const { grid } = makeFullGrid('no-border-isolated');
    generateBorders(grid, catalog);

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const cell = grid[row][col];
        if (cell.border === null) {
          // If no border, verify it either has liquid/wall itself OR has no transition neighbors
          if (cell.liquid === null && cell.wall === null) {
            const mask = computeNeighborTransitionMask(grid, row, col);
            expect(mask, `Cell (${row},${col}) has transition neighbors but no border`).toBe(0);
          }
        }
      }
    }
  });
});

describe('generateBorders — Determinism', () => {
  it('same grid state produces same borders', () => {
    const { grid: grid1 } = makeFullGrid('determ-border');
    generateBorders(grid1, catalog);

    const { grid: grid2 } = makeFullGrid('determ-border');
    generateBorders(grid2, catalog);

    for (let row = 0; row < grid1.length; row++) {
      for (let col = 0; col < grid1[0].length; col++) {
        expect(grid1[row][col].border).toEqual(grid2[row][col].border);
        expect(grid1[row][col].borderMask).toEqual(grid2[row][col].borderMask);
      }
    }
  });
});

describe('generateBorders — Wall transitions', () => {
  it('cells adjacent to walls (but not walls themselves) get borders', () => {
    const { grid } = makeFullGrid('wall-borders');
    generateBorders(grid, catalog);

    let wallAdjacentBorders = 0;
    const height = grid.length;
    const width = grid[0].length;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];
        if (cell.border !== null && cell.liquid === null && cell.wall === null) {
          // Check if any neighbor is a wall
          const offsets = [[-1, 0], [0, 1], [1, 0], [0, -1]] as Array<[number, number]>;
          for (const [dr, dc] of offsets) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
              if (grid[nr][nc].wall !== null) {
                wallAdjacentBorders++;
                break;
              }
            }
          }
        }
      }
    }

    // With wallDensity=0.05, there should be wall-adjacent borders
    expect(wallAdjacentBorders).toBeGreaterThan(0);
  });
});
