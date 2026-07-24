import Phaser from 'phaser';

import { GAME_CONSTANTS } from '../config/constants';
import type { EnemyTypeWeight, WaveConfig } from '../types/interfaces';
import type { EnemyRegistry } from './EnemyRegistry';
import { generateSpawnPosition, selectWeightedType, shouldDespawn } from './spawn-utils';
import type { CameraViewport, MapBounds } from './spawn-utils';

/**
 * SpawnManager: gestiona el spawn de enemigos, respetando el límite máximo,
 * despawn por distancia, y selección ponderada de tipos.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.6, 6.2, 9.4
 */
export class SpawnManager {
  private enemyPool: Phaser.Physics.Arcade.Group;
  private spawnTimer: number;
  private spawnInterval: number;
  private maxEnemies: number;
  private despawnDistance: number;
  private enemyTypes: EnemyTypeWeight[];
  private hpMultiplier: number;
  private speedMultiplier: number;
  private enemyRegistry: EnemyRegistry;
  private scene: Phaser.Scene;

  /** Optional walkability checker to prevent spawning in non-walkable tiles (BUG-001). */
  private walkabilityChecker: ((x: number, y: number) => boolean) | null = null;

  private static readonly MAP_BOUNDS: MapBounds = {
    minX: 0,
    minY: 0,
    maxX: GAME_CONSTANTS.MAP_WIDTH,
    maxY: GAME_CONSTANTS.MAP_HEIGHT,
  };

  constructor(scene: Phaser.Scene, enemyRegistry: EnemyRegistry) {
    this.scene = scene;
    this.enemyRegistry = enemyRegistry;
    this.enemyPool = scene.physics.add.group({ runChildUpdate: false });
    this.spawnTimer = 0;
    this.spawnInterval = GAME_CONSTANTS.BASE_SPAWN_INTERVAL;
    this.maxEnemies = GAME_CONSTANTS.DEFAULT_MAX_ENEMIES;
    this.despawnDistance = GAME_CONSTANTS.ENEMY_DESPAWN_DISTANCE;
    this.enemyTypes = [];
    this.hpMultiplier = 1;
    this.speedMultiplier = 1;
  }

  /**
   * Update loop: despawnea enemigos lejanos, acumula timer, intenta spawn.
   * @param delta - tiempo en ms desde el último frame
   * @param playerPos - posición actual del jugador
   * @param camera - cámara principal de la escena
   */
  update(
    delta: number,
    playerPos: { x: number; y: number },
    camera: Phaser.Cameras.Scene2D.Camera,
  ): void {
    // Despawn enemies too far from player every frame
    this.despawnDistantEnemies(playerPos);

    // Accumulate delta into spawn timer
    this.spawnTimer += delta;

    const intervalMs = this.spawnInterval * 1000;
    if (this.spawnTimer >= intervalMs) {
      this.spawnTimer -= intervalMs;
      this.attemptSpawn(camera);
    }
  }

  /**
   * Configura los parámetros de oleada para ajustar el spawn.
   */
  setWaveConfig(config: WaveConfig): void {
    this.spawnInterval = config.spawnInterval;
    this.maxEnemies = config.maxEnemies;
    this.enemyTypes = config.enemyTypes;
    this.hpMultiplier = config.hpMultiplier;
    this.speedMultiplier = config.speedMultiplier;
  }

  /**
   * Retorna la cantidad de enemigos activos en el pool.
   */
  getActiveEnemyCount(): number {
    return this.enemyPool.getChildren().filter((child) => child.active).length;
  }

  /**
   * Retorna el grupo de enemigos para uso externo (colisiones, etc.)
   */
  getEnemyPool(): Phaser.Physics.Arcade.Group {
    return this.enemyPool;
  }

  /**
   * Sets a walkability checker function to prevent spawning in non-walkable tiles.
   * BUG-001: Prevents enemies from spawning inside blocking liquids.
   *
   * @param checker Function that returns true if position (x, y) in pixels is walkable.
   */
  setWalkabilityChecker(checker: (x: number, y: number) => boolean): void {
    this.walkabilityChecker = checker;
  }

  /**
   * Intenta spawnar un enemigo si no se ha alcanzado el cap.
   */
  private attemptSpawn(camera: Phaser.Cameras.Scene2D.Camera): void {
    // Check cap
    if (this.getActiveEnemyCount() >= this.maxEnemies) {
      return;
    }

    // No enemy types configured
    if (this.enemyTypes.length === 0) {
      return;
    }

    const position = this.findValidSpawnPosition(camera);
    if (!position) {
      return;
    }

    // Select enemy type using weighted random
    const type = this.selectEnemyType();

    // Create enemy via registry
    const enemy = this.enemyRegistry.create(type, this.scene, position.x, position.y, {
      hpMultiplier: this.hpMultiplier,
      speedMultiplier: this.speedMultiplier,
    });

    // Add to pool
    this.enemyPool.add(enemy);
  }

  /**
   * Finds a valid spawn position outside the camera viewport but within map bounds.
   * Uses up to 10 attempts. Also checks walkability if a checker is set (BUG-001).
   */
  private findValidSpawnPosition(
    camera: Phaser.Cameras.Scene2D.Camera,
  ): { x: number; y: number } | null {
    const viewport: CameraViewport = {
      x: camera.worldView.x,
      y: camera.worldView.y,
      width: camera.worldView.width,
      height: camera.worldView.height,
    };

    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const pos = generateSpawnPosition(
        viewport,
        SpawnManager.MAP_BOUNDS,
        GAME_CONSTANTS.SPAWN_MIN_DISTANCE_FROM_EDGE,
        GAME_CONSTANTS.SPAWN_MAX_DISTANCE_FROM_EDGE,
        () => Math.random(),
        1, // single attempt per call — we handle retries ourselves
      );

      if (!pos) continue;

      // BUG-001: Check walkability at the generated position
      if (this.walkabilityChecker && !this.walkabilityChecker(pos.x, pos.y)) {
        continue;
      }

      return pos;
    }

    return null;
  }

  /**
   * Despawnea enemigos que están a más de despawnDistance del jugador.
   * NO emite evento 'enemy-defeated' ni otorga XP.
   */
  private despawnDistantEnemies(playerPos: { x: number; y: number }): void {
    const children = this.enemyPool.getChildren();
    for (const child of children) {
      if (!child.active) continue;

      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (shouldDespawn({ x: sprite.x, y: sprite.y }, playerPos, this.despawnDistance)) {
        sprite.setActive(false);
        sprite.setVisible(false);
        if (sprite.body) {
          sprite.body.enable = false;
        }
      }
    }
  }

  /**
   * Selecciona un tipo de enemigo usando selección aleatoria ponderada.
   */
  private selectEnemyType(): string {
    const totalWeight = this.enemyTypes.reduce((sum, entry) => sum + entry.weight, 0);
    const roll = Math.random() * totalWeight;
    return selectWeightedType(this.enemyTypes, roll);
  }
}
