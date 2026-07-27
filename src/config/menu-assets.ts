/**
 * Registro centralizado de assets del menú principal.
 * Única fuente de verdad para claves y rutas de imágenes del menú.
 *
 * Arquitectura idéntica a enemy-assets.ts / player-assets.ts.
 */

export interface MenuImageConfig {
  /** Clave de la imagen cargada en Phaser. */
  key: string;
  /** Ruta al archivo PNG. */
  path: string;
}

export const MENU_ASSETS = {
  background: {
    key: 'menu_background',
    path: 'src/assets/BackgroundsLevelsMenu/menuBackGround.png',
  } as MenuImageConfig,
};

/**
 * Carga todos los assets del menú principal.
 * Llamar desde BootScene.preload().
 */
export function loadMenuAssets(loader: Phaser.Loader.LoaderPlugin): void {
  loader.image(MENU_ASSETS.background.key, MENU_ASSETS.background.path);
}
