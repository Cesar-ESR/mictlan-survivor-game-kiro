import type { WaveConfig, EnemyTypeWeight } from '../types/interfaces.js';
import { GAME_CONSTANTS } from './constants.js';

/**
 * Progresión de tipos de enemigos por oleada.
 * Oleadas 1-3: solo Esqueletos
 * Oleadas 4-6: Esqueletos + Murciélagos
 * Oleadas 7-8: + Calavera Llameante
 * Oleadas 9-10: los 4 tipos
 */
export const WAVE_ENEMY_PROGRESSION: Record<number, string[]> = {
  //1: ['esqueleto', 'murcielago', 'calavera_llameante', 'serpiente_emplumada'],
  1: ['esqueleto'],
  2: ['esqueleto'],
  3: ['esqueleto'],
  4: ['esqueleto', 'murcielago'],
  5: ['esqueleto', 'murcielago'],
  6: ['esqueleto', 'murcielago'],
  7: ['esqueleto', 'murcielago', 'calavera_llameante'],
  8: ['esqueleto', 'murcielago', 'calavera_llameante'],
  9: ['esqueleto', 'murcielago', 'calavera_llameante', 'serpiente_emplumada'],
  10: ['esqueleto', 'murcielago', 'calavera_llameante', 'serpiente_emplumada'],
};

/**
 * Construye la configuración completa de una oleada aplicando fórmulas exponenciales.
 *
 * - spawnInterval = max(BASE_SPAWN_INTERVAL × 0.9^(wave-1), 0.5)
 * - hpMultiplier = min(1.15^(wave-1), 5)
 * - speedMultiplier = min(1.05^(wave-1), 2)
 * - Pesos iguales para todos los tipos de enemigos de esa oleada.
 */
export function buildWaveConfig(wave: number): WaveConfig {
  const spawnInterval = Math.max(
    GAME_CONSTANTS.BASE_SPAWN_INTERVAL * Math.pow(GAME_CONSTANTS.SPAWN_INTERVAL_DECAY, wave - 1),
    GAME_CONSTANTS.MIN_SPAWN_INTERVAL,
  );

  const hpMultiplier = Math.min(
    Math.pow(GAME_CONSTANTS.HP_SCALING_BASE, wave - 1),
    GAME_CONSTANTS.MAX_HP_MULTIPLIER,
  );

  const speedMultiplier = Math.min(
    Math.pow(GAME_CONSTANTS.SPEED_SCALING_BASE, wave - 1),
    GAME_CONSTANTS.MAX_SPEED_MULTIPLIER,
  );

  // Determinar tipos de enemigos: si la oleada supera las configuradas, usar la última (oleada 10)
  const maxConfiguredWave = Math.max(...Object.keys(WAVE_ENEMY_PROGRESSION).map(Number));
  const effectiveWave = Math.min(wave, maxConfiguredWave);
  const types = WAVE_ENEMY_PROGRESSION[effectiveWave] ?? WAVE_ENEMY_PROGRESSION[maxConfiguredWave];

  // Asignar pesos iguales a todos los tipos
  const equalWeight = 1 / types.length;
  const enemyTypes: EnemyTypeWeight[] = types.map((type) => ({
    type,
    weight: equalWeight,
  }));

  return {
    waveNumber: wave,
    duration: GAME_CONSTANTS.WAVE_DURATION,
    spawnInterval,
    maxEnemies: GAME_CONSTANTS.DEFAULT_MAX_ENEMIES,
    enemyTypes,
    hpMultiplier,
    speedMultiplier,
  };
}
