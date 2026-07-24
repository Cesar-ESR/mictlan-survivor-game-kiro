/**
 * Pure utility functions for HUD calculations.
 * Extracted for testability — no Phaser dependency.
 * Requirements: 7.1, 7.2, 7.3, 7.6
 */

/**
 * Calculates health bar fill ratio clamped [0,1].
 * @param hp Current HP
 * @param maxHp Maximum HP (must be > 0)
 * @returns Fill ratio between 0 and 1
 */
export function calculateHealthFill(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

/**
 * Calculates XP bar fill ratio with level-up excess handling.
 * - Normal: levelXp / threshold clamped [0,1]
 * - At max level: always returns 1
 * @param levelXp Current XP in the level
 * @param threshold XP needed to level up
 * @param isMaxLevel Whether player is at max level (20)
 * @returns Fill ratio between 0 and 1
 */
export function calculateXPFill(levelXp: number, threshold: number, isMaxLevel: boolean): number {
  if (isMaxLevel) return 1;
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(1, levelXp / threshold));
}

/**
 * Formats elapsed seconds as MM:SS with zero-padding.
 * Negative values are treated as 0.
 * @param elapsedSeconds Total elapsed seconds
 * @returns Formatted string in MM:SS format
 */
export function formatTimerMMSS(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, elapsedSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
