import { describe, it, expect } from 'vitest';
import { TileCatalog } from '../TileCatalog';
import type { TilesetKey } from '../TileCatalog';
import {
  TILE_CATALOG_DEFINITION,
  TILESET_BY_KEY,
  CONFIRMED_VALID_RANGES,
  CONFIRMED_EMPTY_RANGES,
} from '../../config/tile-catalog-data';

// Helper: construct metadata map for validation
const tilesetMetadata: Record<TilesetKey, { totalFrames: number }> = {
  ground: { totalFrames: 48 },
  borders: { totalFrames: 16 },
  liquids: { totalFrames: 48 },
  walls: { totalFrames: 48 },
  decorations: { totalFrames: 256 },
};

describe('TileCatalog — Validation (Task 3.3)', () => {
  const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);

  it('should pass full catalog validation without errors', () => {
    const result = catalog.validate(tilesetMetadata);
    if (!result.valid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('no emptyOrTransparent frame appears in any usable category', () => {
    const emptySet = new Set(
      TILE_CATALOG_DEFINITION.emptyOrTransparent.map((r) => `${r.tileset}:${r.frame}`),
    );

    const usableCategories = Object.keys(TILE_CATALOG_DEFINITION).filter(
      (k) => k !== 'emptyOrTransparent',
    ) as (keyof typeof TILE_CATALOG_DEFINITION)[];

    for (const cat of usableCategories) {
      for (const ref of TILE_CATALOG_DEFINITION[cat]) {
        const key = `${ref.tileset}:${ref.frame}`;
        expect(emptySet.has(key), `Frame ${ref.frame} of ${ref.tileset} is empty but in "${cat}"`).toBe(false);
      }
    }
  });

  it('all frame indices are within the valid range of their tileset', () => {
    const allCategories = Object.keys(TILE_CATALOG_DEFINITION) as (keyof typeof TILE_CATALOG_DEFINITION)[];

    for (const cat of allCategories) {
      for (const ref of TILE_CATALOG_DEFINITION[cat]) {
        const meta = TILESET_BY_KEY[ref.tileset];
        expect(ref.frame, `${ref.tileset}:${ref.frame} in "${cat}"`).toBeGreaterThanOrEqual(0);
        expect(ref.frame, `${ref.tileset}:${ref.frame} in "${cat}"`).toBeLessThan(meta.totalFrames);
      }
    }
  });

  it('all references have both tileset and frame defined', () => {
    const allCategories = Object.keys(TILE_CATALOG_DEFINITION) as (keyof typeof TILE_CATALOG_DEFINITION)[];

    for (const cat of allCategories) {
      for (const ref of TILE_CATALOG_DEFINITION[cat]) {
        expect(ref.tileset, `Missing tileset in "${cat}"`).toBeDefined();
        expect(ref.frame, `Missing frame in "${cat}"`).toBeDefined();
        expect(typeof ref.tileset).toBe('string');
        expect(typeof ref.frame).toBe('number');
      }
    }
  });

  it('Ground categories never use emptyOrTransparent frames', () => {
    const emptySet = new Set(
      TILE_CATALOG_DEFINITION.emptyOrTransparent.map((r) => `${r.tileset}:${r.frame}`),
    );

    for (const ref of TILE_CATALOG_DEFINITION.groundBase) {
      expect(emptySet.has(`${ref.tileset}:${ref.frame}`), `groundBase has empty frame ${ref.frame}`).toBe(false);
    }
    for (const ref of TILE_CATALOG_DEFINITION.groundVariations) {
      expect(emptySet.has(`${ref.tileset}:${ref.frame}`), `groundVariations has empty frame ${ref.frame}`).toBe(false);
    }
  });

  it('all tileset keys in the catalog are valid TILESET_METADATA keys', () => {
    const validKeys: TilesetKey[] = ['ground', 'borders', 'liquids', 'walls', 'decorations'];
    const allCategories = Object.keys(TILE_CATALOG_DEFINITION) as (keyof typeof TILE_CATALOG_DEFINITION)[];

    for (const cat of allCategories) {
      for (const ref of TILE_CATALOG_DEFINITION[cat]) {
        expect(validKeys, `Unknown tileset "${ref.tileset}" in "${cat}"`).toContain(ref.tileset);
      }
    }
  });

  it('confirmed empty ranges match the emptyOrTransparent entries', () => {
    const tilesets: TilesetKey[] = ['ground', 'borders', 'liquids', 'walls', 'decorations'];
    const emptyByTileset: Record<TilesetKey, number[]> = {
      ground: [], borders: [], liquids: [], walls: [], decorations: [],
    };

    for (const ref of TILE_CATALOG_DEFINITION.emptyOrTransparent) {
      emptyByTileset[ref.tileset].push(ref.frame);
    }

    for (const key of tilesets) {
      const range = CONFIRMED_EMPTY_RANGES[key];
      if (range === null) {
        expect(emptyByTileset[key]).toHaveLength(0);
      } else {
        const expectedCount = range.to - range.from + 1;
        expect(emptyByTileset[key]).toHaveLength(expectedCount);
        for (let i = range.from; i <= range.to; i++) {
          expect(emptyByTileset[key], `Expected frame ${i} of ${key} to be empty`).toContain(i);
        }
      }
    }
  });

  it('confirmed valid ranges do not overlap with empty ranges', () => {
    const tilesets: TilesetKey[] = ['ground', 'borders', 'liquids', 'walls', 'decorations'];

    for (const key of tilesets) {
      const validRange = CONFIRMED_VALID_RANGES[key];
      const emptyRange = CONFIRMED_EMPTY_RANGES[key];

      if (emptyRange === null) continue;

      // Valid range should not overlap with empty range
      expect(validRange.to).toBeLessThan(emptyRange.from);
    }
  });

  it('isValidGroundTile returns true for groundBase tiles', () => {
    for (const ref of TILE_CATALOG_DEFINITION.groundBase) {
      expect(catalog.isValidGroundTile(ref), `Frame ${ref.frame} should be valid ground`).toBe(true);
    }
  });

  it('isValidGroundTile returns false for emptyOrTransparent tiles', () => {
    for (const ref of TILE_CATALOG_DEFINITION.emptyOrTransparent.slice(0, 10)) {
      expect(catalog.isValidGroundTile(ref), `Frame ${ref.frame} of ${ref.tileset} should not be valid ground`).toBe(false);
    }
  });

  it('isPermittedForLayer correctly validates ground layer', () => {
    for (const ref of TILE_CATALOG_DEFINITION.groundBase) {
      expect(catalog.isPermittedForLayer(ref, 'ground')).toBe(true);
    }
    // Walls should not be permitted in ground layer
    for (const ref of TILE_CATALOG_DEFINITION.wallTops.slice(0, 3)) {
      expect(catalog.isPermittedForLayer(ref, 'ground')).toBe(false);
    }
  });

  it('semantic classification is marked as provisional', () => {
    expect(catalog.isSemanticClassificationProvisional()).toBe(true);
  });

  it('debugListAllFrames returns entries for all classified frames', () => {
    const allFrames = catalog.debugListAllFrames();
    // Total classified = valid + empty frames across all tilesets
    const totalExpected =
      TILE_CATALOG_DEFINITION.groundBase.length +
      TILE_CATALOG_DEFINITION.groundVariations.length +
      TILE_CATALOG_DEFINITION.borders.length +
      TILE_CATALOG_DEFINITION.liquidCenters.length +
      TILE_CATALOG_DEFINITION.liquidEdges.length +
      TILE_CATALOG_DEFINITION.wallTops.length +
      TILE_CATALOG_DEFINITION.wallSides.length +
      TILE_CATALOG_DEFINITION.wallCorners.length +
      TILE_CATALOG_DEFINITION.cliffs.length +
      TILE_CATALOG_DEFINITION.obstacles.length +
      TILE_CATALOG_DEFINITION.decorations.length +
      TILE_CATALOG_DEFINITION.emptyOrTransparent.length;

    expect(allFrames).toHaveLength(totalExpected);
  });
});
