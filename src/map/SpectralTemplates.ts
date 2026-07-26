/**
 * SpectralTemplates: Template-based lake definitions for spectral liquid regions.
 * 
 * Spectral does NOT use a repeated centerFrame. Instead, it uses small
 * hand-crafted templates with specific frame assignments per cell.
 * 
 * Templates remain 'provisional' until visually confirmed in ?debug=mappings.
 * While no template is confirmed, Spectral does NOT generate in the procedural map.
 *
 * Valid spectral frames: 32–41 (from liquids tileset)
 */

import type { MappingStatus, TileRotation } from './VisualTileMappings';

// ─── Types ───

export interface LiquidTemplateCell {
  /** X offset from template origin (column). */
  x: number;
  /** Y offset from template origin (row). */
  y: number;
  /** Frame index in the liquids tileset (must be 32–41). */
  frame: number;
  /** Rotation in degrees. */
  rotation: TileRotation;
  /** Horizontal flip. */
  flipX: boolean;
  /** Vertical flip. */
  flipY: boolean;
}

export interface SpectralTemplate {
  /** Unique identifier for this template. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Width of the template in tiles. */
  width: number;
  /** Height of the template in tiles. */
  height: number;
  /** Cell definitions. */
  cells: readonly LiquidTemplateCell[];
  /** Calibration status — only 'confirmed' templates can be used in generation. */
  status: MappingStatus;
}

// ─── Configuration ───

export interface SpectralGenerationConfig {
  /** Probability of attempting to place a spectral region per map. 0–1. */
  spectralRegionChance: number;
  /** Maximum number of spectral regions per map. */
  maxSpectralRegions: number;
  /** Minimum template size (cells). */
  minSize: number;
  /** Maximum template size (cells). */
  maxSize: number;
}

export const DEFAULT_SPECTRAL_CONFIG: SpectralGenerationConfig = {
  spectralRegionChance: 0.10,
  maxSpectralRegions: 1,
  minSize: 9,   // 3×3
  maxSize: 25,  // 5×5
};

// ─── Valid frame range ───

export const SPECTRAL_FRAME_MIN = 32;
export const SPECTRAL_FRAME_MAX = 41;

/** Validates that a frame is in the spectral range [32, 41]. */
export function isValidSpectralFrame(frame: number): boolean {
  return frame >= SPECTRAL_FRAME_MIN && frame <= SPECTRAL_FRAME_MAX;
}

/** Validates all cells in a template use valid spectral frames. */
export function validateTemplate(template: SpectralTemplate): boolean {
  if (template.cells.length === 0) return false;
  if (template.width < 1 || template.height < 1) return false;
  for (const cell of template.cells) {
    if (!isValidSpectralFrame(cell.frame)) return false;
    if (cell.x < 0 || cell.x >= template.width) return false;
    if (cell.y < 0 || cell.y >= template.height) return false;
  }
  return true;
}

/** Returns true if any template has status 'confirmed'. */
export function hasConfirmedTemplate(): boolean {
  return SPECTRAL_TEMPLATES.some(t => t.status === 'confirmed');
}

/** Returns only confirmed templates. */
export function getConfirmedTemplates(): SpectralTemplate[] {
  return SPECTRAL_TEMPLATES.filter(t => t.status === 'confirmed');
}

// ─── Template Definitions (ALL PROVISIONAL — need visual confirmation) ───

/**
 * Candidate templates for spectral lakes.
 * ALL are provisional until visually verified in ?debug=mappings.
 * 
 * Frame assignment is tentative:
 * - 32: assumed center/fill
 * - 33: assumed edge variant
 * - 34: assumed corner
 * - 35-41: other variants to be identified
 */
export const SPECTRAL_TEMPLATES: readonly SpectralTemplate[] = [
  {
    id: 'spectral-3x3-a',
    description: 'Small 3×3 square pool using frame 32 center with 33 edges',
    width: 3,
    height: 3,
    status: 'provisional',
    cells: [
      { x: 0, y: 0, frame: 34, rotation: 0, flipX: false, flipY: false },
      { x: 1, y: 0, frame: 33, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 0, frame: 34, rotation: 90, flipX: false, flipY: false },
      { x: 0, y: 1, frame: 33, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 1, frame: 32, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 1, frame: 33, rotation: 90, flipX: false, flipY: false },
      { x: 0, y: 2, frame: 34, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 2, frame: 33, rotation: 180, flipX: false, flipY: false },
      { x: 2, y: 2, frame: 34, rotation: 180, flipX: false, flipY: false },
    ],
  },
  {
    id: 'spectral-4x4-a',
    description: 'Medium 4×4 pool with edges and corners',
    width: 4,
    height: 4,
    status: 'confirmed',
    cells: [
      { x: 0, y: 0, frame: 34, rotation: 0, flipX: false, flipY: false },
      { x: 1, y: 0, frame: 33, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 0, frame: 33, rotation: 0, flipX: false, flipY: false },
      { x: 3, y: 0, frame: 34, rotation: 90, flipX: false, flipY: false },
      { x: 0, y: 1, frame: 33, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 1, frame: 32, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 1, frame: 32, rotation: 0, flipX: false, flipY: false },
      { x: 3, y: 1, frame: 33, rotation: 90, flipX: false, flipY: false },
      { x: 0, y: 2, frame: 33, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 2, frame: 32, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 2, frame: 32, rotation: 0, flipX: false, flipY: false },
      { x: 3, y: 2, frame: 33, rotation: 90, flipX: false, flipY: false },
      { x: 0, y: 3, frame: 34, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 3, frame: 33, rotation: 180, flipX: false, flipY: false },
      { x: 2, y: 3, frame: 33, rotation: 180, flipX: false, flipY: false },
      { x: 3, y: 3, frame: 34, rotation: 180, flipX: false, flipY: false },
    ],
  },
  {
    id: 'spectral-L-shape',
    description: 'L-shaped spectral pool (3×3 minus corner)',
    width: 3,
    height: 3,
    status: 'provisional',
    cells: [
      { x: 0, y: 0, frame: 34, rotation: 0, flipX: false, flipY: false },
      { x: 1, y: 0, frame: 33, rotation: 0, flipX: false, flipY: false },
      { x: 0, y: 1, frame: 33, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 1, frame: 35, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 1, frame: 33, rotation: 90, flipX: false, flipY: false },
      { x: 0, y: 2, frame: 34, rotation: 270, flipX: false, flipY: false },
      { x: 1, y: 2, frame: 33, rotation: 180, flipX: false, flipY: false },
      { x: 2, y: 2, frame: 34, rotation: 180, flipX: false, flipY: false },
    ],
  },
  {
    id: 'spectral-irregular-small',
    description: 'Small irregular spectral puddle (5 cells)',
    width: 3,
    height: 2,
    status: 'provisional',
    cells: [
      { x: 0, y: 0, frame: 36, rotation: 0, flipX: false, flipY: false },
      { x: 1, y: 0, frame: 37, rotation: 0, flipX: false, flipY: false },
      { x: 2, y: 0, frame: 38, rotation: 0, flipX: false, flipY: false },
      { x: 0, y: 1, frame: 39, rotation: 0, flipX: false, flipY: false },
      { x: 1, y: 1, frame: 40, rotation: 0, flipX: false, flipY: false },
    ],
  },
];
