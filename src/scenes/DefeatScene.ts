import Phaser from 'phaser';

interface DefeatData {
  survivalTime: number;
  totalXp: number;
}

/**
 * DefeatScene: Pantalla de derrota.
 * Muestra estadísticas de la partida y opción de reintentar.
 * Requirements: 4.5
 */
export class DefeatScene extends Phaser.Scene {
  private defeatData!: DefeatData;

  constructor() {
    super({ key: 'DefeatScene' });
  }

  init(data: DefeatData): void {
    this.defeatData = data;
  }

  create(): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Título
    this.add.text(centerX, centerY - 100, 'DERROTA', {
      fontSize: '48px',
      color: '#ff2222',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Tiempo de supervivencia formateado MM:SS
    const minutes = Math.floor(this.defeatData.survivalTime / 60);
    const seconds = Math.floor(this.defeatData.survivalTime % 60);
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    this.add.text(centerX, centerY - 30, `Tiempo: ${timeFormatted}`, {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // XP total
    this.add.text(centerX, centerY + 10, `XP Total: ${this.defeatData.totalXp}`, {
      fontSize: '24px',
      color: '#44ff44',
    }).setOrigin(0.5);

    // Botón de reintentar
    const retryBtn = this.add.text(centerX, centerY + 80, '[ Reintentar ]', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.scene.start('BootScene');
    });
  }
}
