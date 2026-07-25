import Phaser from 'phaser';
import type { GameModeConfig } from '../types/interfaces';

interface VictoryData {
  totalTime: number;
  maxWave: number;
  enemiesDefeated: number;
  totalXp: number;
  levelReached: number;
  gameMode?: GameModeConfig;
}

/**
 * VictoryScene: Pantalla de victoria (Modo Campaña).
 * Muestra todas las estadísticas de la partida y opción de volver.
 * Requirements: 6.4
 */
export class VictoryScene extends Phaser.Scene {
  private victoryData!: VictoryData;
  private transitionInProgress = false;

  constructor() {
    super({ key: 'VictoryScene' });
  }

  init(data: VictoryData): void {
    this.victoryData = data;
    this.transitionInProgress = false;
  }

  create(): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.add.text(centerX, centerY - 140, '¡VICTORIA!', {
      fontSize: '48px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const minutes = Math.floor(this.victoryData.totalTime / 60);
    const seconds = Math.floor(this.victoryData.totalTime % 60);
    const timeStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    const stats = [
      'Tiempo total: ' + timeStr,
      'Oleada máxima: ' + this.victoryData.maxWave,
      'Enemigos derrotados: ' + this.victoryData.enemiesDefeated,
      'XP total: ' + this.victoryData.totalXp,
      'Nivel alcanzado: ' + this.victoryData.levelReached,
    ];

    stats.forEach((stat, index) => {
      this.add.text(centerX, centerY - 60 + index * 36, stat, {
        fontSize: '22px',
        color: '#ffffff',
      }).setOrigin(0.5);
    });

    // Botón reintentar (jugar de nuevo con mismo modo)
    const retryBtn = this.add.text(centerX, centerY + 140, '[ Jugar de nuevo ]', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      if (this.transitionInProgress) return;
      this.transitionInProgress = true;
      retryBtn.disableInteractive();
      menuBtn.disableInteractive();
      this.scene.start('GameScene', { gameMode: this.victoryData.gameMode });
    });

    // Botón volver al menú
    const menuBtn = this.add.text(centerX, centerY + 200, '[ Volver al menú ]', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

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
