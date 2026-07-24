/**
 * SpectralRegionGenerator: Places template-based spectral liquid regions.
 *
 * Unlike Water/Lava which use seed-and-grow with a repeated centerFrame,
 * Spectral uses hand-crafted templates placed as a complete unit.
 *
 * Placement rules:
 * - Deterministic (uses SeededRandom)
 * - Template placed completely or not at all (no partial placement)
 * - Within map bounds
 * - Outside Safe Zone
 * - No overlap with existing liquids (Water/Lava)
 * - No overlap with Walls or Obstacles
 * - Preserves Ground beneath
 * - Assigns liquidConfig.type='spectral' to all cells
 * - At most maxSpectralRegions per map
 * - If no valid position found, generation continues without spectral
 */

import type { LogicalMapGrid, LiquidConfig } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import { SeededRandom } from './SeededRandom';
import {
  getConfirmedTemplates,
  DEFAULT_SPECTRAL_CONFIG,
} from './SpectralTemplates';
import type { SpectralTemplate, SpectralGenerationConfig } from './SpectralTemplates';

/**
 * Attempts to place spectral template regions on the grid.
 * Should be called AFTER Water/Lava generation and BEFORE Walls/Obstacles.
 */
export function generateSpectralRegions(
  grid: LogicalMapGrid,
  _config: MapGenerationConfig,
  rng: SeededRandom,
  spectralConfig: SpectralGenerationConfig = DEFAULT_SPECTRAL_CONFIG,
): void {
  const confirmedTemplates = getConfirmedTemplates();
  if (confirmedTemplates.length === 0) return;

  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;
  if (width === 0 || height === 0) return;

  for (let i = 0; i < spectralConfig.maxSpectralRegions; i++) {
    // Roll chance
    if (rng.next() > spectralConfig.spectralRegionChance) continue;

    // Pick a template
    const templateIdx = rng.integer(0, confirmedTemplates.length - 1);
    const template = confirmedTemplates[templateIdx];

    // Try to find a valid position (limited attempts)
    const maxAttempts = 200;
    let success = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startRow = rng.integer(0, height - template.height);
      const startCol = rng.integer(0, width - template.width);

      if (canPlaceTemplate(grid, template, startRow, startCol)) {
        placeTemplate(grid, template, startRow, startCol);
        success = true;
        break;
      }
    }

    // If no valid position found, stop trying more regions (graceful)
    if (!success) break;
  }
}

/**
 * Checks if a template can be placed at the given position.
 */
function canPlaceTemplate(
  grid: LogicalMapGrid,
  template: SpectralTemplate,
  startRow: number,
  startCol: number,
): boolean {
  const height = grid.length;
  const width = grid[0].length;

  for (const cell of template.cells) {
    const row = startRow + cell.y;
    const col = startCol + cell.x;

    // Bounds check
    if (row < 0 || row >= height || col < 0 || col >= width) return false;

    const gridCell = grid[row][col];

    // Safe zone check
    if (gridCell.inSafeZone) return false;

    // No overlap with existing liquids
    if (gridCell.liquid !== null) return false;

    // No overlap with walls or obstacles
    if (gridCell.wall !== null) return false;
    if (gridCell.obstacle !== null) return false;
  }

  return true;
}

/**
 * Places a template at the given position. Assumes canPlaceTemplate returned true.
 */
function placeTemplate(
  grid: LogicalMapGrid,
  template: SpectralTemplate,
  startRow: number,
  startCol: number,
): void {
  const liquidConfig: LiquidConfig = {
    type: 'spectral',
    behavior: 'walkable',
  };

  for (const cell of template.cells) {
    const row = startRow + cell.y;
    const col = startCol + cell.x;
    const gridCell = grid[row][col];

    // Assign liquid tile with template frame
    gridCell.liquid = { tileset: 'liquids', frame: cell.frame };
    gridCell.liquidConfig = liquidConfig;
    gridCell.liquidRotation = cell.rotation;
    gridCell.liquidFlipX = cell.flipX;
    gridCell.liquidFlipY = cell.flipY;
    // Ground is preserved (not removed)
    // walkable stays true for 'walkable' behavior
  }
}
