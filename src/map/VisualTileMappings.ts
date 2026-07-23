/**
 * VisualTileMappings: Mapeos provisionales de máscara → frame para
 * bordes y estructuras (walls/cliffs).
 *
 * PROVISIONAL: Estos mapeos deben validarse visualmente en el navegador.
 * Se usa frame 0 como fallback para cualquier máscara no mapeada.
 *
 * Convención de máscaras cardinales:
 *   north=1, east=2, south=4, west=8
 *   Rango: 0–15
 *
 * Requirements: 10.2, Property 30
 */

// ─── Border Frame Mapping ───

/**
 * Mapeo de borderMask → frame index en tileset_borders.
 * Borders tileset tiene 16 frames (0–15), uno por cada combinación cardinal.
 *
 * PROVISIONAL: Asumimos que el frame index coincide directamente con la máscara.
 * Esto es una convención habitual en tilesets de bordes auto-tile 4-bit.
 */
export interface BorderFrameMapping {
  readonly [mask: number]: number;
}

export const BORDER_FRAME_MAPPING: BorderFrameMapping = {
  0: 0,   // sin vecinos líquidos (fallback)
  1: 1,   // north
  2: 2,   // east
  3: 3,   // north + east
  4: 4,   // south
  5: 5,   // north + south
  6: 6,   // east + south
  7: 7,   // north + east + south
  8: 8,   // west
  9: 9,   // north + west
  10: 10, // east + west
  11: 11, // north + east + west
  12: 12, // south + west
  13: 13, // north + south + west
  14: 14, // east + south + west
  15: 15, // all four
};

// ─── Structure Frame Mapping ───

/**
 * Mapeo de structureMask → frame index en tileset_walls para muros y cliffs.
 *
 * PROVISIONAL: Distribución estimada de frames para muros:
 * - wallTops: 0–7, wallSides: 8–11, wallCorners: 12–15
 * - Se usa frame 0 como fallback para máscaras no mapeadas.
 *
 * La máscara indica vecinos del mismo tipo (wall o cliff):
 *   north=1, east=2, south=4, west=8
 */
export interface StructureFrameMapping {
  readonly wall: Partial<Record<number, number>>;
  readonly cliff: Partial<Record<number, number>>;
}

export const STRUCTURE_FRAME_MAPPING: StructureFrameMapping = {
  wall: {
    // TEMPORARILY all masks map to frame 0 until proper mask→frame calibration.
    // This ensures walls are visually uniform (single tile) during calibration phase.
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0,
    8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0,
  },
  cliff: { 0: 16 },
};

// ─── Ground Visual Config (Single uniform palette) ───

/**
 * Configuration for uniform ground generation across the entire map.
 * Replaces the chunk-based palette system to eliminate visible chunk boundaries.
 */
export interface GroundVisualConfig {
  baseFrames: readonly number[];      // visually neutral, seamless tiles
  accentFrames: readonly number[];    // subtle variations (may be empty until confirmed)
  rareFrames: readonly number[];      // eye-catching (very sparse, may be empty)
  accentProbability: number;          // 0.03
  rareProbability: number;            // 0.005
}

/**
 * Confirmed neutral frames from TileDebugScene inspection:
 * Frames 0-4 are the most visually neutral ground tiles.
 * Single map-wide palette — no chunk boundaries.
 */
export const GROUND_VISUAL_CONFIG: GroundVisualConfig = {
  baseFrames: [0, 1, 2, 3, 4],
  accentFrames: [5, 6, 7, 8],     // provisional — need visual confirmation
  rareFrames: [16, 17],            // provisional — ornamental accents
  accentProbability: 0.03,
  rareProbability: 0.005,
};

// ─── Ground Visual Palettes (Legacy — kept for backward compat with tests) ───

/**
 * Visual palette for region-based ground generation.
 * @deprecated Use GROUND_VISUAL_CONFIG instead. Kept for backward compat with visual-polish.test.ts.
 */
export interface GroundVisualPalette {
  id: string;
  baseFrames: readonly number[];    // 2-3 visually neutral frames
  accentFrames: readonly number[];  // subtle variations
  rareFrames: readonly number[];    // eye-catching elements (very sparse)
  accentProbability: number;        // 0.05-0.10
  rareProbability: number;          // 0.01-0.02
}

/**
 * Legacy palettes — kept exported for backward compat with visual-polish.test.ts.
 * The actual generation now uses GROUND_VISUAL_CONFIG (single palette, no chunks).
 * @deprecated
 */
export const GROUND_PALETTES: readonly GroundVisualPalette[] = [
  {
    id: 'uniform',
    baseFrames: [0, 1, 2, 3, 4],
    accentFrames: [5, 6, 7, 8],
    rareFrames: [16, 17],
    accentProbability: 0.03,
    rareProbability: 0.005,
  },
];

// ─── Liquid Families ───

export type LiquidFamily = 'water' | 'lava' | 'spectral';

export interface LiquidFamilyConfig {
  family: LiquidFamily;
  centerFrame: number;     // single confirmed seamless center frame
  weight: number;          // selection probability
}

/**
 * Liquid family configurations. Each liquid region picks one family
 * and uses that family's centerFrame for ALL cells in the region.
 * This ensures visual uniformity within each liquid body.
 */
export const LIQUID_FAMILIES: readonly LiquidFamilyConfig[] = [
  { family: 'water', centerFrame: 0, weight: 6 },
  { family: 'lava', centerFrame: 20, weight: 3 },
  { family: 'spectral', centerFrame: 32, weight: 1 },
];

/**
 * Resuelve el frame para un borde dado su máscara.
 * Usa frame 0 como fallback.
 */
export function resolveBorderFrame(mask: number): number {
  return BORDER_FRAME_MAPPING[mask] ?? 0;
}

/**
 * Resuelve el frame para una estructura (wall o cliff) dada su máscara.
 * Usa frame 0 (wall) o frame 16 (cliff) como fallback.
 */
export function resolveStructureFrame(kind: 'wall' | 'cliff', mask: number): number {
  const mapping = STRUCTURE_FRAME_MAPPING[kind];
  const fallback = kind === 'wall' ? 0 : 16;
  return mapping[mask] ?? fallback;
}
