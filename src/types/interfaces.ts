/**
 * Tipos e interfaces base del juego Mictlán Survivor.
 * Este archivo NO importa Phaser — todos los tipos son puros.
 */

// --- Modos de Juego ---

export type GameModeConfig =
  | { mode: 'campaign'; finalWave: number }
  | { mode: 'infinite'; finalWave: null };

// --- Oleadas ---

export interface WaveConfig {
  waveNumber: number;
  duration: number;
  spawnInterval: number;
  maxEnemies: number;
  enemyTypes: EnemyTypeWeight[];
  hpMultiplier: number;
  speedMultiplier: number;
}

export interface EnemyTypeWeight {
  type: string;
  weight: number;
}

export interface DifficultyParams {
  spawnInterval: number;
  hpMultiplier: number;
  speedMultiplier: number;
}

// --- Enemigos ---

export interface EnemyConfig {
  key: string;
  hp: number;
  speed: number;
  damage: number;
  xpReward: number;
  spriteKey: string;
  behavior: EnemyBehaviorConfig;
}

export type EnemyBehaviorConfig =
  | { type: 'direct_chase' }
  | { type: 'zigzag_chase'; amplitude: number; frequency: number }
  | { type: 'explode_on_death'; explosionRadius: number; explosionDamage: number }
  | { type: 'accelerating_chase'; acceleration: number; maxSpeed: number };

export interface EnemySpawnConfig {
  hpMultiplier: number;
  speedMultiplier: number;
}

// --- Jugador ---

export interface PlayerState {
  hp: number;
  maxHp: number;
  level: number;
  levelXp: number;
  totalXp: number;
  xpThreshold: number;
  speed: number;
  weapon: WeaponConfig;
  upgrades: Upgrade[];
}

export interface WeaponConfig {
  damage: number;
  fireRate: number;
  range: number;
  projectileSpeed: number;
  maxDistance: number;
}

// --- Mejoras ---

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  apply: (playerState: PlayerState) => PlayerState;
}

export type UpgradePool = Upgrade[];

// --- Mapa ---

export interface MapConfig {
  width: number;
  height: number;
}

// --- Level Up ---

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  excessXp: number;
  reachedMaxLevel: boolean;
}
