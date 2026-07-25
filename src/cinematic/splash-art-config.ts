/**
 * Configuración visual individual de cada Splash Art.
 *
 * Permite desacoplar la presentación de cada personaje del motor de cinemáticas.
 * CinematicPlayer consulta esta configuración al mostrar un portrait y aplica
 * automáticamente los valores correspondientes.
 *
 * Para agregar un nuevo Splash Art:
 * 1. Registra el asset en cinematic-assets.ts
 * 2. Agrega una entrada a SPLASH_ART_CONFIGS con su key
 * 3. Ajusta displayHeight, offsetX, offsetY, originX, originY según la composición del PNG
 *
 * Los valores se expresan en proporción relativa a la pantalla (0-1) salvo offsets que son px.
 */

/** Configuración visual de un Splash Art individual. */
export interface SplashArtDisplayConfig {
  /**
   * Altura deseada del splash art como fracción de la altura de pantalla.
   * Ejemplo: 0.7 = ocupa 70% de la altura de la cámara.
   * El ancho se calcula automáticamente para conservar la relación de aspecto.
   */
  displayHeightRatio: number;

  /** Desplazamiento horizontal en píxeles desde la posición base (centerX). */
  offsetX: number;

  /** Desplazamiento vertical en píxeles desde la posición base (centerY - 40). */
  offsetY: number;

  /** Origin X del sprite (0 = izquierda, 0.5 = centro, 1 = derecha). */
  originX: number;

  /** Origin Y del sprite (0 = arriba, 0.5 = centro, 1 = abajo). */
  originY: number;
}

/** Configuración por defecto para splash arts sin configuración explícita. */
const DEFAULT_CONFIG: SplashArtDisplayConfig = {
  displayHeightRatio: 0.7,
  offsetX: 0,
  offsetY: 0,
  originX: 0.5,
  originY: 0.5,
};

/**
 * Registro de configuraciones visuales por portrait key.
 * El key debe coincidir con el campo `portrait` del JSON de cinemáticas.
 */
const SPLASH_ART_CONFIGS: Record<string, SplashArtDisplayConfig> = {
  GuerreroJaguarSplashArt: {
    displayHeightRatio: 0.75,
    offsetX: 0,
    offsetY: 0,
    originX: 0.5,
    originY: 0.5,
  },
  PerroGuiaSplashArt: {
    displayHeightRatio: 0.6,
    offsetX: 0,
    offsetY: 20,
    originX: 0.5,
    originY: 0.5,
  },
  Gobernante1: {
    displayHeightRatio: 0.75,
    offsetX: 0,
    offsetY: 0,
    originX: 0.5,
    originY: 0.5,
  },
  Gobernante2: {
    displayHeightRatio: 0.75,
    offsetX: 0,
    offsetY: 0,
    originX: 0.5,
    originY: 0.5,
  },
};

/**
 * Obtiene la configuración visual de un Splash Art.
 * Si el key no tiene configuración explícita, retorna la configuración por defecto.
 */
export function getSplashArtConfig(portraitKey: string): SplashArtDisplayConfig {
  return SPLASH_ART_CONFIGS[portraitKey] ?? DEFAULT_CONFIG;
}
