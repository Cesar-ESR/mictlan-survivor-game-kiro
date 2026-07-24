/**
 * Registro centralizado de spritesheets de enemigos.
 * Define rutas, dimensiones de frame y cantidad de frames para cada enemigo.
 *
 * Para agregar un nuevo enemigo:
 * 1. Añadir una entrada a ENEMY_SPRITESHEETS con sus variantes (walk, attack, death).
 * 2. Registrar las animaciones correspondientes en enemy-animations.ts.
 *
 * Los valores de frameWidth/frameHeight/frameCount son PLACEHOLDERS
 * que deben verificarse y ajustarse visualmente por cada spritesheet.
 */

export interface EnemySpriteConfig {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  /** Cantidad total de frames en el spritesheet (para referencia). */
  frameCount: number;
}

export interface EnemySpriteSet {
  /** Sprite key base del enemigo (usado en el constructor del enemigo). */
  spriteKey: string;
  walk: EnemySpriteConfig;
  attack?: EnemySpriteConfig;
  death?: EnemySpriteConfig;
}

/**
 * Definición de todos los spritesheets de enemigos del proyecto.
 * Cada entrada mapea un tipo de enemigo a sus variantes de animación.
 */
export const ENEMY_SPRITESHEETS: EnemySpriteSet[] = [
  {
    spriteKey: 'esqueleto_sprite',
    walk: {
      key: 'esqueleto_walk',
      path: 'src/assets/SkeletonDogSpritsheets/Skeleton_Dog_Walk.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    attack: {
      key: 'esqueleto_attack',
      path: 'src/assets/SkeletonDogSpritsheets/Skeleton_Dog_Attack.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    death: {
      key: 'esqueleto_death',
      path: 'src/assets/SkeletonDogSpritsheets/Skeleton_Dog_Death.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
  },
  {
    spriteKey: 'murcielago_sprite',
    walk: {
      key: 'murcielago_walk',
      path: 'src/assets/SkeletonSpikeSpriteSheets/Skeleton_Spike_Walk.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    attack: {
      key: 'murcielago_attack',
      path: 'src/assets/SkeletonSpikeSpriteSheets/Skeleton_Spike_Attack.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    death: {
      key: 'murcielago_death',
      path: 'src/assets/SkeletonSpikeSpriteSheets/Skeleton_Spike_Death.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
  },
  {
    spriteKey: 'calavera_llameante_sprite',
    walk: {
      key: 'calavera_llameante_walk',
      path: 'src/assets/SkeletonMageSpritesheets/Skeleton_Mage_Walk.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    attack: {
      key: 'calavera_llameante_attack',
      path: 'src/assets/SkeletonMageSpritesheets/Skeleton_Mage_Attack.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 5,
    },
    death: {
      key: 'calavera_llameante_death',
      path: 'src/assets/SkeletonMageSpritesheets/Sketelon_Mage_Death.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
  },
  {
    spriteKey: 'serpiente_emplumada_sprite',
    walk: {
      key: 'serpiente_emplumada_walk',
      path: 'src/assets/SerpienteSpritsheets/serpent_movement.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    attack: {
      key: 'serpiente_emplumada_attack',
      path: 'src/assets/SerpienteSpritsheets/serpent_attack.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
    death: {
      key: 'serpiente_emplumada_death',
      path: 'src/assets/SerpienteSpritsheets/serpent_death.png',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 4,
    },
  },
];

/**
 * Carga todos los spritesheets de enemigos en el loader de Phaser.
 * 
 * Para cada enemigo:
 * - Carga el walk spritesheet bajo el `spriteKey` del enemigo (textura principal usada en el constructor).
 * - Carga variantes adicionales (attack, death) bajo sus propias claves.
 *
 * Llamar desde BootScene.preload().
 */
export function loadEnemyAssets(loader: Phaser.Loader.LoaderPlugin): void {
  for (const enemy of ENEMY_SPRITESHEETS) {
    // Cargar walk spritesheet bajo el spriteKey del enemigo (textura principal)
    loader.spritesheet(enemy.spriteKey, enemy.walk.path, {
      frameWidth: enemy.walk.frameWidth,
      frameHeight: enemy.walk.frameHeight,
    });

    // Cargar variantes adicionales (attack, death) bajo sus propias claves
    const additionalVariants = [enemy.attack, enemy.death].filter(
      (v): v is EnemySpriteConfig => v !== undefined,
    );

    for (const variant of additionalVariants) {
      loader.spritesheet(variant.key, variant.path, {
        frameWidth: variant.frameWidth,
        frameHeight: variant.frameHeight,
      });
    }
  }
}

/**
 * Obtiene la configuración de sprites para un enemigo por su spriteKey.
 * Retorna undefined si no se encuentra.
 */
export function getEnemySpriteSet(spriteKey: string): EnemySpriteSet | undefined {
  return ENEMY_SPRITESHEETS.find((e) => e.spriteKey === spriteKey);
}

/**
 * Obtiene la clave de la animación de walk para un enemigo dado su spriteKey.
 * Retorna la clave del spritesheet de walk (que también es la clave de la animación).
 */
export function getWalkAnimationKey(spriteKey: string): string | undefined {
  const spriteSet = getEnemySpriteSet(spriteKey);
  return spriteSet?.walk.key;
}

/**
 * Obtiene la clave de la animación de attack para un enemigo dado su spriteKey.
 * Retorna undefined si el enemigo no tiene animación de ataque definida.
 */
export function getAttackAnimationKey(spriteKey: string): string | undefined {
  const spriteSet = getEnemySpriteSet(spriteKey);
  return spriteSet?.attack?.key;
}
