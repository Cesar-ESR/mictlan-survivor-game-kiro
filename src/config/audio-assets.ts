/**
 * Registro centralizado de assets de audio (música).
 * Única fuente de verdad para claves, rutas, volumen y loop de cada pista.
 *
 * Para agregar, eliminar o renombrar pistas: modificar únicamente este archivo.
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
  GAMEPLAY_A: {
    key: 'music_gameplay_a',
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
    volume: 0.4,
    loop: true,
  },
  GAMEPLAY_B: {
    key: 'music_gameplay_b',
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
    volume: 0.4,
    loop: true,
  },
  GAMEPLAY_C: {
    key: 'music_gameplay_c',
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
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
    path: 'src/assets/Music/Temple_of_the_Obsidian_Call.mp3',
    volume: 0.5,
    loop: false,
  },
} as const satisfies Record<string, AudioTrackConfig>;

/** Tipo auxiliar para las claves disponibles de música. */
export type MusicTrackKey = keyof typeof MUSIC_TRACKS;

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
