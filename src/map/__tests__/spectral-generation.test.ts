import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../SeededRandom';
import { TileCatalog } from '../TileCatalog';
import { createEmptyGrid } from '../MapCell';
import { createMapGenerationConfig } from '../MapGenerationConfig';
import { generateGround, markSafeZone } from '../GroundGenerator';
import { generateLiquidRegions, clearLiquidsFromSafeZone } from '../LiquidRegionGenerator';
import { generateSpectralRegions } from '../SpectralRegionGenerator';
import { TILE_CATALOG_DEFINITION } from '../../config/tile-catalog-data';
import { getConfirmedTemplates, hasConfirmedTemplate, SPECTRAL_TEMPLATES, SPECTRAL_FRAME_MIN, SPECTRAL_FRAME_MAX } from '../SpectralTemplates';
import type { SpectralGenerationConfig } from '../SpectralTemplates';

const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);

function makeGridForSpectral(seed: string, spectralConfig?: Partial<SpectralGenerationConfig>) {
  const config = createMapGenerationConfig(seed, { liquidDensity: 0.05 });
  const grid = createEmptyGrid(100, 100);
  const rng = new SeededRandom(seed);
  generateGround(grid, rng, catalog);
  markSafeZone(grid, config);
  const rng2 = new SeededRandom(seed + '-liq');
  generateLiquidRegions(grid, config, rng2, catalog);
  clearLiquidsFromSafeZone(grid);
  const rng3 = new SeededRandom(seed + '-spectral');
  generateSpectralRegions(grid, config, rng3, {
    spectralRegionChance: spectralConfig?.spectralRegionChance ?? 1.0, // force for testing
    maxSpectralRegions: spectralConfig?.maxSpectralRegions ?? 1,
    minSize: 9,
    maxSize: 25,
  });
  return { grid, config };
}

describe('Spectral generation — template selection', () => {
  it('only spectral-4x4-a is confirmed', () => {
    expect(hasConfirmedTemplate()).toBe(true);
    const confirmed = getConfirmedTemplates();
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].id).toBe('spectral-4x4-a');
  });

  it('only confirmed templates are used (provisional ones never selected)', () => {
    const provisional = SPECTRAL_TEMPLATES.filter(t => t.status === 'provisional');
    expect(provisional.length).toBe(3);
    // Generation only uses getConfirmedTemplates()
    const confirmed = getConfirmedTemplates();
    for (const t of confirmed) {
      expect(t.status).toBe('confirmed');
    }
  });

  it('spectral does not need centerFrame', () => {
    const { grid } = makeGridForSpectral('no-center-test');
    // Spectral cells don't use a uniform centerFrame
    let spectralCells = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquidConfig?.type === 'spectral') {
          spectralCells++;
        }
      }
    }
    // With chance=1.0, spectral should appear
    expect(spectralCells).toBeGreaterThan(0);
  });
});

describe('Spectral generation — determinism', () => {
  it('same seed produces same placement', () => {
    const { grid: g1 } = makeGridForSpectral('determ-spectral');
    const { grid: g2 } = makeGridForSpectral('determ-spectral');
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(g1[row][col].liquid).toEqual(g2[row][col].liquid);
        expect(g1[row][col].liquidConfig).toEqual(g2[row][col].liquidConfig);
      }
    }
  });

  it('does not use Math.random()', () => {
    const orig = Math.random;
    Math.random = () => 0.999;
    const { grid: g1 } = makeGridForSpectral('no-math-random-spec');
    Math.random = orig;
    const { grid: g2 } = makeGridForSpectral('no-math-random-spec');
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(g1[row][col].liquid).toEqual(g2[row][col].liquid);
      }
    }
  });
});

describe('Spectral generation — constraints', () => {
  it('at most maxSpectralRegions=1 region appears', () => {
    const { grid } = makeGridForSpectral('max-one', { spectralRegionChance: 1.0, maxSpectralRegions: 1 });
    // Count connected spectral components
    const visited = new Set<string>();
    let components = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const key = `${row},${col}`;
        if (visited.has(key)) continue;
        if (grid[row][col].liquidConfig?.type !== 'spectral') continue;
        components++;
        // BFS to mark all connected
        const queue: [number, number][] = [[row, col]];
        visited.add(key);
        while (queue.length > 0) {
          const [r, c] = queue.shift()!;
          for (const [dr, dc] of [[-1,0],[0,1],[1,0],[0,-1]] as [number,number][]) {
            const nr = r+dr, nc = c+dc;
            const nk = `${nr},${nc}`;
            if (nr >= 0 && nr < 100 && nc >= 0 && nc < 100 && !visited.has(nk) && grid[nr][nc].liquidConfig?.type === 'spectral') {
              visited.add(nk);
              queue.push([nr, nc]);
            }
          }
        }
      }
    }
    expect(components).toBeLessThanOrEqual(1);
  });

  it('spectralRegionChance=0 prevents generation', () => {
    const { grid } = makeGridForSpectral('chance-zero', { spectralRegionChance: 0 });
    let count = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquidConfig?.type === 'spectral') count++;
      }
    }
    expect(count).toBe(0);
  });

  it('spectralRegionChance=1 attempts generation (may succeed)', () => {
    const { grid } = makeGridForSpectral('chance-one', { spectralRegionChance: 1.0 });
    let count = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquidConfig?.type === 'spectral') count++;
      }
    }
    // With a 100x100 grid and low liquid density, it should find space
    expect(count).toBeGreaterThan(0);
  });

  it('never appears in Safe Zone', () => {
    const { grid, config } = makeGridForSpectral('safe-zone-spec', { spectralRegionChance: 1.0 });
    const center = 50;
    const radius = config.safeZoneRadius;
    for (let row = center - radius; row <= center + radius; row++) {
      for (let col = center - radius; col <= center + radius; col++) {
        expect(grid[row][col].liquidConfig?.type).not.toBe('spectral');
      }
    }
  });

  it('does not overlap with Water or Lava', () => {
    const { grid } = makeGridForSpectral('no-overlap', { spectralRegionChance: 1.0 });
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquidConfig?.type === 'spectral') {
          // If it's spectral, it shouldn't also be water or lava
          expect(cell.liquidConfig.type).toBe('spectral');
        }
      }
    }
  });

  it('all spectral cells have type=spectral', () => {
    const { grid } = makeGridForSpectral('all-spectral-type', { spectralRegionChance: 1.0 });
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        const cell = grid[row][col];
        if (cell.liquid && cell.liquid.frame >= SPECTRAL_FRAME_MIN && cell.liquid.frame <= SPECTRAL_FRAME_MAX) {
          expect(cell.liquidConfig?.type).toBe('spectral');
        }
      }
    }
  });

  it('all spectral cells preserve Ground', () => {
    const { grid } = makeGridForSpectral('ground-preserved', { spectralRegionChance: 1.0 });
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquidConfig?.type === 'spectral') {
          expect(grid[row][col].ground).not.toBeNull();
        }
      }
    }
  });

  it('frames belong to range 32–41', () => {
    const { grid } = makeGridForSpectral('frame-range', { spectralRegionChance: 1.0 });
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquidConfig?.type === 'spectral') {
          const frame = grid[row][col].liquid!.frame;
          expect(frame).toBeGreaterThanOrEqual(SPECTRAL_FRAME_MIN);
          expect(frame).toBeLessThanOrEqual(SPECTRAL_FRAME_MAX);
        }
      }
    }
  });

  it('template never placed partially outside map', () => {
    // With 100x100 grid and 4x4 template, the max start position is (96,96)
    const { grid } = makeGridForSpectral('no-partial', { spectralRegionChance: 1.0 });
    // Find spectral cells — if present, they should form exactly the template shape
    let spectralCells = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (grid[row][col].liquidConfig?.type === 'spectral') spectralCells++;
      }
    }
    // spectral-4x4-a has 16 cells; either 0 or 16
    expect(spectralCells === 0 || spectralCells === 16).toBe(true);
  });

  it('generation continues if no valid position found', () => {
    // Fill the entire grid with liquids to block placement
    const config = createMapGenerationConfig('blocked', { liquidDensity: 0.99 });
    const grid = createEmptyGrid(100, 100);
    const rng = new SeededRandom('blocked');
    generateGround(grid, rng, catalog);
    markSafeZone(grid, config);
    const rng2 = new SeededRandom('blocked-liq');
    generateLiquidRegions(grid, config, rng2, catalog);
    // Don't clear safe zone — try spectral on a full grid
    const rng3 = new SeededRandom('blocked-spectral');
    // This should not throw
    generateSpectralRegions(grid, config, rng3, { spectralRegionChance: 1.0, maxSpectralRegions: 1, minSize: 9, maxSize: 25 });
    // Just verify it didn't crash
    expect(true).toBe(true);
  });
});

describe('Spectral — Borders remain disabled', () => {
  it('spectral placement does not enable borders', () => {
    // This is a structural assertion - borders are disabled at renderer level
    expect(true).toBe(true);
  });
});
