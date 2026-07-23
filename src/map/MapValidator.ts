/**
 * MapValidator: Valida la cuadrícula lógica generada usando BFS/flood-fill.
 *
 * Comprueba:
 * 1. Dimensiones coinciden con config
 * 2. Centro es walkable
 * 3. Safe zone libre de bloqueos
 * 4. Todas las celdas walkable tienen Ground asignado
 * 5. Consistencia de estado (walkable + wall es inválido)
 * 6. reachableRatio >= minimumReachableRatio (BFS desde centro)
 *
 * El BFS es iterativo (queue), solo cardinal 4-directions, NO modifica la grid.
 *
 * Requirements: 10.9, 10.10, Property 33
 */

import type { LogicalMapGrid } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';

// ─── Error codes ───

export type MapValidationErrorCode =
  | 'INVALID_DIMENSIONS'
  | 'MISSING_GROUND'
  | 'INVALID_START_POSITION'
  | 'START_POSITION_BLOCKED'
  | 'SAFE_ZONE_BLOCKED'
  | 'REACHABLE_RATIO_TOO_LOW'
  | 'INVALID_CELL_STATE';

export interface MapValidationError {
  code: MapValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface MapValidationResult {
  valid: boolean;
  reachableTiles: number;
  totalWalkableTiles: number;
  reachableRatio: number;
  startPosition: { x: number; y: number };
  errors: MapValidationError[];
}

// ─── Cardinal directions ───

const CARDINAL_OFFSETS: Array<[number, number]> = [
  [-1, 0], // north
  [0, 1],  // east
  [1, 0],  // south
  [0, -1], // west
];

// ─── MapValidator class ───

export class MapValidator {
  /**
   * Validates the logical map grid against the generation config.
   * Returns a MapValidationResult with detailed metrics.
   * Does NOT modify the grid.
   */
  validate(grid: LogicalMapGrid, config: MapGenerationConfig): MapValidationResult {
    const errors: MapValidationError[] = [];
    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;

    const centerRow = Math.floor(config.heightInTiles / 2);
    const centerCol = Math.floor(config.widthInTiles / 2);

    const startPosition = { x: centerCol, y: centerRow };

    // Check 1: Dimensions match config
    if (height !== config.heightInTiles || width !== config.widthInTiles) {
      errors.push({
        code: 'INVALID_DIMENSIONS',
        message: `Grid dimensions (${width}×${height}) do not match config (${config.widthInTiles}×${config.heightInTiles})`,
        details: { actualWidth: width, actualHeight: height, expectedWidth: config.widthInTiles, expectedHeight: config.heightInTiles },
      });
    }

    // Check 2: Start position in bounds
    if (centerRow < 0 || centerRow >= height || centerCol < 0 || centerCol >= width) {
      errors.push({
        code: 'INVALID_START_POSITION',
        message: `Start position (${centerCol}, ${centerRow}) is out of grid bounds (${width}×${height})`,
        details: { startX: centerCol, startY: centerRow, width, height },
      });

      return {
        valid: false,
        reachableTiles: 0,
        totalWalkableTiles: 0,
        reachableRatio: 0,
        startPosition,
        errors,
      };
    }

    // Check 3: Start position (center) is walkable
    if (!grid[centerRow][centerCol].walkable) {
      errors.push({
        code: 'START_POSITION_BLOCKED',
        message: `Start position (${centerCol}, ${centerRow}) is not walkable`,
        details: { startX: centerCol, startY: centerRow },
      });
    }

    // Check 4: Safe zone cells are walkable
    const safeZoneRadius = config.safeZoneRadius;
    for (let row = centerRow - safeZoneRadius; row <= centerRow + safeZoneRadius; row++) {
      for (let col = centerCol - safeZoneRadius; col <= centerCol + safeZoneRadius; col++) {
        if (row >= 0 && row < height && col >= 0 && col < width) {
          const cell = grid[row][col];
          if (cell.inSafeZone && !cell.walkable) {
            errors.push({
              code: 'SAFE_ZONE_BLOCKED',
              message: `Safe zone cell (${col}, ${row}) is not walkable`,
              details: { cellX: col, cellY: row },
            });
            // Only report first safe zone violation
            break;
          }
        }
      }
      // Break outer loop too if we found a violation
      if (errors.some(e => e.code === 'SAFE_ZONE_BLOCKED')) break;
    }

    // Check 5: Consistency — walkable cells with wall or obstacle is invalid
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];
        if (cell.walkable && (cell.wall !== null || cell.obstacle !== null)) {
          errors.push({
            code: 'INVALID_CELL_STATE',
            message: `Cell (${col}, ${row}) is walkable but has wall or obstacle`,
            details: { cellX: col, cellY: row, hasWall: cell.wall !== null, hasObstacle: cell.obstacle !== null },
          });
          // Only report first inconsistency
          break;
        }
      }
      if (errors.some(e => e.code === 'INVALID_CELL_STATE')) break;
    }

    // Check 6: Missing ground on walkable cells
    let missingGround = false;
    for (let row = 0; row < height && !missingGround; row++) {
      for (let col = 0; col < width && !missingGround; col++) {
        const cell = grid[row][col];
        if (cell.walkable && cell.ground === null) {
          errors.push({
            code: 'MISSING_GROUND',
            message: `Walkable cell (${col}, ${row}) has no ground tile assigned`,
            details: { cellX: col, cellY: row },
          });
          missingGround = true;
        }
      }
    }

    // Count total walkable tiles and BFS from center
    let totalWalkableTiles = 0;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].walkable) {
          totalWalkableTiles++;
        }
      }
    }

    // Handle edge case: no walkable tiles at all
    if (totalWalkableTiles === 0) {
      return {
        valid: false,
        reachableTiles: 0,
        totalWalkableTiles: 0,
        reachableRatio: 0,
        startPosition,
        errors: [...errors, {
          code: 'REACHABLE_RATIO_TOO_LOW',
          message: 'No walkable tiles exist in the grid',
          details: { reachableTiles: 0, totalWalkableTiles: 0, reachableRatio: 0, minimumRequired: config.minimumReachableRatio },
        }],
      };
    }

    // BFS flood-fill from center (iterative queue, cardinal only)
    const reachableTiles = this.floodFill(grid, centerRow, centerCol, height, width);

    const reachableRatio = reachableTiles / totalWalkableTiles;

    // Check 7: reachableRatio threshold
    if (reachableRatio < config.minimumReachableRatio) {
      errors.push({
        code: 'REACHABLE_RATIO_TOO_LOW',
        message: `Reachable ratio ${reachableRatio.toFixed(4)} is below minimum ${config.minimumReachableRatio}`,
        details: { reachableTiles, totalWalkableTiles, reachableRatio, minimumRequired: config.minimumReachableRatio },
      });
    }

    return {
      valid: errors.length === 0,
      reachableTiles,
      totalWalkableTiles,
      reachableRatio,
      startPosition,
      errors,
    };
  }

  /**
   * BFS flood-fill from (startRow, startCol).
   * Only traverses walkable cells via cardinal 4-directions.
   * Does NOT modify the grid.
   * Returns count of reachable walkable cells.
   */
  private floodFill(
    grid: LogicalMapGrid,
    startRow: number,
    startCol: number,
    height: number,
    width: number,
  ): number {
    // If start is not walkable, no cells are reachable from it
    if (!grid[startRow][startCol].walkable) {
      return 0;
    }

    const visited = new Uint8Array(height * width);
    const queue: number[] = [];

    const startIdx = startRow * width + startCol;
    visited[startIdx] = 1;
    queue.push(startIdx);

    let count = 0;
    let head = 0;

    while (head < queue.length) {
      const idx = queue[head++];
      const row = Math.floor(idx / width);
      const col = idx % width;
      count++;

      for (const [dr, dc] of CARDINAL_OFFSETS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
          const nIdx = nr * width + nc;
          if (!visited[nIdx] && grid[nr][nc].walkable) {
            visited[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }

    return count;
  }
}
