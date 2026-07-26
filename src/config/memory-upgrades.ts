import type { UpgradeContext } from '../types/interfaces';
import { GAME_CONSTANTS } from './constants';

// --- Memory Upgrade Types ---

export type MemoryId =
  | 'memory-war'
  | 'memory-family'
  | 'memory-home';

export type MemoryEffect =
  | { type: 'weapon-damage'; amount: number }
  | { type: 'max-hp'; amount: number; healAmount: number }
  | { type: 'fire-rate'; reductionMs: number; minimumMs: number };

export interface MemoryUpgrade {
  id: MemoryId;
  name: string;
  narrative: string;
  effectText: string;
  level: number;
  maxLevel: number;
  effect: MemoryEffect;
}

// --- Memory Configuration (immutable template) ---

const MEMORY_UPGRADE_CONFIGS: ReadonlyArray<Omit<MemoryUpgrade, 'level'>> = [
  {
    id: 'memory-war',
    name: 'Recuerdo de la Guerra',
    narrative: 'El eco de antiguas batallas fortalece sus ataques.',
    effectText: 'Aumenta el daño del arma en 25.',
    maxLevel: 6,
    effect: { type: 'weapon-damage', amount: 25 },
  },
  {
    id: 'memory-family',
    name: 'Recuerdo de la Familia',
    narrative: 'El amor de quienes dejó atrás fortalece su corazón.',
    effectText: 'Aumenta la vida máxima en 40 y recupera 50 de vida.',
    maxLevel: 6,
    effect: { type: 'max-hp', amount: 40, healAmount: 50 },
  },
  {
    id: 'memory-home',
    name: 'Recuerdo del Hogar',
    narrative: 'El deseo de regresar acelera su voluntad.',
    effectText: 'Reduce el intervalo de disparo en 100 ms.',
    maxLevel: 6,
    effect: { type: 'fire-rate', reductionMs: 117, minimumMs: 250 },
  },
];

/**
 * Factory that creates a fresh set of MemoryUpgrade instances for each game session.
 * Returns new objects each time — no shared mutable references.
 */
export function createInitialMemories(): MemoryUpgrade[] {
  return MEMORY_UPGRADE_CONFIGS.map((config) => ({
    ...config,
    effect: { ...config.effect } as MemoryEffect,
    level: 0,
  }));
}

/**
 * Returns only memories that have not reached their max level.
 * Order is preserved: War, Family, Home.
 */
export function getAvailableMemories(memories: MemoryUpgrade[]): MemoryUpgrade[] {
  return memories.filter((m) => m.level < m.maxLevel);
}

/**
 * Exhaustive application of memory upgrade effects.
 * Does NOT increment memory.level — caller is responsible for that after success.
 */
export function applyMemoryUpgrade(memory: MemoryUpgrade, context: UpgradeContext): void {
  const effect = memory.effect;
  switch (effect.type) {
    case 'weapon-damage':
      context.weaponSystem.increaseDamage(effect.amount);
      break;
    case 'max-hp':
      context.player.maxHp += effect.amount;
      context.player.hp = Math.min(context.player.hp + effect.healAmount, context.player.maxHp);
      break;
    case 'fire-rate':
      context.weaponSystem.reduceFireRate(effect.reductionMs, effect.minimumMs);
      break;
    default: {
      const _exhaustive: never = effect;
      throw new Error(`Unknown memory effect type: ${(_exhaustive as { type: string }).type}`);
    }
  }

  // Hidden speed bonus: every memory upgrade grants a small movement speed increase
  context.player.increaseSpeed(GAME_CONSTANTS.MEMORY_UPGRADE_SPEED_BONUS);
}
