import Phaser from 'phaser';

import { GAME_CONSTANTS } from '../config/constants';
import type { IEnemy } from '../types/interfaces';
import { DEFAULT_XP_ORB_VARIANT } from '../config/xp-orb-assets';
import type { XPOrbVariant } from '../config/xp-orb-assets';

/**
 * Animation state for the enemy state machine (BUG-006).
 * - 'moving': default state, walk animation loops
 * - 'attacking': attack animation playing (one-shot)
 * - 'dying': death sequence, no interruption allowed
 */
export type EnemyAnimState = 'moving' | 'attacking' | 'dying';

/**
 * Abstract base class for all enemy entities in Mictlán Survivor.
 * Extends Phaser Arcade Sprite and implements common enemy behavior.
 *
 * Subclasses must set hp, maxHp, speed, damage, xpReward in their constructor
 * and implement the update() method for their specific movement/behavior.
 *
 * Requirements: 9.2, 9.3
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite implements IEnemy {
  declare hp: number;
  declare maxHp: number;
  declare speed: number;
  declare damage: number;
  declare xpReward: number;
  /** Variante de orbe de XP que genera este enemigo al ser derrotado. */
  xpOrbVariant: XPOrbVariant = DEFAULT_XP_ORB_VARIANT;

  /** Current animation state (BUG-006). */
  protected animState: EnemyAnimState = 'moving';
  /** Walk animation key set by subclass. */
  protected walkAnimKey: string = '';
  /** Attack animation key set by subclass. */
  protected attackAnimKey: string = '';
  /** Death animation key set by subclass (BUG-007). */
  protected deathAnimKey: string = '';
  /** Guard to prevent double-emit of defeat event (BUG-007). */
  private defeatEmitted: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(0.45);
    this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_ENEMIES);
    this.setScale(0.25);
  }

  abstract update(delta: number, playerPos: { x: number; y: number }): void;

  /**
   * Subclass-specific behavior called every frame.
   * Implementations should move the enemy toward or relative to the player.
   */
  abstract update(delta: number, playerPos: Phaser.Math.Vector2): void;

  /**
   * Returns the current animation state.
   */
  getAnimState(): EnemyAnimState {
    return this.animState;
  }

  /**
   * Plays the attack animation once when contact damage is applied.
   * Called by DamageSystem when this enemy deals valid contact damage.
   * Does nothing if enemy is already attacking or dying.
   *
   * BUG-006: Enemies attack without animation
   */
  playAttackAnimation(targetX?: number): void {
    if (!this.active) return;
    if (this.animState === 'dying') return;
    if (this.animState === 'attacking') return;

    // Flip toward player
    if (targetX !== undefined) {
      this.setFlipX(targetX > this.x);
    }

    this.animState = 'attacking';

    // Play attack animation if registered and exists
    if (this.attackAnimKey && this.scene.anims.exists(this.attackAnimKey)) {
      this.play(this.attackAnimKey);
      this.once('animationcomplete', this.onAttackAnimComplete, this);
    } else {
      // No attack anim available — return to moving immediately
      this.animState = 'moving';
    }
  }

  /**
   * Handler for when attack animation completes. Resumes walk animation.
   */
  private onAttackAnimComplete(): void {
    if (this.animState === 'attacking') {
      this.animState = 'moving';
      // Resume walk animation
      if (this.walkAnimKey && this.scene.anims.exists(this.walkAnimKey)) {
        this.play(this.walkAnimKey);
      }
    }
  }

  /**
   * Updates the horizontal facing direction toward the player.
   * Flips the sprite when the player is to the left.
   * Call this from subclass update() after movement is applied.
   */
  protected updateFacing(playerPos: { x: number; y: number }): void {
    this.setFlipX(playerPos.x > this.x);
  }

  /**
   * Reduces HP by the given amount. If HP drops to 0 or below, triggers onDefeat().
   */
  takeDamage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.onDefeat();
    }
  }

  /**
   * Handles enemy defeat: sets dying state, emits event, disables physics,
   * plays death animation, then deactivates sprite on animation complete.
   * If no death animation is available, deactivates immediately.
   *
   * BUG-007: Play death animation before deactivating.
   */
  onDefeat(): void {
    // Guard against double-kill (e.g. multiple projectiles in same frame)
    if (this.animState === 'dying') return;

    this.animState = 'dying';
    this.setVelocity(0, 0);

    // Disable physics body immediately (no more collisions)
    if (this.body) {
      this.body.enable = false;
    }

    // Emit defeat event once (XP orb spawns, stats increment)
    if (!this.defeatEmitted) {
      this.defeatEmitted = true;
      this.scene.events.emit('enemy-defeated', {
        x: this.x,
        y: this.y,
        xpReward: this.xpReward,
        xpOrbVariant: this.xpOrbVariant,
      });
    }

    // Play death animation if available
    if (this.deathAnimKey && this.scene.anims.exists(this.deathAnimKey)) {
      this.play(this.deathAnimKey);
      this.once('animationcomplete', this.finishDeath, this);
    } else {
      // No death anim — hide immediately
      this.finishDeath();
    }
  }

  /**
   * Called after death animation completes (or immediately if no anim).
   * Performs the actual sprite deactivation/hiding.
   *
   * BUG-007: Separated from onDefeat to allow animation to play first.
   */
  private finishDeath(): void {
    this.setActive(false);
    this.setVisible(false);
  }
}
