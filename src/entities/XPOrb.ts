import Phaser from 'phaser';
import { getXPOrbAsset, DEFAULT_XP_ORB_VARIANT, XP_ORB_FLOAT_CONFIG } from '../config/xp-orb-assets';
import type { XPOrbVariant } from '../config/xp-orb-assets';

import { GAME_CONSTANTS } from '../config/constants';

/** Global monotonic counter for FIFO ordering without wall-clock dependency */
let orbSequenceCounter = 0;

/**
 * XP Orb entity that drops from defeated enemies.
 * Attracted toward the player when within range and collected on contact.
 * Uses delta-accumulated `age` for expiration and `creationSequence` for FIFO.
 *
 * Incluye una animación de flotación sutil (tween vertical) que se inicia
 * automáticamente al crearse y se detiene al destruirse.
 *
 * La variante visual es proporcionada por el sistema que crea el orbe
 * (enemigo, gestor de drops, etc.), no decidida internamente.
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
  /** Variante visual de este orbe. */
  readonly variant: XPOrbVariant;
  /** Tween de flotación vertical. */
  private floatTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number, variant: XPOrbVariant = DEFAULT_XP_ORB_VARIANT) {
    const asset = getXPOrbAsset(variant);
    super(scene, x, y, asset.textureKey);

    this.value = value;
    this.variant = variant;
    this.creationSequence = orbSequenceCounter++;
    this.age = 0;
    this.isAttracted = false;

    scene.add.existing(this);
    scene.physics.add.existing(this);
<<<<<<< HEAD
    this.setDisplaySize(asset.scaleX, asset.scaleY);

    this.startFloatAnimation();
  }

  /**
   * Inicia la animación de flotación vertical usando un tween en loop.
   * El tween modifica únicamente la posición visual (y) sin afectar la física.
   */
  private startFloatAnimation(): void {
    const { amplitude, duration, ease } = XP_ORB_FLOAT_CONFIG;

    this.floatTween = this.scene.tweens.add({
      targets: this,
      y: this.y - amplitude,
      duration,
      ease,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Detiene y limpia el tween de flotación.
   * Se invoca automáticamente al destruir el sprite.
   */
  destroy(fromScene?: boolean): void {
    if (this.floatTween) {
      this.floatTween.destroy();
      this.floatTween = null;
    }
    super.destroy(fromScene);
=======
    this.setDepth(GAME_CONSTANTS.ENTITY_DEPTH_ORBS);
>>>>>>> 500056a97722c8db4697e121636946e990622da1
  }
}
