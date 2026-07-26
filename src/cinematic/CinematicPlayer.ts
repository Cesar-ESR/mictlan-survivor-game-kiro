/**
 * CinematicPlayer: Motor reutilizable de reproducción de cinemáticas.
 *
 * Interpreta un array de CinematicStep y gestiona:
 * - Cambios de fondo
 * - Splash arts con transiciones fade in/out
 * - Animación de "hablando" (tween escala + movimiento vertical)
 * - Efecto typewriter para diálogos
 * - Texto inmediato para narraciones
 * - Emisión de evento 'cinematic-complete' al finalizar
 *
 * No contiene lógica específica de ninguna cinemática.
 * Todo se define por el JSON proporcionado.
 */

import Phaser from 'phaser';
import type { CinematicData, DialogStep } from './cinematic-types';
import { getSplashArtConfig } from './splash-art-config';

/** Configuración de timing del CinematicPlayer. */
const CONFIG = {
  /** Duración del fade out del splash art (ms). */
  FADE_OUT_DURATION: 200,
  /** Duración del fade in del splash art (ms). */
  FADE_IN_DURATION: 200,
  /** Velocidad del typewriter (ms por carácter). */
  TYPEWRITER_SPEED: 30,
  /** Duración de un ciclo de la animación de hablando (ms). */
  TALKING_ANIM_DURATION: 800,
  /** Variación de escala durante animación de hablando. */
  TALKING_SCALE_DELTA: 0.01,
  /** Variación vertical durante animación de hablando (px). */
  TALKING_Y_DELTA: 2,
};

export class CinematicPlayer {
  private scene: Phaser.Scene;
  private data: CinematicData;
  private currentStepIndex = 0;
  private isTransitioning = false;
  private isTypewriting = false;
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private fullText = '';

  // Current state
  private currentSpeaker: string | null = null;
  private currentPortraitKey: string | null = null;

  // Visual elements (owned by the scene, referenced here)
  private background: Phaser.GameObjects.Image | null = null;
  private splashArt: Phaser.GameObjects.Image | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private dialogText: Phaser.GameObjects.Text | null = null;

  // Tweens
  private talkingTween: Phaser.Tweens.Tween | null = null;
  private splashBaseY = 0;

  constructor(scene: Phaser.Scene, data: CinematicData) {
    this.scene = scene;
    this.data = data;
  }

  /**
   * Inicializa los elementos visuales y comienza la reproducción.
   * Llamar después de crear la escena.
   */
  start(
    background: Phaser.GameObjects.Image,
    splashArt: Phaser.GameObjects.Image,
    nameText: Phaser.GameObjects.Text,
    dialogText: Phaser.GameObjects.Text,
  ): void {
    this.background = background;
    this.splashArt = splashArt;
    this.nameText = nameText;
    this.dialogText = dialogText;

    // Splash art starts hidden
    this.splashArt.setAlpha(0);
    this.splashBaseY = this.splashArt.y;

    // Process first steps (skip background steps automatically)
    this.processCurrentStep();
  }

  /**
   * Avanza al siguiente paso. Llamar cuando el jugador presione continuar.
   * Si el typewriter está activo, primero completa el texto.
   */
  advance(): void {
    if (this.isTransitioning) return;

    // Si el typewriter está en progreso, completar texto inmediatamente
    if (this.isTypewriting) {
      this.completeTypewriter();
      return;
    }

    // Avanzar al siguiente paso
    this.currentStepIndex++;
    if (this.currentStepIndex >= this.data.steps.length) {
      this.onComplete();
      return;
    }

    this.processCurrentStep();
  }

  /** Procesa el paso actual según su tipo. */
  private processCurrentStep(): void {
    const step = this.data.steps[this.currentStepIndex];
    if (!step) {
      this.onComplete();
      return;
    }

    switch (step.type) {
      case 'background':
        this.handleBackground(step.image);
        // Los pasos de background se procesan automáticamente y pasan al siguiente
        this.currentStepIndex++;
        this.processCurrentStep();
        break;
      case 'narration':
        this.handleNarration(step.text);
        break;
      case 'dialog':
        this.handleDialog(step);
        break;
    }
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private handleBackground(imageKey: string): void {
    if (!this.background) return;
    this.background.setTexture(imageKey);
    // Escalar para cubrir toda la pantalla
    const { width, height } = this.scene.cameras.main;
    const scaleX = width / this.background.width;
    const scaleY = height / this.background.height;
    this.background.setScale(Math.max(scaleX, scaleY));
  }

  // ─── Narration ──────────────────────────────────────────────────────────────

  private handleNarration(text: string): void {
    // Ocultar nombre del personaje
    if (this.nameText) {
      this.nameText.setText('');
      this.nameText.setVisible(false);
    }

    // Mostrar texto completo inmediatamente
    if (this.dialogText) {
      this.dialogText.setText(text);
    }

    // Detener animación de hablando (narración = estático)
    this.stopTalkingAnimation();

    // El splash art se mantiene visible si hay un speaker activo (no se oculta entre narraciones).
    // Solo se actualiza currentSpeaker = null si se quiere ocultar explícitamente en el futuro.
    if (!this.currentSpeaker && this.splashArt) {
      this.splashArt.setAlpha(0);
    }
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  private handleDialog(step: DialogStep): void {
    // Mostrar nombre del personaje
    if (this.nameText) {
      this.nameText.setText(step.name);
      this.nameText.setVisible(true);
    }

    // Manejar cambio de splash art
    if (step.portrait !== this.currentPortraitKey) {
      this.transitionSplashArt(step.portrait, step.speaker, step.text);
    } else {
      // Mismo personaje, solo actualizar texto con typewriter
      this.startTypewriter(step.text);
      // Asegurar que la animación de hablando continúa
      if (!this.talkingTween || !this.talkingTween.isPlaying()) {
        this.startTalkingAnimation();
      }
    }
  }

  // ─── Splash Art Transitions ─────────────────────────────────────────────────

  private transitionSplashArt(newPortraitKey: string, newSpeaker: string, text: string): void {
    if (!this.splashArt) return;

    this.isTransitioning = true;

    // Si hay un splash art visible, hacer fade out primero
    if (this.currentPortraitKey && this.splashArt.alpha > 0) {
      this.stopTalkingAnimation();
      this.scene.tweens.add({
        targets: this.splashArt,
        alpha: 0,
        duration: CONFIG.FADE_OUT_DURATION,
        ease: 'Power2',
        onComplete: () => {
          this.showNewSplashArt(newPortraitKey, newSpeaker, text);
        },
      });
    } else {
      // No hay splash art previo, mostrar directamente
      this.showNewSplashArt(newPortraitKey, newSpeaker, text);
    }
  }

  private showNewSplashArt(portraitKey: string, speaker: string, text: string): void {
    if (!this.splashArt) return;

    const config = getSplashArtConfig(portraitKey);
    const { width, height } = this.scene.cameras.main;

    this.splashArt.setTexture(portraitKey);

    // Aplicar origin desde configuración
    this.splashArt.setOrigin(config.originX, config.originY);

    // Calcular escala basada en displayHeightRatio
    const targetHeight = height * config.displayHeightRatio;
    const scale = targetHeight / this.splashArt.height;
    this.splashArt.setScale(scale);

    // Posición base (centro de pantalla, ligeramente arriba) + offsets individuales
    const baseX = width / 2;
    const baseY = this.splashBaseY;
    this.splashArt.setPosition(baseX + config.offsetX, baseY + config.offsetY);

    // Fade in
    this.scene.tweens.add({
      targets: this.splashArt,
      alpha: 1,
      duration: CONFIG.FADE_IN_DURATION,
      ease: 'Power2',
      onComplete: () => {
        this.currentPortraitKey = portraitKey;
        this.currentSpeaker = speaker;
        this.isTransitioning = false;

        // Iniciar typewriter y animación de hablando
        this.startTypewriter(text);
        this.startTalkingAnimation();
      },
    });
  }

  // ─── Talking Animation ──────────────────────────────────────────────────────

  private startTalkingAnimation(): void {
    if (!this.splashArt) return;

    this.stopTalkingAnimation();

    const baseScaleX = this.splashArt.scaleX;
    const baseScaleY = this.splashArt.scaleY;
    const baseY = this.splashArt.y;

    this.talkingTween = this.scene.tweens.add({
      targets: this.splashArt,
      scaleX: baseScaleX + CONFIG.TALKING_SCALE_DELTA,
      scaleY: baseScaleY + CONFIG.TALKING_SCALE_DELTA,
      y: baseY - CONFIG.TALKING_Y_DELTA,
      duration: CONFIG.TALKING_ANIM_DURATION,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private stopTalkingAnimation(): void {
    if (this.talkingTween) {
      this.talkingTween.stop();
      this.talkingTween = null;

      // Resetear a valores correspondientes a la configuración del portrait actual
      if (this.splashArt && this.currentPortraitKey) {
        const config = getSplashArtConfig(this.currentPortraitKey);
        const { width, height } = this.scene.cameras.main;

        const targetHeight = height * config.displayHeightRatio;
        const sourceHeight = this.splashArt.texture.getSourceImage().height;
        if (sourceHeight > 0) {
          const scale = targetHeight / sourceHeight;
          this.splashArt.setScale(scale);
        }

        const baseX = width / 2;
        this.splashArt.setPosition(baseX + config.offsetX, this.splashBaseY + config.offsetY);
      }
    }
  }

  // ─── Typewriter ─────────────────────────────────────────────────────────────

  private startTypewriter(text: string): void {
    if (!this.dialogText) return;

    this.fullText = text;
    this.dialogText.setText('');
    this.isTypewriting = true;

    let charIndex = 0;

    this.typewriterTimer = this.scene.time.addEvent({
      delay: CONFIG.TYPEWRITER_SPEED,
      repeat: text.length - 1,
      callback: () => {
        charIndex++;
        if (this.dialogText) {
          this.dialogText.setText(text.substring(0, charIndex));
        }
        if (charIndex >= text.length) {
          this.isTypewriting = false;
          this.typewriterTimer = null;
        }
      },
    });
  }

  private completeTypewriter(): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }
    if (this.dialogText) {
      this.dialogText.setText(this.fullText);
    }
    this.isTypewriting = false;
  }

  // ─── Completion ─────────────────────────────────────────────────────────────

  private onComplete(): void {
    this.stopTalkingAnimation();
    this.scene.events.emit('cinematic-complete');
  }

  /** Limpieza de recursos al destruir. */
  destroy(): void {
    this.stopTalkingAnimation();
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }
  }
}
