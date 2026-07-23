/**
 * MapCell: Representación lógica de una celda individual del mapa.
 *
 * Cada celda almacena su estado de walkability y referencias a los tiles
 * asignados por cada capa. La grid lógica se usa para generación y validación
 * ANTES de construir las capas de Phaser.
 *
 * Requirements: 10.1, Property 27
 */

import type { TileReference } from './TileCatalog';

/** Comportamiento de un líquido en la celda. */
export type LiquidBehavior = 'walkable' | 'blocking' | 'damaging';

/** Configuración de líquido para una celda. */
export interface LiquidConfig {
  type: string;
  behavior: LiquidBehavior;
  damagePerSecond?: number;
}

/**
 * Representación lógica de una celda del mapa.
 * Diferencia al mínimo: walkable, liquid, blocking, decoration, safeZone.
 */
export interface MapCell {
  /** true si jugador/enemigos pueden atravesar esta celda. */
  walkable: boolean;
  /** Tile de suelo. Nunca null en celdas walkable tras generación de Ground. */
  ground: TileReference | null;
  /** Tile de líquido (si aplica). */
  liquid: TileReference | null;
  /** Configuración del líquido en esta celda. */
  liquidConfig: LiquidConfig | null;
  /** Tile de muro. Implica walkable=false. */
  wall: TileReference | null;
  /** Tile de obstáculo. Implica walkable=false. */
  obstacle: TileReference | null;
  /** Tile decorativo. No afecta walkable. */
  decoration: TileReference | null;
  /** Tile de transición visual entre capas. */
  border: TileReference | null;
  /**
   * Topología lógica de bordes — máscara binaria de vecinos líquidos cardinales.
   * north=1, east=2, south=4, west=8. Rango [0, 15].
   * null si la celda no requiere border.
   */
  borderMask: number | null;
  /**
   * Structure topology info — cardinal neighbor mask for wall/cliff cells.
   * north=1, east=2, south=4, west=8. Rango [0, 15].
   * null si la celda no tiene wall/cliff/obstacle.
   */
  structureMask: number | null;
  /** true si está dentro del radio seguro del punto de spawn. */
  inSafeZone: boolean;
}

/** Grid lógica completa del mapa: array 2D [rows][cols]. */
export type LogicalMapGrid = MapCell[][];

/**
 * Crea una celda vacía con valores por defecto.
 * walkable=true, todas las referencias null, inSafeZone=false.
 */
export function createEmptyCell(): MapCell {
  return {
    walkable: true,
    ground: null,
    liquid: null,
    liquidConfig: null,
    wall: null,
    obstacle: null,
    decoration: null,
    border: null,
    borderMask: null,
    structureMask: null,
    inSafeZone: false,
  };
}

/**
 * Crea una grid lógica vacía de width × height celdas.
 * Todas las celdas comienzan como walkable=true con referencias null.
 *
 * @param width Número de columnas (tiles horizontales)
 * @param height Número de filas (tiles verticales)
 * @returns Grid 2D indexada como grid[row][col]
 * @throws Error si width o height no son enteros positivos
 */
export function createEmptyGrid(width: number, height: number): LogicalMapGrid {
  if (width < 1 || !Number.isInteger(width)) {
    throw new Error(`createEmptyGrid: width must be a positive integer, got ${width}`);
  }
  if (height < 1 || !Number.isInteger(height)) {
    throw new Error(`createEmptyGrid: height must be a positive integer, got ${height}`);
  }

  const grid: LogicalMapGrid = [];
  for (let row = 0; row < height; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < width; col++) {
      rowCells.push(createEmptyCell());
    }
    grid.push(rowCells);
  }
  return grid;
}
