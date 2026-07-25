/**
 * Registro centralizado de assets para el sistema de cinemáticas.
 * Incluye fondos, splash arts y archivos JSON de cinemáticas.
 *
 * Los keys coinciden con los valores usados en los JSON de cinemáticas
 * (campo `image` en BackgroundStep, campo `portrait` en DialogStep).
 *
 * Para agregar un nuevo fondo o splash art:
 * 1. Coloca el PNG en src/assets/BackgroundsLevelsMenu/
 * 2. Agrega una entrada al registro correspondiente aquí.
 * 3. Usa el key en tu JSON de cinemática.
 */

export interface CinematicImageAsset {
  key: string;
  path: string;
}

export interface CinematicJsonAsset {
  key: string;
  path: string;
}

// ─── Fondos ───────────────────────────────────────────────────────────────────

const CINEMATIC_BACKGROUNDS: CinematicImageAsset[] = [
  { key: 'menuBackGround', path: 'src/assets/BackgroundsLevelsMenu/menuBackGround.png' },
  { key: 'BackgroundNivel1Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel1Dialogs.png' },
  { key: 'BackgroundNivel2Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel2Dialogs.png' },
  { key: 'BackgroundNivel3Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel3Dialogs.png' },
  { key: 'BackgroundNivel4Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel4Dialogs.png' },
  { key: 'BackgroundNivel5Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel5Dialogs.png' },
  { key: 'BackgroundNivel6Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel6Dialogs.png' },
  { key: 'BackgroundNivel7Dialogs', path: 'src/assets/BackgroundsLevelsMenu/BackgroundNivel7Dialogs.png' },
];

// ─── Splash Arts ──────────────────────────────────────────────────────────────

const CINEMATIC_SPLASH_ARTS: CinematicImageAsset[] = [
  { key: 'GuerreroJaguarSplashArt', path: 'src/assets/BackgroundsLevelsMenu/GuerreroJaguarSplashArt.png' },
  { key: 'PerroGuiaSplashArt', path: 'src/assets/BackgroundsLevelsMenu/PerroGuiaSplashArt.png' },
  { key: 'Gobernante1', path: 'src/assets/BackgroundsLevelsMenu/Gobernante1.png' },
  { key: 'Gobernante2', path: 'src/assets/BackgroundsLevelsMenu/Gobernante2.png' },
];

// ─── JSON de cinemáticas ──────────────────────────────────────────────────────

const CINEMATIC_JSON_FILES: CinematicJsonAsset[] = [
  { key: 'cinematic_intro_campaign', path: 'src/assets/History/Prologo.json' },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Carga todos los assets requeridos por el sistema de cinemáticas.
 * Llamar desde BootScene.preload().
 */
export function loadCinematicAssets(loader: Phaser.Loader.LoaderPlugin): void {
  for (const bg of CINEMATIC_BACKGROUNDS) {
    loader.image(bg.key, bg.path);
  }
  for (const splash of CINEMATIC_SPLASH_ARTS) {
    loader.image(splash.key, splash.path);
  }
  for (const json of CINEMATIC_JSON_FILES) {
    loader.json(json.key, json.path);
  }
}
