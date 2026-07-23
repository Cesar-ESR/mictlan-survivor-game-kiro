import Phaser from 'phaser';
import { TILESET_METADATA, TILE_SIZE } from '../config/tile-catalog-data';

/**
 * BootScene: Carga de assets iniciales y transición a GameScene.
 * Carga los 5 tilesets como spritesheets de 32×32 frames.
 * Implementa timeout de 3 segundos y manejo de errores de carga.
 * Requirements: 1.1, 1.4, 10.14
 */
export class BootScene extends Phaser.Scene {
  private loadFailed = false;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.loadFailed = false;

    // Cargar los 5 tilesets como spritesheets (frames de 32×32)
    for (const meta of TILESET_METADATA) {
      this.load.spritesheet(meta.phaserKey, meta.assetPath, {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
        margin: 0,
        spacing: 0,
      });
    }

    // Timeout de 3 segundos para detectar cargas estancadas
    this.time.delayedCall(3000, () => {
      if (!this.scene.isActive('GameScene')) {
        this.loadFailed = true;
        this.load.reset();
        this.showError('La carga excedió el tiempo límite de 3 segundos.');
      }
    });

    // Escuchar errores de carga de assets
    this.load.on('loaderror', (_file: Phaser.Loader.File) => {
      this.loadFailed = true;
      this.load.reset();
      this.showError('Error al cargar assets del juego.');
    });
  }

  create(): void {
    if (!this.loadFailed) {
      this.scene.start('GameScene');
    }
  }

  private showError(message: string): void {
    // Limpiar cualquier contenido previo
    this.children.removeAll();

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Mensaje de error
    this.add.text(centerX, centerY - 40, message, {
      fontSize: '18px',
      color: '#ff4444',
      align: 'center',
    }).setOrigin(0.5);

    // Botón de reintentar
    const retryBtn = this.add.text(centerX, centerY + 20, '[ Reintentar ]', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
