/**
 * ObstacleGenerator: Coloca obstáculos individuales o en clusters pequeños.
 *
 * Algoritmo:
 * 1. Calcula número objetivo de celdas con obstáculo según obstacleDensity.
 * 2. Coloca obstáculos individuales o clusters de 1-2 celdas.
 * 3. Respeta spacing mínimo entre obstáculos (default: 2 tiles).
 * 4. Excluye: safe zone, líquidos, muros, obstáculos existentes.
 * 5. Marca walkable=false en celdas con obstáculo.
 * 6. Asigna TileReference placeholder del tileset walls (obstacles category, frames 27-34).
 * 7. Totalmente determinista via SeededRandom.
 *
 * La validación de paths principales se delega al MapValidator (fase posterior).
 *
 * Requirements: 10.6
 */

import type { LogicalMapGrid } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import type { TileReference } from './TileCatalog';
import { TileCatalog } from './TileCatalog';
import { SeededRandom } from './SeededRandom';
import { computeAllStructureMasks } from './StructureGenerator';

// ─── Configuración ───

export interface ObstacleGenerationConfig {
  /** Tolerancia de densidad. Default: 0.02 */
  densityTolerance: number;
  /** Mínimo spacing entre obstáculos en tiles. Default: 2 */
  minSpacing: number;
  /** Tamaño máximo de un cluster de obstáculos. Default: 2 */
  maxClusterSize: number;
}

export const DEFAULT_OBSTACLE_GENERATION_CONFIG: ObstacleGenerationConfig = {
  densityTolerance: 0.02,
  minSpacing: 2,
  maxClusterSize: 2,
};

// ─── Direcciones cardinales ───

const CARDINAL_OFFSETS: Array<[number, number]> = [
  [-1, 0], // north
  [0, 1],  // east
  [1, 0],  // south
  [0, -1], // west
];

// ─── Generador principal ───

/**
 * Genera obstáculos en celdas walkable fuera de la safe zone.
 *
 * @param grid Cuadrícula lógica con Ground, líquidos y muros ya generados.
 * @param config MapGenerationConfig con obstacleDensity.
 * @param rng SeededRandom para determinismo.
 * @param catalog TileCatalog para obtener tiles de obstáculos.
 * @param obstacleConfig Configuración de generación de obstáculos (opcional).
 */
export function generateObstacles(
  grid: LogicalMapGrid,
  config: MapGenerationConfig,
  rng: SeededRandom,
  catalog: TileCatalog,
  obstacleConfig: ObstacleGenerationConfig = DEFAULT_OBSTACLE_GENERATION_CONFIG,
): void {
  const height = grid.length;
  const width = grid[0].length;
  const totalCells = width * height;
  const targetObstacleCells = Math.floor(totalCells * config.obstacleDensity);

  if (targetObstacleCells === 0) return;

  // Get obstacle tiles (frames 27-34 from walls tileset)
  const obstacleTiles = catalog.getByCategory('obstacles');
  if (obstacleTiles.length === 0) return;

  let placedCells = 0;
  let attempts = 0;
  const maxAttempts = targetObstacleCells * 5; // prevent infinite loops

  while (placedCells < targetObstacleCells && attempts < maxAttempts) {
    attempts++;

    // Pick a random position
    const row = rng.integer(0, height - 1);
    const col = rng.integer(0, width - 1);

    // Validate placement
    if (!canPlaceObstacle(grid, row, col, height, width, obstacleConfig.minSpacing)) {
      continue;
    }

    // Check if placing would exceed target by too much
    if (placedCells >= targetObstacleCells + Math.floor(totalCells * obstacleConfig.densityTolerance)) {
      break;
    }

    // Decide cluster size (1 or up to maxClusterSize)
    const clusterSize = rng.integer(1, obstacleConfig.maxClusterSize);

    // Place the anchor obstacle
    const obstacleTile = rng.pick(obstacleTiles);
    placeObstacleAt(grid, row, col, obstacleTile);
    placedCells++;

    // Try to extend cluster with adjacent cells
    if (clusterSize > 1 && placedCells < targetObstacleCells) {
      const extensions = getValidExtensions(grid, row, col, height, width, obstacleConfig.minSpacing);
      if (extensions.length > 0) {
        const ext = rng.pick(extensions);
        const extTile = rng.pick(obstacleTiles);
        placeObstacleAt(grid, ext[0], ext[1], extTile);
        placedCells++;
      }
    }
  }

  // Recompute structure masks to include obstacles
  computeAllStructureMasks(grid);
}

/**
 * Checks if an obstacle can be placed at (row, col) with minimum spacing.
 */
function canPlaceObstacle(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  height: number,
  width: number,
  minSpacing: number,
): boolean {
  if (row < 0 || row >= height || col < 0 || col >= width) return false;
  const cell = grid[row][col];
  if (cell.inSafeZone) return false;
  if (!cell.walkable) return false;
  if (cell.liquid !== null) return false;
  if (cell.wall !== null) return false;
  if (cell.obstacle !== null) return false;

  // Check minimum spacing from other obstacles
  for (let dr = -minSpacing; dr <= minSpacing; dr++) {
    for (let dc = -minSpacing; dc <= minSpacing; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
        if (grid[nr][nc].obstacle !== null) return false;
      }
    }
  }

  return true;
}

/**
 * Gets valid cardinal extension positions for a cluster.
 */
function getValidExtensions(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  height: number,
  width: number,
  _minSpacing: number,
): Array<[number, number]> {
  const extensions: Array<[number, number]> = [];

  for (const [dr, dc] of CARDINAL_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (canPlaceObstacleForCluster(grid, nr, nc, height, width)) {
      extensions.push([nr, nc]);
    }
  }

  return extensions;
}

/**
 * Checks if a cell can receive a cluster extension obstacle.
 * Relaxed spacing check — only checks non-cluster obstacles.
 */
function canPlaceObstacleForCluster(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  height: number,
  width: number,
): boolean {
  if (row < 0 || row >= height || col < 0 || col >= width) return false;
  const cell = grid[row][col];
  if (cell.inSafeZone) return false;
  if (!cell.walkable) return false;
  if (cell.liquid !== null) return false;
  if (cell.wall !== null) return false;
  if (cell.obstacle !== null) return false;
  return true;
}

/**
 * Places an obstacle at the given position.
 */
function placeObstacleAt(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  tile: TileReference,
): void {
  const cell = grid[row][col];
  cell.obstacle = tile;
  cell.walkable = false;
  // Ground preserved — not removed
}

/**
 * Clears all obstacles from safe zone cells (defensive pass).
 * After clearing, recalculates walkable considering blocking liquids and walls.
 */
export function clearObstaclesFromSafeZone(grid: LogicalMapGrid): void {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      if (cell.inSafeZone && cell.obstacle !== null) {
        cell.obstacle = null;
        // Restore walkable only if no other blocker exists
        const hasBlockingLiquid = cell.liquidConfig?.behavior === 'blocking';
        const hasWall = cell.wall !== null;
        cell.walkable = !hasBlockingLiquid && !hasWall;
      }
    }
  }
  // Recompute masks after clearing
  computeAllStructureMasks(grid);
}
