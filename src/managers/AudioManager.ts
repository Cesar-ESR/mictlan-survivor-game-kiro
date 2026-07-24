import Phaser from 'phaser';
import { MUSIC_TRACKS, type MusicTrackKey } from '../config/audio-assets';

/**
 * AudioManager: Singleton encargado de toda la reproducción musical del juego.
 *
 * Responsabilidades:
 * - Reproducir / detener / cambiar pistas de música.
 * - Garantizar una única instancia reproduciéndose a la vez.
 * - Controlar volumen y realizar fade in / fade out.
 * - Evitar reinicios innecesarios si la pista solicitada ya está sonando.
 *
 * Las escenas NUNCA deben usar this.sound directamente para música.
 * Toda reproducción musical pasa por AudioManager.
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  private scene: Phaser.Scene;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentTrackKey: string | null = null;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Obtiene (o crea) la instancia singleton del AudioManager.
   * Debe llamarse con la escena activa actual para acceder al sound manager.
   */
  static getInstance(scene: Phaser.Scene): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager(scene);
    } else {
      // Actualizar referencia de escena para mantener acceso al sound manager activo
      AudioManager.instance.scene = scene;
    }
    return AudioManager.instance;
  }

  /**
   * Reproduce una pista de música por su clave del catálogo.
   * Si la misma pista ya se está reproduciendo, no reinicia.
   * Si hay otra pista sonando, la detiene antes de iniciar la nueva.
   */
  play(trackName: MusicTrackKey): void {
    const trackConfig = MUSIC_TRACKS[trackName];

    // Evitar reinicio si ya está reproduciendo la misma pista
    if (this.currentTrackKey === trackConfig.key && this.currentMusic && this.isPlaying()) {
      return;
    }

    // Detener pista anterior si existe
    this.stopImmediate();

    // Crear y reproducir la nueva pista
    this.currentMusic = this.scene.sound.add(trackConfig.key, {
      volume: trackConfig.volume,
      loop: trackConfig.loop,
    });
    this.currentMusic.play();
    this.currentTrackKey = trackConfig.key;
  }

  /**
   * Reproduce una pista con fade in.
   * @param trackName Clave de la pista en MUSIC_TRACKS.
   * @param duration Duración del fade in en milisegundos (default: 1000).
   */
  playWithFadeIn(trackName: MusicTrackKey, duration = 1000): void {
    const trackConfig = MUSIC_TRACKS[trackName];

    if (this.currentTrackKey === trackConfig.key && this.currentMusic && this.isPlaying()) {
      return;
    }

    this.stopImmediate();

    this.currentMusic = this.scene.sound.add(trackConfig.key, {
      volume: 0,
      loop: trackConfig.loop,
    });
    this.currentMusic.play();
    this.currentTrackKey = trackConfig.key;

    // Fade in usando tween del scene
    this.scene.tweens.add({
      targets: this.currentMusic,
      volume: trackConfig.volume,
      duration,
      ease: 'Linear',
    });
  }

  /**
   * Detiene la música actual con fade out.
   * @param duration Duración del fade out en milisegundos (default: 800).
   * @param onComplete Callback opcional al finalizar el fade out.
   */
  stopWithFadeOut(duration = 800, onComplete?: () => void): void {
    if (!this.currentMusic || !this.isPlaying()) {
      this.currentTrackKey = null;
      onComplete?.();
      return;
    }

    const musicRef = this.currentMusic;
    this.scene.tweens.add({
      targets: musicRef,
      volume: 0,
      duration,
      ease: 'Linear',
      onComplete: () => {
        musicRef.stop();
        musicRef.destroy();
        onComplete?.();
      },
    });

    this.currentMusic = null;
    this.currentTrackKey = null;
  }

  /**
   * Detiene la música inmediatamente sin fade.
   */
  stop(): void {
    this.stopImmediate();
  }

  /**
   * Cambia a otra pista realizando crossfade (fade out → fade in).
   * @param trackName Nueva pista a reproducir.
   * @param fadeOutDuration Duración del fade out (ms).
   * @param fadeInDuration Duración del fade in (ms).
   */
  crossfadeTo(trackName: MusicTrackKey, fadeOutDuration = 800, fadeInDuration = 1000): void {
    const trackConfig = MUSIC_TRACKS[trackName];

    // No cambiar si es la misma pista
    if (this.currentTrackKey === trackConfig.key && this.isPlaying()) {
      return;
    }

    this.stopWithFadeOut(fadeOutDuration, () => {
      this.playWithFadeIn(trackName, fadeInDuration);
    });
  }

  /**
   * Ajusta el volumen de la pista actual.
   * @param volume Valor entre 0 y 1.
   */
  setVolume(volume: number): void {
    if (this.currentMusic && 'volume' in this.currentMusic) {
      (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(
        Math.max(0, Math.min(1, volume)),
      );
    }
  }

  /**
   * Indica si actualmente hay música reproduciéndose.
   */
  isPlaying(): boolean {
    return this.currentMusic?.isPlaying ?? false;
  }

  /**
   * Devuelve la clave interna de la pista actualmente en reproducción, o null.
   */
  getCurrentTrackKey(): string | null {
    return this.currentTrackKey;
  }

  // --- Helpers privados ---

  private stopImmediate(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
    }
    this.currentTrackKey = null;
  }
}
