/**
 * Registro centralizado de animaciones de enemigos.
 * Define las animaciones para cada variante (walk, attack, death) de cada enemigo.
 *
 * Para agregar un nuevo enemigo:
 * 1. Asegurarse de que los spritesheets estén definidos en enemy-assets.ts.
 * 2. Añadir las configuraciones de animación aquí.
 *
 * Convención de nombres: `{spriteKey}_{variante}` → e.g. `esqueleto_walk`
 *
 * Los frameRate y rangos de frames son PLACEHOLDERS que deben ajustarse
 * tras inspección visual de cada spritesheet.
 */

import { ENEMY_SPRITESHEETS } from './enemy-assets';
import type { EnemySpriteConfig } from './enemy-assets';

export interface EnemyAnimationConfig {
  /** Clave de la animación (e.g. 'esqueleto_walk'). */
  key: string;
  /** Clave del spritesheet del que provienen los frames. */
  spriteSheetKey: string;
  /** Frame inicial (inclusive). */
  startFrame: number;
  /** Frame final (inclusive). */
  endFrame: number;
  /** Frames por segundo. */
  frameRate: number;
  /** -1 para loop infinito, 0 para una sola reproducción. */
  repeat: number;
}

/**
 * Genera la configuración de animación para una variante de enemigo.
 * @param sprite - La configuración del spritesheet de la variante.
 * @param variant - El tipo de variante (walk, attack, death).
 * @param textureKey - La clave de textura a usar para generateFrameNumbers.
 *                     Para walk, es el spriteKey del enemigo.
 *                     Para attack/death, es el key del spritesheet de la variante.
 */
function buildAnimConfig(
  sprite: EnemySpriteConfig,
  variant: 'walk' | 'attack' | 'death',
  textureKey: string,
): EnemyAnimationConfig {
  const isLooping = variant === 'walk';
  return {
    key: sprite.key,
    spriteSheetKey: textureKey,
    startFrame: 0,
    endFrame: Math.max(0, sprite.frameCount - 1),
    frameRate: variant === 'death' ? 8 : 10,
    repeat: isLooping ? -1 : 0,
  };
}

/**
 * Genera todas las configuraciones de animación para todos los enemigos registrados.
 */
export function getEnemyAnimationConfigs(): EnemyAnimationConfig[] {
  const configs: EnemyAnimationConfig[] = [];

  for (const enemy of ENEMY_SPRITESHEETS) {
    // Walk animation uses the spriteKey as texture (loaded under spriteKey in loadEnemyAssets)
    configs.push(buildAnimConfig(enemy.walk, 'walk', enemy.spriteKey));

    if (enemy.attack) {
      // Attack/death use their own texture keys
      configs.push(buildAnimConfig(enemy.attack, 'attack', enemy.attack.key));
    }

    if (enemy.death) {
      configs.push(buildAnimConfig(enemy.death, 'death', enemy.death.key));
    }
  }

  return configs;
}

/**
 * Registra todas las animaciones de enemigos en el AnimationManager de Phaser.
 * Solo registra animaciones que no existen aún (evita duplicados en hot-reload).
 * Llamar desde BootScene.create() o GameScene.create().
 */
export function registerEnemyAnimations(anims: Phaser.Animations.AnimationManager): void {
  const configs = getEnemyAnimationConfigs();

  for (const config of configs) {
    // Evitar duplicados
    if (anims.exists(config.key)) {
      continue;
    }

    anims.create({
      key: config.key,
      frames: anims.generateFrameNumbers(config.spriteSheetKey, {
        start: config.startFrame,
        end: config.endFrame,
      }),
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  }
}
