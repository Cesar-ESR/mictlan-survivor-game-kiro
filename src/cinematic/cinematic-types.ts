/**
 * Tipos e interfaces del sistema reutilizable de cinemáticas.
 * Toda cinemática se define 100% por datos JSON; no se hardcodea contenido.
 *
 * Campos opcionales marcados con `?` están preparados para extensiones futuras
 * (sonidos, música, cámara, eventos custom, etc.) y se ignoran por ahora.
 */

// ─── Step types ───────────────────────────────────────────────────────────────

/** Paso que cambia el fondo de la escena. */
export interface BackgroundStep {
  type: 'background';
  /** Key del asset de fondo (registrado en cinematic-assets). */
  image: string;
  /** Duración de transición en ms (futuro). */
  transition?: number;
  /** Efecto de cámara al cambiar fondo (futuro). */
  camera?: string;
}

/** Paso de narración: texto completo inmediato, sin portrait ni nombre. */
export interface NarrationStep {
  type: 'narration';
  text: string;
  /** Sonido a reproducir (futuro). */
  sound?: string;
  /** Pausa automática antes del paso en ms (futuro). */
  delay?: number;
}

/** Paso de diálogo: typewriter, splash art, nombre del personaje. */
export interface DialogStep {
  type: 'dialog';
  /** Identificador único del personaje (para comparar si cambió). */
  speaker: string;
  /** Nombre visible del personaje en la caja de diálogo. */
  name: string;
  /** Key del splash art del personaje (registrado en cinematic-assets). */
  portrait: string;
  /** Texto del diálogo. */
  text: string;
  /** Archivo de voz (futuro). */
  voice?: string;
  /** Sonido a reproducir (futuro). */
  sound?: string;
  /** Efecto de cámara (futuro). */
  camera?: string;
  /** Evento custom a emitir (futuro). */
  event?: string;
  /** Pausa automática antes del paso en ms (futuro). */
  delay?: number;
}

/** Union de todos los tipos de pasos soportados. */
export type CinematicStep = BackgroundStep | NarrationStep | DialogStep;

// ─── Data structures ──────────────────────────────────────────────────────────

/** Estructura raíz de un archivo JSON de cinemática. */
export interface CinematicData {
  /** Identificador único de la cinemática. */
  id: string;
  /** Título descriptivo (para debug/logs). */
  title: string;
  /** Array ordenado de pasos a reproducir. */
  steps: CinematicStep[];
  /** Pista musical de fondo (futuro). */
  music?: string;
}

// ─── Scene data ───────────────────────────────────────────────────────────────

/** Datos pasados a CinematicScene al iniciarla. */
export interface CinematicSceneData {
  /** Key del JSON de cinemática cargado en el cache de Phaser. */
  cinematicKey: string;
  /** Key de la escena a la que transicionar al finalizar. */
  nextScene: string;
  /** Datos opcionales para pasar a la siguiente escena. */
  nextSceneData?: Record<string, unknown>;
}
