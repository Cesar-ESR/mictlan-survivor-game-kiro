/**
 * LogicalMapGenerator: Coordinador de la pipeline completa de generación de mapa.
 *
 * Pipeline por intento:
 * 1. createEmptyGrid
 * 2. generateGround
 * 3. markSafeZone
 * 4. generateLiquidRegions
 * 5. computeAllBorderMasks
 * 6. generateWallsAndCliffs
 * 7. generateObstacles
 * 8. generateDecorations
 * 9. clearSafeZone (unified)
 * 10. recomputeBorderMasks
 * 11. computeAllStructureMasks
 * 12. validator.validate
 *
 * Retry logic:
 * - Attempt 0 uses baseSeed directly
 * - Attempt N uses derived seed: `${baseSeed}:attempt:${N}`
 * - Max attempts: config.maxGenerationAttempts (default 5)
 * - Time limit: config.maxGenerationTimeMs (default 3000)
 *
 * NOTE (Cliff Audit): StructureGenerator currently sets structureKind as 'wall'
 * for ALL structures. It NEVER generates structureKind: 'cliff' as a distinct kind.
 * Cliff generation as a separate kind is typed but not yet implemented.
 *
 * Requirements: 10.11, 10.12, 10.15, Property 34, Property 35
 */

import type { LogicalMapGrid } from './MapCell';
import { createEmptyGrid } from './MapCell';
import type { MapGenerationConfig } from './MapGenerationConfig';
import { SeededRandom } from './SeededRandom';
import { TileCatalog } from './TileCatalog';
import { generateGround, markSafeZone } from './GroundGenerator';
import { generateLiquidRegions } from './LiquidRegionGenerator';
import { generateSpectralRegions } from './SpectralRegionGenerator';
import { computeAllBorderMasks } from './BorderTopology';
import { generateWallsAndCliffs } from './StructureGenerator';
import { generateObstacles } from './ObstacleGenerator';
import { generateDecorations } from './DecorationGenerator';
import { clearSafeZone } from './SafeZoneCleaner';
import { MapValidator } from './MapValidator';
import type { MapValidationResult } from './MapValidator';

// ─── Clock interface for testability ───

export interface Clock {
  now(): number;
}

export const defaultClock: Clock = { now: () => performance.now() };

// ─── Result types ───

export type LogicalMapGenerationResult =
  | {
      success: true;
      grid: LogicalMapGrid;
      baseSeed: string | number;
      resolvedSeed: string | number;
      attempts: number;
      validation: MapValidationResult;
      generationTimeMs: number;
    }
  | {
      success: false;
      error: 'MAX_ATTEMPTS_EXCEEDED' | 'GENERATION_TIMEOUT' | 'INVALID_CONFIGURATION';
      baseSeed: string | number;
      attempts: number;
      lastValidation: MapValidationResult | null;
      generationTimeMs: number;
    };

// ─── LogicalMapGenerator class ───

export class LogicalMapGenerator {
  private validator: MapValidator;
  private clock: Clock;
  private catalog: TileCatalog;

  constructor(
    catalog: TileCatalog,
    options?: {
      clock?: Clock;
      validator?: MapValidator;
    },
  ) {
    this.catalog = catalog;
    this.clock = options?.clock ?? defaultClock;
    this.validator = options?.validator ?? new MapValidator();
  }

  /**
   * Generate a logical map grid with retry logic and time limiting.
   */
  generate(config: MapGenerationConfig): LogicalMapGenerationResult {
    const startTime = this.clock.now();
    const baseSeed = config.seed;
    let lastValidation: MapValidationResult | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt < config.maxGenerationAttempts; attempt++) {
      // Check time limit BEFORE starting a new attempt
      const elapsed = this.clock.now() - startTime;
      if (elapsed > config.maxGenerationTimeMs) {
        return {
          success: false,
          error: 'GENERATION_TIMEOUT',
          baseSeed,
          attempts,
          lastValidation,
          generationTimeMs: elapsed,
        };
      }

      attempts++;

      // Derive seed for this attempt
      const resolvedSeed = attempt === 0
        ? baseSeed
        : `${baseSeed}:attempt:${attempt}`;

      const rng = new SeededRandom(resolvedSeed);

      // Execute pipeline (may return null on mid-phase timeout)
      const grid = this.executePipeline(config, rng, startTime);

      if (grid === null) {
        // Timeout detected between pipeline phases
        const timeoutElapsed = this.clock.now() - startTime;
        return {
          success: false,
          error: 'GENERATION_TIMEOUT',
          baseSeed,
          attempts,
          lastValidation,
          generationTimeMs: timeoutElapsed,
        };
      }

      // Validate
      const validation = this.validator.validate(grid, config);
      lastValidation = validation;

      if (validation.valid) {
        const generationTimeMs = this.clock.now() - startTime;
        return {
          success: true,
          grid,
          baseSeed,
          resolvedSeed,
          attempts,
          validation,
          generationTimeMs,
        };
      }

      // Check time limit after validation too
      const postValidationElapsed = this.clock.now() - startTime;
      if (postValidationElapsed > config.maxGenerationTimeMs) {
        return {
          success: false,
          error: 'GENERATION_TIMEOUT',
          baseSeed,
          attempts,
          lastValidation,
          generationTimeMs: postValidationElapsed,
        };
      }
    }

    // All attempts failed
    const generationTimeMs = this.clock.now() - startTime;
    return {
      success: false,
      error: 'MAX_ATTEMPTS_EXCEEDED',
      baseSeed,
      attempts,
      lastValidation,
      generationTimeMs,
    };
  }

  /**
   * Execute the full generation pipeline for one attempt.
   * Returns a fresh grid (each attempt starts with a new empty grid).
   * Returns null if a timeout is detected between phases.
   */
  private executePipeline(config: MapGenerationConfig, rng: SeededRandom, startTime: number): LogicalMapGrid | null {
    const budget = (): boolean => {
      return this.clock.now() - startTime > config.maxGenerationTimeMs;
    };

    // 1. Create fresh empty grid
    const grid = createEmptyGrid(config.widthInTiles, config.heightInTiles);

    if (budget()) return null;

    // 2. Generate ground
    generateGround(grid, rng, this.catalog);

    if (budget()) return null;

    // 3. Mark safe zone
    markSafeZone(grid, config);

    // 4. Generate liquid regions
    generateLiquidRegions(grid, config, rng, this.catalog);

    if (budget()) return null;

    // 4b. Generate spectral template regions (after water/lava, before structures)
    generateSpectralRegions(grid, config, rng);

    if (budget()) return null;

    // 5. Compute border masks
    computeAllBorderMasks(grid);

    // 6. Generate walls and cliffs
    generateWallsAndCliffs(grid, config, rng, this.catalog);

    if (budget()) return null;

    // 7. Generate obstacles
    generateObstacles(grid, config, rng, this.catalog);

    if (budget()) return null;

    // 8. Generate decorations (real implementation)
    generateDecorations(grid, config, rng, this.catalog);

    if (budget()) return null;

    // 9. Clear safe zone (unified — removes walls, obstacles, blocking liquids, decorations)
    // clearSafeZone internally calls recomputeBorderMasks + computeAllStructureMasks
    clearSafeZone(grid);

    if (budget()) return null;

    return grid;
  }
}
