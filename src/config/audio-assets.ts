/**
 * Registro centralizado de assets de audio (música y SFX).
 * Única fuente de verdad para claves, rutas, volumen y loop de cada pista/efecto.
 *
 * Para agregar, eliminar o renombrar pistas o efectos: modificar únicamente este archivo.
 * Todas las escenas consumen audio a través de AudioManager, nunca directamente.
 */

export interface AudioTrackConfig {
  /** Clave única usada por Phaser para identificar el audio. */
  key: string;
  /** Ruta al archivo de audio. */
  path: string;
  /** Volumen por defecto (0 a 1). */
  volume: number;
  /** Si la pista debe reproducirse en bucle. */
  loop: boolean;
}

export interface SFXConfig {
  /** Clave única usada por Phaser para identificar el efecto. */
  key: string;
  /** Ruta al archivo de audio. */
  path: string;
  /** Volumen por defecto (0 a 1). */
  volume: number;
}

/**
 * Catálogo de pistas musicales del juego.
 * Todas apuntan temporalmente al mismo archivo placeholder.
 * Reemplazar cada `path` por la pista definitiva cuando esté disponible.
 */
export const MUSIC_TRACKS = {
  MENU: {
    key: 'music_menu',
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
    volume: 0.5,
    loop: true,
  },
  GAMEPLAY: {
    key: 'music_gameplay',
    path: 'src/assets/Music/Beneath_the_Jaguar_Path.mp3',
    volume: 0.4,
    loop: true,
  },
  BOSS: {
    key: 'music_boss',
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
    volume: 0.6,
    loop: true,
  },
  VICTORY: {
    key: 'music_victory',
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
    volume: 0.5,
    loop: false,
  },
  DEFEAT: {
    key: 'music_defeat',
    path: 'src/assets/Music/Beneath_the_Obsidian_Altar.mp3',
    volume: 0.5,
    loop: false,
  },
  CINEMATIC: {
    key: 'music_cinematic',
    path: 'src/assets/Music/The_Jaguar_s_Vigil.mp3',
    volume: 0.45,
    loop: true,
  },
} as const satisfies Record<string, AudioTrackConfig>;

/** Tipo auxiliar para las claves disponibles de música. */
export type MusicTrackKey = keyof typeof MUSIC_TRACKS;

// ============================================================
// SFX — Efectos de sonido
// ============================================================

/**
 * Catálogo de efectos de sonido del juego.
 * Para agregar un nuevo efecto: añadir una entrada aquí.
 * Los efectos NO hacen loop y permiten múltiples reproducciones simultáneas.
 */
export const SFX_TRACKS = {
  /** Sonido de confirmación / selección. Reutilizable en menú, bendiciones, etc. */
  CONFIRM: {
    key: 'sfx_confirm',
    path: 'src/assets/Music/InicioSound.mp3',
    volume: 0.6,
  },
} as const satisfies Record<string, SFXConfig>;

/** Tipo auxiliar para las claves disponibles de SFX. */
export type SFXTrackKey = keyof typeof SFX_TRACKS;

/**
 * Carga todas las pistas de música en el loader de Phaser.
 * Llamar desde BootScene.preload().
 */
export function loadMusicAssets(loader: Phaser.Loader.LoaderPlugin): void {
  // Usar un Set para evitar cargar el mismo archivo más de una vez
  const loadedPaths = new Set<string>();

  for (const track of Object.values(MUSIC_TRACKS)) {
    if (!loadedPaths.has(track.path)) {
      loader.audio(track.key, track.path);
      loadedPaths.add(track.path);
    } else {
      // Mismo archivo, distinta clave: registrar como alias
      loader.audio(track.key, track.path);
    }
  }
}

/**
 * Carga todos los efectos de sonido en el loader de Phaser.
 * Llamar desde BootScene.preload().
 */
export function loadSFXAssets(loader: Phaser.Loader.LoaderPlugin): void {
  for (const sfx of Object.values(SFX_TRACKS)) {
    loader.audio(sfx.key, sfx.path);
  }
}
