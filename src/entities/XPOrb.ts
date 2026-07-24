import Phaser from 'phaser';

/**
 * XP Orb entity that drops from defeated enemies.
 * Attracted toward the player when within range and collected on contact.
 *
 * Requirements: 8.1
 */
export class XPOrb extends Phaser.Physics.Arcade.Sprite {
  value: number;
  creationTime: number;
  isAttracted: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    super(scene, x, y, 'xp_orb');

    this.value = value;
    this.creationTime = Date.now();
    this.isAttracted = false;

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
}
