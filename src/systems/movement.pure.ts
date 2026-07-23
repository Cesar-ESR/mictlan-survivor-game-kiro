import { GAME_CONSTANTS } from '../config/constants';

/**
 * Pure movement logic extracted for testability without Phaser dependencies.
 * These functions implement the core movement calculations.
 *
 * Requirements: 2.1, 2.2, 2.5, 2.6
 */

/**
 * Represents the state of directional input keys.
 */
export interface DirectionInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Pure function: Calculates the movement direction with axis-independent cancellation.
 *
 * - Opposing keys on the same axis cancel each other (W+S→0 on Y, A+D→0 on X).
 * - Each axis is evaluated independently.
 * - The resulting vector is normalized to ensure magnitude = 1 for diagonals.
 * - Returns {x: 0, y: 0} if no net movement (zero vector, not normalized).
 *
 * Requirements: 2.2, 2.6
 */
export function calculateDirection(input: DirectionInput): { x: number; y: number } {
  let dx = 0;
  let dy = 0;

  // Axis-independent cancellation
  if (input.left && !input.right) dx = -1;
  else if (input.right && !input.left) dx = 1;
  // else: both or neither → dx = 0

  if (input.up && !input.down) dy = -1;
  else if (input.down && !input.up) dy = 1;
  // else: both or neither → dy = 0

  // Normalize diagonal so magnitude = 1
  if (dx !== 0 && dy !== 0) {
    const mag = Math.sqrt(dx * dx + dy * dy);
    dx /= mag;
    dy /= mag;
  }

  return { x: dx, y: dy };
}

/**
 * Pure function: Applies movement to a position using direction, speed, and delta time.
 * Clamps the resulting position to map boundaries.
 *
 * Requirements: 2.1, 2.5
 */
export function applyMovement(
  position: { x: number; y: number },
  direction: { x: number; y: number },
  speed: number,
  delta: number,
  mapWidth: number = GAME_CONSTANTS.MAP_WIDTH,
  mapHeight: number = GAME_CONSTANTS.MAP_HEIGHT
): { x: number; y: number } {
  const deltaSeconds = delta / 1000;
  const newX = position.x + direction.x * speed * deltaSeconds;
  const newY = position.y + direction.y * speed * deltaSeconds;

  return {
    x: Math.max(0, Math.min(mapWidth, newX)),
    y: Math.max(0, Math.min(mapHeight, newY)),
  };
}
