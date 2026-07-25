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
import { EnemyRegistry } from '../systems/EnemyRegistry';
import { SpawnManager } from '../systems/SpawnManager';
import { WaveManager } from '../systems/WaveManager';
import { WeaponSystem } from '../systems/WeaponSystem';
import type { WeaponConfig } from '../systems/WeaponSystem';
import { hasLineOfSight } from '../systems/line-of-sight';
import { DamageSystem } from '../systems/DamageSystem';
import { OrbCollector } from '../systems/OrbCollector';
import { XPSystem } from '../systems/XPSystem';
import { LevelUpCoordinator } from '../systems/LevelUpCoordinator';
import { PauseSystem } from '../systems/PauseSystem';
import { registerEnemyTypes } from '../entities/enemies';
import { Projectile } from '../entities/Projectile';
import { createInitialMemories } from '../config/memory-upgrades';
import type { MemoryUpgrade } from '../config/memory-upgrades';
import type { GameStats } from '../types/game-stats';
import type { GameModeConfig, WaveChangedPayload } from '../types/interfaces';
import { resolveGameMode } from './game-mode-utils';
import { AudioManager } from '../managers/AudioManager';
import { BlessingManager } from '../managers/BlessingManager';

/** Data passed to GameScene from MainMenuScene or DefeatScene/VictoryScene retry. */
interface GameSceneData {
  gameMode?: GameModeConfig;
}


const { MAP_WIDTH, MAP_HEIGHT } = GAME_CONSTANTS;

/** Safe zone center in pixels (tile 50 * 32px). */
const SAFE_ZONE_CENTER_X = 50 * 32;
const SAFE_ZONE_CENTER_Y = 50 * 32;

/**
 * GameScene: Escena principal del juego.
 * Genera el mapa procedural usando LogicalMapGenerator, construye las 6 capas
 * de Phaser Tilemap via PhaserMapLayerBuilder, configura world bounds y colisiones.
 * Wires all gameplay systems: PlayerManager, WaveManager, SpawnManager,
 * WeaponSystem, DamageSystem, OrbCollector, XPSystem, LevelUpCoordinator, PauseSystem.
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
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.5, 4.2, 4.4, 5.4, 5.5, 6.4, 6.5, 8.3, 10.1, 10.2, 10.6, 10.11, 10.12
 */
export class GameScene extends Phaser.Scene {
  private _mapLayers: MapLayers | null = null;
  private isDebugMode = false;
  private isEnemyDebugMode = false;
  private currentSeed: string = '';
  private debugOverlayText: Phaser.GameObjects.Text | null = null;
  private enemyDebugText: Phaser.GameObjects.Text | null = null;
  private debugCursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private debugWASD: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;

  // Core entities
  private player!: Player;
  private playerManager!: PlayerManager;

  // Enemy systems
  private enemyRegistry!: EnemyRegistry;
  private spawnManager!: SpawnManager;
  private waveManager!: WaveManager;

  // Combat systems
  private weaponSystem!: WeaponSystem;
  private damageSystem!: DamageSystem;

  // XP/Orb systems
  private orbCollector!: OrbCollector;
  private xpSystem!: XPSystem;

  // Level-up and pause
  private levelUpCoordinator!: LevelUpCoordinator;
  private pauseSystem!: PauseSystem;
  private memories!: MemoryUpgrade[];

  // Collider references for cleanup (BUG-001)
  private colliders: Phaser.Physics.Arcade.Collider[] = [];

  // Logical grid reference for walkability checks (BUG-001)
  private logicalGrid: import('../map/MapCell').LogicalMapGrid | null = null;

  // Game mode
  private gameModeConfig: GameModeConfig = { mode: 'campaign', finalWave: 10 };

  // Game state
  private gameState: 'playing' | 'victory' | 'defeat' = 'playing';
  private gameStats: GameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

  /** Access generated map layers (null if generation failed). */
  get mapLayers(): MapLayers | null {
    return this._mapLayers;
  }

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    const urlParams = new URLSearchParams(window.location.search);
    const queryMode = urlParams.get('mode');
    this.gameModeConfig = resolveGameMode(data, queryMode);
  }

  create(): void {
    // Get seed from URL or generate one
    const urlParams = new URLSearchParams(window.location.search);
    this.currentSeed = urlParams.get('seed') || `mictlan-${Date.now()}`;
    this.isDebugMode = this.registry.get('debugMode') === 'map';
    this.isEnemyDebugMode = this.registry.get('debugMode') === 'enemies';

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

    // Store grid reference for walkability checks (BUG-001)
    this.logicalGrid = result.grid;

    // Build Phaser tilemap layers from the logical grid
    const builder = new PhaserMapLayerBuilder();
    this._mapLayers = builder.build(this, result.grid);

    // Configure physics world bounds
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Store generation info for potential debug overlay
    this.registry.set('mapSeed', seed);
    this.registry.set('mapResolvedSeed', result.resolvedSeed);
    this.registry.set('mapAttempts', result.attempts);
    this.registry.set('mapGenerationTimeMs', result.generationTimeMs);

    // Configure camera
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Reproducir música de gameplay (detiene cualquier pista anterior automáticamente)
    AudioManager.getInstance(this).play('GAMEPLAY');

    if (this.isDebugMode) {
      this.setupDebugControls(result);
      // Start camera centered on safe zone
      this.cameras.main.scrollX = SAFE_ZONE_CENTER_X - this.cameras.main.width / 2;
      this.cameras.main.scrollY = SAFE_ZONE_CENTER_Y - this.cameras.main.height / 2;
    }

    // --- 1. Create Player + PlayerManager ---
    this.player = new Player(this, SAFE_ZONE_CENTER_X, SAFE_ZONE_CENTER_Y, 'hero');
    this.player.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_PLAYER);
    this.player.setCollideWorldBounds(true);
    this.playerManager = new PlayerManager(this.player, this);

    // --- 2. EnemyRegistry + registerEnemyTypes ---
    this.enemyRegistry = new EnemyRegistry();
    registerEnemyTypes(this.enemyRegistry);

    // --- 3. SpawnManager ---
    this.spawnManager = new SpawnManager(this, this.enemyRegistry);

    // Provide walkability checker to prevent spawning in blocking liquids (BUG-001)
    if (this.logicalGrid) {
      const grid = this.logicalGrid;
      const gridHeight = grid.length;
      const gridWidth = gridHeight > 0 ? grid[0].length : 0;
      this.spawnManager.setWalkabilityChecker((x, y) => {
        const col = Math.floor(x / 32);
        const row = Math.floor(y / 32);
        if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) return false;
        return grid[row][col].walkable;
      });
    }

    // --- 4. Use stored GameModeConfig (resolved in init) ---

    // --- 5. WaveManager ---
    this.waveManager = new WaveManager(this.gameModeConfig, this.spawnManager, this.events);

    // --- 6. PauseSystem ---
    this.pauseSystem = new PauseSystem();
    this.pauseSystem.setPhysicsController({
      pause: () => this.physics.world.pause(),
      resume: () => this.physics.world.resume(),
    });

    // --- 7. XPSystem ---
    this.xpSystem = new XPSystem();

    // --- 7b. Memory Upgrades (CHANGE-001) ---
    this.memories = createInitialMemories();

    // --- 8. WeaponSystem ---
    const weaponConfig: WeaponConfig = {
      fireRateMs: GAME_CONSTANTS.WEAPON_BASE_FIRE_RATE,
      range: GAME_CONSTANTS.WEAPON_RANGE,
      projectileSpeed: 600,
      maxDistance: GAME_CONSTANTS.PROJECTILE_MAX_DISTANCE,
      damage: GAME_CONSTANTS.WEAPON_BASE_DAMAGE,
      poolSize: 30,
    };
    this.weaponSystem = new WeaponSystem(this, weaponConfig);

    // Connect weapon fire to player attack animation
    this.weaponSystem.setOnFireCallback(() => {
      this.player.playAttack();
    });

    // --- 9. OrbCollector (no player ref — GameScene handles XP flow) ---
    this.orbCollector = new OrbCollector(this);

    // --- 10. DamageSystem ---
    this.damageSystem = new DamageSystem(
      this,
      this.player,
      this.weaponSystem.getProjectilePool(),
      this.spawnManager.getEnemyPool(),
      GAME_CONSTANTS.WEAPON_BASE_DAMAGE,
    );

    // --- 11. LevelUpCoordinator ---
    this.levelUpCoordinator = new LevelUpCoordinator(
      this.memories,
      this.pauseSystem,
      this.events,
      this.player,
      this.weaponSystem,
    );

    // --- 11b. Apply initial blessing passive modifiers (once) ---
    this.applyBlessingModifiers();

    // --- 12. Reset gameStats ---
    this.gameState = 'playing';
    this.gameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

    // --- 13. Configure colliders ---
    // Destroy previous colliders if regenerating
    for (const collider of this.colliders) {
      collider.destroy();
    }
    this.colliders = [];

    if (this._mapLayers) {
      // Player collides with walls and obstacles
      this.colliders.push(this.physics.add.collider(this.player, this._mapLayers.walls));
      this.colliders.push(this.physics.add.collider(this.player, this._mapLayers.obstacles));

      // Player collides with blocking liquids (BUG-001)
      this.colliders.push(this.physics.add.collider(this.player, this._mapLayers.liquids));

      // Enemy group collides with walls and obstacles
      this.colliders.push(this.physics.add.collider(this.spawnManager.getEnemyPool(), this._mapLayers.walls));
      this.colliders.push(this.physics.add.collider(this.spawnManager.getEnemyPool(), this._mapLayers.obstacles));

      // Enemy group collides with blocking liquids (BUG-001)
      this.colliders.push(this.physics.add.collider(this.spawnManager.getEnemyPool(), this._mapLayers.liquids));

      // Projectiles collide with blocking layers (BUG-005)
      const projPool = this.weaponSystem.getProjectilePool();
      const projHitCb = this.onProjectileHitMap as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;
      this.colliders.push(this.physics.add.collider(projPool, this._mapLayers.walls, projHitCb, undefined, this));
      this.colliders.push(this.physics.add.collider(projPool, this._mapLayers.obstacles, projHitCb, undefined, this));
      this.colliders.push(this.physics.add.collider(projPool, this._mapLayers.liquids, projHitCb, undefined, this));
    }

    // Provide line-of-sight checker to WeaponSystem (BUG-005)
    if (this.logicalGrid) {
      const grid = this.logicalGrid;
      const gridHeight = grid.length;
      const gridWidth = gridHeight > 0 ? grid[0].length : 0;

      this.weaponSystem.setLineOfSightChecker((start, end) => {
        return hasLineOfSight(start, end, 32, (col, row) => {
          if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) return true;
          const cell = grid[row][col];
          return cell.wall !== null || cell.obstacle !== null || cell.liquid !== null;
        });
      });
    }

    // --- 14. Register game listeners ---
    this.registerGameListeners();

    // --- 15. Launch HUDScene ---
    if (!this.scene.isActive('HUDScene')) {
      this.scene.launch('HUDScene');
    }

    // Camera follows player, stops at map edges (native Phaser behavior with setBounds)
    if (!this.isDebugMode) {
      this.cameras.main.startFollow(this.player);
    }

    // Setup enemy debug overlay if ?debug=enemies
    if (this.isEnemyDebugMode) {
      this.setupEnemyDebugOverlay();
    }
  }

  /**
   * Registers event listeners for stats tracking, defeat, victory, and XP flow.
   * Called once per generateMap(). Listeners are removed in shutdown().
   */
  private registerGameListeners(): void {
    this.events.on('player-defeated', this.onPlayerDefeated, this);
    this.events.on('victory', this.onVictory, this);
    this.events.on('enemy-defeated', this.onEnemyDefeated, this);
    this.events.on('wave-changed', this.onWaveChanged, this);
    this.events.on('orb-collected', this.onOrbCollected, this);
  }

  /**
   * Reads the blessing selection from BlessingManager and applies
   * initial passive modifiers once at game start.
   *
   * - "orgullo_del_inframundo": +15% damage.
   * - "eco_de_los_recuerdos": +15% max HP (and current HP if at full).
   */
  private applyBlessingModifiers(): void {
    const selection = BlessingManager.getInstance().getSelection();
    if (!selection) return;

    const blessingId = selection.primary.id;

    if (blessingId === 'orgullo_del_inframundo') {
      // +15% damage applied to weapon system
      const baseDamage = GAME_CONSTANTS.WEAPON_BASE_DAMAGE;
      const bonus = Math.floor(baseDamage * 0.15);
      this.weaponSystem.increaseDamage(bonus);
    } else if (blessingId === 'eco_de_los_recuerdos') {
      // +15% max HP (current HP follows if player is at full)
      this.player.applyMaxHpModifier(0.15);
    }
  }

  private onPlayerDefeated = (): void => {
    if (this.gameState !== 'playing') return;
    this.gameState = 'defeat';

    // Stop player movement immediately
    this.player.setVelocity(0, 0);

    // Trigger death animation (hp is already 0, updateAnimation will start death)
    this.player.updateAnimation(false);

    // Wait for death animation to finish before transitioning
    this.player.once('death-animation-complete', this.onDeathAnimationComplete, this);
  };

  /** Transitions to DefeatScene after death animation finishes. */
  private onDeathAnimationComplete = (): void => {
    this.scene.stop('HUDScene');
    this.scene.start('DefeatScene', {
      survivalTime: this.gameStats.survivalTime,
      totalXp: this.player.totalXp,
      gameMode: this.gameModeConfig,
    });
  };

  private onVictory = (): void => {
    if (this.gameState !== 'playing') return;
    this.gameState = 'victory';
    this.scene.stop('HUDScene');
    this.scene.start('VictoryScene', {
      totalTime: this.gameStats.survivalTime,
      maxWave: this.gameStats.maxWave,
      enemiesDefeated: this.gameStats.enemiesDefeated,
      totalXp: this.player.totalXp,
      levelReached: this.player.level,
      gameMode: this.gameModeConfig,
    });
  };

  private onEnemyDefeated = (): void => {
    this.gameStats.enemiesDefeated++;
  };

  private onWaveChanged = (payload: WaveChangedPayload): void => {
    this.gameStats.maxWave = Math.max(this.gameStats.maxWave, payload.wave);
  };

  /**
   * Handles orb collection: routes XP through XPSystem and LevelUpCoordinator.
   * Emits 'xp-changed' to HUD with player state, and 'hp-changed' after upgrades.
   */
  private onOrbCollected = (data: { value: number }): void => {
    // Process XP through XPSystem (which calls player.addXP internally)
    const result = this.xpSystem.addXP(this.player, data.value);

    // Emit XP state to HUD
    this.events.emit(
      'xp-changed',
      this.player.levelXp,
      this.player.xpThreshold,
      this.player.level,
      result.reachedMaxLevel,
    );

    // If leveled up, hand off to LevelUpCoordinator
    if (result.leveledUp && result.showPanel) {
      this.levelUpCoordinator.processLevelUp(result);
    }
  };

  /**
   * Callback when a projectile collides with a map blocking layer (BUG-005).
   * Plays impact animation, then recycles the projectile.
   */
  private onProjectileHitMap(
    projectile: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    if ('playImpact' in projectile && (projectile as Phaser.GameObjects.GameObject).active) {
      (projectile as Projectile).playImpact();
    }
  }

  /**
   * Shutdown: removes all event listeners registered by this scene.
   * Called automatically by Phaser on scene shutdown/restart.
   */
  shutdown(): void {
    this.events.off('player-defeated', this.onPlayerDefeated, this);
    this.events.off('victory', this.onVictory, this);
    this.events.off('enemy-defeated', this.onEnemyDefeated, this);
    this.events.off('wave-changed', this.onWaveChanged, this);
    this.events.off('orb-collected', this.onOrbCollected, this);

    // Remove death animation listener in case shutdown happens during dying state
    this.player?.off('death-animation-complete', this.onDeathAnimationComplete, this);

    // Destroy colliders (BUG-001)
    for (const collider of this.colliders) {
      collider.destroy();
    }
    this.colliders = [];

    // Clear grid reference
    this.logicalGrid = null;

    // Destroy systems with cleanup methods
    this.levelUpCoordinator?.destroy();
    this.pauseSystem?.destroy();
    this.weaponSystem?.destroy();
    this.orbCollector?.destroy();

    // Stop HUD
    if (this.scene.isActive('HUDScene')) {
      this.scene.stop('HUDScene');
    }
    // --- Stats tracking event listeners ---

    // Reset stats on (re)generation
    this.gameStats = { survivalTime: 0, enemiesDefeated: 0, maxWave: 1 };

    // Defeat flow: transition to DefeatScene with stats (Requirement 4.5)
    this.events.on('player-defeated', () => {
      this.scene.start('DefeatScene', {
        survivalTime: this.gameStats.survivalTime,
        totalXp: this.player.totalXp,
      });
    });

    // Victory flow: transition to VictoryScene with full stats (Requirement 6.4)
    this.events.on('victory', () => {
      this.scene.start('VictoryScene', {
        totalTime: this.gameStats.survivalTime,
        maxWave: this.gameStats.maxWave,
        enemiesDefeated: this.gameStats.enemiesDefeated,
        totalXp: this.player.totalXp,
        levelReached: this.player.level,
      });
    });

    // Increment enemies defeated counter
    this.events.on('enemy-defeated', () => {
      this.gameStats.enemiesDefeated++;
    });

    // Update max wave reached
    this.events.on('wave-changed', (wave: number) => {
      this.gameStats.maxWave = Math.max(this.gameStats.maxWave, wave);
    });

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
    // --- End state guard ---
    if (this.gameState !== 'playing') return;

    // --- Pause guard ---
    if (this.pauseSystem.isPaused) return;

    // --- Debug camera movement (no gameplay updates in debug mode) ---
    // Accumulate survival time (when not paused and not in debug mode)
    if (!this.isDebugMode) {
      this.gameStats.survivalTime += _delta / 1000;
    }

    // Debug camera movement
    if (this.isDebugMode && this.debugCursorKeys && this.debugWASD) {
      const speed = 8;
      if (this.debugCursorKeys.left.isDown || this.debugWASD.A.isDown) {
        this.cameras.main.scrollX -= speed;
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
      return; // No gameplay updates in debug mode
    }

    const delta = _delta;
    const playerPos = { x: this.player.x, y: this.player.y };

    // --- System update order (as per design) ---

    // 1. PlayerManager: input → velocity
    this.playerManager.update(delta);

    // 2. WaveManager: wave timer, transitions, config changes
    this.waveManager.update(delta);

    // 3. SpawnManager: spawn timer, despawn distant enemies
    this.spawnManager.update(delta, playerPos, this.cameras.main);

    // 4. Update active enemies (move toward player)
    const enemyChildren = this.spawnManager.getEnemyPool().getChildren();
    const activeEnemies: { x: number; y: number; active: boolean; hp: number }[] = [];
    for (const child of enemyChildren) {
      if (child.active) {
        const enemy = child as unknown as { x: number; y: number; hp: number; active: boolean; update(delta: number, playerPos: { x: number; y: number }): void };
        enemy.update(delta, playerPos);
        activeEnemies.push({ x: enemy.x, y: enemy.y, active: enemy.active, hp: enemy.hp });
      }
    }

    // 5. WeaponSystem: auto-fire toward closest enemy, update projectile distances
    this.weaponSystem.update(delta, playerPos, activeEnemies);

    // 6. DamageSystem: projectile-enemy collisions
    this.damageSystem.checkProjectileEnemyCollisions();

    // 7. DamageSystem: enemy-player contact damage
    this.damageSystem.checkEnemyPlayerCollisions(delta);

    // 8. OrbCollector: attract, collect, expire orbs
    this.orbCollector.update(delta, playerPos);

    // 9. Accumulate survival time and emit to HUD
    this.gameStats.survivalTime += delta / 1000;
    this.events.emit('time-updated', this.gameStats.survivalTime);

    // 10. Update enemy debug overlay
    if (this.isEnemyDebugMode && this.enemyDebugText) {
      this.updateEnemyDebugOverlay();
    }
  }

  /**
   * Enemy debug overlay: shows spawn state when ?debug=enemies
   */
  private setupEnemyDebugOverlay(): void {
    this.enemyDebugText = this.add.text(8, 8, '', {
      fontSize: '12px',
      color: '#ffcc00',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(2000);

    // Key F: force spawn one enemy immediately for diagnostics
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-F', () => {
        // Force a spawn by temporarily setting interval to 0 and calling update
        const playerPos = { x: this.player.x, y: this.player.y };
        this.spawnManager.update(99999, playerPos, this.cameras.main);
      });
    }
  }

  private updateEnemyDebugOverlay(): void {
    if (!this.enemyDebugText) return;
    const activeCount = this.spawnManager.getActiveEnemyCount();
    const wave = this.waveManager.getCurrentWave();
    const state = this.waveManager.getState();
    const info = [
      `[Enemy Debug] ?debug=enemies`,
      `Wave: ${wave} (${state})`,
      `Active Enemies: ${activeCount}`,
      `Registry Types: ${this.enemyRegistry.getRegisteredTypes().join(', ')}`,
      `Player: (${Math.round(this.player.x)}, ${Math.round(this.player.y)})`,
      ``,
      `Press F to force-spawn`,
    ].join('\n');
    this.enemyDebugText.setText(info);
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
