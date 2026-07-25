import Phaser from 'phaser';
import { TILESET_METADATA, TILE_SIZE } from '../config/tile-catalog-data';
import { loadEnemyAssets } from '../config/enemy-assets';
import { registerEnemyAnimations } from '../config/enemy-animations';
import { loadPlayerAssets } from '../config/player-assets';
import { registerPlayerAnimations } from '../config/player-animations';
import { loadXPOrbAssets } from '../config/xp-orb-assets';
import { loadMenuAssets } from '../config/menu-assets';
import { loadButtonAssets } from '../config/button-assets';
import { loadMusicAssets, loadSFXAssets } from '../config/audio-assets';
import { loadCinematicAssets } from '../cinematic/cinematic-assets';
import { GAME_FONT_FAMILY } from '../config/font-config';

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

    // Cargar spritesheet del jugador (delegado a módulo centralizado)
    loadPlayerAssets(this.load);

    // Cargar assets de la barra de vida
    this.load.image('health_frame', 'src/assets/HealthBarSpritsheets/health_frame.png');
    this.load.image('health_fill', 'src/assets/HealthBarSpritsheets/health_fill.png');
    this.load.image('health_damage', 'src/assets/HealthBarSpritsheets/health_damage.png');
    this.load.image('health_glow', 'src/assets/HealthBarSpritsheets/health_glow.png');

    // Cargar spritesheets de enemigos (delegado a módulo centralizado)
    loadEnemyAssets(this.load);

    // Cargar asset del orbe de experiencia (delegado a módulo centralizado)
    loadXPOrbAssets(this.load);

    // Cargar assets del menú principal (delegado a módulo centralizado)
    loadMenuAssets(this.load);

    // Cargar fondo de pantalla de derrota
    this.load.image('defeat-background', 'src/assets/BackgroundsLevelsMenu/BackgroundNivel6Dialogs.png');

    // Cargar assets modulares del botón (delegado a módulo centralizado)
    loadButtonAssets(this.load);

    // Cargar pistas de música (delegado a módulo centralizado)
    loadMusicAssets(this.load);

    // Cargar efectos de sonido (delegado a módulo centralizado)
    loadSFXAssets(this.load);

    // Cargar assets del sistema de cinemáticas (fondos, splash arts, JSON)
    loadCinematicAssets(this.load);

    // Cargar JSON y assets de bendiciones
    this.load.json('blessings_data', 'src/assets/BendicionesText/BendicionesText.json');
    this.load.image('OrgulloDelInframundo', 'src/assets/Assets bendiciones/OrgulloDelInframundo.png');
    this.load.image('FuriaDelInframundo', 'src/assets/Assets bendiciones/FuriaDelInframundo.png');
    this.load.image('EcoDeLosRecuerdos', 'src/assets/Assets bendiciones/EcoDeLosRecuerdos.png');
    this.load.image('ConsueloDeLaMemoria', 'src/assets/Assets bendiciones/ConsueloDeLaMemoria.png');

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
      // Registrar animaciones (tras carga exitosa de assets)
      registerEnemyAnimations(this.anims);
      registerPlayerAnimations(this.anims);

      this.scene.start('MainMenuScene');
    }
  }

  private showError(message: string): void {
    // Limpiar cualquier contenido previo
    this.children.removeAll();

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Mensaje de error
    this.add.text(centerX, centerY - 40, message, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: '#ff4444',
      align: 'center',
    }).setOrigin(0.5);

    // Botón de reintentar
    const retryBtn = this.add.text(centerX, centerY + 20, '[ Reintentar ]', {
      fontFamily: GAME_FONT_FAMILY,
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
