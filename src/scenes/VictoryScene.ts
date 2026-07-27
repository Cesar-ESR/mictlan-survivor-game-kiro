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
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background image
    const bg = this.add.image(centerX, centerY, 'victory-background');
    bg.setDisplaySize(width, height);

    this.add.text(centerX, centerY - 160, 'El viaje ha terminado', {
      fontSize: '36px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const message = [
      'Has logrado abandonar el Mictlán.',
      '',
      'Este proyecto es un homenaje a la riqueza cultural de México',
      'y está inspirado en la cosmovisión mexica. Nuestro propósito',
      'es despertar la curiosidad por conocer y preservar el legado',
      'de nuestros pueblos originarios.',
      '',
      'Gracias por recorrer este camino.',
    ];

    this.add.text(centerX, centerY - 40, message.join('\n'), {
      fontSize: '18px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);

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
