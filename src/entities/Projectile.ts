import Phaser from 'phaser';

import { GAME_CONSTANTS } from '../config/constants';
import { PLAYER_SPRITES } from '../config/player-assets';

/** Animation key for the projectile impact effect. */
export const PROJECTILE_IMPACT_ANIM_KEY = 'mc_hit_effect_impact';

/**
 * Projectile entity that extends Phaser.Physics.Arcade.Sprite
 * for integration with the physics system and DamageSystem.
 *
 * Projectiles are managed via object pooling in WeaponSystem.
 * They track their distance traveled and are recycled when
 * they exceed the maximum distance (1000px).
 *
 * Uses MC_Hit_Effect spritesheet:
 * - Frame 0: flying state (static)
 * - Frames 1-3: impact animation (single play, then recycle)
 *
 * Requirements: 4.1, 4.6
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number = 0;
  distanceTravelled: number = 0;
  speed: number = 0;

  /** Whether this projectile is in the impact state (no longer deals damage). */
  private impacting = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Listen for impact animation complete to recycle
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onImpactAnimComplete, this);
  }

  /** Returns true if this projectile is currently in the impact animation state. */
  get isImpacting(): boolean {
    return this.impacting;
  }

  /**
   * Activates the projectile at a given position with velocity, damage, and speed.
   * Resets distance traveled and enables physics body.
   * Shows frame 0 (flying state).
   */
  activate(fromX: number, fromY: number, vx: number, vy: number, damage: number, speed: number): void {
    this.setPosition(fromX, fromY);
    this.setVelocity(vx, vy);
    this.damage = damage;
    this.speed = speed;
    this.distanceTravelled = 0;
    this.impacting = false;
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES);

    // Show flying frame (frame 0 of hitEffect spritesheet)
    this.setTexture(PLAYER_SPRITES.hitEffect.key, 0);
    this.setDisplaySize(GAME_CONSTANTS.PROJECTILE_DISPLAY_SIZE, GAME_CONSTANTS.PROJECTILE_DISPLAY_SIZE);
    this.anims.stop();

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = true;
    }
  }

  /**
   * Transitions to impact state: stops movement, disables collisions,
   * and plays the impact animation. On animation complete, recycles.
   */
  playImpact(): void {
    if (this.impacting) return;
    this.impacting = true;

    // Stop movement
    this.setVelocity(0, 0);

    // Disable physics body to prevent further collision checks
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }

    // Play impact animation (frames 1-3)
    if (this.scene.anims.exists(PROJECTILE_IMPACT_ANIM_KEY)) {
      this.play(PROJECTILE_IMPACT_ANIM_KEY);
    } else {
      // Fallback: recycle immediately if animation not registered
      this.recycle();
    }
  }

  /**
   * Deactivates and hides the projectile, stops its velocity,
   * resets distance traveled, and disables its physics body.
   * Returns it to the pool as "dead" for reuse.
   */
  recycle(): void {
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.distanceTravelled = 0;
    this.impacting = false;
    this.anims.stop();

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }
  }

  /**
   * Handler for animation complete — recycles after impact animation finishes.
   */
  private onImpactAnimComplete(animation: Phaser.Animations.Animation): void {
    if (animation.key === PROJECTILE_IMPACT_ANIM_KEY) {
      this.recycle();
    }
  }
}
