/**
 * Registro centralizado de assets de orbes de experiencia.
 * Única fuente de verdad para texture keys y rutas de todas las variantes.
 *
 * Arquitectura idéntica a enemy-assets.ts.
 * Preparado para convertirse en spritesheets animados en el futuro.
 *
 * Para agregar una nueva variante:
 * 1. Añadir una entrada a XP_ORB_ASSETS con su id, textureKey y path.
 * 2. El loader registra automáticamente todas las variantes.
 */

/** Identificadores de variante de orbe de XP. */
export type XPOrbVariant = 'common' | 'rare' | 'very_rare' | 'special';

export interface XPOrbAssetConfig {
  /** Identificador único de la variante. */
  id: XPOrbVariant;
  /** Clave de textura usada en Phaser para este orbe. */
  textureKey: string;
  /** Ruta al archivo de imagen del asset. */
  path: string;
  /** variables para el cambio de tamaño */
  scaleX: number;
  scaleY: number;
}

/** Parámetros de la animación de flotación (tween vertical). */
export interface XPOrbFloatConfig {
  /** Amplitud vertical en píxeles (desplazamiento arriba/abajo). */
  amplitude: number;
  /** Duración de medio ciclo en ms (subir o bajar). */
  duration: number;
  /** Easing de Phaser para el movimiento. */
  ease: string;
}

/** Configuración por defecto para la animación de flotación de todos los orbes. */
export const XP_ORB_FLOAT_CONFIG: XPOrbFloatConfig = {
  amplitude: 4,
  duration: 800,
  ease: 'Sine.easeInOut',
};

/**
 * Registro de todas las variantes de orbes de experiencia.
 * Cada entrada define un tipo visual distinto de orbe.
 */
export const XP_ORB_ASSETS: XPOrbAssetConfig[] = [
  {
    id: 'common',
    textureKey: 'xp_orb_common',
    path: 'src/assets/ExpSpritesheets/Exp_Common.png',
    scaleX: 32,
    scaleY: 32,
  },
  {
    id: 'rare',
    textureKey: 'xp_orb_rare',
    path: 'src/assets/ExpSpritesheets/Exp_Rare.png',
    scaleX: 42,
    scaleY: 42,
  },
  {
    id: 'very_rare',
    textureKey: 'xp_orb_very_rare',
    path: 'src/assets/ExpSpritesheets/Exp_Very_Rare.png',
    scaleX: 52,
    scaleY: 52,
  },
  {
    id: 'special',
    textureKey: 'xp_orb_special',
    path: 'src/assets/ExpSpritesheets/Exp_Special.png',
    scaleX: 62,
    scaleY: 62,
  },
];

/** Variante por defecto cuando no se especifica una. */
export const DEFAULT_XP_ORB_VARIANT: XPOrbVariant = 'common';

/**
 * Obtiene la configuración de asset para una variante dada.
 * Retorna la variante por defecto si no se encuentra.
 */
export function getXPOrbAsset(variant: XPOrbVariant = DEFAULT_XP_ORB_VARIANT): XPOrbAssetConfig {
  return XP_ORB_ASSETS.find((a) => a.id === variant) ?? XP_ORB_ASSETS[0];
}

/**
 * Carga todos los assets de orbes de experiencia en el loader de Phaser.
 * Llamar desde BootScene.preload().
 */
export function loadXPOrbAssets(loader: Phaser.Loader.LoaderPlugin): void {
  for (const orbAsset of XP_ORB_ASSETS) {
    loader.image(orbAsset.textureKey, orbAsset.path);
  }
}
