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
 * BUG-010 V3: Uses a plain array instead of Phaser.GameObjects.Group to avoid
 * scene lifecycle coupling that causes crashes on retry.
 *
 * BUG-012 V5: OrbCollector is the SINGLE authority for orb removal.
 * Key fix: Do NOT call `orb.deactivate()` or `disableBody()` before `destroy()`.
 * Instead: kill tweens via `scene.tweens.killTweensOf(orb)`, then `orb.destroy()`.
 * This ensures Phaser 4's destroy pipeline removes the sprite from the display list
 * and physics world atomically without interference from disableBody.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 3.4
 */
export class OrbCollector {
  private orbs: XPOrb[] = [];
  private readonly attractRadius: number;
  private readonly attractSpeed: number;
  private readonly maxOrbs: number;
  private readonly orbLifetime: number;
  private readonly scene: Phaser.Scene;
  private isDestroyed = false;

  private static readonly COLLECTION_RADIUS = 16;

  /** Stored handler for proper listener removal (BUG-010) */
  private readonly enemyDefeatedHandler = (data: EnemyDefeatedPayload): void => {
    if (this.isDestroyed) return;
    this.spawnOrb({ x: data.x, y: data.y }, data.xpReward, data.xpOrbVariant);
  };

  constructor(scene: Phaser.Scene, _player?: { addXP(value: number): unknown }) {
    this.scene = scene;
    this.attractRadius = GAME_CONSTANTS.ORB_ATTRACT_RADIUS;
    this.attractSpeed = GAME_CONSTANTS.ORB_ATTRACT_SPEED;
    this.maxOrbs = GAME_CONSTANTS.MAX_ORBS;
    this.orbLifetime = GAME_CONSTANTS.ORB_LIFETIME * 1000;

    // BUG-010 V3: No Phaser Group needed — XPOrb adds itself to scene in its constructor.
    // We track orbs in a plain array for iteration/cleanup.

    // Listen for enemy defeats to spawn orbs (BUG-010: stored handler)
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
    this.orbs.push(orb);
    this.enforceOrbCap();
  }

  /**
   * Main update loop: ages orbs, removes expired, attracts and collects orbs near the player.
   * BUG-012 V2: Iterates a snapshot since collectOrb→deactivateOrb modifies the array.
   */
  update(delta: number, playerPos: { x: number; y: number }): void {
    if (this.isDestroyed) return;

    // Age all active orbs by delta (ms)
    for (const orb of this.orbs) {
      if (orb.active) {
        orb.age += delta;
      }
    }

    this.removeExpiredOrbs();

    // Iterate a snapshot since collectOrb→deactivateOrb modifies the array
    const snapshot = [...this.orbs];
    for (const orb of snapshot) {
      if (!orb.active || orb.collected) continue;

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

      // Check if attraction moved orb into collection range (BUG-011: guard against collected)
      if (!orb.collected && shouldCollectOrb({ x: orb.x, y: orb.y }, playerPos, OrbCollector.COLLECTION_RADIUS)) {
        this.collectOrb(orb);
      }
    }
  }

  /**
   * Returns the number of currently active orbs.
   * BUG-012 V2: Destroyed orbs are removed from the array, but expired ones
   * may still be present before removeExpiredOrbs runs, so we still filter.
   */
  getActiveOrbCount(): number {
    return this.orbs.filter((orb) => orb.active && !orb.collected).length;
  }

  /**
   * Collects an orb: uses consume() for single-authority value extraction,
   * then emits 'orb-collected' event and fully removes the orb.
   * BUG-012 V5: Uses orb.consume() which guards against double-collection.
   */
  private collectOrb(orb: XPOrb): void {
    if (orb.collected) return;
    const amount = orb.consume();
    if (amount <= 0) return;

    // Emit event for GameScene to handle XP flow via XPSystem
    this.scene.events.emit('orb-collected', { value: amount });

    this.deactivateOrb(orb);
  }

  /**
   * Removes orbs that have exceeded their lifetime (30s) based on accumulated delta.
   * BUG-012 V2: Iterates backwards since deactivateOrb now splices the array.
   */
  private removeExpiredOrbs(): void {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      if (orb.active && orb.age >= this.orbLifetime) {
        this.deactivateOrb(orb);
      }
    }
  }

  /**
   * Enforces the maximum orb cap by removing the oldest orbs first (by creationSequence).
   */
  private enforceOrbCap(): void {
    const activeOrbs = this.orbs.filter((orb) => orb.active);
    if (activeOrbs.length <= this.maxOrbs) return;

    // Sort by creationSequence ascending (oldest first)
    activeOrbs.sort((a, b) => a.creationSequence - b.creationSequence);

    // Remove oldest until within cap
    const toRemove = activeOrbs.length - this.maxOrbs;
    for (let i = 0; i < toRemove; i++) {
      this.deactivateOrb(activeOrbs[i]);
    }
  }

  /**
   * BUG-012 V5: Single-authority removal. The key fix is:
   * 1. Kill ALL tweens targeting this sprite FIRST (prevents tween callbacks from re-showing)
   * 2. Destroy the game object (removes from display list + physics world atomically)
   * 3. Remove from tracking array
   *
   * CRITICAL: Do NOT call orb.deactivate() / disableBody() before destroy().
   * In Phaser 4, disableBody(true, true) sets active=false which interferes with
   * the destroy() pipeline, leaving the sprite visible in the render list.
   */
  private deactivateOrb(orb: XPOrb): void {
    // Kill ALL tweens targeting this sprite FIRST
    this.scene.tweens.killTweensOf(orb);
    // Destroy the game object (removes from display list + physics world)
    orb.destroy();
    // Remove from tracking array
    const idx = this.orbs.indexOf(orb);
    if (idx !== -1) {
      this.orbs.splice(idx, 1);
    }
  }

  /**
   * Cleanup: removes event listener and destroys all tracked orbs.
   * BUG-010 V3: No Phaser Group to corrupt — just destroys individual sprites
   * and clears the tracking array.
   * BUG-012 V5: killTweensOf + destroy() for each orb guarantees full removal.
   * Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.scene.events.off('enemy-defeated', this.enemyDefeatedHandler);
    for (const orb of this.orbs) {
      this.scene.tweens.killTweensOf(orb);
      orb.destroy();
    }
    this.orbs = [];
  }
}
