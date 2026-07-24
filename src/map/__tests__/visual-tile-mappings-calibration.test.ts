import { describe, it, expect } from 'vitest';
import {
  LIQUID_FAMILIES,
  BORDER_FRAME_MAPPING_BY_FAMILY,
  BORDER_FRAME_CANDIDATES,
  WALL_FRAME_MAPPING_BY_MASK,
  WALLS_EMPTY_FRAMES,
  WALL_STRAIGHT_CANDIDATES,
  DOOR_OR_OPENING_CANDIDATES,
  OBSTACLE_FRAMES,
  CLIFF_OR_CHASM_CANDIDATES,
  isValidWallFrame,
  isValidRotation,
  createPlacement,
  missingPlacement,
  resolveBorderPlacement,
  resolveWallPlacement,
} from '../VisualTileMappings';
import type { LiquidFamily } from '../VisualTileMappings';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { createEmptyGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import { generateGround, markSafeZone } from '../GroundGenerator';
import {
  generateLiquidRegions,
  clearLiquidsFromSafeZone,
} from '../LiquidRegionGenerator';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';

const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);

/** Creates a grid with liquids for testing family assignment. */
function makeGridWithLiquids(seed: string | number = 'family-test', liquidDensity = 0.08) {
  const config = createMapGenerationConfig(seed, { liquidDensity });
  const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);
  const rng2 = new SeededRandom(seed);
  for (let i = 0; i < 100; i++) rng2.next();
  generateLiquidRegions(grid, config, rng2, catalog);
  clearLiquidsFromSafeZone(grid);
  return { grid, config };
}

// ═══════════════════════════════════════════════════════════════
// Test 1: Water uses frame 0 as confirmed center
// ═══════════════════════════════════════════════════════════════

describe('Water centerFrame confirmed', () => {
  it('water family has centerFrame = 0', () => {
    const water = LIQUID_FAMILIES.find(f => f.family === 'water');
    expect(water).toBeDefined();
    expect(water!.centerFrame).toBe(0);
  });

  it('water family has centerStatus = confirmed', () => {
    const water = LIQUID_FAMILIES.find(f => f.family === 'water');
    expect(water!.centerStatus).toBe('confirmed');
  });

  it('water family has weight 6', () => {
    const water = LIQUID_FAMILIES.find(f => f.family === 'water');
    expect(water!.weight).toBe(6);
  });

  it('all water regions use frame 0 exclusively', () => {
    const { grid } = makeGridWithLiquids('water-frame-check');
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null && cell.liquidConfig?.type === 'water') {
          expect(cell.liquid.frame).toBe(0);
          expect(cell.liquid.tileset).toBe('liquids');
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 2: Lava uses frame 20 as confirmed center
// ═══════════════════════════════════════════════════════════════

describe('Lava centerFrame confirmed', () => {
  it('lava family has centerFrame = 20', () => {
    const lava = LIQUID_FAMILIES.find(f => f.family === 'lava');
    expect(lava).toBeDefined();
    expect(lava!.centerFrame).toBe(20);
  });

  it('lava family has centerStatus = confirmed', () => {
    const lava = LIQUID_FAMILIES.find(f => f.family === 'lava');
    expect(lava!.centerStatus).toBe('confirmed');
  });

  it('lava family has weight 3', () => {
    const lava = LIQUID_FAMILIES.find(f => f.family === 'lava');
    expect(lava!.weight).toBe(3);
  });

  it('all lava regions use frame 20 exclusively', () => {
    const { grid } = makeGridWithLiquids('lava-frame-check');
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid !== null && cell.liquidConfig?.type === 'lava') {
          expect(cell.liquid.frame).toBe(20);
          expect(cell.liquid.tileset).toBe('liquids');
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 3: Spectral has weight 0 and no confirmed center
// ═══════════════════════════════════════════════════════════════

describe('Spectral disabled — weight 0, no confirmed center', () => {
  it('spectral family has weight 0', () => {
    const spectral = LIQUID_FAMILIES.find(f => f.family === 'spectral');
    expect(spectral).toBeDefined();
    expect(spectral!.weight).toBe(0);
  });

  it('spectral family has centerStatus = missing', () => {
    const spectral = LIQUID_FAMILIES.find(f => f.family === 'spectral');
    expect(spectral!.centerStatus).toBe('missing');
  });

  it('spectral centerFrame is null (template-region, no repeated center)', () => {
    const spectral = LIQUID_FAMILIES.find(f => f.family === 'spectral');
    expect(spectral!.centerFrame).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 4: No region selects Spectral
// ═══════════════════════════════════════════════════════════════

describe('No region selects Spectral', () => {
  it('no liquid cell has type "spectral" after generation', () => {
    // Run multiple seeds to increase confidence
    const seeds = ['spectral-check-1', 'spectral-check-2', 'spectral-check-3'];
    for (const seed of seeds) {
      const { grid } = makeGridWithLiquids(seed, 0.12);
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) {
          const cell = grid[row][col];
          if (cell.liquidConfig !== null) {
            expect(cell.liquidConfig.type, `Spectral found at (${row},${col}) with seed ${seed}`).not.toBe('spectral');
          }
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 5: A region does not mix families
// ═══════════════════════════════════════════════════════════════

describe('Regions do not mix families', () => {
  it('each liquid cell has a frame matching its family type', () => {
    const { grid } = makeGridWithLiquids('no-mix-families', 0.10);
    const height = grid.length;
    const width = grid[0].length;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];
        if (cell.liquid === null || cell.liquidConfig === null) continue;

        const type = cell.liquidConfig.type;
        const frame = cell.liquid.frame;

        // Water regions must use water's confirmed centerFrame
        if (type === 'water') {
          expect(frame, `Water cell at (${row},${col}) has wrong frame`).toBe(0);
        }
        // Lava regions must use lava's confirmed centerFrame
        if (type === 'lava') {
          expect(frame, `Lava cell at (${row},${col}) has wrong frame`).toBe(20);
        }
        // All liquid tiles must be from 'liquids' tileset
        expect(cell.liquid.tileset).toBe('liquids');
      }
    }
  });

  it('connected cells of the same frame share the same family type', () => {
    const { grid } = makeGridWithLiquids('same-frame-same-type', 0.10);
    const height = grid.length;
    const width = grid[0].length;
    const visited = new Set<string>();

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const key = `${row},${col}`;
        if (visited.has(key)) continue;
        const cell = grid[row][col];
        if (cell.liquid === null) continue;

        // BFS collecting cells with the same frame
        const regionFrame = cell.liquid.frame;
        const regionType = cell.liquidConfig!.type;
        const queue: Array<[number, number]> = [[row, col]];
        visited.add(key);

        while (queue.length > 0) {
          const [r, c] = queue.shift()!;
          const current = grid[r][c];

          // Only cells with matching frame in this connected component
          if (current.liquid!.frame !== regionFrame) continue;

          // Same frame → same type
          expect(current.liquidConfig!.type).toBe(regionType);

          for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]] as Array<[number, number]>) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
              const nkey = `${nr},${nc}`;
              if (!visited.has(nkey) && grid[nr][nc].liquid !== null && grid[nr][nc].liquid!.frame === regionFrame) {
                visited.add(nkey);
                queue.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 6: Borders legacy mapping remains empty (new mappings in CONFIRMED_BORDER_MAPPINGS)
// ═══════════════════════════════════════════════════════════════

describe('Borders legacy mapping remains empty', () => {
  it('resolveBorderPlacement (legacy) returns null for all masks and families', () => {
    const families: LiquidFamily[] = ['water', 'lava', 'spectral'];
    for (const family of families) {
      for (let mask = 0; mask < 16; mask++) {
        const result = resolveBorderPlacement(mask, family);
        expect(result).toBeNull();
      }
    }
  });

  it('BORDER_FRAME_MAPPING_BY_FAMILY has empty maps (no assignments)', () => {
    const families: LiquidFamily[] = ['water', 'lava', 'spectral'];
    for (const family of families) {
      const map = BORDER_FRAME_MAPPING_BY_FAMILY[family];
      if (!map) continue;
      expect(Object.keys(map)).toHaveLength(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 7: Legacy border mapping has no confirmed entries
// ═══════════════════════════════════════════════════════════════

describe('Legacy border mapping has no confirmed entries', () => {
  it('no border placement in BORDER_FRAME_MAPPING_BY_FAMILY has status confirmed', () => {
    const families: LiquidFamily[] = ['water', 'lava', 'spectral'];
    for (const family of families) {
      const map = BORDER_FRAME_MAPPING_BY_FAMILY[family];
      if (!map) continue;
      const entries = Object.values(map);
      for (const entry of entries) {
        if (entry) {
          expect(entry.status).not.toBe('confirmed');
        }
      }
    }
  });

  it('border frame candidates are documented but not confirmed', () => {
    // Just verify the documentation structure exists
    expect(BORDER_FRAME_CANDIDATES.waterEdge).toContain(0);
    expect(BORDER_FRAME_CANDIDATES.cornersOrEnds).toEqual([2, 3, 4]);
    expect(BORDER_FRAME_CANDIDATES.darkOrangeFamily).toEqual([5, 6, 7, 8]);
    expect(BORDER_FRAME_CANDIDATES.waterFamily).toEqual([9, 10, 11, 12]);
    expect(BORDER_FRAME_CANDIDATES.lavaFamily).toEqual([13, 14, 15]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Previous tests maintained (wall frames, rotation, placements)
// ═══════════════════════════════════════════════════════════════

describe('Wall frames 35–47 are rejected', () => {
  it('WALLS_EMPTY_FRAMES contains frames 35–47', () => {
    expect(WALLS_EMPTY_FRAMES).toHaveLength(13);
    for (let i = 35; i <= 47; i++) {
      expect(WALLS_EMPTY_FRAMES).toContain(i);
    }
  });

  it('isValidWallFrame rejects frames 35–47', () => {
    for (let i = 35; i <= 47; i++) {
      expect(isValidWallFrame(i)).toBe(false);
    }
  });

  it('isValidWallFrame accepts frames 0–34', () => {
    for (let i = 0; i <= 34; i++) {
      expect(isValidWallFrame(i)).toBe(true);
    }
  });

  it('isValidWallFrame rejects negative frames', () => {
    expect(isValidWallFrame(-1)).toBe(false);
  });
});

describe('VisualFramePlacement rotation validation', () => {
  it('isValidRotation accepts 0, 90, 180, 270', () => {
    expect(isValidRotation(0)).toBe(true);
    expect(isValidRotation(90)).toBe(true);
    expect(isValidRotation(180)).toBe(true);
    expect(isValidRotation(270)).toBe(true);
  });

  it('isValidRotation rejects invalid values', () => {
    expect(isValidRotation(45)).toBe(false);
    expect(isValidRotation(360)).toBe(false);
    expect(isValidRotation(-90)).toBe(false);
    expect(isValidRotation(1)).toBe(false);
  });

  it('createPlacement defaults rotation to 0', () => {
    const p = createPlacement(5);
    expect(p.rotation).toBe(0);
    expect(p.flipX).toBe(false);
    expect(p.flipY).toBe(false);
    expect(p.status).toBe('provisional');
  });

  it('createPlacement accepts valid rotation', () => {
    const p = createPlacement(5, { rotation: 270 });
    expect(p.rotation).toBe(270);
  });
});

describe('Missing mapping does not produce a tile', () => {
  it('missingPlacement() has status "missing" and frame -1', () => {
    const p = missingPlacement();
    expect(p.status).toBe('missing');
    expect(p.frame).toBe(-1);
  });

  it('resolveBorderPlacement returns null for missing entries', () => {
    const result = resolveBorderPlacement(5, 'water');
    expect(result).toBeNull();
  });
});

describe('Wall mappings — confirmed and provisional split', () => {
  it('masks 1, 2, 4, 5, 8, 10 are confirmed', () => {
    for (const mask of [1, 2, 4, 5, 8, 10]) {
      const placement = WALL_FRAME_MAPPING_BY_MASK[mask];
      expect(placement).toBeDefined();
      expect(placement!.status).toBe('confirmed');
    }
  });

  it('masks 0, 3, 6, 7, 9, 11, 12, 13, 14, 15 are provisional', () => {
    for (const mask of [0, 3, 6, 7, 9, 11, 12, 13, 14, 15]) {
      const placement = WALL_FRAME_MAPPING_BY_MASK[mask];
      expect(placement).toBeDefined();
      expect(placement!.status).toBe('provisional');
    }
  });
});


// ═══════════════════════════════════════════════════════════════
// Wall mask mapping — confirmed entries
// ═══════════════════════════════════════════════════════════════

describe('Wall mask mapping — confirmed entries', () => {
  it('mask 1 uses frame 0 with rotation 90 (vertical)', () => {
    const p = WALL_FRAME_MAPPING_BY_MASK[1]!;
    expect(p.frame).toBe(0);
    expect(p.rotation).toBe(90);
    expect(p.status).toBe('confirmed');
  });
  it('mask 4 uses frame 0 with rotation 90 (vertical)', () => {
    const p = WALL_FRAME_MAPPING_BY_MASK[4]!;
    expect(p.frame).toBe(0);
    expect(p.rotation).toBe(90);
    expect(p.status).toBe('confirmed');
  });
  it('mask 5 uses frame 0 with rotation 90 (vertical)', () => {
    const p = WALL_FRAME_MAPPING_BY_MASK[5]!;
    expect(p.frame).toBe(0);
    expect(p.rotation).toBe(90);
    expect(p.status).toBe('confirmed');
  });
  it('mask 2 uses frame 0 with rotation 0 (horizontal)', () => {
    const p = WALL_FRAME_MAPPING_BY_MASK[2]!;
    expect(p.frame).toBe(0);
    expect(p.rotation).toBe(0);
    expect(p.status).toBe('confirmed');
  });
  it('mask 8 uses frame 0 with rotation 0 (horizontal)', () => {
    const p = WALL_FRAME_MAPPING_BY_MASK[8]!;
    expect(p.frame).toBe(0);
    expect(p.rotation).toBe(0);
    expect(p.status).toBe('confirmed');
  });
  it('mask 10 uses frame 0 with rotation 0 (horizontal)', () => {
    const p = WALL_FRAME_MAPPING_BY_MASK[10]!;
    expect(p.frame).toBe(0);
    expect(p.rotation).toBe(0);
    expect(p.status).toBe('confirmed');
  });
  it('all six confirmed masks have status confirmed', () => {
    for (const mask of [1, 2, 4, 5, 8, 10]) {
      expect(WALL_FRAME_MAPPING_BY_MASK[mask]!.status).toBe('confirmed');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Wall mask mapping — provisional entries
// ═══════════════════════════════════════════════════════════════

describe('Wall mask mapping — provisional entries', () => {
  it('corners and junctions remain provisional', () => {
    for (const mask of [0, 3, 6, 7, 9, 11, 12, 13, 14, 15]) {
      expect(WALL_FRAME_MAPPING_BY_MASK[mask]!.status).toBe('provisional');
    }
  });
  it('no implicit structureMask→frame conversion (mask !== frame for confirmed)', () => {
    // mask 1 maps to frame 0 (not frame 1)
    expect(WALL_FRAME_MAPPING_BY_MASK[1]!.frame).toBe(0);
    expect(WALL_FRAME_MAPPING_BY_MASK[4]!.frame).toBe(0);
    expect(WALL_FRAME_MAPPING_BY_MASK[8]!.frame).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Door/opening frames excluded from generic walls
// ═══════════════════════════════════════════════════════════════

describe('Door/opening frames excluded from generic walls', () => {
  it('DOOR_OR_OPENING_CANDIDATES contains 19, 20, 22', () => {
    expect(DOOR_OR_OPENING_CANDIDATES).toEqual([19, 20, 22]);
  });
  it('door frames are not in WALL_STRAIGHT_CANDIDATES', () => {
    for (const f of DOOR_OR_OPENING_CANDIDATES) {
      expect(WALL_STRAIGHT_CANDIDATES).not.toContain(f);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Obstacles use only frames 21 and 26
// ═══════════════════════════════════════════════════════════════

describe('Obstacles use only frames 21 and 26', () => {
  it('OBSTACLE_FRAMES contains exactly [21, 26]', () => {
    expect(OBSTACLE_FRAMES).toEqual([21, 26]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Frames 28–34 are deferred (cliff/chasm)
// ═══════════════════════════════════════════════════════════════

describe('Frames 28–34 are deferred (cliff/chasm)', () => {
  it('CLIFF_OR_CHASM_CANDIDATES contains frames 28–34', () => {
    expect(CLIFF_OR_CHASM_CANDIDATES).toEqual([28, 29, 30, 31, 32, 33, 34]);
  });
  it('cliff frames are not in WALL_STRAIGHT_CANDIDATES', () => {
    for (const f of CLIFF_OR_CHASM_CANDIDATES) {
      expect(WALL_STRAIGHT_CANDIDATES).not.toContain(f);
    }
  });
  it('cliff frames are not in OBSTACLE_FRAMES', () => {
    for (const f of CLIFF_OR_CHASM_CANDIDATES) {
      expect(OBSTACLE_FRAMES).not.toContain(f);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Frames 35–47 remain rejected
// ═══════════════════════════════════════════════════════════════

describe('Frames 35–47 remain rejected', () => {
  it('isValidWallFrame rejects 35–47', () => {
    for (let i = 35; i <= 47; i++) {
      expect(isValidWallFrame(i)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Collision does not depend on frame
// ═══════════════════════════════════════════════════════════════

describe('Collision does not depend on frame', () => {
  it('resolveWallPlacement returns a placement for all masks 0-15', () => {
    for (let mask = 0; mask < 16; mask++) {
      const p = resolveWallPlacement(mask);
      expect(p).toBeDefined();
      expect(p.frame).toBeGreaterThanOrEqual(0);
      // Collision is determined by cell.wall presence, not by frame value
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Borders legacy function still returns null (duplicate for completeness)
// ═══════════════════════════════════════════════════════════════

describe('Borders legacy remains null (resolveWallPlacement context)', () => {
  it('resolveBorderPlacement (legacy) returns null for all', () => {
    const families: LiquidFamily[] = ['water', 'lava', 'spectral'];
    for (const family of families) {
      for (let mask = 0; mask < 16; mask++) {
        expect(resolveBorderPlacement(mask, family)).toBeNull();
      }
    }
  });
});
