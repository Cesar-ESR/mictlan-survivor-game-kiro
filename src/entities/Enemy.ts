import Phaser from 'phaser';

export interface IEnemy {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpReward: number;
  update(delta: number, playerPos: { x: number; y: number }): void;
  takeDamage(amount: number): void;
  onDefeat(): void;
}

import type { IEnemy } from '../types/interfaces';

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

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  abstract update(delta: number, playerPos: { x: number; y: number }): void;

  /**
   * Subclass-specific behavior called every frame.
   * Implementations should move the enemy toward or relative to the player.
   */
  abstract update(delta: number, playerPos: Phaser.Math.Vector2): void;

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
