/**
 * SafeZoneCleaner: Limpieza unificada de la zona segura.
 *
 * Para cada celda donde inSafeZone === true:
 * - wall = null
 * - obstacle = null
 * - liquid = null, liquidConfig = null (ALL liquids removed — no swimming mechanic)
 * - decoration = null
 * - walkable = true
 * - structureMask = null
 * - Preserva cell.ground (nunca se anula)
 *
 * Después de limpiar todas las celdas de la zona segura:
 * - Recomputa border masks (por si se removieron líquidos)
 * - Recomputa structure masks (por si se removieron muros/obstáculos)
 *
 * Requirements: 10.8, 10.11
 */

import type { LogicalMapGrid } from './MapCell';
import { recomputeBorderMasks } from './BorderTopology';
import { computeAllStructureMasks } from './StructureGenerator';

/**
 * Limpia la zona segura removiendo muros, obstáculos, líquidos bloqueantes
 * y decoraciones. Garantiza walkable=true para todas las celdas de la safe zone.
 *
 * @param grid Cuadrícula lógica completa ya generada.
 */
export function clearSafeZone(grid: LogicalMapGrid): void {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      if (!cell.inSafeZone) continue;

      // Remove walls
      cell.wall = null;

      // Remove obstacles
      cell.obstacle = null;

      // Remove ALL liquids — all liquid types block movement
      if (cell.liquid !== null) {
        cell.liquid = null;
        cell.liquidConfig = null;
      }

      // Remove decorations
      cell.decoration = null;

      // Ensure walkable
      cell.walkable = true;

      // Clear structure mask (no wall/obstacle remains)
      cell.structureMask = null;
    }
  }

  // Recompute border masks (liquid layout may have changed)
  recomputeBorderMasks(grid);

  // Recompute structure masks globally (neighbors of cleared cells need updating)
  computeAllStructureMasks(grid);
}
