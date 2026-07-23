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
import { resolveStructureFrame } from './VisualTileMappings';

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
  borders: Phaser.Tilemaps.TilemapLayer;
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
    const bordersLayer = tilemap.createBlankLayer(
      'borders', bordersTileset, 0, 0, width, height, tileSize, tileSize,
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
    bordersLayer.setDepth(LAYER_DEPTHS.borders);
    decorationsLayer.setDepth(LAYER_DEPTHS.decorations);
    wallsLayer.setDepth(LAYER_DEPTHS.walls);
    obstaclesLayer.setDepth(LAYER_DEPTHS.obstacles);

    // 5. Populate tiles from grid
    this.populateLayers(grid, {
      groundLayer,
      liquidsLayer,
      bordersLayer,
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
      borders: bordersLayer,
      walls: wallsLayer,
      obstacles: obstaclesLayer,
      decorations: decorationsLayer,
      tilemap,
    };
  }

  /**
   * Populate all 6 layers from the logical grid.
   */
  private populateLayers(
    grid: LogicalMapGrid,
    layers: {
      groundLayer: Phaser.Tilemaps.TilemapLayer;
      liquidsLayer: Phaser.Tilemaps.TilemapLayer;
      bordersLayer: Phaser.Tilemaps.TilemapLayer;
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
          layers.liquidsLayer.putTileAt(index, col, row);
        }

        // Borders: TEMPORARILY DISABLED — uncalibrated mask→frame mapping
        // TODO: Re-enable after calibration in ?debug=mappings scene
        // if (cell.borderMask !== null) {
        //   const frameIndex = resolveBorderFrame(cell.borderMask);
        //   layers.bordersLayer.putTileAt(frameIndex, col, row);
        // }

        // Walls: only where wall is present
        if (cell.wall) {
          // Use structureMask for visual variant if available
          if (cell.structureMask !== null) {
            const frameIndex = resolveStructureFrame('wall', cell.structureMask);
            layers.wallsLayer.putTileAt(frameIndex, col, row);
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
