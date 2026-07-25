/**
 * CinematicScene: Escena Phaser dedicada a reproducir cinemáticas.
 *
 * Recibe CinematicSceneData al ser iniciada:
 * - cinematicKey: key del JSON en el cache de Phaser
 * - nextScene: escena a la que transicionar al finalizar
 * - nextSceneData: datos opcionales para la siguiente escena
 *
 * Configura las capas visuales (background, splash art, dialog box, textos)
 * y delega toda la lógica de reproducción al CinematicPlayer.
 *
 * El jugador avanza con click o tecla Space/Enter.
 */

import Phaser from 'phaser';
import type { CinematicSceneData } from '../cinematic/cinematic-types';
import type { CinematicData } from '../cinematic/cinematic-types';
import { CinematicPlayer } from '../cinematic/CinematicPlayer';
import { GAME_FONT_FAMILY } from '../config/font-config';
import { AudioManager } from '../managers/AudioManager';

export class CinematicScene extends Phaser.Scene {
  private cinematicPlayer: CinematicPlayer | null = null;
  private sceneData: CinematicSceneData | null = null;
  private skipButton: Phaser.GameObjects.Text | null = null;
  private isTransitioningToNext = false;

  constructor() {
    super({ key: 'CinematicScene' });
  }

  init(data: CinematicSceneData): void {
    this.sceneData = data;
  }

  create(): void {
    if (!this.sceneData) return;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // ─── Layer 1: Background ────────────────────────────────────────────────
    const background = this.add.image(centerX, centerY, 'menuBackGround');
    const bgScaleX = width / background.width;
    const bgScaleY = height / background.height;
    background.setScale(Math.max(bgScaleX, bgScaleY));
    background.setDepth(0);

    // ─── Layer 2: Splash Art ────────────────────────────────────────────────
    // Centrado, ligeramente arriba del centro para dejar espacio a la caja de diálogo
    const splashArt = this.add.image(centerX, centerY - 80, '__DEFAULT');
    splashArt.setDepth(10);
    splashArt.setAlpha(0);

    // ─── Layer 3: Dialog Box ────────────────────────────────────────────────
    const boxHeight = 160;
    const boxY = height - boxHeight / 2 - 10;
    const dialogBox = this.add.rectangle(centerX, boxY, width - 40, boxHeight, 0x000000, 0.75);
    dialogBox.setDepth(20);
    dialogBox.setStrokeStyle(2, 0x8b6914);

    // ─── Layer 4: Name Text ─────────────────────────────────────────────────
    const nameText = this.add.text(40, height - boxHeight + 10, '', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: '#ffdd00',
      fontStyle: 'bold',
    });
    nameText.setDepth(30);

    // ─── Layer 5: Dialog Text ───────────────────────────────────────────────
    const dialogText = this.add.text(40, height - boxHeight + 35, '', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: width - 80 },
      lineSpacing: 6,
    });
    dialogText.setDepth(30);

    // ─── Layer 6: Continue indicator ────────────────────────────────────────
    const continueText = this.add.text(width - 60, height - 30, '▼', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: '#ffffff',
    });
    continueText.setDepth(30);
    continueText.setAlpha(0.6);
    // Parpadeo sutil del indicador
    this.tweens.add({
      targets: continueText,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ─── Cargar datos de la cinemática ──────────────────────────────────────
    const cinematicData = this.cache.json.get(this.sceneData.cinematicKey) as CinematicData;
    if (!cinematicData) {
      console.error(`[CinematicScene] JSON no encontrado: ${this.sceneData.cinematicKey}`);
      this.transitionToNext();
      return;
    }

    // ─── Reproducir música de cinemática ────────────────────────────────────
    AudioManager.getInstance(this).play('CINEMATIC');

    // ─── Instanciar CinematicPlayer ─────────────────────────────────────────
    this.cinematicPlayer = new CinematicPlayer(this, cinematicData);
    this.cinematicPlayer.start(background, splashArt, nameText, dialogText);

    // ─── Skip Button ────────────────────────────────────────────────────────
    this.createSkipButton();

    // ─── Input: avanzar con click, Space o Enter ────────────────────────────
    this.input.on('pointerdown', this.onAdvance, this);
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', this.onAdvance, this);
      this.input.keyboard.on('keydown-ENTER', this.onAdvance, this);
    }

    // ─── Escuchar evento de finalización ────────────────────────────────────
    this.events.on('cinematic-complete', this.transitionToNext, this);
  }

  private onAdvance = (): void => {
    this.cinematicPlayer?.advance();
  };

  private transitionToNext(): void {
    if (!this.sceneData) return;
    if (this.isTransitioningToNext) return;
    this.isTransitioningToNext = true;

    // Ocultar botón skip
    this.hideSkipButton();

    // Limpiar listeners
    this.input.off('pointerdown', this.onAdvance, this);
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown-SPACE', this.onAdvance, this);
      this.input.keyboard.off('keydown-ENTER', this.onAdvance, this);
    }
    this.events.off('cinematic-complete', this.transitionToNext, this);

    // Destruir player
    this.cinematicPlayer?.destroy();
    this.cinematicPlayer = null;

    // Transicionar a la siguiente escena
    this.scene.start(this.sceneData.nextScene, this.sceneData.nextSceneData);
  }

  private createSkipButton(): void {
    const { width } = this.cameras.main;
    this.skipButton = this.add.text(width - 20, 20, 'Skip', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: '#ffffff',
    })
      .setOrigin(1, 0)
      .setDepth(50)
      .setAlpha(0.7)
      .setInteractive({ useHandCursor: true });

    this.skipButton.on('pointerover', () => {
      this.skipButton?.setAlpha(1.0);
    });
    this.skipButton.on('pointerout', () => {
      this.skipButton?.setAlpha(0.7);
    });
    this.skipButton.on('pointerdown', this.handleSkip, this);
  }

  private handleSkip(): void {
    if (this.isTransitioningToNext) return;

    this.hideSkipButton();

    this.tweens.killAll();
    this.time.removeAllEvents();

    this.transitionToNext();
  }

  private hideSkipButton(): void {
    if (this.skipButton) {
      this.skipButton.disableInteractive();
      this.skipButton.setVisible(false);
    }
  }

  shutdown(): void {
    this.cinematicPlayer?.destroy();
    this.cinematicPlayer = null;
    this.events.off('cinematic-complete', this.transitionToNext, this);
  }
}
