/**
 * Tipos e interfaces base del juego Mictlán Survivor.
 * Este archivo NO importa Phaser — todos los tipos son puros.
 */

// --- Level Up ---

/** Result returned by the Player.addXP() method */
export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  excessXp: number;
  reachedMaxLevel: boolean;
}

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

// --- Mejoras ---

/** Context passed to upgrade apply functions — provides access to player stats and weapon system */
export interface UpgradeContext {
  player: {
    hp: number;
    maxHp: number;
    speed: number;
  };
  weaponSystem: {
    getDamage(): number;
    increaseDamage(amount: number): void;
    getFireRateMs(): number;
    reduceFireRate(amountMs: number, minimumMs: number): void;
    getRange(): number;
    increaseRange(amount: number): void;
    getProjectileSpeed(): number;
    increaseProjectileSpeed(amount: number): void;
    getMaxDistance(): number;
    increaseMaxDistance(amount: number): void;
  };
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  apply(context: UpgradeContext): void;
}

/** Upgrade pool type alias */
export type UpgradePool = Upgrade[];

/** Map configuration */
export interface MapConfig {
  width: number;
  height: number;
}

// --- Event Payloads (shared contracts between producers and consumers) ---

/** Payload emitted by WaveManager on wave transitions. Consumed by GameScene, HUDScene. */
export interface WaveChangedPayload {
  wave: number;
  config: WaveConfig;
}

/** Payload emitted by LevelUpCoordinator when level-up panel should appear. Consumed by HUDScene. */
export interface LevelUpPayload {
  level: number;
  upgrades: readonly Upgrade[];
}

/** Payload emitted by HUDScene when user selects an upgrade. Consumed by LevelUpCoordinator. */
export interface UpgradeSelectedPayload {
  upgradeId: string;
}
