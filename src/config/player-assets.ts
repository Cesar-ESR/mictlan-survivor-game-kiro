/**
 * Registro centralizado de spritesheets del personaje principal.
 * Única fuente de verdad para sprite keys, rutas y animation keys del jugador.
 *
 * Arquitectura idéntica a enemy-assets.ts.
 */

export interface PlayerSpriteConfig {
  /** Clave del spritesheet cargado en Phaser. */
  key: string;
  /** Ruta al archivo PNG del spritesheet. */
  path: string;
  frameWidth: number;
  frameHeight: number;
  /** Cantidad total de frames en el spritesheet. */
  frameCount: number;
}

export interface PlayerSpriteSet {
  /** Clave de textura principal del jugador (usada en el constructor del sprite). */
  spriteKey: string;
  idle: PlayerSpriteConfig;
  walk: PlayerSpriteConfig;
  attack: PlayerSpriteConfig;
  death: PlayerSpriteConfig;
  hitEffect: PlayerSpriteConfig;
}

/**
 * Definición de todos los spritesheets del personaje principal.
 * spriteKey se usa como texture key; idle spritesheet se carga bajo ese nombre.
 */
export const PLAYER_SPRITES: PlayerSpriteSet = {
  spriteKey: 'hero',
  idle: {
    key: 'mc_idle',
    path: 'src/assets/PersonajePrincipalSpritsheets/MC_StandBy.png',
    frameWidth: 250,
    frameHeight: 250,
    frameCount: 4,
  },
  walk: {
    key: 'mc_walk',
    path: 'src/assets/PersonajePrincipalSpritsheets/MC_Walk.png',
    frameWidth: 250,
    frameHeight: 250,
    frameCount: 8,
  },
  attack: {
    key: 'mc_attack',
    path: 'src/assets/PersonajePrincipalSpritsheets/MC_Attack.png',
    frameWidth: 250,
    frameHeight: 250,
    frameCount: 4,
  },
  death: {
    key: 'mc_death',
    path: 'src/assets/PersonajePrincipalSpritsheets/MC_Death.png',
    frameWidth: 250,
    frameHeight: 250,
    frameCount: 4,
  },
  hitEffect: {
    key: 'mc_hit_effect',
    path: 'src/assets/PersonajePrincipalSpritsheets/MC_Hit_Effect.png',
    frameWidth: 250,
    frameHeight: 250,
    frameCount: 4,
  },
};

/**
 * Carga todos los spritesheets del personaje principal.
 * - La textura principal (spriteKey 'hero') se carga desde el idle spritesheet.
 * - Las demás variantes se cargan bajo sus propias claves.
 *
 * Llamar desde BootScene.preload().
 */
export function loadPlayerAssets(loader: Phaser.Loader.LoaderPlugin): void {
  const p = PLAYER_SPRITES;

  // Cargar idle como textura principal bajo spriteKey
  loader.spritesheet(p.spriteKey, p.idle.path, {
    frameWidth: p.idle.frameWidth,
    frameHeight: p.idle.frameHeight,
  });

  // Cargar variantes adicionales bajo sus propias claves
  const variants = [p.walk, p.attack, p.death, p.hitEffect];
  for (const variant of variants) {
    loader.spritesheet(variant.key, variant.path, {
      frameWidth: variant.frameWidth,
      frameHeight: variant.frameHeight,
    });
  }
}
