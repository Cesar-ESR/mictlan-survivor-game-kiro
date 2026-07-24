import Phaser from 'phaser';
import type { GameModeConfig } from '../types/interfaces';
import { createCampaignModeConfig, createInfiniteModeConfig } from './game-mode-utils';
import { MENU_ASSETS } from '../config/menu-assets';
import { PixelButton } from '../components/PixelButton';
import { FONT_STYLES } from '../config/font-config';
import { AudioManager } from '../managers/AudioManager';

/**
 * MainMenuScene: Pantalla principal con selección de modo de juego.
 * Muestra título, subtítulo y botones para Modo Campaña / Modo Infinito.
 * Requirements: 6.4, 6.5
 */
export class MainMenuScene extends Phaser.Scene {
  private hasSelected = false;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.hasSelected = false;

    // Reproducir música del menú mediante AudioManager
    AudioManager.getInstance(this).play('MENU');

    const centerX = this.cameras.main.centerX;
    const { width, height } = this.cameras.main;

    // Background — added first so it stays behind all UI elements
    const bg = this.add.image(centerX, height / 2, MENU_ASSETS.background.key);
    // Scale to cover the full camera while preserving aspect ratio
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale).setDepth(0);

    // Title — positioned near the top, centered horizontally
    this.add.text(centerX, 60, 'Mictlán', {
      ...FONT_STYLES.title,
    }).setOrigin(0.5);

    // Subtitle — just below the title
    this.add.text(centerX, 100, 'El honor del guerrero jaguar', {
      ...FONT_STYLES.subtitle,
    }).setOrigin(0.5);

    // Buttons aligned to the right side of the screen
    const buttonX = width - 190; // ~20px margin from right edge of button to screen edge
    const buttonStartY = height / 2 - 60;
    const buttonSpacing = 100;

    // Campaign button (using modular PixelButton)
    new PixelButton({
      scene: this,
      x: buttonX,
      y: buttonStartY,
      width: 280,
      text: 'Modo Campaña',
      textStyle: FONT_STYLES.button,
      callback: () => {
        if (this.hasSelected) return;
        this.hasSelected = true;
        AudioManager.getInstance(this).playSFX('CONFIRM');
        this.startGame(createCampaignModeConfig());
      },
    });

    this.add.text(buttonX - 60, buttonStartY + 50, 'Sobrevive 10 oleadas y alcanza la victoria', {
      ...FONT_STYLES.description,
    }).setOrigin(0.5);

    // Infinite button (using modular PixelButton)
    new PixelButton({
      scene: this,
      x: buttonX,
      y: buttonStartY + buttonSpacing,
      width: 280,
      text: 'Modo Infinito',
      textStyle: FONT_STYLES.button,
      callback: () => {
        if (this.hasSelected) return;
        this.hasSelected = true;
        AudioManager.getInstance(this).playSFX('CONFIRM');
        this.startGame(createInfiniteModeConfig());
      },
    });

    this.add.text(buttonX - 35, buttonStartY + buttonSpacing + 50, 'Sobrevive tantas oleadas como puedas', {
      ...FONT_STYLES.description,
    }).setOrigin(0.5);
  }

  private startGame(gameMode: GameModeConfig): void {
    // Fade out de la música del menú antes de cambiar de escena
    AudioManager.getInstance(this).stopWithFadeOut(600, () => {
      this.scene.start('GameScene', { gameMode });
    });
  }
}
