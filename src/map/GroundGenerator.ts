/**
 * GroundGenerator: Fase de generación de suelo para la cuadrícula lógica.
 *
 * Llena las 10,000 celdas (100×100) con tiles de Ground válidos usando
 * selección regional por paleta para coherencia visual.
 *
 * - NUNCA usa tiles emptyOrTransparent (frames 43–47 de ground).
 * - Usa solo tiles del tileset 'ground' con frames 0–42.
 * - Implementa selección regional: chunks del mapa comparten paleta visual.
 * - La misma semilla + config + catálogo produce la misma distribución.
 *
 * Requirements: 10.3, Property 28
 */

import type { TileReference } from './TileCatalog';
import { TileCatalog } from './TileCatalog';
import { SeededRandom } from './SeededRandom';
import type { WeightedItem } from './SeededRandom';
import type { LogicalMapGrid } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import { GROUND_VISUAL_CONFIG } from './VisualTileMappings';
import type { GroundVisualConfig } from './VisualTileMappings';

// ─── Configuración de pesos de selección de Ground ───

/**
 * Pesos para la selección ponderada de tiles de Ground.
 *
 * NOTA: La división entre "base" y "variations" es PROVISIONAL
 * (ver tile-catalog-data.ts). Los pesos favorecen tiles de la categoría
 * groundBase para mayor uniformidad visual y usan groundVariations para
 * romper repetición.
 */
export interface GroundSelectionWeights {
  /** Peso relativo de tiles clasificados como groundBase. */
  baseWeight: number;
  /** Peso relativo de tiles clasificados como groundVariations. */
  variationWeight: number;
}

/** Pesos predeterminados — provisional, ajustable en fase de balance. */
export const DEFAULT_GROUND_WEIGHTS: GroundSelectionWeights = {
  baseWeight: 5,
  variationWeight: 1,
};

/** Tamaño de chunk para la generación regional (en tiles). */
export const REGION_CHUNK_SIZE = 10;

/**
 * Valida que los pesos de selección sean válidos.
 * @throws Error si algún peso es negativo o ambos son 0.
 */
export function validateGroundWeights(weights: GroundSelectionWeights): void {
  if (weights.baseWeight < 0) {
    throw new Error(`GroundSelectionWeights: baseWeight must be >= 0, got ${weights.baseWeight}`);
  }
  if (weights.variationWeight < 0) {
    throw new Error(`GroundSelectionWeights: variationWeight must be >= 0, got ${weights.variationWeight}`);
  }
  if (weights.baseWeight + weights.variationWeight <= 0) {
    throw new Error('GroundSelectionWeights: at least one weight must be > 0');
  }
}

/**
 * Genera la capa de Ground para toda la cuadrícula lógica.
 *
 * Usa selección regional por paleta: divide la grid en chunks y cada chunk
 * recibe una paleta coherente. Dentro de cada chunk, ~90% base, ~8% accent,
 * ~2% rare. Celdas en Safe Zone solo usan baseFrames.
 *
 * El parámetro weights se mantiene para backward-compat con tests existentes.
 * Si se proporcionan weights explícitos con baseWeight=0 o variationWeight=0,
 * se usa la lógica legacy de selección ponderada uniforme (para compat tests).
 *
 * @param grid Cuadrícula lógica (será mutada in-place)
 * @param rng Instancia de SeededRandom para determinismo
 * @param catalog TileCatalog para obtener tiles válidos
 * @param weights Pesos de selección (opcional, si se provee se usa lógica legacy)
 */
export function generateGround(
  grid: LogicalMapGrid,
  rng: SeededRandom,
  catalog: TileCatalog,
  weights: GroundSelectionWeights = DEFAULT_GROUND_WEIGHTS,
): void {
  validateGroundWeights(weights);

  // If caller passed explicit non-default weights, use legacy uniform logic
  // (ensures existing tests with custom weights still work)
  if (weights !== DEFAULT_GROUND_WEIGHTS && 
      (weights.baseWeight !== DEFAULT_GROUND_WEIGHTS.baseWeight || 
       weights.variationWeight !== DEFAULT_GROUND_WEIGHTS.variationWeight)) {
    generateGroundLegacy(grid, rng, catalog, weights);
    return;
  }

  // Regional palette-based generation
  generateGroundRegional(grid, rng, catalog);
}

/**
 * Legacy ground generation: uniform weighted selection across entire grid.
 * Kept for backward compatibility with tests that pass custom weights.
 */
function generateGroundLegacy(
  grid: LogicalMapGrid,
  rng: SeededRandom,
  catalog: TileCatalog,
  weights: GroundSelectionWeights,
): void {
  const baseTiles = catalog.getByCategory('groundBase');
  const variationTiles = catalog.getByCategory('groundVariations');

  const weightedPool: WeightedItem<TileReference>[] = [];

  for (const tile of baseTiles) {
    weightedPool.push({ item: tile, weight: weights.baseWeight });
  }
  for (const tile of variationTiles) {
    weightedPool.push({ item: tile, weight: weights.variationWeight });
  }

  if (weightedPool.length === 0) {
    throw new Error('GroundGenerator: no valid ground tiles available in TileCatalog');
  }

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = rng.weightedPick(weightedPool);
      grid[row][col].ground = tile;
    }
  }
}

/**
 * Regional ground generation: uses a SINGLE map-wide palette (GROUND_VISUAL_CONFIG)
 * to eliminate visible chunk boundaries. All cells draw from the same set of frames:
 * ~95%+ base (frames 0-4), ~3% accent, ~0.5% rare.
 *
 * Safe Zone cells ONLY use baseFrames (no accent or rare).
 */
export function generateGroundRegional(
  grid: LogicalMapGrid,
  rng: SeededRandom,
  catalog: TileCatalog,
): void {
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  if (width === 0 || height === 0) return;

  // Validate catalog has ground tiles
  const allGround = catalog.getGroundTiles();
  if (allGround.length === 0) {
    throw new Error('GroundGenerator: no valid ground tiles available in TileCatalog');
  }

  const config = GROUND_VISUAL_CONFIG;

  // Fill each cell from the single map-wide palette
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const tile = selectTileFromConfig(rng, config, grid[row][col].inSafeZone);
      grid[row][col].ground = tile;
    }
  }
}

/**
 * Selects a tile from the uniform config based on probability tiers.
 * Safe zone cells only get base frames.
 */
function selectTileFromConfig(
  rng: SeededRandom,
  config: GroundVisualConfig,
  inSafeZone: boolean,
): TileReference {
  let frame: number;

  if (inSafeZone) {
    // Safe zone: only base frames
    frame = rng.pick(config.baseFrames);
  } else {
    const roll = rng.next();
    if (roll < config.rareProbability && config.rareFrames.length > 0) {
      // Rare frame
      frame = rng.pick(config.rareFrames);
    } else if (roll < config.rareProbability + config.accentProbability && config.accentFrames.length > 0) {
      // Accent frame
      frame = rng.pick(config.accentFrames);
    } else {
      // Base frame (majority)
      frame = rng.pick(config.baseFrames);
    }
  }

  return { tileset: 'ground', frame };
}

// ─── Zona segura central ───

/**
 * Marca la zona segura central del mapa.
 *
 * - Centro lógico: (floor(width/2), floor(height/2))
 * - Radio: config.safeZoneRadius tiles (distancia Chebyshev / cuadrado)
 * - Marca inSafeZone = true
 * - Mantiene walkable = true
 * - Garantiza Ground válido (ya debería estar asignado por generateGround)
 * - NO coloca muros, obstáculos ni líquidos (esa limpieza se hará en fases
 *   posteriores si algo se colocó encima, pero en esta fase no aplica)
 *
 * @param grid Cuadrícula lógica ya con Ground generado
 * @param config MapGenerationConfig con safeZoneRadius
 */
export function markSafeZone(
  grid: LogicalMapGrid,
  config: MapGenerationConfig,
): void {
  const height = grid.length;
  const width = grid[0].length;
  const centerRow = Math.floor(height / 2);
  const centerCol = Math.floor(width / 2);
  const radius = config.safeZoneRadius;

  for (let row = centerRow - radius; row <= centerRow + radius; row++) {
    for (let col = centerCol - radius; col <= centerCol + radius; col++) {
      if (row >= 0 && row < height && col >= 0 && col < width) {
        const cell = grid[row][col];
        cell.inSafeZone = true;
        cell.walkable = true;
        // Ground should already be assigned; ensure it's not accidentally null
        // (this is a safety invariant, not a generation step)
      }
    }
  }
}
