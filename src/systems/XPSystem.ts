import type { Upgrade, LevelUpResult } from '../types/interfaces';
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
 * XPSystem — Coordinator for XP gain, level-up, and upgrade selection.
 *
 * Wraps player.addXP() and adds upgrade pool management plus
 * panel display decisions. Pure logic, no Phaser dependency.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11
 */
export class XPSystem {
  private upgradePool: Upgrade[];

  constructor(initialPool: Upgrade[]) {
    this.upgradePool = [...initialPool];
  }

  /** Formula: level * 10 + 5 */
  calculateThreshold(level: number): number {
    return GAME_CONSTANTS.XP_THRESHOLD_FORMULA(level);
  }

  /**
   * Adds XP to the player and determines if the upgrade panel should show.
   * Delegates XP math to player.addXP(value) but adds panel logic:
   * - If leveledUp && level < 20 && upgradePool.length > 0: showPanel = true
   * - If leveledUp && (level >= 20 || upgradePool.length === 0): showPanel = false
   * - If !leveledUp: showPanel = false
   */
  addXP(
    player: { addXP(value: number): LevelUpResult },
    value: number,
  ): XPAddResult {
    const result = player.addXP(value);

    const showPanel =
      result.leveledUp &&
      result.newLevel < GAME_CONSTANTS.MAX_LEVEL &&
      this.upgradePool.length > 0;

    return {
      leveledUp: result.leveledUp,
      showPanel,
      newLevel: result.newLevel,
      excessXp: result.excessXp,
      reachedMaxLevel: result.reachedMaxLevel,
    };
  }

  /**
   * Returns min(count, pool.length) random unique upgrades from the pool.
   * Default count = 3. If pool is empty, returns [].
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

  /** Applies an upgrade to the player by calling upgrade.apply(player). */
  applyUpgrade(player: unknown, upgrade: Upgrade): void {
    upgrade.apply(player);
  }

  /** Removes an upgrade from the pool by ID. */
  removeUpgradeFromPool(upgradeId: string): void {
    this.upgradePool = this.upgradePool.filter((u) => u.id !== upgradeId);
  }

  /** Returns current pool size (for testing). */
  getPoolSize(): number {
    return this.upgradePool.length;
  }
}
