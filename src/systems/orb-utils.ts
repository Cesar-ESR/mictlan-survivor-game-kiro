/**
 * Pure utility functions for XP orb calculations.
 * Extracted for testability without Phaser dependencies.
 *
 * Requirements: 8.2, 8.4, 8.5
 */

export interface OrbState {
  x: number;
  y: number;
  value: number;
  creationTime: number;
  isAttracted: boolean;
  active: boolean;
}

/**
 * Pure: calculates new orb position after attraction toward player.
 * If distance <= attractRadius, moves toward player at attractSpeed.
 * Otherwise stays in place.
 */
export function calculateOrbAttraction(
  orb: { x: number; y: number },
  playerPos: { x: number; y: number },
  delta: number,
  attractRadius: number,
  attractSpeed: number,
): { x: number; y: number; isAttracted: boolean } {
  const dx = playerPos.x - orb.x;
  const dy = playerPos.y - orb.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= attractRadius && distance > 0) {
    const deltaSeconds = delta / 1000;
    const moveDistance = attractSpeed * deltaSeconds;

    // Don't overshoot the player
    const actualMove = Math.min(moveDistance, distance);
    const nx = dx / distance;
    const ny = dy / distance;

    return {
      x: orb.x + nx * actualMove,
      y: orb.y + ny * actualMove,
      isAttracted: true,
    };
  }

  return {
    x: orb.x,
    y: orb.y,
    isAttracted: false,
  };
}

/**
 * Pure: determines if an orb should be collected (close enough to player).
 */
export function shouldCollectOrb(
  orbPos: { x: number; y: number },
  playerPos: { x: number; y: number },
  collectionRadius: number,
): boolean {
  const dx = playerPos.x - orbPos.x;
  const dy = playerPos.y - orbPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= collectionRadius;
}

/**
 * Pure: determines if an orb has expired based on lifetime.
 */
export function isOrbExpired(
  creationTime: number,
  currentTime: number,
  maxLifetimeMs: number,
): boolean {
  return (currentTime - creationTime) > maxLifetimeMs;
}

/**
 * Pure: given an array of orb states, returns indices to remove to enforce the cap.
 * Removes the oldest (lowest creationTime) active orbs first.
 */
export function getOrbsToRemoveForCap(
  orbs: Array<{ creationTime: number; active: boolean }>,
  maxOrbs: number,
): number[] {
  // Get indices of active orbs
  const activeIndices: number[] = [];
  for (let i = 0; i < orbs.length; i++) {
    if (orbs[i].active) {
      activeIndices.push(i);
    }
  }

  const excessCount = activeIndices.length - maxOrbs;
  if (excessCount <= 0) {
    return [];
  }

  // Sort active indices by creationTime ascending (oldest first)
  activeIndices.sort((a, b) => orbs[a].creationTime - orbs[b].creationTime);

  // Return the oldest ones that need removal
  return activeIndices.slice(0, excessCount);
}
