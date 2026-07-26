/**
 * Pure utility functions for the weapon system.
 * These are independent of Phaser and can be tested without mocks.
 *
 * Requirements: 4.1, 4.6
 */

export interface WeaponTarget {
  x: number;
  y: number;
  active: boolean;
  hp: number;
}

/**
 * Finds the closest active enemy with hp > 0 within the specified range.
 *
 * Rules:
 * - Uses Euclidean distance (squared for comparison optimization)
 * - Range is inclusive: distance <= maxRange
 * - Ignores enemies with active === false or hp <= 0
 * - Returns null when no valid target exists
 * - On exact tie: returns the first found (earlier in array)
 * - Does NOT modify the input array
 * - Works with positive and negative coordinates
 * - Never produces NaN
 */
export function findClosestEnemy(
  playerPos: { x: number; y: number },
  enemies: WeaponTarget[],
  maxRange: number,
): WeaponTarget | null {
  if (!enemies || enemies.length === 0) return null;
  if (!isFinite(playerPos.x) || !isFinite(playerPos.y) || !isFinite(maxRange)) return null;

  const maxRangeSq = maxRange * maxRange;
  let closest: WeaponTarget | null = null;
  let closestDistSq = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];

    // Skip inactive or dead enemies
    if (!enemy.active || enemy.hp <= 0) continue;

    // Skip enemies with invalid coordinates
    if (!isFinite(enemy.x) || !isFinite(enemy.y)) continue;

    const dx = enemy.x - playerPos.x;
    const dy = enemy.y - playerPos.y;
    const distSq = dx * dx + dy * dy;

    // Range check (inclusive: distance <= maxRange → distSq <= maxRangeSq)
    if (distSq > maxRangeSq) continue;

    // Closest wins; on tie, first found wins (strict less than)
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closest = enemy;
    }
  }

  return closest;
}

/**
 * Calculates the velocity components (vx, vy) for a projectile
 * traveling from `from` toward `target` at the given speed.
 *
 * Rules:
 * - Normalizes direction vector, multiplies by speed
 * - If from === target (distance 0): returns { vx: 0, vy: 0 }
 * - Never produces NaN
 */
export function calculateProjectileVelocity(
  from: { x: number; y: number },
  target: { x: number; y: number },
  speed: number,
): { vx: number; vy: number } {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distSq = dx * dx + dy * dy;

  // If same position or invalid, return zero velocity
  if (distSq === 0 || !isFinite(distSq) || !isFinite(speed)) {
    return { vx: 0, vy: 0 };
  }

  const dist = Math.sqrt(distSq);
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;

  // Guard against NaN
  if (!isFinite(vx) || !isFinite(vy)) {
    return { vx: 0, vy: 0 };
  }

  return { vx, vy };
}
