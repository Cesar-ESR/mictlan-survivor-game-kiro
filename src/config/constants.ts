/**
 * Constantes globales del juego Mictlán Survivor.
 * Todas las velocidades en px/s, tiempos en segundos (excepto donde se indica ms).
 */
export const GAME_CONSTANTS = {
  // Player
  PLAYER_BASE_SPEED: 200,
  PLAYER_BASE_HP: 100,
  MAX_LEVEL: 20,

  // Map
  MAP_WIDTH: 3200,
  MAP_HEIGHT: 3200,

  // Waves
  WAVE_DURATION: 30,
  WAVE_TRANSITION_TIME: 2,
  BASE_SPAWN_INTERVAL: 2,

  // Enemies
  DEFAULT_MAX_ENEMIES: 100,
  ENEMY_DESPAWN_DISTANCE: 1500,

  // Spawn positioning
  SPAWN_MIN_DISTANCE_FROM_EDGE: 50,
  SPAWN_MAX_DISTANCE_FROM_EDGE: 300,

  // Weapon
  WEAPON_BASE_DAMAGE: 10,
  WEAPON_BASE_FIRE_RATE: 1000,
  WEAPON_RANGE: 800,
  PROJECTILE_MAX_DISTANCE: 1000,

  // Combat
  CONTACT_DAMAGE_COOLDOWN: 1000,

  // Orbs
  ORB_ATTRACT_RADIUS: 100,
  ORB_ATTRACT_SPEED: 400,
  ORB_LIFETIME: 30,
  MAX_ORBS: 200,

  // XP
  XP_THRESHOLD_FORMULA: (level: number) => level * 10 + 5,

  // Difficulty scaling
  SPAWN_INTERVAL_DECAY: 0.9,
  MIN_SPAWN_INTERVAL: 0.5,
  HP_SCALING_BASE: 1.15,
  MAX_HP_MULTIPLIER: 5,
  SPEED_SCALING_BASE: 1.05,
  MAX_SPEED_MULTIPLIER: 2,

  // Calavera Llameante
  EXPLOSION_RADIUS: 100,
  EXPLOSION_DAMAGE: 15,
} as const;

/** Función pura para calcular el umbral de XP para un nivel dado. */
export function xpThresholdFormula(level: number): number {
  return level * 10 + 5;
}
