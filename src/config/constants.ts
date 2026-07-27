/**
 * Constantes globales del juego Mictlán Survivor.
 * Todas las velocidades en px/s, tiempos en segundos (excepto donde se indica ms).
 */
export const GAME_CONSTANTS = {
  // Player
  PLAYER_BASE_SPEED: 220,
  PLAYER_BASE_HP: 100,
  MAX_LEVEL: 20,

  /** Hidden speed bonus applied after every memory upgrade (percentage of base speed). */
  MEMORY_UPGRADE_SPEED_BONUS: 0.10,

  // Map
  MAP_WIDTH: 3200,
  MAP_HEIGHT: 3200,

  // Waves
  WAVE_DURATION: 30,                // seconds
  WAVE_TRANSITION_TIME: 2,          // seconds
  BASE_SPAWN_INTERVAL: 2,           // seconds

  // Enemies
  DEFAULT_MAX_ENEMIES: 100,
  ENEMY_DESPAWN_DISTANCE: 1500,     // px

  // Spawn positioning
  SPAWN_MIN_DISTANCE_FROM_EDGE: 50,
  SPAWN_MAX_DISTANCE_FROM_EDGE: 300,

  // Weapon
  WEAPON_BASE_DAMAGE: 20,
  WEAPON_BASE_FIRE_RATE: 700,
  WEAPON_RANGE: 404,                // 12 tiles × 32px (BUG-004: was 800 — too far)
  PROJECTILE_MAX_DISTANCE: 450,     // slightly more than range (BUG-004: was 1000)
  PROJECTILE_DISPLAY_SIZE: 32,      // px — visual size of projectile sprite (flying & impact)

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
  MAX_HP_MULTIPLIER: 4.5,
  SPEED_SCALING_BASE: 1.05,
  MAX_SPEED_MULTIPLIER: 1.6,

  // Calavera Llameante
  EXPLOSION_RADIUS: 100,
  EXPLOSION_DAMAGE: 15,

  // Rendering depths for entities (above map layers which use 0-4)
  ENTITY_DEPTH_ORBS: 50,
  ENTITY_DEPTH_PROJECTILES: 90,
  ENTITY_DEPTH_ENEMIES: 100,
  ENTITY_DEPTH_PLAYER: 100,
} as const;

/** Función pura para calcular el umbral de XP para un nivel dado. */
export function xpThresholdFormula(level: number): number {
  return level * 10 + 5;
}
