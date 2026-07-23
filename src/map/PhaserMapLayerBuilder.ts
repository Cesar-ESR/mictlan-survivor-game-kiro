/**
 * PhaserMapLayerBuilder: Construye las 6 capas de Phaser Tilemap a partir
 * de la grid lógica generada por LogicalMapGenerator.
 *
 * Capas (en orden de profundidad):
 * - Ground (depth 0): suelo base, siempre relleno
 * - Liquids (depth 1): regiones de líquido
 * - Borders (depth 2): transiciones visuales
 * - Decorations (depth 3): elementos decorativos
 * - Walls (depth 4): muros bloqueantes
 * - Obstacles (depth 4): obstáculos bloqueantes
 *
 * Colisiones:
 * - Walls: colisión habilitada (bloquea jugador y enemigos)
 * - Obstacles: colisión habilitada
 * - Liquids: colisión solo si behavior === 'blocking'
 * - Ground, Borders, Decorations: SIN colisión
 *
 * Requirements: 10.2, 10.6, 10.7, Property 30, Property 31
 */

import Phaser from 'phaser';
import type { LogicalMapGrid } from './MapCell';
import { TileIndexResolver } from './TileIndexResolver';
import { resolveWallPlacement, resolveBorderPlacements, invertBorderMask } from './VisualTileMappings';
import type { LiquidFamily } from './VisualTileMappings';

// ─── Layer depths ───

export const LAYER_DEPTHS = {
  ground: 0,
  liquids: 1,
  borders: 2,
  decorations: 3,
  walls: 4,
  obstacles: 4,
} as const;

// ─── Tileset registration names (must match addTilesetImage first param) ───

const TILESET_NAMES = {
  ground: 'ground',
  borders: 'borders',
  liquids: 'liquids',
  walls: 'walls',
  decorations: 'decorations',
} as const;

// ─── Phaser texture keys (as loaded in BootScene) ───

const TEXTURE_KEYS = {
  ground: 'tileset_ground',
  borders: 'tileset_borders',
  liquids: 'tileset_liquids',
  walls: 'tileset_walls',
  decorations: 'tileset_decorations',
} as const;

// ─── Result interface ───

export interface MapLayers {
  ground: Phaser.Tilemaps.TilemapLayer;
  liquids: Phaser.Tilemaps.TilemapLayer;
  /** @deprecated Use bordersPrimary instead. Alias for bordersPrimary. */
  borders: Phaser.Tilemaps.TilemapLayer;
  bordersPrimary: Phaser.Tilemaps.TilemapLayer;
  bordersSecondary: Phaser.Tilemaps.TilemapLayer;
  walls: Phaser.Tilemaps.TilemapLayer;
  obstacles: Phaser.Tilemaps.TilemapLayer;
  decorations: Phaser.Tilemaps.TilemapLayer;
  tilemap: Phaser.Tilemaps.Tilemap;
}

// ─── Builder class ───

export class PhaserMapLayerBuilder {
  private resolver: TileIndexResolver;

  constructor() {
    this.resolver = new TileIndexResolver();
  }

  /**
   * Builds all 6 Phaser Tilemap layers from a validated logical grid.
   *
   * @param scene The Phaser Scene to create the tilemap in
   * @param grid The validated LogicalMapGrid (100×100)
   * @returns MapLayers object with all 6 layers and the tilemap reference
   */
  build(scene: Phaser.Scene, grid: LogicalMapGrid): MapLayers {
    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;
    const tileSize = 32;

    // 1. Create blank tilemap
    const tilemap = scene.make.tilemap({
      width,
      height,
      tileWidth: tileSize,
      tileHeight: tileSize,
    });

    // 2. Register tilesets
    const groundTileset = tilemap.addTilesetImage(TILESET_NAMES.ground, TEXTURE_KEYS.ground)!;
    const liquidsTileset = tilemap.addTilesetImage(TILESET_NAMES.liquids, TEXTURE_KEYS.liquids)!;
    const bordersTileset = tilemap.addTilesetImage(TILESET_NAMES.borders, TEXTURE_KEYS.borders)!;
    const wallsTileset = tilemap.addTilesetImage(TILESET_NAMES.walls, TEXTURE_KEYS.walls)!;
    const decorationsTileset = tilemap.addTilesetImage(TILESET_NAMES.decorations, TEXTURE_KEYS.decorations)!;

    // 3. Create blank layers
    const groundLayer = tilemap.createBlankLayer(
      'ground', groundTileset, 0, 0, width, height, tileSize, tileSize,
    )!;
    const liquidsLayer = tilemap.createBlankLayer(
      'liquids', liquidsTileset, 0, 0, width, height, tileSize, tileSize,
    )!;
    const bordersPrimaryLayer = tilemap.createBlankLayer(
      'borders_primary', bordersTileset, 0, 0, width, height, tileSize, tileSize,
    )!;
    const bordersSecondaryLayer = tilemap.createBlankLayer(
      'borders_secondary', bordersTileset, 0, 0, width, height, tileSize, tileSize,
    )!;
    const wallsLayer = tilemap.createBlankLayer(
      'walls', wallsTileset, 0, 0, width, height, tileSize, tileSize,
    )!;
    const obstaclesLayer = tilemap.createBlankLayer(
      'obstacles', wallsTileset, 0, 0, width, height, tileSize, tileSize,
    )!;
    const decorationsLayer = tilemap.createBlankLayer(
      'decorations', decorationsTileset, 0, 0, width, height, tileSize, tileSize,
    )!;

    // 4. Set depths
    groundLayer.setDepth(LAYER_DEPTHS.ground);
    liquidsLayer.setDepth(LAYER_DEPTHS.liquids);
    bordersPrimaryLayer.setDepth(LAYER_DEPTHS.borders);
    bordersSecondaryLayer.setDepth(LAYER_DEPTHS.borders);
    decorationsLayer.setDepth(LAYER_DEPTHS.decorations);
    wallsLayer.setDepth(LAYER_DEPTHS.walls);
    obstaclesLayer.setDepth(LAYER_DEPTHS.obstacles);

    // 5. Populate tiles from grid
    this.populateLayers(grid, {
      groundLayer,
      liquidsLayer,
      bordersPrimaryLayer,
      bordersSecondaryLayer,
      wallsLayer,
      obstaclesLayer,
      decorationsLayer,
    });

    // 6. Configure collisions
    // Walls: all placed tiles have collision
    wallsLayer.setCollisionByExclusion([-1]);
    // Obstacles: all placed tiles have collision
    obstaclesLayer.setCollisionByExclusion([-1]);
    // Liquids: set collision on individual blocking tiles
    this.setLiquidCollisions(grid, liquidsLayer);
    // Ground, Borders, Decorations: NO collision (default)

    return {
      ground: groundLayer,
      liquids: liquidsLayer,
      borders: bordersPrimaryLayer,
      bordersPrimary: bordersPrimaryLayer,
      bordersSecondary: bordersSecondaryLayer,
      walls: wallsLayer,
      obstacles: obstaclesLayer,
      decorations: decorationsLayer,
      tilemap,
    };
  }

  /**
   * Populate all layers from the logical grid.
   */
  private populateLayers(
    grid: LogicalMapGrid,
    layers: {
      groundLayer: Phaser.Tilemaps.TilemapLayer;
      liquidsLayer: Phaser.Tilemaps.TilemapLayer;
      bordersPrimaryLayer: Phaser.Tilemaps.TilemapLayer;
      bordersSecondaryLayer: Phaser.Tilemaps.TilemapLayer;
      wallsLayer: Phaser.Tilemaps.TilemapLayer;
      obstaclesLayer: Phaser.Tilemaps.TilemapLayer;
      decorationsLayer: Phaser.Tilemaps.TilemapLayer;
    },
  ): void {
    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];

        // Ground: always fill (all 10,000 cells)
        if (cell.ground) {
          const index = this.resolver.resolve(cell.ground);
          layers.groundLayer.putTileAt(index, col, row);
        }

        // Liquids: only where liquid is present
        if (cell.liquid) {
          const index = this.resolver.resolve(cell.liquid);
          const tile = layers.liquidsLayer.putTileAt(index, col, row);
          if (tile) {
            if (cell.liquidRotation) {
              tile.rotation = (cell.liquidRotation * Math.PI) / 180;
            }
            if (cell.liquidFlipX) {
              tile.flipX = true;
            }
            if (cell.liquidFlipY) {
              tile.flipY = true;
            }
          }
        }

        // Borders: place confirmed mappings using family resolution
        if (cell.borderMask !== null && cell.borderMask > 0) {
          const family = this.resolveBorderFamily(grid, row, col, cell.borderMask);
          if (family) {
            const visualMask = invertBorderMask(cell.borderMask);
            const placements = resolveBorderPlacements(visualMask, family);
            if (placements.length > 0) {
              // Primary placement
              const p0 = placements[0];
              const tile0 = layers.bordersPrimaryLayer.putTileAt(p0.frame, col, row);
              if (tile0) {
                if (p0.rotation !== 0) tile0.rotation = (p0.rotation * Math.PI) / 180;
                if (p0.flipX) tile0.flipX = true;
                if (p0.flipY) tile0.flipY = true;
              }
              // Secondary placement (for corners)
              if (placements.length > 1) {
                const p1 = placements[1];
                const tile1 = layers.bordersSecondaryLayer.putTileAt(p1.frame, col, row);
                if (tile1) {
                  if (p1.rotation !== 0) tile1.rotation = (p1.rotation * Math.PI) / 180;
                  if (p1.flipX) tile1.flipX = true;
                  if (p1.flipY) tile1.flipY = true;
                }
              }
            }
          }
        }

        // Walls: only where wall is present
        if (cell.wall) {
          // Use structureMask for visual variant if available
          if (cell.structureMask !== null) {
            const placement = resolveWallPlacement(cell.structureMask);
            const tile = layers.wallsLayer.putTileAt(placement.frame, col, row);
            if (tile && placement.rotation !== 0) {
              // Phaser rotation is in radians for tiles
              tile.rotation = (placement.rotation * Math.PI) / 180;
            }
          } else {
            const index = this.resolver.resolve(cell.wall);
            layers.wallsLayer.putTileAt(index, col, row);
          }
        }

        // Obstacles: only where obstacle is present
        if (cell.obstacle) {
          const index = this.resolver.resolve(cell.obstacle);
          layers.obstaclesLayer.putTileAt(index, col, row);
        }

        // Decorations: only where decoration is present
        if (cell.decoration) {
          const index = this.resolver.resolve(cell.decoration);
          layers.decorationsLayer.putTileAt(index, col, row);
        }
      }
    }
  }

  /**
   * Determines the liquid family for a border cell by inspecting its liquid neighbors.
   * Returns null if neighbors are mixed or spectral (no border rendered).
   */
  private resolveBorderFamily(
    grid: LogicalMapGrid,
    row: number,
    col: number,
    mask: number,
  ): LiquidFamily | null {
    const height = grid.length;
    const width = grid[0].length;
    const bits: Array<[number, number, number]> = [
      [-1, 0, 1], // N
      [0, 1, 2],  // E
      [1, 0, 4],  // S
      [0, -1, 8], // W
    ];

    let detectedFamily: LiquidFamily | null = null;

    for (const [dr, dc, bit] of bits) {
      if (!(mask & bit)) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const neighbor = grid[nr][nc];
      if (!neighbor.liquidConfig) continue;

      const neighborFamily = neighbor.liquidConfig.type as LiquidFamily;

      // Skip spectral — no borders for spectral
      if (neighborFamily === 'spectral') return null;

      if (detectedFamily === null) {
        detectedFamily = neighborFamily;
      } else if (detectedFamily !== neighborFamily) {
        // Mixed families — don't render border
        return null;
      }
    }

    return detectedFamily;
  }

  /**
   * Set collision on liquid tiles that have blocking behavior.
   */
  private setLiquidCollisions(
    grid: LogicalMapGrid,
    liquidsLayer: Phaser.Tilemaps.TilemapLayer,
  ): void {
    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];
        if (cell.liquid && cell.liquidConfig?.behavior === 'blocking') {
          const tile = liquidsLayer.getTileAt(col, row);
          if (tile) {
            tile.setCollision(true, true, true, true);
          }
        }
      }
    }
  }
}
