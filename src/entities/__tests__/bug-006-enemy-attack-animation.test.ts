import { describe, it, expect } from 'vitest';
import {
  ENEMY_SPRITESHEETS,
  getWalkAnimationKey,
  getAttackAnimationKey,
  getEnemySpriteSet,
} from '../../config/enemy-assets';
import { getEnemyAnimationConfigs } from '../../config/enemy-animations';

/**
 * Regression tests for BUG-006: Enemies attack without animation.
 *
 * Validates that:
 * 1. All 4 enemy archetypes have attack animation configs defined.
 * 2. Attack animation keys match expected naming convention.
 * 3. Frame counts are valid (> 0) for all attack animations.
 * 4. Walk and attack animations are distinct keys.
 * 5. Animation configs are generated correctly for attack variants.
 */

describe('BUG-006: Enemy attack animation configuration', () => {
  const allSpriteKeys = [
    'esqueleto_sprite',
    'murcielago_sprite',
    'calavera_llameante_sprite',
    'serpiente_emplumada_sprite',
  ];

  describe('Attack animation config exists for all archetypes', () => {
    it.each(allSpriteKeys)('%s has attack spritesheet defined', (spriteKey) => {
      const spriteSet = getEnemySpriteSet(spriteKey);
      expect(spriteSet).toBeDefined();
      expect(spriteSet!.attack).toBeDefined();
      expect(spriteSet!.attack!.key).toBeTruthy();
      expect(spriteSet!.attack!.path).toBeTruthy();
    });

    it.each(allSpriteKeys)('%s has getAttackAnimationKey returning a value', (spriteKey) => {
      const attackKey = getAttackAnimationKey(spriteKey);
      expect(attackKey).toBeDefined();
      expect(attackKey).toBeTruthy();
    });
  });

  describe('Attack animation frame counts are valid', () => {
    it.each(allSpriteKeys)('%s attack has at least 1 frame', (spriteKey) => {
      const spriteSet = getEnemySpriteSet(spriteKey);
      expect(spriteSet!.attack!.frameCount).toBeGreaterThanOrEqual(1);
    });

    it('calavera_llameante has 5 attack frames (unique among enemies)', () => {
      const spriteSet = getEnemySpriteSet('calavera_llameante_sprite');
      expect(spriteSet!.attack!.frameCount).toBe(5);
    });

    it('esqueleto, murcielago, serpiente have 4 attack frames', () => {
      for (const key of ['esqueleto_sprite', 'murcielago_sprite', 'serpiente_emplumada_sprite']) {
        const spriteSet = getEnemySpriteSet(key);
        expect(spriteSet!.attack!.frameCount).toBe(4);
      }
    });
  });

  describe('Walk and attack animation keys are distinct', () => {
    it.each(allSpriteKeys)('%s walk key differs from attack key', (spriteKey) => {
      const walkKey = getWalkAnimationKey(spriteKey);
      const attackKey = getAttackAnimationKey(spriteKey);
      expect(walkKey).not.toBe(attackKey);
    });
  });

  describe('Animation configs generated correctly for attack variants', () => {
    it('all 4 enemy attack animations appear in generated configs', () => {
      const configs = getEnemyAnimationConfigs();
      const attackConfigs = configs.filter((c) => c.key.includes('_attack'));
      expect(attackConfigs.length).toBe(4);
    });

    it('attack animations have repeat=0 (one-shot, not looping)', () => {
      const configs = getEnemyAnimationConfigs();
      const attackConfigs = configs.filter((c) => c.key.includes('_attack'));
      for (const config of attackConfigs) {
        expect(config.repeat).toBe(0);
      }
    });

    it('walk animations have repeat=-1 (looping)', () => {
      const configs = getEnemyAnimationConfigs();
      const walkConfigs = configs.filter((c) => c.key.includes('_walk'));
      for (const config of walkConfigs) {
        expect(config.repeat).toBe(-1);
      }
    });

    it('attack animations use frameRate=10', () => {
      const configs = getEnemyAnimationConfigs();
      const attackConfigs = configs.filter((c) => c.key.includes('_attack'));
      for (const config of attackConfigs) {
        expect(config.frameRate).toBe(10);
      }
    });
  });

  describe('ENEMY_SPRITESHEETS completeness', () => {
    it('all 4 enemies have walk, attack, and death defined', () => {
      expect(ENEMY_SPRITESHEETS.length).toBe(4);
      for (const enemy of ENEMY_SPRITESHEETS) {
        expect(enemy.walk).toBeDefined();
        expect(enemy.attack).toBeDefined();
        expect(enemy.death).toBeDefined();
      }
    });

    it('all sprite paths point to existing folder patterns', () => {
      for (const enemy of ENEMY_SPRITESHEETS) {
        // Walk path should start with src/assets/
        expect(enemy.walk.path).toMatch(/^src\/assets\//);
        if (enemy.attack) {
          expect(enemy.attack.path).toMatch(/^src\/assets\//);
        }
        if (enemy.death) {
          expect(enemy.death.path).toMatch(/^src\/assets\//);
        }
      }
    });
  });

  describe('getAttackAnimationKey returns undefined for unknown keys', () => {
    it('returns undefined for non-existent sprite key', () => {
      const result = getAttackAnimationKey('nonexistent_sprite');
      expect(result).toBeUndefined();
    });
  });
});
