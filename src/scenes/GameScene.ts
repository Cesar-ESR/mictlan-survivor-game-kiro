import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../config/constants';
import { TILE_CATALOG_DEFINITION } from '../config/tile-catalog-data';
import { TileCatalog } from '../map/TileCatalog';
import { createMapGenerationConfig } from '../map/MapGenerationConfig';
import { LogicalMapGenerator } from '../map/LogicalMapGenerator';
import type { LogicalMapGenerationResult } from '../map/LogicalMapGenerator';
import { PhaserMapLayerBuilder } from '../map/PhaserMapLayerBuilder';
import type { MapLayers } from '../map/PhaserMapLayerBuilder';
import { Player } from '../entities/Player';
import { PlayerManager } from '../systems/PlayerManager';

const { MAP_WIDTH, MAP_HEIGHT } = GAME_CONSTANTS;

/** Safe zone center in pixels (tile 50 * 32px). */
const SAFE_ZONE_CENTER_X = 50 * 32;
const SAFE_ZONE_CENTER_Y = 50 * 32;

/**
 * GameScene: Escena principal del juego.
 * Genera el mapa procedural usando LogicalMapGenerator, construye las 6 capas
 * de Phaser Tilemap via PhaserMapLayerBuilder, configura world bounds y colisiones.
 *
 * When ?debug=map is active:
 * - WASD/arrows move camera
 * - Key C centers camera on safe zone
 * - Keys 1-6 toggle layer visibility
 * - Key R regenerates with same seed
 * - Key N generates new seed
 * - Overlay text shows generation info
 * - Camera starts centered at safe zone center
 *
 * Requirements: 1.1, 1.3, 1.5, 2.5, 10.1, 10.2, 10.11, 10.12
 */
export class GameScene extends Phaser.Scene {
  private isPaused = false;
  private _mapLayers: MapLayers | null = null;
  private isDebugMode = false;
  private currentSeed: string = '';
  private debugOverlayText: Phaser.GameObjects.Text | null = null;
  private debugCursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private debugWASD: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;
  private player!: Player;
  private playerManager!: PlayerManager;

  /** Access generated map layers (null if generation failed). */
  get mapLayers(): MapLayers | null {
    return this._mapLayers;
  }

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Get seed from URL or generate one
    const urlParams = new URLSearchParams(window.location.search);
    this.currentSeed = urlParams.get('seed') || `mictlan-${Date.now()}`;
    this.isDebugMode = this.registry.get('debugMode') === 'map';

    this.generateMap(this.currentSeed);
  }

  private generateMap(seed: string): void {
    // Clean up previous layers if regenerating
    if (this._mapLayers) {
      this._mapLayers.tilemap.destroy();
      this._mapLayers = null;
    }
    if (this.debugOverlayText) {
      this.debugOverlayText.destroy();
      this.debugOverlayText = null;
    }

    // Build catalog and config
    const catalog = new TileCatalog(TILE_CATALOG_DEFINITION);
    const config = createMapGenerationConfig(seed);
    const generator = new LogicalMapGenerator(catalog);

    // Generate the logical map
    const result = generator.generate(config);

    if (!result.success) {
      this.showGenerationError(result);
      return;
    }

    // Build Phaser tilemap layers from the logical grid
    const builder = new PhaserMapLayerBuilder();
    this._mapLayers = builder.build(this, result.grid);

    // Configure physics world bounds
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Launch HUD as overlay scene
    if (!this.scene.isActive('HUDScene')) {
      this.scene.launch('HUDScene');
    }

    // Store generation info for potential debug overlay
    this.registry.set('mapSeed', seed);
    this.registry.set('mapResolvedSeed', result.resolvedSeed);
    this.registry.set('mapAttempts', result.attempts);
    this.registry.set('mapGenerationTimeMs', result.generationTimeMs);

    // Configure camera
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    if (this.isDebugMode) {
      this.setupDebugControls(result);
      // Start camera centered on safe zone
      this.cameras.main.scrollX = SAFE_ZONE_CENTER_X - this.cameras.main.width / 2;
      this.cameras.main.scrollY = SAFE_ZONE_CENTER_Y - this.cameras.main.height / 2;
    }

    // Instanciar Player en el centro del mapa (safe zone center)
    this.player = new Player(this, SAFE_ZONE_CENTER_X, SAFE_ZONE_CENTER_Y, 'hero');
    this.player.setDepth(100);
    this.player.setCollideWorldBounds(true);

    // Inicializar PlayerManager para input y movimiento
    this.playerManager = new PlayerManager(this.player, this);

    // Camera follows player, stops at map edges (native Phaser behavior with setBounds)
    if (!this.isDebugMode) {
      this.cameras.main.startFollow(this.player);
    }

    // TODO: Configurar player/enemies colliders con walls/obstacles layers (Task 5+)
    // TODO: Instanciar sistemas (SpawnManager, WaveManager, etc.) (Task 23)
  }

  private setupDebugControls(result: Extract<LogicalMapGenerationResult, { success: true }>): void {
    // Overlay text (fixed to camera)
    const reachableRatio = result.validation.reachableRatio?.toFixed(3) ?? 'N/A';
    const overlayInfo = [
      `Seed: ${this.currentSeed}`,
      `Attempts: ${result.attempts}`,
      `Reachable: ${reachableRatio}`,
      `Time: ${result.generationTimeMs.toFixed(0)}ms`,
      '',
      'WASD/Arrows: move camera',
      'C: center on safe zone',
      '1-6: toggle layers',
      'R: regen same seed',
      'N: new seed',
    ].join('\n');

    this.debugOverlayText = this.add.text(8, 8, overlayInfo, {
      fontSize: '12px',
      color: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(1000);
    // Input keys
    if (this.input.keyboard) {
      this.debugCursorKeys = this.input.keyboard.createCursorKeys();
      this.debugWASD = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // Key C: center on safe zone
      this.input.keyboard.on('keydown-C', () => {
        this.cameras.main.scrollX = SAFE_ZONE_CENTER_X - this.cameras.main.width / 2;
        this.cameras.main.scrollY = SAFE_ZONE_CENTER_Y - this.cameras.main.height / 2;
      });

      // Key R: regenerate same seed
      this.input.keyboard.on('keydown-R', () => {
        this.generateMap(this.currentSeed);
      });

      // Key N: new seed
      this.input.keyboard.on('keydown-N', () => {
        this.currentSeed = `mictlan-${Date.now()}`;
        this.generateMap(this.currentSeed);
      });

      // Keys 1-6: toggle layer visibility
      this.input.keyboard.on('keydown-ONE', () => { this._mapLayers?.ground.setVisible(!this._mapLayers.ground.visible); });
      this.input.keyboard.on('keydown-TWO', () => { this._mapLayers?.liquids.setVisible(!this._mapLayers.liquids.visible); });
      this.input.keyboard.on('keydown-THREE', () => {
        if (this._mapLayers) {
          const vis = !this._mapLayers.bordersPrimary.visible;
          this._mapLayers.bordersPrimary.setVisible(vis);
          this._mapLayers.bordersSecondary.setVisible(vis);
        }
      });
      this.input.keyboard.on('keydown-FOUR', () => { this._mapLayers?.decorations.setVisible(!this._mapLayers.decorations.visible); });
      this.input.keyboard.on('keydown-FIVE', () => { this._mapLayers?.walls.setVisible(!this._mapLayers.walls.visible); });
      this.input.keyboard.on('keydown-SIX', () => { this._mapLayers?.obstacles.setVisible(!this._mapLayers.obstacles.visible); });
    }
  }

  update(_time: number, _delta: number): void {
    if (this.isPaused) {
      return;
    }

    // Debug camera movement
    if (this.isDebugMode && this.debugCursorKeys && this.debugWASD) {
      const speed = 8;
      if (this.debugCursorKeys.left.isDown || this.debugWASD.A.isDown) {
        this.cameras.main.scrollX -= speed;
//console.log(this.player.depth);

      }
      if (this.debugCursorKeys.right.isDown || this.debugWASD.D.isDown) {
        this.cameras.main.scrollX += speed;
      }
      if (this.debugCursorKeys.up.isDown || this.debugWASD.W.isDown) {
        this.cameras.main.scrollY -= speed;
      }
      if (this.debugCursorKeys.down.isDown || this.debugWASD.S.isDown) {
        this.cameras.main.scrollY += speed;
      }
    }

    // Update player movement when not in debug mode
    if (!this.isDebugMode) {
      this.playerManager.update(_delta);
    }

    // TODO: Delegar actualización a sistemas en orden (Task 23):
    // WaveManager → SpawnManager → Enemies → WeaponSystem → DamageSystem → OrbCollector
  }

  /**
   * Shows a generation error with retry option.
   * Handles both MAX_ATTEMPTS_EXCEEDED and GENERATION_TIMEOUT errors.
   */
  private showGenerationError(
    result: Extract<LogicalMapGenerationResult, { success: false }>,
  ): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // Background overlay
    this.add.rectangle(centerX, centerY, 600, 300, 0x000000, 0.85);

    // Error title
    const errorTitle = result.error === 'GENERATION_TIMEOUT'
      ? 'Generación excedió el tiempo límite'
      : 'No se pudo generar un mapa válido';

    this.add.text(centerX, centerY - 80, errorTitle, {
      fontSize: '20px',
      color: '#ff4444',
      align: 'center',
    }).setOrigin(0.5);

    // Error details
    const details = [
      `Error: ${result.error}`,
      `Intentos: ${result.attempts}`,
      `Tiempo: ${result.generationTimeMs.toFixed(0)}ms`,
    ].join('\n');

    this.add.text(centerX, centerY - 10, details, {
      fontSize: '14px',
      color: '#cccccc',
      align: 'center',
    }).setOrigin(0.5);

    // Retry button
    const retryBtn = this.add.text(centerX, centerY + 60, '[ Reintentar con nueva seed ]', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
