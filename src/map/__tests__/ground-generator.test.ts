import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { createEmptyGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import {
  generateGround,
  markSafeZone,
  validateGroundWeights,
} from '../GroundGenerator';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';

// Shared fixtures
const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);
const WIDTH = 100;
const HEIGHT = 100;

function makeGrid() {
  return createEmptyGrid(WIDTH, HEIGHT);
}

function makeFilledGrid(seed: string | number = 'test') {
  const grid = makeGrid();
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  return grid;
}

describe('generateGround — Coverage (Task 3.9, Property 28)', () => {
  it('grid has exactly 100 rows and 100 columns after generation', () => {
    const grid = makeFilledGrid();
    expect(grid.length).toBe(100);
    for (let row = 0; row < 100; row++) {
      expect(grid[row].length).toBe(100);
    }
  });

  it('all 10,000 cells have a non-null ground reference', () => {
    const grid = makeFilledGrid();
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(grid[row][col].ground, `Cell (${row},${col}) has null ground`).not.toBeNull();
      }
    }
  });

  it('no cell uses ground frames 43–47 (emptyOrTransparent)', () => {
    const grid = makeFilledGrid();
    const emptyFrames = [43, 44, 45, 46, 47];
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const ref = grid[row][col].ground!;
        expect(emptyFrames, `Cell (${row},${col}) uses empty frame ${ref.frame}`).not.toContain(ref.frame);
      }
    }
  });

  it('all ground references use the "ground" tileset', () => {
    const grid = makeFilledGrid();
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const ref = grid[row][col].ground!;
        expect(ref.tileset).toBe('ground');
      }
    }
  });

  it('all ground frame indices are within valid range [0, 42]', () => {
    const grid = makeFilledGrid();
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const ref = grid[row][col].ground!;
        expect(ref.frame).toBeGreaterThanOrEqual(0);
        expect(ref.frame).toBeLessThanOrEqual(42);
      }
    }
  });

  it('all ground tiles pass TileCatalog.isValidGroundTile()', () => {
    const grid = makeFilledGrid();
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const ref = grid[row][col].ground!;
        expect(catalog.isValidGroundTile(ref), `Tile frame ${ref.frame} not valid ground`).toBe(true);
      }
    }
  });
});

describe('generateGround — Determinism (Property 32)', () => {
  it('same seed produces exactly the same ground distribution', () => {
    const grid1 = makeFilledGrid('determinism-test');
    const grid2 = makeFilledGrid('determinism-test');

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(grid1[row][col].ground).toEqual(grid2[row][col].ground);
      }
    }
  });

  it('different seeds produce different distributions', () => {
    const grid1 = makeFilledGrid('seed-a');
    const grid2 = makeFilledGrid('seed-b');

    let differences = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid1[row][col].ground!.frame !== grid2[row][col].ground!.frame) {
          differences++;
        }
      }
    }
    // Should have many differences (not identical)
    expect(differences).toBeGreaterThan(1000);
  });
});

describe('generateGround — Weighted selection (Task 3.10)', () => {
  it('uses both groundBase and groundVariations tiles', () => {
    const grid = makeFilledGrid('variation-test');
    const baseTiles = new Set(
      TILE_CATALOG_DEFINITION.groundBase.map((r) => r.frame),
    );
    const variationTiles = new Set(
      TILE_CATALOG_DEFINITION.groundVariations.map((r) => r.frame),
    );

    let baseCount = 0;
    let variationCount = 0;

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const frame = grid[row][col].ground!.frame;
        if (baseTiles.has(frame)) baseCount++;
        if (variationTiles.has(frame)) variationCount++;
      }
    }

    expect(baseCount).toBeGreaterThan(0);
    expect(variationCount).toBeGreaterThan(0);
  });

  it('base tiles are more frequent than variation tiles with default weights', () => {
    const grid = makeFilledGrid('weight-test');
    const baseTiles = new Set(
      TILE_CATALOG_DEFINITION.groundBase.map((r) => r.frame),
    );

    let baseCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (baseTiles.has(grid[row][col].ground!.frame)) baseCount++;
      }
    }

    // With baseWeight=5 and variationWeight=1, base should dominate
    // groundBase has 16 tiles × weight 5 = 80, groundVariations has 27 tiles × weight 1 = 27
    // Expected ~74% base tiles
    expect(baseCount).toBeGreaterThan(6000); // > 60%
  });

  it('custom weights are respected', () => {
    const grid = makeGrid();
    const rng = new SeededRandom('custom-weights');
    generateGround(grid, rng, catalog, { baseWeight: 0, variationWeight: 1 });

    const baseTiles = new Set(
      TILE_CATALOG_DEFINITION.groundBase.map((r) => r.frame),
    );

    let baseCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (baseTiles.has(grid[row][col].ground!.frame)) baseCount++;
      }
    }

    // With baseWeight=0, NO base tiles should appear
    expect(baseCount).toBe(0);
  });

  it('only base tiles when variationWeight=0', () => {
    const grid = makeGrid();
    const rng = new SeededRandom('base-only');
    generateGround(grid, rng, catalog, { baseWeight: 1, variationWeight: 0 });

    const variationTiles = new Set(
      TILE_CATALOG_DEFINITION.groundVariations.map((r) => r.frame),
    );

    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(variationTiles.has(grid[row][col].ground!.frame)).toBe(false);
      }
    }
  });
});

describe('validateGroundWeights', () => {
  it('accepts valid weights', () => {
    expect(() => validateGroundWeights({ baseWeight: 5, variationWeight: 1 })).not.toThrow();
    expect(() => validateGroundWeights({ baseWeight: 0, variationWeight: 1 })).not.toThrow();
    expect(() => validateGroundWeights({ baseWeight: 1, variationWeight: 0 })).not.toThrow();
  });

  it('rejects negative baseWeight', () => {
    expect(() => validateGroundWeights({ baseWeight: -1, variationWeight: 1 })).toThrow();
  });

  it('rejects negative variationWeight', () => {
    expect(() => validateGroundWeights({ baseWeight: 1, variationWeight: -1 })).toThrow();
  });

  it('rejects both weights being 0', () => {
    expect(() => validateGroundWeights({ baseWeight: 0, variationWeight: 0 })).toThrow();
  });
});

describe('markSafeZone — Central safe zone (Task 3.16, Property 29)', () => {
  it('marks safe zone centered on (50, 50) with radius 5', () => {
    const config = createMapGenerationConfig('safe-zone-test');
    const grid = makeFilledGrid('safe-zone-test');
    markSafeZone(grid, config);

    const centerRow = 50;
    const centerCol = 50;
    const radius = config.safeZoneRadius; // 5

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        expect(grid[row][col].inSafeZone, `Cell (${row},${col}) should be in safe zone`).toBe(true);
      }
    }
  });

  it('cells outside safe zone are not marked', () => {
    const config = createMapGenerationConfig('safe-zone-test');
    const grid = makeFilledGrid('safe-zone-test');
    markSafeZone(grid, config);

    // Corners should NOT be in safe zone
    expect(grid[0][0].inSafeZone).toBe(false);
    expect(grid[99][99].inSafeZone).toBe(false);
    expect(grid[0][99].inSafeZone).toBe(false);
    expect(grid[99][0].inSafeZone).toBe(false);
  });

  it('all safe zone cells are walkable', () => {
    const config = createMapGenerationConfig('safe-walkable');
    const grid = makeFilledGrid('safe-walkable');
    markSafeZone(grid, config);

    const centerRow = 50;
    const centerCol = 50;
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        expect(grid[row][col].walkable, `Cell (${row},${col}) should be walkable`).toBe(true);
      }
    }
  });

  it('all safe zone cells have valid ground', () => {
    const config = createMapGenerationConfig('safe-ground');
    const grid = makeFilledGrid('safe-ground');
    markSafeZone(grid, config);

    const centerRow = 50;
    const centerCol = 50;
    const radius = config.safeZoneRadius;

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        expect(grid[row][col].ground).not.toBeNull();
        expect(catalog.isValidGroundTile(grid[row][col].ground!)).toBe(true);
      }
    }
  });

  it('safe zone size matches expected (2*radius+1)^2 cells', () => {
    const config = createMapGenerationConfig('safe-size');
    const grid = makeFilledGrid('safe-size');
    markSafeZone(grid, config);

    let safeCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].inSafeZone) safeCount++;
      }
    }

    const expectedSize = (2 * config.safeZoneRadius + 1) ** 2; // (11)^2 = 121
    expect(safeCount).toBe(expectedSize);
  });

  it('respects custom safeZoneRadius', () => {
    const config = createMapGenerationConfig('custom-radius', { safeZoneRadius: 3 });
    const grid = makeFilledGrid('custom-radius');
    markSafeZone(grid, config);

    let safeCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].inSafeZone) safeCount++;
      }
    }

    const expectedSize = (2 * 3 + 1) ** 2; // 49
    expect(safeCount).toBe(expectedSize);
  });

  it('safeZoneRadius=0 marks only the center cell', () => {
    const config = createMapGenerationConfig('zero-radius', { safeZoneRadius: 0 });
    const grid = makeFilledGrid('zero-radius');
    markSafeZone(grid, config);

    let safeCount = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].inSafeZone) safeCount++;
      }
    }

    expect(safeCount).toBe(1);
    expect(grid[50][50].inSafeZone).toBe(true);
  });
});
