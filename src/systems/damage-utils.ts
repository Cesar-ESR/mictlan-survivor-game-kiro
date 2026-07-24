/**
 * Pure utility functions for the DamageSystem.
 * Extracted for testability without Phaser dependencies.
 *
 * Requirements: 4.2, 4.3, 4.4
 */

export interface CooldownState {
  cooldowns: Map<string, number>;
  cooldownMs: number;
}

/**
 * Pure: checks if an enemy can apply contact damage (cooldown expired).
 * Returns true if the enemy's cooldown has expired (value <= 0) or has no entry.
 */
export function canApplyContactDamage(
  enemyId: string,
  state: CooldownState,
): boolean {
  const remaining = state.cooldowns.get(enemyId);
  if (remaining === undefined) {
    return true;
  }
  return remaining <= 0;
}

/**
 * Pure: applies damage, resets cooldown, returns new HP.
 * Clamps HP to 0 minimum.
 */
export function applyContactDamage(
  currentHp: number,
  enemyDamage: number,
  enemyId: string,
  state: CooldownState,
): { newHp: number } {
  const newHp = Math.max(0, currentHp - enemyDamage);
  state.cooldowns.set(enemyId, state.cooldownMs);
  return { newHp };
}

/**
 * Pure: updates all cooldowns by subtracting delta.
 * Removes entries that have expired (value <= 0 after subtraction).
 */
export function updateCooldowns(
  state: CooldownState,
  delta: number,
): void {
  for (const [id, remaining] of state.cooldowns.entries()) {
    const newValue = remaining - delta;
    if (newValue <= 0) {
      state.cooldowns.delete(id);
    } else {
      state.cooldowns.set(id, newValue);
    }
  }
}

/**
 * Pure: checks if explosion damage should apply based on distance.
 * Returns true if the player is within the explosion radius.
 */
export function shouldApplyExplosionDamage(
  playerPos: { x: number; y: number },
  explosionPos: { x: number; y: number },
  radius: number,
): boolean {
  const dx = playerPos.x - explosionPos.x;
  const dy = playerPos.y - explosionPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= radius;
}
