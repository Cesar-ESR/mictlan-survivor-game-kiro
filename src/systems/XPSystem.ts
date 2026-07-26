import type { Upgrade, UpgradeContext, LevelUpResult } from '../types/interfaces';
import { GAME_CONSTANTS } from '../config/constants';

/**
 * Result of adding XP through the XPSystem.
 * Extends LevelUpResult with panel display logic.
 */
export interface XPAddResult {
  leveledUp: boolean;
  showPanel: boolean;
  newLevel: number;
  excessXp: number;
  reachedMaxLevel: boolean;
}

/**
 * XPSystem — Coordinator for XP gain and level-up detection.
 *
 * Wraps player.addXP() and adds panel display decisions.
 * Pure logic, no Phaser dependency.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 11.6, 11.7
 */
export class XPSystem {
  /** @deprecated Legacy upgrade pool — kept for backward compatibility with old tests */
  private upgradePool: Upgrade[];

  constructor(initialPool?: Upgrade[]) {
    this.upgradePool = initialPool ? [...initialPool] : [];
  }

  /** Formula: level * 10 + 5 */
  calculateThreshold(level: number): number {
    return GAME_CONSTANTS.XP_THRESHOLD_FORMULA(level);
  }

  /**
   * Adds XP to the player and determines if the upgrade panel should show.
   * Now always shows panel if leveled up and not at max level.
   * Memory availability is checked by LevelUpCoordinator.
   */
  addXP(
    player: { addXP(value: number): LevelUpResult },
    value: number,
  ): XPAddResult {
    const result = player.addXP(value);

    const showPanel =
      result.leveledUp &&
      result.newLevel < GAME_CONSTANTS.MAX_LEVEL;

    return {
      leveledUp: result.leveledUp,
      showPanel,
      newLevel: result.newLevel,
      excessXp: result.excessXp,
      reachedMaxLevel: result.reachedMaxLevel,
    };
  }

  /**
   * @deprecated Legacy method — kept for backward compatibility with existing tests.
   * Returns min(count, pool.length) random unique upgrades from the pool.
   */
  getRandomUpgrades(count: number = 3): Upgrade[] {
    if (this.upgradePool.length === 0) return [];

    const actualCount = Math.min(count, this.upgradePool.length);

    // Fisher-Yates shuffle on a copy, then take first `actualCount`
    const shuffled = [...this.upgradePool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, actualCount);
  }

  /** @deprecated Legacy method — kept for backward compatibility with existing tests. */
  applyUpgrade(context: UpgradeContext, upgrade: Upgrade): void {
    upgrade.apply(context);
  }

  /** @deprecated Legacy method — kept for backward compatibility with existing tests. */
  removeUpgradeFromPool(upgradeId: string): void {
    this.upgradePool = this.upgradePool.filter((u) => u.id !== upgradeId);
  }

  /** Returns current pool size (for testing). */
  getPoolSize(): number {
    return this.upgradePool.length;
  }
}
