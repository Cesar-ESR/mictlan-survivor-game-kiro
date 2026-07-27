import type { GameModeConfig } from '../types/interfaces';

/**
 * Pure utility functions for game mode resolution.
 * Extracted for testability (no Phaser dependency).
 * Requirements: 6.4, 6.5
 */

/** Creates the default campaign mode config. */
export function createCampaignModeConfig(): GameModeConfig {
  return { mode: 'campaign', finalWave: 10 };
}

/** Creates the infinite mode config. */
export function createInfiniteModeConfig(): GameModeConfig {
  return { mode: 'infinite', finalWave: null };
}

/**
 * Resolves a GameModeConfig from scene init data, with fallback to query param (debug only).
 * Validates the incoming data structure to prevent malformed configs.
 */
export function resolveGameMode(
  data: { gameMode?: GameModeConfig } | undefined,
  queryMode: string | null,
): GameModeConfig {
  if (data?.gameMode) {
    if (
      data.gameMode.mode === 'campaign' &&
      typeof data.gameMode.finalWave === 'number' &&
      data.gameMode.finalWave >= 1
    ) {
      return { mode: 'campaign', finalWave: data.gameMode.finalWave };
    }
    if (data.gameMode.mode === 'infinite' && data.gameMode.finalWave === null) {
      return { mode: 'infinite', finalWave: null };
    }
  }
  // Fallback to query param (debug/legacy support)
  return queryMode === 'infinite'
    ? { mode: 'infinite', finalWave: null }
    : { mode: 'campaign', finalWave: 10 };
}
