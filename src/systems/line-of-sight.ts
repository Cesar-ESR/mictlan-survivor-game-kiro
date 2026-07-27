/**
 * Line of sight utilities for weapon targeting.
 * Uses Bresenham-style line traversal on the logical grid.
 *
 * BUG-005: Projectiles pass through blocking layers — this module
 * provides the LOS check so WeaponSystem skips targets behind walls.
 */

export interface Position {
  x: number;
  y: number;
}

export type CellBlockingChecker = (col: number, row: number) => boolean;

/**
 * Checks if there's a clear line of sight between two world positions.
 * Traverses all grid cells along the line and checks for blockers.
 *
 * @param start World position (pixels)
 * @param end World position (pixels)
 * @param tileSize Size of each tile in pixels (32)
 * @param isCellBlocking Function that returns true if the cell at (col, row) blocks projectiles
 * @returns true if no blocking cell is between start and end
 */
export function hasLineOfSight(
  start: Position,
  end: Position,
  tileSize: number,
  isCellBlocking: CellBlockingChecker,
): boolean {
  // Convert to tile coordinates
  const startCol = Math.floor(start.x / tileSize);
  const startRow = Math.floor(start.y / tileSize);
  const endCol = Math.floor(end.x / tileSize);
  const endRow = Math.floor(end.y / tileSize);

  // If same tile, always clear
  if (startCol === endCol && startRow === endRow) return true;

  // Bresenham's line algorithm to traverse all cells
  let x0 = startCol;
  let y0 = startRow;
  const x1 = endCol;
  const y1 = endRow;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    // Skip the start cell (player's own cell)
    if (!(x0 === startCol && y0 === startRow)) {
      if (isCellBlocking(x0, y0)) {
        return false;
      }
    }

    // Reached end
    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return true;
}
