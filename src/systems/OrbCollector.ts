import Phaser from 'phaser';
import { XPOrb } from '../entities/XPOrb';
import { GAME_CONSTANTS } from '../config/constants';
import { calculateOrbAttraction, shouldCollectOrb } from './orb-utils';
import { DEFAULT_XP_ORB_VARIANT } from '../config/xp-orb-assets';
import type { XPOrbVariant } from '../config/xp-orb-assets';

/** Payload emitted by Enemy.onDefeat() */
interface EnemyDefeatedPayload {
  x: number;
  y: number;
  xpReward: number;
  xpOrbVariant?: XPOrbVariant;
}

/**
 * Manages XP orb spawning, attraction, collection, expiration, and pool cap.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 3.4
 */
export class OrbCollector {
  private orbPool: Phaser.GameObjects.Group;
  private attractRadius: number;
  private attractSpeed: number;
  private maxOrbs: number;
  private orbLifetime: number;
  private scene: Phaser.Scene;
  private player: { addXP(value: number): unknown } | null;
  private isDestroyed = false;

  private static readonly COLLECTION_RADIUS = 16;

  /** Stored handler for proper listener removal (BUG-010) */
  private readonly enemyDefeatedHandler = (data: EnemyDefeatedPayload): void => {
    if (this.isDestroyed) return;
    this.spawnOrb({ x: data.x, y: data.y }, data.xpReward, data.xpOrbVariant);
  };

  constructor(scene: Phaser.Scene, player?: { addXP(value: number): unknown }) {
    this.scene = scene;
    this.player = player ?? null;
    this.attractRadius = GAME_CONSTANTS.ORB_ATTRACT_RADIUS;
    this.attractSpeed = GAME_CONSTANTS.ORB_ATTRACT_SPEED;
    this.maxOrbs = GAME_CONSTANTS.MAX_ORBS;
    this.orbLifetime = GAME_CONSTANTS.ORB_LIFETIME * 1000; // convert seconds to ms

    this.orbPool = scene.add.group({
      classType: XPOrb,
      runChildUpdate: false,
    });

    // Listen for enemy defeats to spawn orbs (Subtask 15.3, BUG-010: stored handler)
    this.scene.events.on('enemy-defeated', this.enemyDefeatedHandler);
  }

  /**
   * Spawns an XP orb at the given position with the specified value and visual variant.
   */
  spawnOrb(position: { x: number; y: number }, value: number, variant: XPOrbVariant = DEFAULT_XP_ORB_VARIANT): void {
    if (this.isDestroyed) return;
    const orb = new XPOrb(this.scene, position.x, position.y, value, variant);
    orb.setActive(true);
    orb.setVisible(true);
    this.orbPool.add(orb);
    this.enforceOrbCap();
  }

  /**
   * Main update loop: ages orbs, removes expired, attracts and collects orbs near the player.
   */
  update(delta: number, playerPos: { x: number; y: number }): void {
    if (this.isDestroyed) return;

    // Age all active orbs by delta (ms)
    const allActive = this.orbPool.getChildren().filter(
      (child) => child.active
    ) as XPOrb[];
    for (const orb of allActive) {
      orb.age += delta;
    }

    this.removeExpiredOrbs();

    const activeOrbs = this.orbPool.getChildren().filter(
      (child) => child.active
    ) as XPOrb[];

    for (const orb of activeOrbs) {
      // Check collection first
      if (shouldCollectOrb({ x: orb.x, y: orb.y }, playerPos, OrbCollector.COLLECTION_RADIUS)) {
        this.collectOrb(orb);
        continue;
      }

      // Calculate attraction
      const result = calculateOrbAttraction(
        { x: orb.x, y: orb.y },
        playerPos,
        delta,
        this.attractRadius,
        this.attractSpeed,
      );

      orb.x = result.x;
      orb.y = result.y;
      orb.isAttracted = result.isAttracted;

      // Check if attraction moved orb into collection range
      if (shouldCollectOrb({ x: orb.x, y: orb.y }, playerPos, OrbCollector.COLLECTION_RADIUS)) {
        this.collectOrb(orb);
      }
    }
  }

  /**
   * Returns the number of currently active orbs.
   */
  getActiveOrbCount(): number {
    return this.orbPool.getChildren().filter((child) => child.active).length;
  }

  /**
   * Collects an orb: emits 'orb-collected' event with value.
   * GameScene is responsible for routing XP through XPSystem and LevelUpCoordinator.
   */
  private collectOrb(orb: XPOrb): void {
    const value = orb.value;

    // Emit event for GameScene to handle XP flow via XPSystem
    this.scene.events.emit('orb-collected', { value });

    // Directly add XP to player if reference provided (standalone mode)
    if (this.player) {
      this.player.addXP(value);
    }

    this.deactivateOrb(orb);
  }

  /**
   * Removes orbs that have exceeded their lifetime (30s) based on accumulated delta.
   */
  private removeExpiredOrbs(): void {
    const activeOrbs = this.orbPool.getChildren().filter(
      (child) => child.active
    ) as XPOrb[];

    for (const orb of activeOrbs) {
      if (orb.age >= this.orbLifetime) {
        this.deactivateOrb(orb);
      }
    }
  }

  /**
   * Enforces the maximum orb cap by removing the oldest orbs first (by creationSequence).
   */
  private enforceOrbCap(): void {
    const children = this.orbPool.getChildren() as XPOrb[];
    const activeChildren = children
      .map((orb, index) => ({ orb, index }))
      .filter(({ orb }) => orb.active);

    if (activeChildren.length <= this.maxOrbs) return;

    // Sort by creationSequence ascending (oldest first)
    activeChildren.sort((a, b) => a.orb.creationSequence - b.orb.creationSequence);

    // Remove oldest until within cap
    const toRemove = activeChildren.length - this.maxOrbs;
    for (let i = 0; i < toRemove; i++) {
      this.deactivateOrb(activeChildren[i].orb);
    }
  }

  /**
   * Deactivates and hides an orb, disabling its physics body.
   */
  private deactivateOrb(orb: XPOrb): void {
    orb.setActive(false);
    orb.setVisible(false);
    if (orb.body) {
      orb.body.enable = false;
    }
  }

  /**
   * Cleanup: removes event listener by reference and destroys the orb pool.
   * BUG-010: Uses stored handler reference for precise removal.
   * Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.scene.events.off('enemy-defeated', this.enemyDefeatedHandler);
    this.orbPool.destroy(true);
  }
}
