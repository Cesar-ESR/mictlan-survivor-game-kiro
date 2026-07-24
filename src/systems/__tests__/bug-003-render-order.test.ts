import { describe, it, expect } from 'vitest';

import { GAME_CONSTANTS } from '../../config/constants';

/**
 * BUG-003: Enemies render below map textures
 *
 * Validates that entity depth constants are correctly defined
 * and ensure all game entities render ABOVE map layers.
 *
 * Map layer depths (defined in PhaserMapLayerBuilder.ts):
 *   ground: 0, liquids: 1, borders: 2, decorations: 3, walls: 4, obstacles: 4
 *
 * We avoid importing PhaserMapLayerBuilder directly because it triggers
 * Phaser's browser-only initialization (navigator is not defined in Node).
 */
describe('BUG-003: Entity render order', () => {
  // Max map layer depth as defined in PhaserMapLayerBuilder LAYER_DEPTHS
  const MAX_MAP_DEPTH = 4; // walls & obstacles

  it('ENTITY_DEPTH_ENEMIES is above max map layer depth', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES).toBeGreaterThan(MAX_MAP_DEPTH);
  });

  it('ENTITY_DEPTH_PLAYER is above max map layer depth', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_PLAYER).toBeGreaterThan(MAX_MAP_DEPTH);
  });

  it('ENTITY_DEPTH_PROJECTILES is above max map layer depth', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES).toBeGreaterThan(MAX_MAP_DEPTH);
  });

  it('ENTITY_DEPTH_ORBS is above max map layer depth', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_ORBS).toBeGreaterThan(MAX_MAP_DEPTH);
  });

  it('ENTITY_DEPTH_PLAYER >= ENTITY_DEPTH_ENEMIES (equal is fine for top-down)', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_PLAYER).toBeGreaterThanOrEqual(
      GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES,
    );
  });

  it('ENTITY_DEPTH_ORBS < ENTITY_DEPTH_ENEMIES (orbs below entities)', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_ORBS).toBeLessThan(
      GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES,
    );
  });

  it('ENTITY_DEPTH_PROJECTILES < ENTITY_DEPTH_ENEMIES (projectiles below entities)', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES).toBeLessThan(
      GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES,
    );
  });

  it('Depth hierarchy: orbs < projectiles < enemies <= player', () => {
    expect(GAME_CONSTANTS.ENTITY_DEPTH_ORBS).toBeLessThan(
      GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES,
    );
    expect(GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES).toBeLessThan(
      GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES,
    );
    expect(GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES).toBeLessThanOrEqual(
      GAME_CONSTANTS.ENTITY_DEPTH_PLAYER,
    );
  });

  it('LAYER_DEPTHS in source match expected max of 4 (verified via source text)', async () => {
    // Read PhaserMapLayerBuilder source to confirm LAYER_DEPTHS without importing Phaser
    // @ts-ignore -- node:fs available in vitest runtime
    const nodeFs: { readFileSync(p: string, enc: string): string } = await import('node:fs');
    // @ts-ignore -- node:path available in vitest runtime
    const nodePath: { resolve(...args: string[]): string } = await import('node:path');

    // @ts-ignore -- __dirname available in vitest CJS compat
    const dir: string = __dirname;
    const filePath = nodePath.resolve(dir, '../../map/PhaserMapLayerBuilder.ts');
    const source = nodeFs.readFileSync(filePath, 'utf-8');

    // Extract numeric depth values from the LAYER_DEPTHS object
    const depthMatches = source.match(/(?:ground|liquids|borders|decorations|walls|obstacles):\s*(\d+)/g);
    expect(depthMatches).not.toBeNull();

    const depths = depthMatches!.map((m: string) => parseInt(m.split(':')[1].trim(), 10));
    const maxDepthFromSource = Math.max(...depths);
    expect(maxDepthFromSource).toBe(MAX_MAP_DEPTH);
  });
});
