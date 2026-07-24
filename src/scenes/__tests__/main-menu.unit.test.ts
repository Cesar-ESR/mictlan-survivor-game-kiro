import { describe, it, expect } from 'vitest';
import type { GameModeConfig } from '../../types/interfaces';
import {
  createCampaignModeConfig,
  createInfiniteModeConfig,
  resolveGameMode,
} from '../game-mode-utils';

describe('MainMenu Mode Selection', () => {
  describe('createCampaignModeConfig', () => {
    it('returns campaign mode with finalWave 10', () => {
      const config = createCampaignModeConfig();
      expect(config.mode).toBe('campaign');
      expect(config.finalWave).toBe(10);
    });
  });

  describe('createInfiniteModeConfig', () => {
    it('returns infinite mode with finalWave null', () => {
      const config = createInfiniteModeConfig();
      expect(config.mode).toBe('infinite');
      expect(config.finalWave).toBeNull();
    });
  });

  describe('resolveGameMode', () => {
    it('returns campaign config when data has valid campaign mode', () => {
      const data = { gameMode: { mode: 'campaign', finalWave: 10 } as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('returns infinite config when data has valid infinite mode', () => {
      const data = { gameMode: { mode: 'infinite', finalWave: null } as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'infinite', finalWave: null });
    });

    it('falls back to campaign when data is undefined', () => {
      const result = resolveGameMode(undefined, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('falls back to campaign when data has no gameMode', () => {
      const result = resolveGameMode({}, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('uses query param infinite as fallback when no valid data', () => {
      const result = resolveGameMode(undefined, 'infinite');
      expect(result).toEqual({ mode: 'infinite', finalWave: null });
    });

    it('ignores query param when valid data is provided', () => {
      const data = { gameMode: { mode: 'campaign', finalWave: 10 } as GameModeConfig };
      const result = resolveGameMode(data, 'infinite');
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('falls back to campaign when campaign has finalWave 0 (invalid)', () => {
      const data = { gameMode: { mode: 'campaign', finalWave: 0 } as unknown as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('falls back to campaign when campaign has negative finalWave', () => {
      const data = { gameMode: { mode: 'campaign', finalWave: -1 } as unknown as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('accepts custom finalWave for campaign (e.g. 5)', () => {
      const data = { gameMode: { mode: 'campaign', finalWave: 5 } as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 5 });
    });

    it('rejects infinite mode with non-null finalWave', () => {
      const data = { gameMode: { mode: 'infinite', finalWave: 10 } as unknown as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('rejects campaign mode with null finalWave', () => {
      const data = { gameMode: { mode: 'campaign', finalWave: null } as unknown as GameModeConfig };
      const result = resolveGameMode(data, null);
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });

    it('falls back to campaign with unknown query mode param', () => {
      const result = resolveGameMode(undefined, 'arcade');
      expect(result).toEqual({ mode: 'campaign', finalWave: 10 });
    });
  });
});
