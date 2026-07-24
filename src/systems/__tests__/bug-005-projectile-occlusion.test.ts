import { describe, it, expect } from 'vitest';
import { hasLineOfSight } from '../line-of-sight';
import type { CellBlockingChecker } from '../line-of-sight';

/**
 * Regression tests for BUG-005: Projectiles pass through blocking layers.
 * Tests the line-of-sight algorithm used by WeaponSystem targeting.
 */
describe('BUG-005: Projectile occlusion / line-of-sight', () => {
  const TILE_SIZE = 32;

  // Helper: create a blocking checker from a set of blocked cells
  function createBlocker(blockedCells: Array<[number, number]>): CellBlockingChecker {
    const set = new Set(blockedCells.map(([col, row]) => `${col},${row}`));
    return (col, row) => set.has(`${col},${row}`);
  }

  // Helper: nothing blocks
  const nothingBlocks: CellBlockingChecker = () => false;

  // Helper: everything blocks
  const everythingBlocks: CellBlockingChecker = () => true;

  describe('hasLineOfSight', () => {
    it('clear path returns true (no blockers)', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: 5 * TILE_SIZE + 16, y: 16 }; // tile (5,0)
      expect(hasLineOfSight(start, end, TILE_SIZE, nothingBlocks)).toBe(true);
    });

    it('wall in between returns false', () => {
      // Start at tile (0,0), end at tile (4,0), wall at tile (2,0)
      const start = { x: 16, y: 16 };
      const end = { x: 4 * TILE_SIZE + 16, y: 16 };
      const blocker = createBlocker([[2, 0]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(false);
    });

    it('liquid in between returns false', () => {
      // Same setup, liquid acts as blocker
      const start = { x: 16, y: 16 };
      const end = { x: 4 * TILE_SIZE + 16, y: 16 };
      const blocker = createBlocker([[3, 0]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(false);
    });

    it('same-tile always returns true regardless of blocker', () => {
      const pos = { x: 50, y: 50 };
      // Both positions in same tile
      const pos2 = { x: 55, y: 55 };
      expect(hasLineOfSight(pos, pos2, TILE_SIZE, everythingBlocks)).toBe(true);
    });

    it('diagonal path with wall in between returns false', () => {
      // Start at tile (0,0), end at tile (4,4), wall at tile (2,2)
      const start = { x: 16, y: 16 };
      const end = { x: 4 * TILE_SIZE + 16, y: 4 * TILE_SIZE + 16 };
      const blocker = createBlocker([[2, 2]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(false);
    });

    it('diagonal path without wall returns true', () => {
      const start = { x: 16, y: 16 };
      const end = { x: 4 * TILE_SIZE + 16, y: 4 * TILE_SIZE + 16 };
      expect(hasLineOfSight(start, end, TILE_SIZE, nothingBlocks)).toBe(true);
    });

    it('adjacent tile is always reachable if not blocked', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: TILE_SIZE + 16, y: 16 }; // tile (1,0)
      expect(hasLineOfSight(start, end, TILE_SIZE, nothingBlocks)).toBe(true);
    });

    it('adjacent tile blocked returns false', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: TILE_SIZE + 16, y: 16 }; // tile (1,0)
      const blocker = createBlocker([[1, 0]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(false);
    });

    it('blocker at start cell is ignored (player stands there)', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: 3 * TILE_SIZE + 16, y: 16 }; // tile (3,0)
      // Block only start cell
      const blocker = createBlocker([[0, 0]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(true);
    });

    it('blocker at end cell blocks the path', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: 3 * TILE_SIZE + 16, y: 16 }; // tile (3,0)
      // Block end cell
      const blocker = createBlocker([[3, 0]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(false);
    });

    it('vertical path with blocker', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: 16, y: 5 * TILE_SIZE + 16 }; // tile (0,5)
      const blocker = createBlocker([[0, 3]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(false);
    });

    it('vertical path without blocker', () => {
      const start = { x: 16, y: 16 }; // tile (0,0)
      const end = { x: 16, y: 5 * TILE_SIZE + 16 }; // tile (0,5)
      expect(hasLineOfSight(start, end, TILE_SIZE, nothingBlocks)).toBe(true);
    });

    it('blocker beside the path does not block (miss by one tile)', () => {
      // Horizontal path from (0,2) to (5,2). Blocker at (3,3) — adjacent row
      const start = { x: 16, y: 2 * TILE_SIZE + 16 };
      const end = { x: 5 * TILE_SIZE + 16, y: 2 * TILE_SIZE + 16 };
      const blocker = createBlocker([[3, 3]]);
      expect(hasLineOfSight(start, end, TILE_SIZE, blocker)).toBe(true);
    });
  });

  describe('WeaponSystem LOS integration (conceptual)', () => {
    it('closest enemy behind wall is skipped, next visible is selected', () => {
      // Simulate: player at (0,0), enemy A at (3,0) behind wall at (2,0),
      // enemy B at (4,0) with no wall between
      // But enemy A is closer. If LOS blocks A, B should be selected.
      const playerPos = { x: 16, y: 16 };
      const enemyA = { x: 3 * TILE_SIZE + 16, y: 16 };
      const enemyB = { x: 0 * TILE_SIZE + 16, y: 4 * TILE_SIZE + 16 };
      const blocker = createBlocker([[2, 0]]);

      const losA = hasLineOfSight(playerPos, enemyA, TILE_SIZE, blocker);
      const losB = hasLineOfSight(playerPos, enemyB, TILE_SIZE, blocker);

      expect(losA).toBe(false); // Enemy A blocked
      expect(losB).toBe(true);  // Enemy B visible
    });
  });
});
