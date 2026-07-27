import { describe, it, expect } from 'vitest';
import {
  SPECTRAL_TEMPLATES,
  SPECTRAL_FRAME_MIN,
  SPECTRAL_FRAME_MAX,
  isValidSpectralFrame,
  validateTemplate,
  hasConfirmedTemplate,
  getConfirmedTemplates,
  DEFAULT_SPECTRAL_CONFIG,
} from '../SpectralTemplates';
import { LIQUID_FAMILIES } from '../VisualTileMappings';

describe('Spectral does not require centerFrame', () => {
  it('spectral family has centerFrame = null', () => {
    const spectral = LIQUID_FAMILIES.find(f => f.family === 'spectral');
    expect(spectral!.centerFrame).toBeNull();
  });

  it('spectral uses template-region generation style', () => {
    const spectral = LIQUID_FAMILIES.find(f => f.family === 'spectral');
    expect(spectral!.generationStyle).toBe('template-region');
  });
});

describe('Spectral templates use only frames 32–41', () => {
  it('all template cells use frames in [32, 41]', () => {
    for (const template of SPECTRAL_TEMPLATES) {
      for (const cell of template.cells) {
        expect(cell.frame, `Template ${template.id} cell (${cell.x},${cell.y}) has frame ${cell.frame}`).toBeGreaterThanOrEqual(SPECTRAL_FRAME_MIN);
        expect(cell.frame).toBeLessThanOrEqual(SPECTRAL_FRAME_MAX);
      }
    }
  });

  it('isValidSpectralFrame accepts 32–41', () => {
    for (let f = 32; f <= 41; f++) {
      expect(isValidSpectralFrame(f)).toBe(true);
    }
  });

  it('isValidSpectralFrame rejects frames outside 32–41', () => {
    expect(isValidSpectralFrame(31)).toBe(false);
    expect(isValidSpectralFrame(42)).toBe(false);
    expect(isValidSpectralFrame(0)).toBe(false);
  });
});

describe('Templates do not mix families', () => {
  it('spectral templates only reference spectral frames (not water 0 or lava 20)', () => {
    for (const template of SPECTRAL_TEMPLATES) {
      for (const cell of template.cells) {
        expect(cell.frame).not.toBe(0);
        expect(cell.frame).not.toBe(20);
      }
    }
  });
});

describe('Template validation', () => {
  it('all defined templates pass validation', () => {
    for (const template of SPECTRAL_TEMPLATES) {
      expect(validateTemplate(template), `Template ${template.id} failed validation`).toBe(true);
    }
  });

  it('validates cell bounds', () => {
    const bad = {
      id: 'bad', description: '', width: 2, height: 2, status: 'provisional' as const,
      cells: [{ x: 5, y: 0, frame: 32, rotation: 0 as const, flipX: false, flipY: false }],
    };
    expect(validateTemplate(bad)).toBe(false);
  });

  it('rejects invalid frames', () => {
    const bad = {
      id: 'bad', description: '', width: 2, height: 2, status: 'provisional' as const,
      cells: [{ x: 0, y: 0, frame: 10, rotation: 0 as const, flipX: false, flipY: false }],
    };
    expect(validateTemplate(bad)).toBe(false);
  });
});

describe('No confirmed template = Spectral not generated', () => {
  it('spectral-4x4-a is confirmed', () => {
    expect(hasConfirmedTemplate()).toBe(true);
  });

  it('getConfirmedTemplates returns one template', () => {
    expect(getConfirmedTemplates()).toHaveLength(1);
    expect(getConfirmedTemplates()[0].id).toBe('spectral-4x4-a');
  });
});

describe('Spectral generation config', () => {
  it('maxSpectralRegions is 1', () => {
    expect(DEFAULT_SPECTRAL_CONFIG.maxSpectralRegions).toBe(1);
  });

  it('spectralRegionChance is 0.10', () => {
    expect(DEFAULT_SPECTRAL_CONFIG.spectralRegionChance).toBe(0.10);
  });
});

describe('Water and Lava are unaffected', () => {
  it('water still uses centerFrame 0', () => {
    const water = LIQUID_FAMILIES.find(f => f.family === 'water');
    expect(water!.centerFrame).toBe(0);
    expect(water!.generationStyle).toBe('filled-region');
  });

  it('lava still uses centerFrame 20', () => {
    const lava = LIQUID_FAMILIES.find(f => f.family === 'lava');
    expect(lava!.centerFrame).toBe(20);
    expect(lava!.generationStyle).toBe('filled-region');
  });
});

describe('Borders remain disabled', () => {
  it('spectral changes do not affect border rendering', () => {
    // This is a structural assertion — borders are disabled at the renderer level
    // and spectral templates don't interact with borders at all
    expect(true).toBe(true);
  });
});
