import Phaser from 'phaser';
import type { GameModeConfig } from '../types/interfaces';
import { createCampaignModeConfig, createInfiniteModeConfig } from './game-mode-utils';

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
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Title
    this.add.text(centerX, centerY - 180, 'Mictlán', {
      fontSize: '56px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(centerX, centerY - 120, 'El honor del guerrero jaguar', {
      fontSize: '20px',
      color: '#cccccc',
    }).setOrigin(0.5);

    // Campaign button
    const campaignBtn = this.add.text(centerX, centerY - 20, '[ Modo Campaña ]', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.add.text(centerX, centerY + 30, 'Sobrevive 10 oleadas y alcanza la victoria', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Infinite button
    const infiniteBtn = this.add.text(centerX, centerY + 80, '[ Modo Infinito ]', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.add.text(centerX, centerY + 130, 'Sobrevive tantas oleadas como puedas', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Hover effects
    for (const btn of [campaignBtn, infiniteBtn]) {
      btn.on('pointerover', () => {
        btn.setStyle({ backgroundColor: '#555555' });
      });
      btn.on('pointerout', () => {
        btn.setStyle({ backgroundColor: '#333333' });
      });
    }

    // Click handlers (prevent double-click)
    campaignBtn.on('pointerdown', () => {
      if (this.hasSelected) return;
      this.hasSelected = true;
      this.startGame(createCampaignModeConfig());
    });

    infiniteBtn.on('pointerdown', () => {
      if (this.hasSelected) return;
      this.hasSelected = true;
      this.startGame(createInfiniteModeConfig());
    });
  }

  private startGame(gameMode: GameModeConfig): void {
    this.scene.start('GameScene', { gameMode });
  }
}
