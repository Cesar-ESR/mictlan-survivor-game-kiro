import Phaser from 'phaser';

import { GAME_CONSTANTS } from '../config/constants';

/**
 * Projectile entity that extends Phaser.Physics.Arcade.Sprite
 * for integration with the physics system and DamageSystem.
 *
 * Projectiles are managed via object pooling in WeaponSystem.
 * They track their distance traveled and are recycled when
 * they exceed the maximum distance (1000px).
 *
 * Requirements: 4.1, 4.6
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number = 0;
  distanceTravelled: number = 0;
  speed: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  /**
   * Activates the projectile at a given position with velocity, damage, and speed.
   * Resets distance traveled and enables physics body.
   */
  activate(fromX: number, fromY: number, vx: number, vy: number, damage: number, speed: number): void {
    this.setPosition(fromX, fromY);
    this.setVelocity(vx, vy);
    this.damage = damage;
    this.speed = speed;
    this.distanceTravelled = 0;
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_PROJECTILES);

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = true;
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

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }
  }
}
