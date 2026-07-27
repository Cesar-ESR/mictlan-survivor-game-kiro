/**
 * StructureGenerator: Genera muros y acantilados coherentes usando templates.
 *
 * Algoritmo:
 * 1. Define templates de estructuras (líneas H/V, L-shapes, T-shapes, bloques).
 * 2. Calcula número objetivo de celdas de muro según wallDensity.
 * 3. Selecciona templates aleatorios, los rota opcionalmente, y los coloca.
 * 4. Excluye: safe zone, líquidos, muros existentes.
 * 5. Marca walkable=false en celdas de muro.
 * 6. Asigna TileReference placeholder del tileset walls (frames 0-34 solamente).
 * 7. Calcula structureMask cardinal para cada celda de muro.
 *
 * NO usa placement puramente aleatorio sin estructura.
 * Totalmente determinista via SeededRandom.
 *
 * Requirements: 10.6, Property 30
 */

import type { LogicalMapGrid } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import { TileCatalog } from './TileCatalog';
import { SeededRandom } from './SeededRandom';

// ─── Templates de estructuras ───

/** Template de estructura: forma predefinida de muro/acantilado. */
export interface StructureTemplate {
  name: string;
  /** Offsets relativos [row, col] desde la celda ancla (0,0). */
  cells: Array<[number, number]>;
}

/** Templates predeterminados para generación de muros. */
export const DEFAULT_STRUCTURE_TEMPLATES: StructureTemplate[] = [
  // Líneas horizontales
  { name: 'h-line-3', cells: [[0, 0], [0, 1], [0, 2]] },
  { name: 'h-line-4', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { name: 'h-line-5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  // Líneas verticales
  { name: 'v-line-3', cells: [[0, 0], [1, 0], [2, 0]] },
  { name: 'v-line-4', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: 'v-line-5', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  // L-shapes
  { name: 'L-shape', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { name: 'L-shape-inv', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  // T-shapes
  { name: 'T-shape', cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]] },
  { name: 'T-shape-inv', cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
  // Bloques
  { name: 'block-2x2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: 'block-2x3', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
];

// ─── Configuración ───

export interface WallGenerationConfig {
  /** Tolerancia de densidad: celdas reales pueden diferir ±tolerance * totalCells. Default: 0.03 */
  densityTolerance: number;
  /** Templates de estructuras a usar. */
  templates: StructureTemplate[];
}

export const DEFAULT_WALL_GENERATION_CONFIG: WallGenerationConfig = {
  densityTolerance: 0.03,
  templates: DEFAULT_STRUCTURE_TEMPLATES,
};

// ─── Constantes cardinales ───

const CARDINAL_BITS: Array<[number, number, number]> = [
  [-1, 0, 1],  // north
  [0, 1, 2],   // east
  [1, 0, 4],   // south
  [0, -1, 8],  // west
];

// ─── Generador principal ───

/**
 * Genera muros y acantilados usando templates predefinidos.
 *
 * @param grid Cuadrícula lógica con Ground y líquidos ya generados.
 * @param config MapGenerationConfig con wallDensity.
 * @param rng SeededRandom para determinismo.
 * @param catalog TileCatalog para obtener tiles de muros.
 * @param wallConfig Configuración de generación de muros (opcional).
 */
export function generateWallsAndCliffs(
  grid: LogicalMapGrid,
  config: MapGenerationConfig,
  rng: SeededRandom,
  catalog: TileCatalog,
  wallConfig: WallGenerationConfig = DEFAULT_WALL_GENERATION_CONFIG,
): void {
  const height = grid.length;
  const width = grid[0].length;
  const totalCells = width * height;
  const targetWallCells = Math.floor(totalCells * config.wallDensity);

  if (targetWallCells === 0) return;

  // Get valid wall tiles (frames 0-34 only, from categories wallTops, wallSides, wallCorners, cliffs)
  const wallTiles = [
    ...catalog.getByCategory('wallTops'),
    ...catalog.getByCategory('wallSides'),
    ...catalog.getByCategory('wallCorners'),
    ...catalog.getByCategory('cliffs'),
  ];
  if (wallTiles.length === 0) return;

  const templates = wallConfig.templates;
  if (templates.length === 0) return;

  let placedCells = 0;
  let attempts = 0;
  const maxAttempts = targetWallCells * 4; // prevent infinite loops

  while (placedCells < targetWallCells && attempts < maxAttempts) {
    attempts++;

    // Pick a random template
    const template = rng.pick(templates);

    // Pick an anchor position
    const anchorRow = rng.integer(0, height - 1);
    const anchorCol = rng.integer(0, width - 1);

    // Compute absolute positions for this template
    const absoluteCells = template.cells.map(([dr, dc]) => [anchorRow + dr, anchorCol + dc] as [number, number]);

    // Validate ALL cells of the template can be placed
    const canPlace = absoluteCells.every(([r, c]) => canPlaceWall(grid, r, c, height, width));
    if (!canPlace) continue;

    // Check if placing would exceed target by too much
    if (placedCells + absoluteCells.length > targetWallCells + Math.floor(totalCells * wallConfig.densityTolerance)) {
      // Try a smaller template or skip
      continue;
    }

    // Pick a placeholder tile for this structure
    const wallTile = rng.pick(wallTiles);

    // Place all cells of the template
    for (const [r, c] of absoluteCells) {
      const cell = grid[r][c];
      cell.wall = wallTile;
      cell.walkable = false;
      // Ground preserved — not removed
    }

    placedCells += absoluteCells.length;
  }

  // Compute structure masks for all wall cells
  computeAllStructureMasks(grid);
}

/**
 * Checks if a wall can be placed at (row, col).
 * Excludes: out of bounds, safe zone, liquids, existing walls.
 */
function canPlaceWall(
  grid: LogicalMapGrid,
  row: number,
  col: number,
  height: number,
  width: number,
): boolean {
  if (row < 0 || row >= height || col < 0 || col >= width) return false;
  const cell = grid[row][col];
  if (cell.inSafeZone) return false;
  if (cell.liquid !== null) return false;
  if (cell.wall !== null) return false;
  return true;
}

// ─── Structure Masks ───

/**
 * Computes the cardinal neighbor mask for a wall/obstacle cell.
 * Checks if north/east/south/west neighbors also have a wall or obstacle.
 * north=1, east=2, south=4, west=8. Range [0, 15].
 */
export function computeStructureMask(
  grid: LogicalMapGrid,
  row: number,
  col: number,
): number {
  const height = grid.length;
  const width = grid[0].length;
  let mask = 0;

  for (const [dr, dc, bit] of CARDINAL_BITS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
      const neighbor = grid[nr][nc];
      if (neighbor.wall !== null || neighbor.obstacle !== null) {
        mask |= bit;
      }
    }
  }

  return mask;
}

/**
 * Computes and assigns structureMask to all wall and obstacle cells.
 * Cells without wall/obstacle get structureMask = null.
 */
export function computeAllStructureMasks(grid: LogicalMapGrid): void {
  const height = grid.length;
  const width = grid[0].length;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row][col];
      if (cell.wall !== null || cell.obstacle !== null) {
        cell.structureMask = computeStructureMask(grid, row, col);
      } else {
        cell.structureMask = null;
      }
    }
  }
}

/**
 * Clears all wall/cliff structures from safe zone cells (defensive pass).
 * After clearing, recalculates walkable considering blocking liquids.
 */
export function clearStructuresFromSafeZone(grid: LogicalMapGrid): void {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      if (cell.inSafeZone && cell.wall !== null) {
        cell.wall = null;
        // Restore walkable only if no other blocker exists
        const hasBlockingLiquid = cell.liquidConfig?.behavior === 'blocking';
        const hasObstacle = cell.obstacle !== null;
        cell.walkable = !hasBlockingLiquid && !hasObstacle;
      }
    }
  }
  // Recompute masks after clearing
  computeAllStructureMasks(grid);
}
