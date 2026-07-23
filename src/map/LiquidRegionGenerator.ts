/**
 * LiquidRegionGenerator: Genera regiones contiguas de líquido en la cuadrícula lógica.
 *
 * Algoritmo: seed-and-grow (BFS limitado)
 * 1. Calcula número objetivo de celdas líquidas según liquidDensity.
 * 2. Selecciona puntos semilla aleatorios fuera de la zona segura.
 * 3. Desde cada semilla, expande con BFS limitado hasta alcanzar un tamaño.
 * 4. Cada región es contigua (4-connected cardinal).
 * 5. No invade celdas inSafeZone.
 * 6. Asigna LiquidConfig tipado a cada celda.
 * 7. Actualiza walkable según behavior.
 * 8. No elimina Ground subyacente.
 *
 * Requirements: 10.4, Property 36
 */

import type { LogicalMapGrid, LiquidConfig, LiquidBehavior } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import { SeededRandom } from './SeededRandom';
import { TileCatalog } from './TileCatalog';

// ─── Configuración de líquidos ───

export interface LiquidGenerationConfig {
  /** Tamaño mínimo de una región individual en celdas. Default: 4 */
  minRegionSize: number;
  /** Tamaño máximo de una región individual en celdas. Default: 60 */
  maxRegionSize: number;
  /** Comportamientos disponibles con sus pesos relativos. */
  behaviorWeights: Array<{ behavior: LiquidBehavior; weight: number }>;
  /** Tipo de líquido (visual/thematic). */
  liquidType: string;
  /**
   * Tolerancia para la densidad objetivo. La cantidad de celdas líquidas
   * puede diferir del objetivo en ±tolerance * totalCells.
   * Default: 0.02 (2%)
   */
  densityTolerance: number;
}

export const DEFAULT_LIQUID_CONFIG: LiquidGenerationConfig = {
  minRegionSize: 4,
  maxRegionSize: 60,
  behaviorWeights: [
    { behavior: 'walkable', weight: 7 },
    { behavior: 'blocking', weight: 3 },
  ],
  liquidType: 'water',
  densityTolerance: 0.02,
};

// ─── Direcciones cardinales ───

const CARDINAL_OFFSETS: Array<[number, number]> = [
  [-1, 0], // north
  [0, 1],  // east
  [1, 0],  // south
  [0, -1], // west
];

// ─── Generador ───

/**
 * Genera regiones de líquido contiguas en la cuadrícula.
 *
 * @param grid Cuadrícula lógica ya con Ground generado y safe zone marcada.
 * @param config MapGenerationConfig con liquidDensity.
 * @param rng SeededRandom para determinismo.
 * @param catalog TileCatalog para obtener tiles de líquido.
 * @param liquidConfig Configuración de generación de líquidos (opcional).
 */
export function generateLiquidRegions(
  grid: LogicalMapGrid,
  config: MapGenerationConfig,
  rng: SeededRandom,
  catalog: TileCatalog,
  liquidConfig: LiquidGenerationConfig = DEFAULT_LIQUID_CONFIG,
): void {
  const height = grid.length;
  const width = grid[0].length;
  const totalCells = width * height;
  const targetLiquidCells = Math.floor(totalCells * config.liquidDensity);

  if (targetLiquidCells === 0) return;

  const liquidTiles = [
    ...catalog.getByCategory('liquidCenters'),
    ...catalog.getByCategory('liquidEdges'),
  ];
  if (liquidTiles.length === 0) return;

  let placedCells = 0;
  let attempts = 0;
  const maxAttempts = targetLiquidCells * 3; // prevent infinite loops

  while (placedCells < targetLiquidCells && attempts < maxAttempts) {
    attempts++;

    // Pick a region size
    const remaining = targetLiquidCells - placedCells;
    const maxForThisRegion = Math.min(liquidConfig.maxRegionSize, remaining);
    if (maxForThisRegion < liquidConfig.minRegionSize) {
      // Not enough room left for a valid region
      break;
    }
    const regionSize = rng.integer(liquidConfig.minRegionSize, maxForThisRegion);

    // Pick a seed point
    const seedRow = rng.integer(0, height - 1);
    const seedCol = rng.integer(0, width - 1);

    // Validate seed: not in safe zone, walkable, no existing liquid
    if (
      grid[seedRow][seedCol].inSafeZone ||
      !grid[seedRow][seedCol].walkable ||
      grid[seedRow][seedCol].liquid !== null
    ) {
      continue;
    }

    // Pick behavior for this region
    const behavior = pickBehavior(rng, liquidConfig.behaviorWeights);
    const regionLiquidConfig: LiquidConfig = {
      type: liquidConfig.liquidType,
      behavior,
    };

    // Grow region via BFS
    const regionCells = growRegion(
      grid,
      seedRow,
      seedCol,
      regionSize,
      rng,
    );

    // Only place if meets minimum size
    if (regionCells.length < liquidConfig.minRegionSize) {
      continue;
    }

    // Pick a representative liquid tile for this region
    const liquidTile = rng.pick(liquidTiles);

    // Apply liquid to all cells in the region
    for (const [row, col] of regionCells) {
      const cell = grid[row][col];
      cell.liquid = liquidTile;
      cell.liquidConfig = regionLiquidConfig;
      if (behavior === 'blocking') {
        cell.walkable = false;
      }
      // Ground is preserved — not removed
    }

    placedCells += regionCells.length;
  }
}

/**
 * Grows a contiguous region from a seed using randomized BFS.
 * Only expands into cells that are: walkable, not in safe zone, no existing liquid.
 */
function growRegion(
  grid: LogicalMapGrid,
  startRow: number,
  startCol: number,
  maxSize: number,
  rng: SeededRandom,
): Array<[number, number]> {
  const height = grid.length;
  const width = grid[0].length;
  const region: Array<[number, number]> = [];
  const visited = new Set<string>();
  const frontier: Array<[number, number]> = [[startRow, startCol]];
  visited.add(`${startRow},${startCol}`);

  while (frontier.length > 0 && region.length < maxSize) {
    // Pick a random cell from the frontier (not always first — gives organic shapes)
    const idx = rng.integer(0, frontier.length - 1);
    const [row, col] = frontier[idx];
    frontier[idx] = frontier[frontier.length - 1];
    frontier.pop();

    // Validate the cell
    const cell = grid[row][col];
    if (cell.inSafeZone || !cell.walkable || cell.liquid !== null) {
      continue;
    }

    region.push([row, col]);

    // Add cardinal neighbors to frontier
    for (const [dr, dc] of CARDINAL_OFFSETS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          frontier.push([nr, nc]);
        }
      }
    }
  }

  return region;
}

/**
 * Picks a LiquidBehavior using weighted selection.
 */
function pickBehavior(
  rng: SeededRandom,
  weights: Array<{ behavior: LiquidBehavior; weight: number }>,
): LiquidBehavior {
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  let roll = rng.next() * totalWeight;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.behavior;
  }
  return weights[weights.length - 1].behavior;
}

/**
 * Cleans liquid from safe zone cells (defensive pass).
 * Call after liquid generation to ensure no liquids leaked into safe zone.
 */
export function clearLiquidsFromSafeZone(grid: LogicalMapGrid): void {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      if (cell.inSafeZone && cell.liquid !== null) {
        cell.liquid = null;
        cell.liquidConfig = null;
        cell.walkable = true; // restore if it was blocked
      }
    }
  }
}
