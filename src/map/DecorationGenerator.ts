/**
 * DecorationGenerator: Coloca decoraciones sobre celdas walkable libres.
 *
 * Algoritmo:
 * 1. Calcula número objetivo de celdas con decoración según decorationDensity.
 * 2. Mezcla colocaciones individuales + clusters pequeños (expansión cardinal).
 * 3. Solo coloca donde: walkable=true, liquid===null, wall===null, obstacle===null,
 *    decoration===null, inSafeZone===false.
 * 4. NUNCA modifica: walkable, wall, obstacle, liquid, liquidConfig, structureMask, borderMask.
 * 5. Solo escribe: cell.decoration = TileReference.
 * 6. Usa frames 0–51 del tileset 'decorations' (NUNCA 52–255).
 * 7. Totalmente determinista via SeededRandom.
 *
 * Requirements: 10.7, Property 30
 */

import type { LogicalMapGrid } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import type { TileReference } from './TileCatalog';
import { TileCatalog } from './TileCatalog';
import { SeededRandom } from './SeededRandom';

// ─── Configuración ───

export interface DecorationGenerationConfig {
  /** Tolerancia de densidad. Default: 0.02 */
  densityTolerance: number;
  /** Mínimo spacing entre decoraciones. Default: 1 */
  minSpacing: number;
  /** Probabilidad de iniciar un cluster en vez de colocación individual. Default: 0.3 */
  clusterProbability: number;
  /** Tamaño máximo de un cluster de decoraciones. Default: 3 */
  maxClusterSize: number;
}

export const DEFAULT_DECORATION_CONFIG: DecorationGenerationConfig = {
  densityTolerance: 0.01,
  minSpacing: 3,
  clusterProbability: 0.2,
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
 * Genera decoraciones en celdas walkable libres fuera de la safe zone.
 *
 * @param grid Cuadrícula lógica con Ground, líquidos, muros y obstáculos ya generados.
 * @param config MapGenerationConfig con decorationDensity.
 * @param rng SeededRandom para determinismo.
 * @param catalog TileCatalog para obtener tiles de decoración.
 * @param decoConfig Configuración de generación de decoraciones (opcional).
 */
export function generateDecorations(
  grid: LogicalMapGrid,
  config: MapGenerationConfig,
  rng: SeededRandom,
  catalog: TileCatalog,
  decoConfig: DecorationGenerationConfig = DEFAULT_DECORATION_CONFIG,
): void {
  const height = grid.length;
  const width = grid[0].length;
  const totalCells = width * height;
  const targetDecorationCells = Math.floor(totalCells * config.decorationDensity);

  if (targetDecorationCells === 0) return;

  // Get decoration tiles — frames 0–51 only from 'decorations' tileset
  const decorationTiles = catalog.getByCategory('decorations');
  if (decorationTiles.length === 0) return;

  let placedCells = 0;
  let attempts = 0;
  const maxAttempts = targetDecorationCells * 5; // prevent infinite loops
  const maxAllowed = targetDecorationCells + Math.floor(totalCells * decoConfig.densityTolerance);

  while (placedCells < targetDecorationCells && attempts < maxAttempts) {
    attempts++;

    // Pick a random position
    const row = rng.integer(0, height - 1);
    const col = rng.integer(0, width - 1);

    // Validate placement (includes spacing check)
    if (!canPlaceDecoration(grid, row, col, height, width, decoConfig.minSpacing)) {
      continue;
    }

    // Check if placing would exceed max allowed
    if (placedCells >= maxAllowed) {
      break;
    }

    // Pick a decoration tile
    const decoTile = rng.pick(decorationTiles);

    // Decide: individual placement or cluster
    if (rng.chance(decoConfig.clusterProbability)) {
      // Cluster placement
      placeDecorationAt(grid, row, col, decoTile);
      placedCells++;

      // Try to expand cluster with adjacent cells
      const clusterSize = rng.integer(2, decoConfig.maxClusterSize);

      for (let e = 1; e < clusterSize && placedCells < maxAllowed; e++) {
        const extensions = getValidDecorationExtensions(grid, row, col, height, width, decoConfig.minSpacing);
        if (extensions.length === 0) break;

        const ext = rng.pick(extensions);
        const extTile = rng.pick(decorationTiles);
        placeDecorationAt(grid, ext[0], ext[1], extTile);
        placedCells++;
      }
    } else {
      // Individual placement
      placeDecorationAt(grid, row, col, decoTile);
      placedCells++;
    }
  }
}

/**
 * Checks if a decoration can be placed at (row, col).
 * Requirements: walkable=true, no liquid, no wall, no obstacle, no existing decoration,
 * not in safe zone, and no other decoration within minSpacing distance.
 */
function canPlaceDecoration(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  height: number,
  width: number,
  minSpacing: number = 1,
): boolean {
  if (row < 0 || row >= height || col < 0 || col >= width) return false;
  const cell = grid[row][col];
  if (!cell.walkable) return false;
  if (cell.liquid !== null) return false;
  if (cell.wall !== null) return false;
  if (cell.obstacle !== null) return false;
  if (cell.decoration !== null) return false;
  if (cell.inSafeZone) return false;

  // Spacing check: no existing decoration within minSpacing Manhattan distance
  if (minSpacing > 1) {
    for (let dr = -minSpacing + 1; dr < minSpacing; dr++) {
      for (let dc = -minSpacing + 1; dc < minSpacing; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
          if (grid[nr][nc].decoration !== null) return false;
        }
      }
    }
  }

  return true;
}

/**
 * Gets valid cardinal extension positions for a decoration cluster.
 */
function getValidDecorationExtensions(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  height: number,
  width: number,
  minSpacing: number = 1,
): Array<[number, number]> {
  const extensions: Array<[number, number]> = [];

  for (const [dr, dc] of CARDINAL_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (canPlaceDecoration(grid, nr, nc, height, width, minSpacing)) {
      extensions.push([nr, nc]);
    }
  }

  return extensions;
}

/**
 * Places a decoration at the given position.
 * ONLY modifies cell.decoration — never touches walkable, wall, obstacle, etc.
 */
function placeDecorationAt(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  tile: TileReference,
): void {
  grid[row][col].decoration = tile;
}
