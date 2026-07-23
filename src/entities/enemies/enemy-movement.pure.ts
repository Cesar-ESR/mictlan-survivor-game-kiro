/**
 * Pure functions for enemy movement calculations.
 * These are extracted from enemy classes to enable unit testing without Phaser.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Calculate the unit direction vector from source to target.
 * Returns {x: 0, y: 0} if positions are identical.
 */
export function calculateChaseDirection(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: 0, y: 0 };
  return { x: dx / dist, y: dy / dist };
}

/**
 * Calculate the velocity for direct chase movement.
 * Returns velocity vector pointing from enemy to player with given speed.
 */
export function calculateDirectChaseVelocity(
  enemyPos: Vec2,
  playerPos: Vec2,
  speed: number,
  speedMultiplier: number,
): Vec2 {
  const dir = calculateChaseDirection(enemyPos, playerPos);
  const effectiveSpeed = speed * speedMultiplier;
  return { x: dir.x * effectiveSpeed, y: dir.y * effectiveSpeed };
}

/**
 * Calculate zigzag offset perpendicular to direction of advance.
 * Returns the perpendicular offset vector to add to base velocity.
 */
export function calculateZigzagOffset(
  direction: Vec2,
  phase: number,
  amplitude: number,
  frequency: number,
): Vec2 {
  // Perpendicular to direction: rotate 90 degrees
  const perpX = -direction.y;
  const perpY = direction.x;
  const oscillation = Math.sin(phase * frequency) * amplitude;
  return { x: perpX * oscillation, y: perpY * oscillation };
}

/**
 * Calculate new speed after acceleration, capped at maxSpeed.
 */
export function calculateAcceleration(
  currentSpeed: number,
  acceleration: number,
  maxSpeed: number,
  deltaSeconds: number,
): number {
  const newSpeed = currentSpeed + acceleration * deltaSeconds;
  return Math.min(newSpeed, maxSpeed);
}

/**
 * Calculate distance between two positions.
 */
export function calculateDistance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
