/**
 * Registro centralizado de animaciones del personaje principal.
 * Usa PLAYER_SPRITES como única fuente de verdad.
 *
 * Arquitectura idéntica a enemy-animations.ts.
 */

import { PLAYER_SPRITES } from './player-assets';
import type { PlayerSpriteConfig } from './player-assets';
import { PROJECTILE_IMPACT_ANIM_KEY } from '../entities/Projectile';

export interface PlayerAnimationConfig {
  /** Clave de la animación (e.g. 'mc_idle'). */
  key: string;
  /** Clave de la textura que contiene los frames. */
  textureKey: string;
  startFrame: number;
  endFrame: number;
  frameRate: number;
  /** -1 para loop infinito, 0 para una sola reproducción. */
  repeat: number;
}

/**
 * Genera la configuración de una animación del jugador.
 */
function buildPlayerAnimConfig(
  sprite: PlayerSpriteConfig,
  textureKey: string,
  options: { frameRate: number; repeat: number },
): PlayerAnimationConfig {
  return {
    key: sprite.key,
    textureKey,
    startFrame: 0,
    endFrame: Math.max(0, sprite.frameCount - 1),
    frameRate: options.frameRate,
    repeat: options.repeat,
  };
}

/**
 * Genera todas las configuraciones de animación del personaje principal.
 */
export function getPlayerAnimationConfigs(): PlayerAnimationConfig[] {
  const p = PLAYER_SPRITES;

  return [
    // Idle: loop, uses main spriteKey texture
    buildPlayerAnimConfig(p.idle, p.spriteKey, { frameRate: 4, repeat: -1 }),
    // Walk: loop, uses mc_walk texture
    buildPlayerAnimConfig(p.walk, p.walk.key, { frameRate: 10, repeat: -1 }),
    // Attack: single play, uses mc_attack texture
    buildPlayerAnimConfig(p.attack, p.attack.key, { frameRate: 12, repeat: 0 }),
    // Death: single play, uses mc_death texture
    buildPlayerAnimConfig(p.death, p.death.key, { frameRate: 5, repeat: 0 }),
  ];
}

/**
 * Registra todas las animaciones del personaje principal.
 * Solo registra si no existen aún (evita duplicados).
 * Llamar desde BootScene.create().
 */
export function registerPlayerAnimations(anims: Phaser.Animations.AnimationManager): void {
  const configs = getPlayerAnimationConfigs();

  for (const config of configs) {
    if (anims.exists(config.key)) {
      continue;
    }

    anims.create({
      key: config.key,
      frames: anims.generateFrameNumbers(config.textureKey, {
        start: config.startFrame,
        end: config.endFrame,
      }),
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  }

  // Register projectile impact animation (frames 1-3 of hitEffect spritesheet)
  if (!anims.exists(PROJECTILE_IMPACT_ANIM_KEY)) {
    const hitEffect = PLAYER_SPRITES.hitEffect;
    anims.create({
      key: PROJECTILE_IMPACT_ANIM_KEY,
      frames: anims.generateFrameNumbers(hitEffect.key, {
        start: 1,
        end: hitEffect.frameCount - 1,
      }),
      frameRate: 12,
      repeat: 0,
    });
  }
}
