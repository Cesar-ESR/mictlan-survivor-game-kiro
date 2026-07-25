import Phaser from 'phaser';
import type { GameModeConfig } from '../types/interfaces';
import { GAME_FONT_FAMILY } from '../config/font-config';
import { AudioManager } from '../managers/AudioManager';

interface DefeatData {
  survivalTime: number;
  totalXp: number;
  gameMode?: GameModeConfig;
}

/**
 * DefeatScene: Pantalla de derrota.
 * Muestra estadísticas de la partida, opción de reintentar y volver al menú.
 * Requirements: 4.5
 */
export class DefeatScene extends Phaser.Scene {
  private defeatData!: DefeatData;
  private transitionInProgress = false;

  constructor() {
    super({ key: 'DefeatScene' });
  }

  init(data: DefeatData): void {
    this.defeatData = data;
    this.transitionInProgress = false;
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background image — cover strategy (no deformation)
    const bg = this.add.image(centerX, centerY, 'defeat-background');
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);
    bg.setDepth(0);

    // Semi-transparent overlay for text legibility
    const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.35);
    overlay.setDepth(1);

    // Detener música de gameplay y reproducir música de derrota
    AudioManager.getInstance(this).play('DEFEAT');

    // Título
    this.add.text(centerX, centerY - 100, 'DERROTA', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '48px',
      color: '#ff2222',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);

    // Tiempo de supervivencia formateado MM:SS
    const minutes = Math.floor(this.defeatData.survivalTime / 60);
    const seconds = Math.floor(this.defeatData.survivalTime % 60);
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    this.add.text(centerX, centerY - 30, `Tiempo: ${timeFormatted}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(2);

    // XP total
    this.add.text(centerX, centerY + 10, `XP Total: ${this.defeatData.totalXp}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: '#44ff44',
    }).setOrigin(0.5).setDepth(2);

    // Botón de reintentar
    const retryBtn = this.add.text(centerX, centerY + 80, '[ Reintentar ]', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(2);

    retryBtn.on('pointerdown', () => {
      if (this.transitionInProgress) return;
      this.transitionInProgress = true;
      retryBtn.disableInteractive();
      menuBtn.disableInteractive();
      this.scene.start('GameScene', { gameMode: this.defeatData.gameMode });
    });

    // Botón volver al menú
    const menuBtn = this.add.text(centerX, centerY + 140, '[ Volver al menú ]', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(2);

    menuBtn.on('pointerdown', () => {
      if (this.transitionInProgress) return;
      this.transitionInProgress = true;
      retryBtn.disableInteractive();
      menuBtn.disableInteractive();
      if (this.scene.isActive('HUDScene')) {
        this.scene.stop('HUDScene');
      }
      this.scene.start('MainMenuScene');
    });
  }
}
