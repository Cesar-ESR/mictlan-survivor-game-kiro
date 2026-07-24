import Phaser from 'phaser';
import { GAME_FONT_FAMILY } from '../config/font-config';

interface VictoryData {
  totalTime: number;
  maxWave: number;
  enemiesDefeated: number;
  totalXp: number;
  levelReached: number;
}

export class VictoryScene extends Phaser.Scene {
  private victoryData!: VictoryData;

  constructor() {
    super({ key: 'VictoryScene' });
  }

  init(data: VictoryData): void {
    this.victoryData = data;
  }

  create(): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.add.text(centerX, centerY - 140, 'VICTORIA!', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '48px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const minutes = Math.floor(this.victoryData.totalTime / 60);
    const seconds = Math.floor(this.victoryData.totalTime % 60);
    const timeFormatted = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    const stats = [
      'Tiempo total: ' + timeFormatted,
      'Oleada maxima: ' + this.victoryData.maxWave,
      'Enemigos derrotados: ' + this.victoryData.enemiesDefeated,
      'XP total: ' + this.victoryData.totalXp,
      'Nivel alcanzado: ' + this.victoryData.levelReached,
    ];

    stats.forEach((stat, index) => {
      this.add.text(centerX, centerY - 60 + index * 36, stat, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '22px',
        color: '#ffffff',
      }).setOrigin(0.5);
    });

    const returnBtn = this.add.text(centerX, centerY + 140, '[ Volver ]', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    returnBtn.on('pointerdown', () => {
      this.scene.start('BootScene');
    });
  }
}