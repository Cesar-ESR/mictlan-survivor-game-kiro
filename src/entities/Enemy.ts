import Phaser from 'phaser';

import type { IEnemy } from '../types/interfaces';
import { DEFAULT_XP_ORB_VARIANT } from '../config/xp-orb-assets';
import type { XPOrbVariant } from '../config/xp-orb-assets';

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

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(0.25);
  }

  abstract update(delta: number, playerPos: { x: number; y: number }): void;

  /**
   * Subclass-specific behavior called every frame.
   * Implementations should move the enemy toward or relative to the player.
   */
  abstract update(delta: number, playerPos: Phaser.Math.Vector2): void;

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
   * Emits 'enemy-defeated' event with position and XP reward,
   * then deactivates and hides the sprite and disables its physics body.
   */
  onDefeat(): void {
    this.scene.events.emit('enemy-defeated', {
      x: this.x,
      y: this.y,
      xpReward: this.xpReward,
      xpOrbVariant: this.xpOrbVariant,
    });
    this.setActive(false);
    this.setVisible(false);

    this.setActive(false);
    this.setVisible(false);

    // Disable physics body
    if (this.body) {
      this.body.enable = false;
    }
  }
}
