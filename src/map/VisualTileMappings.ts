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

// ─── Visual Frame Placement Types ───

/** Estado de calibración de un mapeo individual. */
export type MappingStatus = 'confirmed' | 'provisional' | 'missing';

/** Rotaciones válidas para un tile (grados). */
export type TileRotation = 0 | 90 | 180 | 270;

/** Validación: solo acepta rotaciones válidas. */
export function isValidRotation(r: number): r is TileRotation {
  return r === 0 || r === 90 || r === 180 || r === 270;
}

/**
 * Posición visual completa de un frame: frame index + transformaciones + estado.
 * Centraliza rotación y flips para que no estén hardcodeados en GameScene.
 */
export interface VisualFramePlacement {
  frame: number;
  rotation: TileRotation;
  flipX: boolean;
  flipY: boolean;
  status: MappingStatus;
}

/** Crea un placement con defaults: sin rotación, sin flip, status provisional. */
export function createPlacement(
  frame: number,
  opts?: Partial<Pick<VisualFramePlacement, 'rotation' | 'flipX' | 'flipY' | 'status'>>,
): VisualFramePlacement {
  return {
    frame,
    rotation: opts?.rotation ?? 0,
    flipX: opts?.flipX ?? false,
    flipY: opts?.flipY ?? false,
    status: opts?.status ?? 'provisional',
  };
}

/** Placeholder para un mapeo que no tiene frame identificado. */
export function missingPlacement(): VisualFramePlacement {
  return { frame: -1, rotation: 0, flipX: false, flipY: false, status: 'missing' };
}

// ─── Border Frame Mapping (Legacy — uses per-family now) ───

/**
 * Mapeo de borderMask → frame index en tileset_borders.
 * Borders tileset tiene 16 frames (0–15), uno por cada combinación cardinal.
 *
 * DEPRECATED: Usar BORDER_FRAME_MAPPING_BY_FAMILY en su lugar.
 * Mantenido por backward compat.
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

// ─── Per-family Border Frame Mapping ───

/**
 * Mapeo de máscara → VisualFramePlacement por familia de líquido.
 * Cada familia puede tener bordes diferentes.
 * Una máscara sin frame confirmado tiene status='missing' y NO se renderiza.
 */
export type BorderFrameMappingByFamily = Partial<
  Record<LiquidFamily, Partial<Record<number, VisualFramePlacement>>>
>;

/**
 * Mapeos de bordes por familia. Actualmente TODOS son missing.
 * No se usa frame=mask implícitamente.
 */
export const BORDER_FRAME_MAPPING_BY_FAMILY: BorderFrameMappingByFamily = {
  water: {},
  lava: {},
  spectral: {},
};

/**
 * Resuelve el placement para un borde dado su máscara y familia.
 * Retorna null si el mapeo es missing o no existe.
 */
export function resolveBorderPlacement(
  mask: number,
  family: LiquidFamily,
): VisualFramePlacement | null {
  const familyMap = BORDER_FRAME_MAPPING_BY_FAMILY[family];
  if (!familyMap) return null;
  const placement = familyMap[mask];
  if (!placement || placement.status === 'missing') return null;
  return placement;
}

// ─── Structure Frame Mapping ───

/**
 * Mapeo de structureMask → VisualFramePlacement para muros y cliffs.
 *
 * PROVISIONAL: Actualmente TODOS usan frame 0 como fallback técnico.
 * Las máscaras no mapeadas tienen status='missing'.
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

/**
 * Mapeo enriquecido de walls con VisualFramePlacement.
 * Cada máscara tiene un status explícito. frame 0 es fallback NOT CALIBRATED.
 */
export type WallFrameMappingByMask = Partial<Record<number, VisualFramePlacement>>;

export const WALL_FRAME_MAPPING_BY_MASK: WallFrameMappingByMask = {
  // ── Confirmed: vertical (frame 0, rotation 90) ──
  1:  createPlacement(0, { rotation: 90, status: 'confirmed' }),  // north
  4:  createPlacement(0, { rotation: 90, status: 'confirmed' }),  // south
  5:  createPlacement(0, { rotation: 90, status: 'confirmed' }),  // north+south

  // ── Confirmed: horizontal (frame 0, rotation 0) ──
  2:  createPlacement(0, { rotation: 0, status: 'confirmed' }),   // east
  8:  createPlacement(0, { rotation: 0, status: 'confirmed' }),   // west
  10: createPlacement(0, { rotation: 0, status: 'confirmed' }),   // east+west

  // ── Provisional: fallback (frame 0, rotation 0) ──
  0:  createPlacement(0, { status: 'provisional' }),  // isolated
  3:  createPlacement(0, { status: 'provisional' }),  // N+E corner
  6:  createPlacement(0, { status: 'provisional' }),  // E+S corner
  9:  createPlacement(0, { status: 'provisional' }),  // N+W corner
  12: createPlacement(0, { status: 'provisional' }),  // S+W corner
  7:  createPlacement(0, { status: 'provisional' }),  // T-junction N+E+S
  11: createPlacement(0, { status: 'provisional' }),  // T-junction N+E+W
  13: createPlacement(0, { status: 'provisional' }),  // T-junction N+S+W
  14: createPlacement(0, { status: 'provisional' }),  // T-junction E+S+W
  15: createPlacement(0, { status: 'provisional' }),  // four-way
};

/** Straight wall candidates — can serve as main wall segment. */
export const WALL_STRAIGHT_CANDIDATES: readonly number[] = [0, 1, 4, 6, 9, 10];

/** Special wall candidates — doors, damaged, ornamental, etc. Not for random wall use. */
export const WALL_SPECIAL_CANDIDATES: readonly number[] = [2, 3, 5, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 23, 24, 25, 27];

/** Door/opening frames — must NOT be used as generic wall segments. */
export const DOOR_OR_OPENING_CANDIDATES: readonly number[] = [19, 20, 22];

/** Obstacle frames — isolated blockers (provisional). */
export const OBSTACLE_FRAMES: readonly number[] = [21, 26];

/** Cliff/chasm frames — deferred, not in MVP. */
export const CLIFF_OR_CHASM_CANDIDATES: readonly number[] = [28, 29, 30, 31, 32, 33, 34];

/** Frames de walls confirmados como vacíos (35–47). No deben usarse. */
export const WALLS_EMPTY_FRAMES: readonly number[] = Array.from({ length: 13 }, (_, i) => 35 + i);

/** Valida que un frame de walls no sea vacío (35–47). */
export function isValidWallFrame(frame: number): boolean {
  return frame >= 0 && frame <= 34;
}

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

export type LiquidGenerationStyle = 'filled-region' | 'template-region';

export interface LiquidFamilyConfig {
  family: LiquidFamily;
  /** Center frame for filled-region families. null for template-region families. */
  centerFrame: number | null;
  weight: number;          // selection probability (0 = disabled)
  /** Calibration status of the centerFrame. */
  centerStatus: MappingStatus;
  /** How this family generates its visual tiles. */
  generationStyle: LiquidGenerationStyle;
}

/**
 * Liquid family configurations. Each liquid region picks one family
 * and uses that family's centerFrame for ALL cells in the region.
 * This ensures visual uniformity within each liquid body.
 *
 * CONFIRMED via MappingsDebugScene inspection:
 * - water frame 0: seamless, no visible grid → confirmed
 * - lava frame 20: seamless, no visible grid → confirmed
 * - spectral: uses template-region style, no repeated centerFrame. weight=0 (disabled).
 */
export const LIQUID_FAMILIES: readonly LiquidFamilyConfig[] = [
  { family: 'water', centerFrame: 0, weight: 6, centerStatus: 'confirmed', generationStyle: 'filled-region' },
  { family: 'lava', centerFrame: 20, weight: 3, centerStatus: 'confirmed', generationStyle: 'filled-region' },
  { family: 'spectral', centerFrame: null, weight: 0, centerStatus: 'missing', generationStyle: 'template-region' },
];

// ─── Border Frame Candidates (PROVISIONAL — not assigned to masks yet) ───

/**
 * Documentación provisional de candidatos de bordes identificados visualmente.
 * NO asignan borderMask → frame. Solo registran observaciones visuales.
 *
 * - frame 0: candidato de borde Water (transición suave)
 * - frames 2–4: candidatos de esquinas o extremos
 * - frames 5–8: candidatos de familia oscura/naranja
 * - frames 9–12: candidatos de familia Water
 * - frames 13–15: candidatos de familia Lava
 *
 * Estos candidatos deben validarse individualmente antes de asignar mask→frame.
 */
export const BORDER_FRAME_CANDIDATES: Readonly<Record<string, readonly number[]>> = {
  waterEdge: [0],
  cornersOrEnds: [2, 3, 4],
  darkOrangeFamily: [5, 6, 7, 8],
  waterFamily: [9, 10, 11, 12],
  lavaFamily: [13, 14, 15],
};

/** Water border frame candidates for calibration. */
export const WATER_BORDER_CANDIDATES: readonly number[] = [9, 10, 11, 12];

/** Lava border frame candidates for calibration. */
export const LAVA_BORDER_CANDIDATES: readonly number[] = [5, 6, 7, 8, 13, 14, 15];

/** Priority masks for MVP calibration (cardinals + corners). */
export const BORDER_PRIORITY_MASKS: readonly number[] = [1, 2, 4, 8, 3, 6, 12, 9];

/** Secondary masks (not yet calibrated). */
export const BORDER_SECONDARY_MASKS: readonly number[] = [5, 10, 7, 11, 13, 14, 15];

// ─── New Border Mapping Model (supports multi-placement corners) ───

export interface BorderVisualPlacement {
  frame: number;
  rotation: TileRotation;
  flipX: boolean;
  flipY: boolean;
}

export interface BorderMaskMapping {
  placements: readonly BorderVisualPlacement[];
  status: MappingStatus;
}

export type BorderMappingByFamily = {
  water: Partial<Record<number, BorderMaskMapping>>;
  lava: Partial<Record<number, BorderMaskMapping>>;
  spectral: Partial<Record<number, BorderMaskMapping>>;
};

export const CONFIRMED_BORDER_MAPPINGS: BorderMappingByFamily = {
  water: {
    1: { placements: [{ frame: 10, rotation: 180, flipX: true, flipY: false }], status: 'confirmed' },
    2: { placements: [{ frame: 10, rotation: 270, flipX: true, flipY: false }], status: 'confirmed' },
    4: { placements: [{ frame: 10, rotation: 0, flipX: true, flipY: false }], status: 'confirmed' },
    8: { placements: [{ frame: 10, rotation: 90, flipX: true, flipY: false }], status: 'confirmed' },
    3: { placements: [{ frame: 10, rotation: 180, flipX: true, flipY: false }, { frame: 10, rotation: 270, flipX: true, flipY: false }], status: 'confirmed' },
    6: { placements: [{ frame: 10, rotation: 270, flipX: true, flipY: false }, { frame: 10, rotation: 0, flipX: true, flipY: false }], status: 'confirmed' },
    12: { placements: [{ frame: 10, rotation: 0, flipX: true, flipY: false }, { frame: 10, rotation: 90, flipX: true, flipY: false }], status: 'confirmed' },
    9: { placements: [{ frame: 10, rotation: 90, flipX: true, flipY: false }, { frame: 10, rotation: 180, flipX: true, flipY: false }], status: 'confirmed' },
  },
  lava: {
    1: { placements: [{ frame: 13, rotation: 0, flipX: true, flipY: false }], status: 'confirmed' },
    2: { placements: [{ frame: 13, rotation: 90, flipX: true, flipY: false }], status: 'confirmed' },
    4: { placements: [{ frame: 13, rotation: 180, flipX: true, flipY: false }], status: 'confirmed' },
    8: { placements: [{ frame: 13, rotation: 270, flipX: true, flipY: false }], status: 'confirmed' },
    3: { placements: [{ frame: 13, rotation: 0, flipX: true, flipY: false }, { frame: 13, rotation: 90, flipX: true, flipY: false }], status: 'confirmed' },
    6: { placements: [{ frame: 13, rotation: 90, flipX: true, flipY: false }, { frame: 13, rotation: 180, flipX: true, flipY: false }], status: 'confirmed' },
    12: { placements: [{ frame: 13, rotation: 0, flipX: true, flipY: false }, { frame: 13, rotation: 270, flipX: true, flipY: false }], status: 'confirmed' },
    9: { placements: [{ frame: 13, rotation: 270, flipX: true, flipY: false }, { frame: 13, rotation: 0, flipX: true, flipY: false }], status: 'confirmed' },
  },
  spectral: {},
};

/**
 * Inverts a borderMask 180 degrees (flips all cardinal directions).
 * borderMask represents where the liquid IS relative to the ground cell.
 * The visual mapping was calibrated from the perspective of the border's visual orientation.
 * This function bridges the semantic gap.
 *
 * Mapping:
 *   N(1) ↔ S(4)
 *   E(2) ↔ W(8)
 */
export function invertBorderMask(mask: number): number {
  let result = 0;
  if ((mask & 1) !== 0) result |= 4;  // North -> South
  if ((mask & 2) !== 0) result |= 8;  // East -> West
  if ((mask & 4) !== 0) result |= 1;  // South -> North
  if ((mask & 8) !== 0) result |= 2;  // West -> East
  return result;
}

/**
 * Resolves border placements for a given mask and family.
 * Returns empty array if no confirmed mapping exists.
 */
export function resolveBorderPlacements(mask: number, family: LiquidFamily): readonly BorderVisualPlacement[] {
  const familyMap = CONFIRMED_BORDER_MAPPINGS[family];
  const mapping = familyMap[mask];
  if (!mapping || mapping.status !== 'confirmed') return [];
  return mapping.placements;
}

/**
 * Resuelve el frame para un borde dado su máscara.
 * Usa frame 0 como fallback.
 */
export function resolveBorderFrame(mask: number): number {
  return BORDER_FRAME_MAPPING[mask] ?? 0;
}

/**
 * Resolves frame and rotation for a wall given its structure mask.
 * Returns the VisualFramePlacement from WALL_FRAME_MAPPING_BY_MASK.
 */
export function resolveWallPlacement(mask: number): VisualFramePlacement {
  return WALL_FRAME_MAPPING_BY_MASK[mask] ?? createPlacement(0, { status: 'provisional' });
}

/**
 * Resuelve el frame para una estructura (wall o cliff) dada su máscara.
 * Usa frame 0 (wall) o frame 16 (cliff) como fallback.
 */
export function resolveStructureFrame(kind: 'wall' | 'cliff', mask: number): number {
  if (kind === 'cliff') {
    const mapping = STRUCTURE_FRAME_MAPPING.cliff;
    return mapping[mask] ?? 16;
  }
  return resolveWallPlacement(mask).frame;
}
