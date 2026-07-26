/**
 * BorderTopology: Calcula la topología lógica de bordes a partir de la máscara
 * de líquidos en la cuadrícula.
 *
 * Asigna una máscara binaria de vecinos líquidos cardinales a cada celda
 * que limita con una región líquida. Esta topología es independiente de la
 * selección visual de frames.
 *
 * Máscara binaria cardinal:
 *   north = 1 (bit 0)
 *   east  = 2 (bit 1)
 *   south = 4 (bit 2)
 *   west  = 8 (bit 3)
 *
 * Rango: [0, 15]
 *
 * El mapeo entre máscara y frame visual específico queda PROVISIONAL
 * hasta que la correspondencia sea verificada visualmente.
 *
 * Requirements: 10.5
 */

import type { LogicalMapGrid } from './MapCell';

// ─── Tipos de topología ───

/** Clasificación lógica de un borde según su máscara. */
export type BorderKind =
  | 'none'           // No es un borde (no tiene vecino líquido)
  | 'edge'           // Borde lineal (1 o 2 vecinos opuestos)
  | 'corner'         // Esquina exterior (2 vecinos adyacentes)
  | 'inner-corner'   // Esquina interior (3 vecinos)
  | 'surrounded'     // Rodeado por líquido (4 vecinos, máscara 15)
  | 'peninsula';     // Solo 1 vecino

export interface BorderTopologyInfo {
  /** Máscara binaria de vecinos líquidos cardinales [0, 15]. */
  mask: number;
  /** Clasificación lógica del borde. */
  kind: BorderKind;
}

// ─── Constantes ───

const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;

/** Offsets cardinales: [deltaRow, deltaCol, bitValue] */
const CARDINAL_BITS: Array<[number, number, number]> = [
  [-1, 0, NORTH],
  [0, 1, EAST],
  [1, 0, SOUTH],
  [0, -1, WEST],
];

// ─── Funciones principales ───

/**
 * Calcula la máscara de vecinos líquidos para una celda.
 * Solo considera vecinos que tienen cell.liquid !== null.
 *
 * @returns Máscara binaria [0, 15]
 */
export function computeNeighborLiquidMask(
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
      if (grid[nr][nc].liquid !== null) {
        mask |= bit;
      }
    }
  }

  return mask;
}

/**
 * Calcula la máscara de vecinos muros/acantilados para una celda.
 * Solo considera vecinos que tienen cell.wall !== null.
 *
 * @returns Máscara binaria [0, 15]
 */
export function computeNeighborWallMask(
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
      if (grid[nr][nc].wall !== null) {
        mask |= bit;
      }
    }
  }

  return mask;
}

/**
 * Calcula la máscara combinada de vecinos que generan transición visual.
 * Incluye tanto vecinos líquidos como vecinos muro/acantilado.
 * Un bit se activa si el vecino tiene liquid !== null O wall !== null.
 *
 * @returns Máscara binaria [0, 15]
 */
export function computeNeighborTransitionMask(
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
      if (neighbor.liquid !== null || neighbor.wall !== null) {
        mask |= bit;
      }
    }
  }

  return mask;
}

/**
 * Clasifica una máscara en un BorderKind.
 */
export function classifyBorderMask(mask: number): BorderKind {
  const bitCount = popcount4(mask);

  if (bitCount === 0) return 'none';
  if (bitCount === 1) return 'peninsula';
  if (bitCount === 4) return 'surrounded';
  if (bitCount === 3) return 'inner-corner';

  // bitCount === 2: check if opposing or adjacent
  if (bitCount === 2) {
    // Opposing pairs: N+S (1+4=5), E+W (2+8=10)
    if (mask === 5 || mask === 10) return 'edge';
    return 'corner';
  }

  return 'none';
}

/** Count bits in a 4-bit number. */
function popcount4(n: number): number {
  let count = 0;
  for (let i = 0; i < 4; i++) {
    if (n & (1 << i)) count++;
  }
  return count;
}

/**
 * Computes the full border topology info for a cell.
 */
export function computeBorderTopology(
  grid: LogicalMapGrid,
  row: number,
  col: number,
): BorderTopologyInfo {
  const mask = computeNeighborLiquidMask(grid, row, col);
  return { mask, kind: classifyBorderMask(mask) };
}

/**
 * Computes and assigns borderMask to all cells that border a liquid or wall region.
 *
 * A cell gets a borderMask if:
 * - It does NOT have a liquid itself (it's the "dry" side of the border)
 * - It does NOT have a wall itself (it's the "open" side of the border)
 * - It has at least one cardinal neighbor with liquid OR wall
 *
 * Cells that ARE liquid or wall get borderMask = null (they are not borders).
 *
 * @param grid Cuadrícula lógica ya con líquidos y muros generados.
 */
export function computeAllBorderMasks(grid: LogicalMapGrid): void {
  const height = grid.length;
  const width = grid[0].length;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row][col];

      if (cell.liquid !== null || cell.wall !== null) {
        // Liquid/wall cells are not borders themselves
        cell.borderMask = null;
        continue;
      }

      const mask = computeNeighborTransitionMask(grid, row, col);
      cell.borderMask = mask > 0 ? mask : null;
    }
  }
}

/**
 * Recomputes all border masks. Use after modifying the liquid layout
 * (e.g., after clearing safe zone liquids).
 */
export function recomputeBorderMasks(grid: LogicalMapGrid): void {
  // Reset all masks first
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      grid[row][col].borderMask = null;
    }
  }
  computeAllBorderMasks(grid);
}
