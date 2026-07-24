import { describe, it, expect } from 'vitest';
import {
  ENEMY_SPRITESHEETS,
  getEnemySpriteSet,
  getDeathAnimationKey,
} from '../../config/enemy-assets';
import { getEnemyAnimationConfigs } from '../../config/enemy-animations';

/**
 * Regression tests for BUG-007: Enemies don't play death animation before deactivating.
 *
 * Validates that:
 * 1. All 4 enemy archetypes have death animation configs defined.
 * 2. Death animation keys match expected naming convention.
 * 3. Frame counts are valid (> 0) for all death animations.
 * 4. Death animations are one-shot (repeat=0).
 * 5. getDeathAnimationKey returns correct keys.
 * 6. Death animations use appropriate frame rate.
 */

describe('BUG-007: Enemy death animation configuration', () => {
  const allSpriteKeys = [
    'esqueleto_sprite',
    'murcielago_sprite',
    'calavera_llameante_sprite',
    'serpiente_emplumada_sprite',
  ];

  describe('Death animation config exists for all archetypes', () => {
    it.each(allSpriteKeys)('%s has death spritesheet defined', (spriteKey) => {
      const spriteSet = getEnemySpriteSet(spriteKey);
      expect(spriteSet).toBeDefined();
      expect(spriteSet!.death).toBeDefined();
      expect(spriteSet!.death!.key).toBeTruthy();
      expect(spriteSet!.death!.path).toBeTruthy();
    });

    it.each(allSpriteKeys)('%s has getDeathAnimationKey returning a value', (spriteKey) => {
      const deathKey = getDeathAnimationKey(spriteKey);
      expect(deathKey).toBeDefined();
      expect(deathKey).toBeTruthy();
    });
  });

  describe('Death animation keys follow naming convention', () => {
    it.each(allSpriteKeys)('%s death key follows pattern {name}_death', (spriteKey) => {
      const deathKey = getDeathAnimationKey(spriteKey);
      expect(deathKey).toMatch(/_death$/);
    });

    it('esqueleto death key is esqueleto_death', () => {
      expect(getDeathAnimationKey('esqueleto_sprite')).toBe('esqueleto_death');
    });

    it('murcielago death key is murcielago_death', () => {
      expect(getDeathAnimationKey('murcielago_sprite')).toBe('murcielago_death');
    });

    it('calavera_llameante death key is calavera_llameante_death', () => {
      expect(getDeathAnimationKey('calavera_llameante_sprite')).toBe('calavera_llameante_death');
    });

    it('serpiente_emplumada death key is serpiente_emplumada_death', () => {
      expect(getDeathAnimationKey('serpiente_emplumada_sprite')).toBe('serpiente_emplumada_death');
    });
  });

  describe('Death animation frame counts are valid', () => {
    it.each(allSpriteKeys)('%s death has at least 1 frame', (spriteKey) => {
      const spriteSet = getEnemySpriteSet(spriteKey);
      expect(spriteSet!.death!.frameCount).toBeGreaterThanOrEqual(1);
    });

    it('all 4 enemies have 4 death frames', () => {
      for (const key of allSpriteKeys) {
        const spriteSet = getEnemySpriteSet(key);
        expect(spriteSet!.death!.frameCount).toBe(4);
      }
    });
  });

  describe('Death animations generated correctly in animation configs', () => {
    it('all 4 enemy death animations appear in generated configs', () => {
      const configs = getEnemyAnimationConfigs();
      const deathConfigs = configs.filter((c) => c.key.includes('_death'));
      expect(deathConfigs.length).toBe(4);
    });

    it('death animations have repeat=0 (one-shot, not looping)', () => {
      const configs = getEnemyAnimationConfigs();
      const deathConfigs = configs.filter((c) => c.key.includes('_death'));
      for (const config of deathConfigs) {
        expect(config.repeat).toBe(0);
      }
    });

    it('death animations use frameRate=8', () => {
      const configs = getEnemyAnimationConfigs();
      const deathConfigs = configs.filter((c) => c.key.includes('_death'));
      for (const config of deathConfigs) {
        expect(config.frameRate).toBe(8);
      }
    });
  });

  describe('Death animation keys are distinct from walk and attack', () => {
    it.each(allSpriteKeys)('%s death key differs from walk and attack keys', (spriteKey) => {
      const spriteSet = getEnemySpriteSet(spriteKey);
      const deathKey = spriteSet!.death!.key;
      const walkKey = spriteSet!.walk.key;
      const attackKey = spriteSet!.attack?.key;
      expect(deathKey).not.toBe(walkKey);
      expect(deathKey).not.toBe(attackKey);
    });
  });

  describe('getDeathAnimationKey returns undefined for unknown keys', () => {
    it('returns undefined for non-existent sprite key', () => {
      const result = getDeathAnimationKey('nonexistent_sprite');
      expect(result).toBeUndefined();
    });
  });

  describe('ENEMY_SPRITESHEETS death completeness', () => {
    it('all 4 enemies have death defined in ENEMY_SPRITESHEETS', () => {
      expect(ENEMY_SPRITESHEETS.length).toBe(4);
      for (const enemy of ENEMY_SPRITESHEETS) {
        expect(enemy.death).toBeDefined();
      }
    });

    it('all death sprite paths point to valid asset folders', () => {
      for (const enemy of ENEMY_SPRITESHEETS) {
        expect(enemy.death!.path).toMatch(/^src\/assets\//);
      }
    });
  });
});
