import Phaser from 'phaser';
import { XPOrb } from '../entities/XPOrb';
import { GAME_CONSTANTS } from '../config/constants';
import { calculateOrbAttraction, shouldCollectOrb, isOrbExpired, getOrbsToRemoveForCap } from './orb-utils';

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

  private static readonly COLLECTION_RADIUS = 16;

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

    // Listen for enemy defeats to spawn orbs (Subtask 15.3)
    this.scene.events.on('enemy-defeated', (data: { x: number; y: number; xpReward: number }) => {
      this.spawnOrb({ x: data.x, y: data.y }, data.xpReward);
    });
  }

  /**
   * Spawns an XP orb at the given position with the specified value.
   */
  spawnOrb(position: { x: number; y: number }, value: number): void {
    const orb = new XPOrb(this.scene, position.x, position.y, value);
    orb.setActive(true);
    orb.setVisible(true);
    this.orbPool.add(orb);
    this.enforceOrbCap();
  }

  /**
   * Main update loop: removes expired orbs, attracts and collects orbs near the player.
   */
  update(delta: number, playerPos: { x: number; y: number }): void {
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
   * Collects an orb: emits 'xp-changed' event and optionally calls player.addXP.
   */
  private collectOrb(orb: XPOrb): void {
    const value = orb.value;

    // Emit event for any listeners (XPSystem will use this later)
    this.scene.events.emit('xp-changed', { value });

    // Directly add XP to player if reference provided
    if (this.player) {
      this.player.addXP(value);
    }

    this.deactivateOrb(orb);
  }

  /**
   * Removes orbs that have exceeded their lifetime (30s).
   */
  private removeExpiredOrbs(): void {
    const now = Date.now();
    const activeOrbs = this.orbPool.getChildren().filter(
      (child) => child.active
    ) as XPOrb[];

    for (const orb of activeOrbs) {
      if (isOrbExpired(orb.creationTime, now, this.orbLifetime)) {
        this.deactivateOrb(orb);
      }
    }
  }

  /**
   * Enforces the maximum orb cap by removing the oldest orbs first.
   */
  private enforceOrbCap(): void {
    const children = this.orbPool.getChildren() as XPOrb[];
    const orbStates = children.map((orb) => ({
      creationTime: orb.creationTime,
      active: orb.active,
    }));

    const indicesToRemove = getOrbsToRemoveForCap(orbStates, this.maxOrbs);

    for (const index of indicesToRemove) {
      this.deactivateOrb(children[index]);
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
}
