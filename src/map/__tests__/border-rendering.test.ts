import { describe, it, expect } from 'vitest';
import {
  CONFIRMED_BORDER_MAPPINGS,
  resolveBorderPlacements,
} from '../VisualTileMappings';

describe('Border rendering — Water confirmed mappings', () => {
  it('masks 1, 2, 4, 8 have exactly 1 placement each', () => {
    for (const mask of [1, 2, 4, 8]) {
      const placements = resolveBorderPlacements(mask, 'water');
      expect(placements).toHaveLength(1);
    }
  });

  it('masks 3, 6, 12, 9 have exactly 2 placements each', () => {
    for (const mask of [3, 6, 12, 9]) {
      const placements = resolveBorderPlacements(mask, 'water');
      expect(placements).toHaveLength(2);
    }
  });

  it('water uses frame 10 exclusively', () => {
    const waterMap = CONFIRMED_BORDER_MAPPINGS.water;
    for (const mapping of Object.values(waterMap)) {
      if (!mapping) continue;
      for (const p of mapping.placements) {
        expect(p.frame).toBe(10);
      }
    }
  });

  it('water mask 1 has exact placement', () => {
    const p = resolveBorderPlacements(1, 'water');
    expect(p[0]).toEqual({ frame: 10, rotation: 180, flipX: true, flipY: false });
  });

  it('water mask 3 has two placements in exact order', () => {
    const p = resolveBorderPlacements(3, 'water');
    expect(p[0]).toEqual({ frame: 10, rotation: 180, flipX: true, flipY: false });
    expect(p[1]).toEqual({ frame: 10, rotation: 270, flipX: true, flipY: false });
  });
});

describe('Border rendering — Lava confirmed mappings', () => {
  it('masks 1, 2, 4, 8 have exactly 1 placement each', () => {
    for (const mask of [1, 2, 4, 8]) {
      const placements = resolveBorderPlacements(mask, 'lava');
      expect(placements).toHaveLength(1);
    }
  });

  it('masks 3, 6, 12, 9 have exactly 2 placements each', () => {
    for (const mask of [3, 6, 12, 9]) {
      const placements = resolveBorderPlacements(mask, 'lava');
      expect(placements).toHaveLength(2);
    }
  });

  it('lava uses frame 13 exclusively', () => {
    const lavaMap = CONFIRMED_BORDER_MAPPINGS.lava;
    for (const mapping of Object.values(lavaMap)) {
      if (!mapping) continue;
      for (const p of mapping.placements) {
        expect(p.frame).toBe(13);
      }
    }
  });

  it('lava mask 1 has exact placement', () => {
    const p = resolveBorderPlacements(1, 'lava');
    expect(p[0]).toEqual({ frame: 13, rotation: 0, flipX: true, flipY: false });
  });

  it('lava mask 12 has exact placements (rotations 0 and 270)', () => {
    const p = resolveBorderPlacements(12, 'lava');
    expect(p[0]).toEqual({ frame: 13, rotation: 0, flipX: true, flipY: false });
    expect(p[1]).toEqual({ frame: 13, rotation: 270, flipX: true, flipY: false });
  });
});

describe('Border rendering — Spectral produces no borders', () => {
  it('spectral mapping is empty', () => {
    expect(Object.keys(CONFIRMED_BORDER_MAPPINGS.spectral)).toHaveLength(0);
  });

  it('resolveBorderPlacements returns empty for spectral', () => {
    for (let mask = 0; mask < 16; mask++) {
      expect(resolveBorderPlacements(mask, 'spectral')).toHaveLength(0);
    }
  });
});

describe('Border rendering — uncalibrated masks produce no tiles', () => {
  it('masks 5, 10, 7, 11, 13, 14, 15 return empty for water', () => {
    for (const mask of [5, 10, 7, 11, 13, 14, 15]) {
      expect(resolveBorderPlacements(mask, 'water')).toHaveLength(0);
    }
  });

  it('masks 5, 10, 7, 11, 13, 14, 15 return empty for lava', () => {
    for (const mask of [5, 10, 7, 11, 13, 14, 15]) {
      expect(resolveBorderPlacements(mask, 'lava')).toHaveLength(0);
    }
  });
});

describe('Border rendering — no implicit borderMask→frame', () => {
  it('mask 1 does not use frame 1', () => {
    const p = resolveBorderPlacements(1, 'water');
    expect(p[0].frame).not.toBe(1);
  });

  it('mask 13 does not use frame 13 for water', () => {
    // mask 13 is uncalibrated for water
    expect(resolveBorderPlacements(13, 'water')).toHaveLength(0);
  });
});

describe('Border rendering — placements are independent', () => {
  it('two placements in a corner have different rotations', () => {
    const p = resolveBorderPlacements(3, 'water');
    expect(p[0].rotation).not.toBe(p[1].rotation);
  });
});

import { invertBorderMask } from '../VisualTileMappings';

describe('invertBorderMask — cardinal inversions', () => {
  it('invertBorderMask(1) === 4 (N→S)', () => {
    expect(invertBorderMask(1)).toBe(4);
  });
  it('invertBorderMask(2) === 8 (E→W)', () => {
    expect(invertBorderMask(2)).toBe(8);
  });
  it('invertBorderMask(4) === 1 (S→N)', () => {
    expect(invertBorderMask(4)).toBe(1);
  });
  it('invertBorderMask(8) === 2 (W→E)', () => {
    expect(invertBorderMask(8)).toBe(2);
  });
});

describe('invertBorderMask — corner inversions', () => {
  it('invertBorderMask(3) === 12 (NE→SW)', () => {
    expect(invertBorderMask(3)).toBe(12);
  });
  it('invertBorderMask(6) === 9 (ES→NW)', () => {
    expect(invertBorderMask(6)).toBe(9);
  });
  it('invertBorderMask(12) === 3 (SW→NE)', () => {
    expect(invertBorderMask(12)).toBe(3);
  });
  it('invertBorderMask(9) === 6 (NW→ES)', () => {
    expect(invertBorderMask(9)).toBe(6);
  });
});

describe('invertBorderMask — symmetric masks unchanged', () => {
  it('invertBorderMask(0) === 0', () => {
    expect(invertBorderMask(0)).toBe(0);
  });
  it('invertBorderMask(5) === 5 (NS)', () => {
    expect(invertBorderMask(5)).toBe(5);
  });
  it('invertBorderMask(10) === 10 (EW)', () => {
    expect(invertBorderMask(10)).toBe(10);
  });
  it('invertBorderMask(15) === 15 (all)', () => {
    expect(invertBorderMask(15)).toBe(15);
  });
});

describe('invertBorderMask — double inversion is identity', () => {
  it('invertBorderMask(invertBorderMask(mask)) === mask for all 0-15', () => {
    for (let mask = 0; mask < 16; mask++) {
      expect(invertBorderMask(invertBorderMask(mask))).toBe(mask);
    }
  });
});

describe('invertBorderMask — confirmed mappings not modified', () => {
  it('CONFIRMED_BORDER_MAPPINGS water still has masks 1,2,3,4,6,8,9,12', () => {
    const waterMasks = Object.keys(CONFIRMED_BORDER_MAPPINGS.water).map(Number);
    expect(waterMasks.sort((a,b) => a-b)).toEqual([1, 2, 3, 4, 6, 8, 9, 12]);
  });
  it('CONFIRMED_BORDER_MAPPINGS lava still has masks 1,2,3,4,6,8,9,12', () => {
    const lavaMasks = Object.keys(CONFIRMED_BORDER_MAPPINGS.lava).map(Number);
    expect(lavaMasks.sort((a,b) => a-b)).toEqual([1, 2, 3, 4, 6, 8, 9, 12]);
  });
});
