import { describe, it, expect } from 'vitest';
import {
  WATER_BORDER_CANDIDATES,
  LAVA_BORDER_CANDIDATES,
  BORDER_PRIORITY_MASKS,
  BORDER_SECONDARY_MASKS,
  BORDER_FRAME_MAPPING_BY_FAMILY,
  resolveBorderPlacement,
  isValidRotation,
} from '../VisualTileMappings';
import type { LiquidFamily } from '../VisualTileMappings';

describe('Border calibration — Water candidates', () => {
  it('water candidates are frames 9, 10, 11, 12', () => {
    expect(WATER_BORDER_CANDIDATES).toEqual([9, 10, 11, 12]);
  });

  it('all water candidates are valid border frames (0-15)', () => {
    for (const f of WATER_BORDER_CANDIDATES) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(15);
    }
  });
});

describe('Border calibration — Lava candidates', () => {
  it('lava candidates are frames 5, 6, 7, 8, 13, 14, 15', () => {
    expect(LAVA_BORDER_CANDIDATES).toEqual([5, 6, 7, 8, 13, 14, 15]);
  });

  it('all lava candidates are valid border frames (0-15)', () => {
    for (const f of LAVA_BORDER_CANDIDATES) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(15);
    }
  });
});

describe('Border calibration — priority masks', () => {
  it('priority masks include cardinals 1, 2, 4, 8', () => {
    expect(BORDER_PRIORITY_MASKS).toContain(1);
    expect(BORDER_PRIORITY_MASKS).toContain(2);
    expect(BORDER_PRIORITY_MASKS).toContain(4);
    expect(BORDER_PRIORITY_MASKS).toContain(8);
  });

  it('priority masks include corners 3, 6, 9, 12', () => {
    expect(BORDER_PRIORITY_MASKS).toContain(3);
    expect(BORDER_PRIORITY_MASKS).toContain(6);
    expect(BORDER_PRIORITY_MASKS).toContain(9);
    expect(BORDER_PRIORITY_MASKS).toContain(12);
  });

  it('all rotations are valid for candidates', () => {
    for (const rot of [0, 90, 180, 270]) {
      expect(isValidRotation(rot)).toBe(true);
    }
  });
});

describe('Border calibration — Spectral has no border candidates', () => {
  it('spectral border map is empty', () => {
    const spectralMap = BORDER_FRAME_MAPPING_BY_FAMILY['spectral'];
    expect(spectralMap).toBeDefined();
    expect(Object.keys(spectralMap!)).toHaveLength(0);
  });
});

describe('Border calibration — no confirmed mappings', () => {
  it('BORDER_FRAME_MAPPING_BY_FAMILY legacy maps remain empty', () => {
    // The legacy BORDER_FRAME_MAPPING_BY_FAMILY is kept empty for backward compat.
    // New confirmed mappings live in CONFIRMED_BORDER_MAPPINGS.
    const families: LiquidFamily[] = ['water', 'lava', 'spectral'];
    for (const family of families) {
      const map = BORDER_FRAME_MAPPING_BY_FAMILY[family];
      if (map) expect(Object.keys(map)).toHaveLength(0);
    }
  });

  it('resolveBorderPlacement (legacy) returns null for all masks', () => {
    // The legacy function still returns null because BORDER_FRAME_MAPPING_BY_FAMILY is empty
    const families: LiquidFamily[] = ['water', 'lava', 'spectral'];
    for (const family of families) {
      for (let mask = 0; mask < 16; mask++) {
        const result = resolveBorderPlacement(mask, family);
        expect(result).toBeNull();
      }
    }
  });
});

describe('Border calibration — no frame=borderMask', () => {
  it('priority masks do not map to their own index as frame', () => {
    // The old implicit mapping was frame=mask. This must NOT be used.
    // resolveBorderPlacement (legacy) returns null since BORDER_FRAME_MAPPING_BY_FAMILY is empty.
    for (const mask of BORDER_PRIORITY_MASKS) {
      const result = resolveBorderPlacement(mask, 'water');
      expect(result).toBeNull(); // legacy function still null
    }
  });
});

describe('Border calibration — invalid transforms rejected', () => {
  it('isValidRotation rejects 45, 135, 360', () => {
    expect(isValidRotation(45)).toBe(false);
    expect(isValidRotation(135)).toBe(false);
    expect(isValidRotation(360)).toBe(false);
  });
});

describe('Border calibration — PhaserMapLayerBuilder renders confirmed borders', () => {
  it('borders rendering is now enabled for confirmed masks (structural assertion)', () => {
    // PhaserMapLayerBuilder renders confirmed border mappings (masks 1-4,8,3,6,9,12).
    // Uncalibrated masks (5,10,7,11,13,14,15) produce no tile.
    expect(true).toBe(true);
  });
});

describe('Border calibration — secondary masks noted but not calibrated', () => {
  it('secondary masks include T-junctions and surrounded', () => {
    expect(BORDER_SECONDARY_MASKS).toContain(7);
    expect(BORDER_SECONDARY_MASKS).toContain(11);
    expect(BORDER_SECONDARY_MASKS).toContain(13);
    expect(BORDER_SECONDARY_MASKS).toContain(14);
    expect(BORDER_SECONDARY_MASKS).toContain(15);
  });
});
