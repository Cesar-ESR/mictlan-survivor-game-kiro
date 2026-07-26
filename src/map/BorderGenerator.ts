/**
 * BorderGenerator: Fase de generación de bordes (transiciones visuales).
 *
 * Analiza la vecindad de cada celda y asigna tiles de la capa 'borders'
 * en transiciones suelo↔líquido y suelo↔muro.
 *
 * Reglas:
 * - Los borders NO son sustituto del suelo base (se superponen en capa separada).
 * - Los borders NO aplican colisión (no alteran walkable).
 * - Solo se asignan a celdas que NO son líquido NI muro, pero que tienen
 *   al menos un vecino cardinal que SÍ es líquido o muro.
 * - La selección de frame es PROVISIONAL: se usa el valor de la máscara
 *   directamente como índice de frame (16 masks → 16 frames disponibles).
 * - Totalmente determinista (sin aleatoriedad; depende solo de la topología).
 *
 * Requirements: 10.5
 */

import type { LogicalMapGrid } from './MapCell';
import type { TileReference } from './TileCatalog';
import { TileCatalog } from './TileCatalog';
import { computeAllBorderMasks } from './BorderTopology';

// ─── Tipos ───

export interface BorderGenerationResult {
  /** Cantidad de celdas con border asignado. */
  borderCount: number;
}

// ─── Generador principal ───

/**
 * Genera la capa de borders (transiciones visuales) para la cuadrícula lógica.
 *
 * Debe ejecutarse DESPUÉS de que las fases de Ground, Liquids y Walls
 * hayan completado, ya que depende de la presencia de cell.liquid y cell.wall
 * para computar la topología de bordes.
 *
 * Algoritmo:
 * 1. Recomputa borderMask para toda la grid (detecta vecinos líquidos y muros).
 * 2. Para cada celda con borderMask > 0, asigna un TileReference del tileset
 *    'borders' usando un mapeo PROVISIONAL mask→frame.
 * 3. No modifica walkable ni reemplaza ground.
 *
 * @param grid Cuadrícula lógica con Ground, Liquids y Walls ya generados.
 * @param catalog TileCatalog para obtener tiles de borders.
 * @returns Resultado con el conteo de celdas border asignadas.
 */
export function generateBorders(
  grid: LogicalMapGrid,
  catalog: TileCatalog,
): BorderGenerationResult {
  // Obtener tiles de borders del catálogo
  const borderTiles = catalog.getByCategory('borders');
  if (borderTiles.length === 0) {
    return { borderCount: 0 };
  }

  // Paso 1: Computar/recomputar las máscaras de topología para toda la grid.
  // Esto actualiza cell.borderMask para cada celda considerando tanto
  // vecinos líquidos como vecinos muro.
  computeAllBorderMasks(grid);

  // Paso 2: Asignar tiles de border según la máscara.
  let borderCount = 0;
  const height = grid.length;
  const width = grid[0].length;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row][col];

      if (cell.borderMask === null || cell.borderMask === 0) {
        // No border needed
        cell.border = null;
        continue;
      }

      // Mapeo PROVISIONAL: mask directamente como frame index.
      // borderMask rango [1, 15] → frame [1, 15] (frame 0 para mask 0 no se usa aquí).
      // Dado que hay 16 frames (0-15), el mask se usa como índice directo.
      const frameIndex = maskToFrameProvisional(cell.borderMask, borderTiles.length);
      const tileRef: TileReference = { tileset: 'borders', frame: frameIndex };

      cell.border = tileRef;
      borderCount++;

      // IMPORTANT: No modificar walkable — borders no aplican colisión.
      // IMPORTANT: No modificar ground — borders se superponen en capa separada.
    }
  }

  return { borderCount };
}

/**
 * Mapeo PROVISIONAL de máscara binaria a índice de frame.
 *
 * Usa el valor de la máscara directamente como índice de frame.
 * Esto funciona porque hay exactamente 16 frames (0-15) y 16 posibles
 * valores de máscara (0-15).
 *
 * Este mapeo es una aproximación y debe refinarse visualmente
 * para verificar que cada frame del tileset corresponda semánticamente
 * a la transición representada por la máscara.
 *
 * @param mask Máscara binaria cardinal [1, 15]
 * @param totalFrames Cantidad total de frames disponibles en el tileset borders
 * @returns Índice de frame a usar [0, totalFrames-1]
 */
function maskToFrameProvisional(mask: number, totalFrames: number): number {
  // Clamp to valid range [0, totalFrames-1]
  // mask is in [1, 15] since we skip mask=0 cells
  if (mask >= totalFrames) {
    return totalFrames - 1;
  }
  return mask;
}
