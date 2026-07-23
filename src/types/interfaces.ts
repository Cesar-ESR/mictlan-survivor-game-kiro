/**
 * Core interfaces for the Mictlán Survivor game.
 */

/** Result returned by the Player.addXP() method */
export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  excessXp: number;
  reachedMaxLevel: boolean;  // true if newLevel >= 20
}

/** Configuration for game modes */
export interface GameModeConfig {
  mode: 'campaign' | 'infinite';
  finalWave: number | null;
}

/** Wave configuration */
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

/** Difficulty parameters calculated per wave */
export interface DifficultyParams {
  spawnInterval: number;
  hpMultiplier: number;
  speedMultiplier: number;
}

/** Enemy configuration */
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

/** Union type for enemy behavior configurations */
export type EnemyBehaviorConfig =
  | { type: 'direct_chase' }
  | { type: 'zigzag_chase'; amplitude: number; frequency: number }
  | { type: 'explode_on_death'; explosionRadius: number; explosionDamage: number }
  | { type: 'accelerating_chase'; acceleration: number; maxSpeed: number };

/** Spawn configuration applied to enemies at creation */
export interface EnemySpawnConfig {
  hpMultiplier: number;
  speedMultiplier: number;
}

/** Common interface for all enemy entities */
export interface IEnemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  update(delta: number, playerPos: { x: number; y: number }): void;
  takeDamage(amount: number): void;
  onDefeat(): void;
}

/** Player state representation */
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

/** Weapon configuration */
export interface WeaponConfig {
  damage: number;
  fireRate: number;
  range: number;
  projectileSpeed: number;
  maxDistance: number;
}

/** Upgrade definition */
// --- Mejoras ---

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  apply(player: unknown): void;
}

/** Upgrade pool type alias */
export type UpgradePool = Upgrade[];

/** Map configuration */
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
