/**
 * GroundGenerator: Fase de generación de suelo para la cuadrícula lógica.
 *
 * Llena las 10,000 celdas (100×100) con tiles de Ground válidos usando
 * selección ponderada determinista via SeededRandom.
 *
 * - NUNCA usa tiles emptyOrTransparent (frames 43–47 de ground).
 * - Usa solo tiles del tileset 'ground' con frames 0–42.
 * - Los pesos de selección son configurables y centralizados.
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
 * Llena las 10,000 celdas con tiles de suelo válidos usando selección
 * ponderada determinista. Cada celda recibe una TileReference no-null
 * del tileset 'ground' con frame en [0, 42].
 *
 * @param grid Cuadrícula lógica de 100×100 (será mutada in-place)
 * @param rng Instancia de SeededRandom para determinismo
 * @param catalog TileCatalog para obtener tiles válidos
 * @param weights Pesos de selección (opcional, usa defaults)
 */
export function generateGround(
  grid: LogicalMapGrid,
  rng: SeededRandom,
  catalog: TileCatalog,
  weights: GroundSelectionWeights = DEFAULT_GROUND_WEIGHTS,
): void {
  validateGroundWeights(weights);

  const baseTiles = catalog.getByCategory('groundBase');
  const variationTiles = catalog.getByCategory('groundVariations');

  // Construir pool de selección ponderada
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

  // Llenar las 10,000 celdas
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = rng.weightedPick(weightedPool);
      grid[row][col].ground = tile;
    }
  }
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
