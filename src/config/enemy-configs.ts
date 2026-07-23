import type { EnemyConfig } from '../types/interfaces.js';

/** Esqueleto: persecución directa, enemigo básico. */
export const ESQUELETO_CONFIG: EnemyConfig = {
  key: 'esqueleto',
  hp: 30,
  speed: 80,
  damage: 5,
  xpReward: 5,
  spriteKey: 'esqueleto_sprite',
  behavior: { type: 'direct_chase' },
};

/** Murciélago: rápido con movimiento en zigzag. */
export const MURCIELAGO_CONFIG: EnemyConfig = {
  key: 'murcielago',
  hp: 15,
  speed: 150,
  damage: 3,
  xpReward: 3,
  spriteKey: 'murcielago_sprite',
  behavior: { type: 'zigzag_chase', amplitude: 40, frequency: 3 },
};

/** Calavera Llameante: lenta pero explota al morir. */
export const CALAVERA_LLAMEANTE_CONFIG: EnemyConfig = {
  key: 'calavera_llameante',
  hp: 50,
  speed: 60,
  damage: 10,
  xpReward: 10,
  spriteKey: 'calavera_llameante_sprite',
  behavior: { type: 'explode_on_death', explosionRadius: 100, explosionDamage: 15 },
};

/** Serpiente Emplumada: comienza lenta pero acelera progresivamente. */
export const SERPIENTE_EMPLUMADA_CONFIG: EnemyConfig = {
  key: 'serpiente_emplumada',
  hp: 80,
  speed: 100,
  damage: 8,
  xpReward: 15,
  spriteKey: 'serpiente_emplumada_sprite',
  behavior: { type: 'accelerating_chase', acceleration: 30, maxSpeed: 250 },
};

/** Mapa para búsqueda rápida de configuración por clave. */
export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  esqueleto: ESQUELETO_CONFIG,
  murcielago: MURCIELAGO_CONFIG,
  calavera_llameante: CALAVERA_LLAMEANTE_CONFIG,
  serpiente_emplumada: SERPIENTE_EMPLUMADA_CONFIG,
};
