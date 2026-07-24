import Phaser from 'phaser';

/** Global monotonic counter for FIFO ordering without wall-clock dependency */
let orbSequenceCounter = 0;

/**
 * XP Orb entity that drops from defeated enemies.
 * Attracted toward the player when within range and collected on contact.
 * Uses delta-accumulated `age` for expiration and `creationSequence` for FIFO.
 *
 * Requirements: 8.1
 */
export class XPOrb extends Phaser.Physics.Arcade.Sprite {
  value: number;
  /** Monotonically increasing sequence number for deterministic FIFO ordering. */
  creationSequence: number;
  /** Accumulated lifetime in ms, advanced by OrbCollector via delta. */
  age: number;
  isAttracted: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    super(scene, x, y, 'xp_orb');

    this.value = value;
    this.creationSequence = orbSequenceCounter++;
    this.age = 0;
    this.isAttracted = false;

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
}
